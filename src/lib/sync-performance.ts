import 'server-only';

/**
 * sync-performance.ts
 *
 * Orchestrates performance data syncs for GSC and DataForSEO.
 *
 * Design principles:
 *  - Import path: fast response to user, all data work happens fire-and-forget in background.
 *  - Cron path: chunk-cursor-based to stay within Vercel's 60s (Hobby) / 300s (Pro) limits.
 *    Each cron invocation processes the next N items and persists a cursor in Airtable Config.
 *    On Pro, increase CHUNK_SIZE constants for faster full-cycle throughput.
 *  - Airtable writes: bulk-read → diff → batch-create/update (10 per call) — see airtable.ts.
 *  - DataForSEO: pre-flight dedup check before every API call to avoid wasting credits.
 *
 * Cron jobs (vercel.json):
 *  - /api/cron/sync-gsc        — Monday 04:00 UTC — GSC weekly data per URL chunk
 *  - /api/cron/sync-dataforseo — Monday 04:30 UTC — DataForSEO ranking per keyword chunk
 */

import {
  getConfig,
  getKeywordMap,
  upsertURLPerformance,
  upsertKeywordRankingHistory,
  getExistingRankingDates,
  getSyncCursor,
  setSyncCursor,
} from './airtable';
import {
  getAccessToken,
  querySearchAnalytics,
  aggregateByWeek,
  getDateRange,
} from './google-search-console';
import { fetchKeywordRankings } from './dataforseo';

// ─── Chunk sizes — increase on Vercel Pro ─────────────────────────────────────
/** URLs processed per cron invocation for GSC sync */
const GSC_CHUNK_SIZE = 50;
/** Keywords processed per cron invocation for DataForSEO sync */
const DFS_CHUNK_SIZE = 300;
/** Concurrent GSC queries per batch (controls parallelism) */
const GSC_CONCURRENCY = 10;

// ─── Cursor keys stored in Airtable Config ────────────────────────────────────
const CURSOR_KEY_GSC = 'SYNC_CURSOR_GSC';
const CURSOR_KEY_DFS = 'SYNC_CURSOR_DFS';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  urlsProcessed: number;
  keywordsProcessed: number;
  gscRowsUpserted: number;
  rankingRowsUpserted: number;
  rankingsSkipped: number;
  errors: string[];
  skippedGsc: boolean;
  skippedDataforseo: boolean;
}

export interface ChunkSyncResult extends SyncResult {
  hasMore: boolean;
  nextCursor: number;
  totalItems: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getCurrentWeekMonday(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

function getSyncDateRange(isFirstSync: boolean): { startDate: string; endDate: string } {
  return getDateRange(isFirstSync ? 180 : 7);
}

/** Run async tasks with a max concurrency limit */
async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

// ─── GSC sync ─────────────────────────────────────────────────────────────────

/**
 * Fetches GSC data for the given URLs and bulk-upserts into URL_Performance.
 * Queries run concurrently (up to GSC_CONCURRENCY at a time).
 */
export async function syncGscForUrls(
  urls: string[],
  accessToken: string,
  gscSiteUrl: string,
  isFirstSync: boolean
): Promise<Pick<SyncResult, 'gscRowsUpserted' | 'errors'>> {
  const errors: string[] = [];
  const { startDate, endDate } = getSyncDateRange(isFirstSync);
  const allRows: Parameters<typeof upsertURLPerformance>[0] = [];

  await withConcurrency(urls, GSC_CONCURRENCY, async (url) => {
    try {
      const dailyRows = await querySearchAnalytics(gscSiteUrl, accessToken, {
        startDate,
        endDate,
        dimensions: ['date'],
        pageFilter: url,
      });
      const weeklyRows = aggregateByWeek(dailyRows);
      weeklyRows.forEach(row => {
        allRows.push({
          Target_URL: url,
          Date: row.date,
          GSC_Clicks: row.clicks,
          GSC_Impressions: row.impressions,
          Position: parseFloat(row.position.toFixed(2)),
        });
      });
    } catch (err: any) {
      errors.push(`GSC sync failed for ${url}: ${err.message}`);
    }
  });

  let gscRowsUpserted = 0;
  if (allRows.length > 0) {
    const upsertResult = await upsertURLPerformance(allRows);
    gscRowsUpserted = upsertResult.created + upsertResult.updated;
    if (upsertResult.errors.length > 0) {
      errors.push(`GSC upsert errors: ${upsertResult.errors.slice(0, 3).map(e => e.error).join(', ')}`);
    }
  }

  return { gscRowsUpserted, errors };
}

// ─── DataForSEO sync ──────────────────────────────────────────────────────────

/**
 * Fetches current SERP rankings for the given keywords and bulk-upserts into
 * Keyword_Ranking_History. Skips keywords that already have a record for this week.
 */
export async function syncDataForSeoForKeywords(
  keywords: Awaited<ReturnType<typeof getKeywordMap>>,
  dfsUsername: string,
  dfsPassword: string
): Promise<Pick<SyncResult, 'keywordsProcessed' | 'rankingRowsUpserted' | 'rankingsSkipped' | 'errors'>> {
  const errors: string[] = [];
  const weekDate = getCurrentWeekMonday();

  // Pre-flight: which keywords already have a ranking for this week?
  const allIds = keywords.map(kw => kw.id);
  const alreadyRanked = await getExistingRankingDates(allIds, weekDate);
  const toFetch = keywords.filter(kw => !alreadyRanked.has(kw.id));
  const rankingsSkipped = keywords.length - toFetch.length;

  if (toFetch.length === 0) {
    return { keywordsProcessed: keywords.length, rankingRowsUpserted: 0, rankingsSkipped, errors };
  }

  // Group by URL so we can pass the correct domain to DataForSEO
  const byUrl = new Map<string, typeof toFetch>();
  toFetch.forEach(kw => {
    if (!kw.Target_URL) return;
    if (!byUrl.has(kw.Target_URL)) byUrl.set(kw.Target_URL, []);
    byUrl.get(kw.Target_URL)!.push(kw);
  });

  const allRankingRecords: Parameters<typeof upsertKeywordRankingHistory>[0] = [];

  for (const [url, urlKeywords] of byUrl) {
    try {
      const rankings = await fetchKeywordRankings(
        urlKeywords.map(kw => ({ keywordId: kw.id, keyword: kw.Keyword })),
        url,
        dfsUsername,
        dfsPassword
      );
      rankings
        .filter(r => r.rank !== null)
        .forEach(r => {
          allRankingRecords.push({
            Keyword_ID: [r.keywordId],
            Date: weekDate,
            Ranking: r.rank as number,
          });
        });
    } catch (err: any) {
      errors.push(`DataForSEO failed for ${url}: ${err.message}`);
    }
  }

  let rankingRowsUpserted = 0;
  if (allRankingRecords.length > 0) {
    const upsertResult = await upsertKeywordRankingHistory(allRankingRecords);
    rankingRowsUpserted = upsertResult.created + upsertResult.updated;
    if (upsertResult.errors.length > 0) {
      errors.push(`DFS upsert errors: ${upsertResult.errors.slice(0, 3).map((e: any) => e.error).join(', ')}`);
    }
  }

  return { keywordsProcessed: keywords.length, rankingRowsUpserted, rankingsSkipped, errors };
}

// ─── Chunk-cursor cron functions ──────────────────────────────────────────────

/**
 * Processes the next GSC_CHUNK_SIZE URLs starting from the stored cursor.
 * Resets cursor to 0 when a full cycle is complete.
 * Called by /api/cron/sync-gsc (Vercel Cron, Monday 04:00 UTC).
 */
export async function syncGscChunk(): Promise<ChunkSyncResult> {
  const baseResult: SyncResult = {
    urlsProcessed: 0, keywordsProcessed: 0, gscRowsUpserted: 0,
    rankingRowsUpserted: 0, rankingsSkipped: 0, errors: [], skippedGsc: false, skippedDataforseo: true,
  };

  let config: Record<string, string>;
  try {
    config = await getConfig();
  } catch (err: any) {
    return { ...baseResult, errors: [`Config load failed: ${err.message}`], hasMore: false, nextCursor: 0, totalItems: 0 };
  }

  const gscRefreshToken = config.GSC_REFRESH_TOKEN?.trim();
  const gscSiteUrl = config.GSC_SITE_URL?.trim();

  if (!gscRefreshToken || !gscSiteUrl) {
    return { ...baseResult, skippedGsc: true, errors: ['GSC skipped: GSC_REFRESH_TOKEN or GSC_SITE_URL not configured'], hasMore: false, nextCursor: 0, totalItems: 0 };
  }

  const allKeywords = await getKeywordMap();
  const allUrls = [...new Set(allKeywords.map(kw => kw.Target_URL).filter((u): u is string => Boolean(u)))];
  const totalItems = allUrls.length;

  const cursor = await getSyncCursor(CURSOR_KEY_GSC);
  const chunk = allUrls.slice(cursor, cursor + GSC_CHUNK_SIZE);

  if (chunk.length === 0) {
    await setSyncCursor(CURSOR_KEY_GSC, 0);
    return { ...baseResult, hasMore: false, nextCursor: 0, totalItems };
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(gscRefreshToken);
  } catch (err: any) {
    return { ...baseResult, skippedGsc: true, errors: [`GSC token refresh failed: ${err.message}`], hasMore: false, nextCursor: cursor, totalItems };
  }

  const { gscRowsUpserted, errors } = await syncGscForUrls(chunk, accessToken, gscSiteUrl, false);

  const nextCursor = cursor + chunk.length;
  const hasMore = nextCursor < totalItems;
  await setSyncCursor(CURSOR_KEY_GSC, hasMore ? nextCursor : 0);

  return {
    ...baseResult,
    urlsProcessed: chunk.length,
    gscRowsUpserted,
    errors,
    hasMore,
    nextCursor: hasMore ? nextCursor : 0,
    totalItems,
  };
}

/**
 * Processes the next DFS_CHUNK_SIZE keywords starting from the stored cursor.
 * Includes pre-flight dedup to skip already-ranked keywords for this week.
 * Called by /api/cron/sync-dataforseo (Vercel Cron, Monday 04:30 UTC).
 */
export async function syncDataForSeoChunk(): Promise<ChunkSyncResult> {
  const baseResult: SyncResult = {
    urlsProcessed: 0, keywordsProcessed: 0, gscRowsUpserted: 0,
    rankingRowsUpserted: 0, rankingsSkipped: 0, errors: [], skippedGsc: true, skippedDataforseo: false,
  };

  let config: Record<string, string>;
  try {
    config = await getConfig();
  } catch (err: any) {
    return { ...baseResult, errors: [`Config load failed: ${err.message}`], hasMore: false, nextCursor: 0, totalItems: 0 };
  }

  const dfsUsername = config.DATAFORSEO_USERNAME?.trim();
  const dfsPassword = config.DATAFORSEO_PASSWORD?.trim();

  if (!dfsUsername || !dfsPassword) {
    return { ...baseResult, skippedDataforseo: true, errors: ['DataForSEO skipped: credentials not configured'], hasMore: false, nextCursor: 0, totalItems: 0 };
  }

  const allKeywords = await getKeywordMap();
  const totalItems = allKeywords.length;

  const cursor = await getSyncCursor(CURSOR_KEY_DFS);
  const chunk = allKeywords.slice(cursor, cursor + DFS_CHUNK_SIZE);

  if (chunk.length === 0) {
    await setSyncCursor(CURSOR_KEY_DFS, 0);
    return { ...baseResult, hasMore: false, nextCursor: 0, totalItems };
  }

  const { keywordsProcessed, rankingRowsUpserted, rankingsSkipped, errors } =
    await syncDataForSeoForKeywords(chunk, dfsUsername, dfsPassword);

  const nextCursor = cursor + chunk.length;
  const hasMore = nextCursor < totalItems;
  await setSyncCursor(CURSOR_KEY_DFS, hasMore ? nextCursor : 0);

  return {
    ...baseResult,
    keywordsProcessed,
    rankingRowsUpserted,
    rankingsSkipped,
    errors,
    hasMore,
    nextCursor: hasMore ? nextCursor : 0,
    totalItems,
  };
}

// ─── Combined import path ─────────────────────────────────────────────────────

/**
 * Full sync for a specific set of URLs (used on import — fire & forget).
 * Always treats the URLs as first-sync (180-day GSC window).
 * Also syncs keywords belonging to those URLs via DataForSEO (with dedup check).
 */
export async function syncPerformanceForUrls(targetUrls: string[]): Promise<SyncResult> {
  const result: SyncResult = {
    urlsProcessed: 0, keywordsProcessed: 0, gscRowsUpserted: 0,
    rankingRowsUpserted: 0, rankingsSkipped: 0, errors: [], skippedGsc: false, skippedDataforseo: false,
  };

  if (!targetUrls.length) return result;

  let config: Record<string, string>;
  try {
    config = await getConfig();
  } catch (err: any) {
    result.errors.push(`Config load failed: ${err.message}`);
    return result;
  }

  const gscRefreshToken = config.GSC_REFRESH_TOKEN?.trim();
  const gscSiteUrl = config.GSC_SITE_URL?.trim();
  const dfsUsername = config.DATAFORSEO_USERNAME?.trim();
  const dfsPassword = config.DATAFORSEO_PASSWORD?.trim();

  const hasGsc = !!(gscRefreshToken && gscSiteUrl);
  const hasDfs = !!(dfsUsername && dfsPassword);

  result.skippedGsc = !hasGsc;
  result.skippedDataforseo = !hasDfs;
  result.urlsProcessed = targetUrls.length;

  if (!hasGsc) result.errors.push('GSC skipped: GSC_REFRESH_TOKEN or GSC_SITE_URL not configured');
  if (!hasDfs) result.errors.push('DataForSEO skipped: DATAFORSEO_USERNAME or DATAFORSEO_PASSWORD not configured');

  // ── GSC: 180-day initial sync for these URLs ──────────────────────────────
  if (hasGsc) {
    try {
      const accessToken = await getAccessToken(gscRefreshToken!);
      const { gscRowsUpserted, errors } = await syncGscForUrls(targetUrls, accessToken, gscSiteUrl!, true);
      result.gscRowsUpserted = gscRowsUpserted;
      result.errors.push(...errors);
    } catch (err: any) {
      result.errors.push(`GSC token refresh failed: ${err.message}`);
    }
  }

  // ── DataForSEO: current-week rankings for keywords of these URLs ──────────
  if (hasDfs) {
    try {
      const allKeywords = await getKeywordMap();
      const urlKeywords = allKeywords.filter(
        kw => kw.Target_URL && targetUrls.includes(kw.Target_URL)
      );
      if (urlKeywords.length > 0) {
        const { keywordsProcessed, rankingRowsUpserted, rankingsSkipped, errors } =
          await syncDataForSeoForKeywords(urlKeywords, dfsUsername!, dfsPassword!);
        result.keywordsProcessed = keywordsProcessed;
        result.rankingRowsUpserted = rankingRowsUpserted;
        result.rankingsSkipped = rankingsSkipped;
        result.errors.push(...errors);
      }
    } catch (err: any) {
      result.errors.push(`DataForSEO sync failed: ${err.message}`);
    }
  }

  return result;
}

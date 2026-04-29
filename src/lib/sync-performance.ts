import 'server-only';

/**
 * sync-performance.ts
 *
 * Orchestrates weekly performance data syncs:
 *  1. Google Search Console  → URL_Performance (clicks, impressions, avg. position)
 *  2. DataForSEO SERP        → Keyword_Ranking_History (ranking per keyword)
 *
 * Called by:
 *  - /api/cron/sync-performance  (Vercel Cron, every Monday 04:00 UTC)
 *  - /api/planning/import        (fire & forget, after a URL import)
 */

import { getConfig, getKeywordMap, upsertURLPerformance, upsertKeywordRankingHistory } from './airtable';
import {
  getAccessToken,
  querySearchAnalytics,
  aggregateByWeek,
  getDateRange,
} from './google-search-console';
import { fetchKeywordRankings } from './dataforseo';

export interface SyncResult {
  urlsProcessed: number;
  keywordsProcessed: number;
  gscRowsUpserted: number;
  rankingRowsUpserted: number;
  errors: string[];
  skippedGsc: boolean;
  skippedDataforseo: boolean;
}

// ─── Date range logic ─────────────────────────────────────────────────────────

/**
 * Determines the date range to fetch from GSC.
 * - First sync (no existing data): last 180 days (≈6 months), weekly aggregated
 * - Regular sync: last 7 days (one week bucket)
 */
function getSyncDateRange(isFirstSync: boolean): { startDate: string; endDate: string } {
  return getDateRange(isFirstSync ? 180 : 7);
}

// ─── Main sync function ───────────────────────────────────────────────────────

/**
 * Syncs performance data for the given target URLs (or all known URLs if none given).
 */
export async function syncPerformanceForUrls(
  targetUrls?: string[]
): Promise<SyncResult> {
  const result: SyncResult = {
    urlsProcessed: 0,
    keywordsProcessed: 0,
    gscRowsUpserted: 0,
    rankingRowsUpserted: 0,
    errors: [],
    skippedGsc: false,
    skippedDataforseo: false,
  };

  // ── Load config ──────────────────────────────────────────────────────────────
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

  if (!hasGsc) {
    result.skippedGsc = true;
    result.errors.push('GSC skipped: GSC_REFRESH_TOKEN or GSC_SITE_URL not configured');
  }

  if (!hasDfs) {
    result.skippedDataforseo = true;
    result.errors.push('DataForSEO skipped: DATAFORSEO_USERNAME or DATAFORSEO_PASSWORD not configured');
  }

  if (!hasGsc && !hasDfs) return result;

  // ── Load keywords ────────────────────────────────────────────────────────────
  let allKeywords: Awaited<ReturnType<typeof getKeywordMap>>;
  try {
    allKeywords = await getKeywordMap();
  } catch (err: any) {
    result.errors.push(`Keyword load failed: ${err.message}`);
    return result;
  }

  // Determine which URLs to sync
  const urlsToSync: string[] = (
    targetUrls && targetUrls.length > 0
      ? targetUrls
      : [...new Set(allKeywords.map((kw) => kw.Target_URL).filter((u): u is string => Boolean(u)))]
  );

  result.urlsProcessed = urlsToSync.length;

  // ── GSC sync ─────────────────────────────────────────────────────────────────
  if (hasGsc) {
    let accessToken: string;
    try {
      accessToken = await getAccessToken(gscRefreshToken!);
    } catch (err: any) {
      result.errors.push(`GSC token refresh failed: ${err.message}`);
      result.skippedGsc = true;
      accessToken = '';
    }

    if (accessToken) {
      // Determine if this is a first sync based on whether we have any URL_Performance data.
      // We use a heuristic: if caller provided specific targetUrls (import flow) → treat as first sync
      const isFirstSync = !!(targetUrls && targetUrls.length > 0);
      const { startDate, endDate } = getSyncDateRange(isFirstSync);

      for (const url of urlsToSync) {
        try {
          const dailyRows = await querySearchAnalytics(gscSiteUrl!, accessToken, {
            startDate,
            endDate,
            dimensions: ['date'],
            pageFilter: url,
          });

          const weeklyRows = aggregateByWeek(dailyRows);

          if (weeklyRows.length > 0) {
            const upsertData = weeklyRows.map((row) => ({
              Target_URL: url,
              Date: row.date,
              GSC_Clicks: row.clicks,
              GSC_Impressions: row.impressions,
              Position: parseFloat(row.position.toFixed(2)),
            }));

            const upsertResult = await upsertURLPerformance(upsertData);
            result.gscRowsUpserted += upsertResult.created + upsertResult.updated;

            if (upsertResult.errors.length > 0) {
              result.errors.push(
                `GSC upsert errors for ${url}: ${upsertResult.errors.slice(0, 3).join(', ')}`
              );
            }
          }
        } catch (err: any) {
          result.errors.push(`GSC sync failed for ${url}: ${err.message}`);
        }
      }
    }
  }

  // ── DataForSEO rankings sync ──────────────────────────────────────────────────
  if (hasDfs) {
    // Current week's Monday as the date key
    const weekDate = getCurrentWeekMonday();

    for (const url of urlsToSync) {
      const urlKeywords = allKeywords.filter((kw) => kw.Target_URL === url);
      if (!urlKeywords.length) continue;

      result.keywordsProcessed += urlKeywords.length;

      try {
        const rankings = await fetchKeywordRankings(
          urlKeywords.map((kw) => ({ keywordId: kw.id, keyword: kw.Keyword })),
          url,
          dfsUsername!,
          dfsPassword!
        );

        const rankingRecords = rankings
          .filter((r) => r.rank !== null)
          .map((r) => ({
            Keyword_ID: [r.keywordId],
            Date: weekDate,
            Ranking: r.rank as number,
          }));

        if (rankingRecords.length > 0) {
          const upsertResult = await upsertKeywordRankingHistory(rankingRecords);
          result.rankingRowsUpserted += upsertResult.created + upsertResult.updated;

          if (upsertResult.errors.length > 0) {
            result.errors.push(
              `DFS ranking upsert errors for ${url}: ${upsertResult.errors.slice(0, 3).join(', ')}`
            );
          }
        }
      } catch (err: any) {
        result.errors.push(`DataForSEO sync failed for ${url}: ${err.message}`);
      }
    }
  }

  return result;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getCurrentWeekMonday(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

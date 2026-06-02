/**
 * sync-jobs.ts
 *
 * DB-backed background job queue for manual data syncs.
 * Uses fire-and-forget pattern — safe on a persistent Node.js server (Coolify/Hetzner).
 * No Redis, no BullMQ, no PM2 required.
 *
 * Retry policy: up to 2 retries, then status = 'failed'.
 */

import { eq, and, inArray } from 'drizzle-orm';
import { db, getDefaultTenantId } from '@/lib/db';
import { syncJobs } from '@/lib/db/schema';
import { getConfig, getKeywordMap } from '@/lib/postgres';
import {
  syncGscForUrls,
  syncSistrixForUrls,
  syncDataForSeoForKeywords,
} from '@/lib/sync-performance';
import { getAccessToken } from '@/lib/google-search-console';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncJobPayload {
  urls: string[];
  mode: 'week' | '6months';
  sources: Array<'gsc' | 'dataforseo' | 'sistrix'>;
}

export interface SyncJobResult {
  urlsProcessed: number;
  keywordsProcessed: number;
  gscRowsUpserted: number;
  sistrixRowsUpserted: number;
  rankingRowsUpserted: number;
  rankingsSkipped: number;
  errors: string[];
  skippedGsc: boolean;
  skippedSistrix: boolean;
  skippedDataforseo: boolean;
  completedAt: string;
}

export type SyncJobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface SyncJob {
  id: number;
  tenantId: string;
  status: SyncJobStatus;
  retryCount: number;
  payload: SyncJobPayload;
  result: SyncJobResult | null;
  error: string | null;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

const MAX_RETRIES = 2;

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function mapRow(row: typeof syncJobs.$inferSelect): SyncJob {
  return {
    id: row.id,
    tenantId: row.tenantId,
    status: row.status as SyncJobStatus,
    retryCount: row.retryCount,
    payload: row.payload as SyncJobPayload,
    result: (row.result as SyncJobResult) ?? null,
    error: row.error ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

/**
 * Create a new job or return an existing active one (prevents duplicate syncs).
 */
export async function createSyncJob(
  tenantId: string,
  payload: SyncJobPayload
): Promise<SyncJob> {
  // Dedup guard: return existing active job for this tenant
  const [existing] = await db
    .select()
    .from(syncJobs)
    .where(
      and(
        eq(syncJobs.tenantId, tenantId),
        inArray(syncJobs.status, ['pending', 'running'])
      )
    )
    .orderBy(syncJobs.createdAt)
    .limit(1);

  if (existing) return mapRow(existing);

  const [job] = await db
    .insert(syncJobs)
    .values({
      tenantId,
      status: 'pending',
      retryCount: 0,
      payload: payload as any,
    })
    .returning();

  return mapRow(job);
}

/**
 * Read a single job (tenant-scoped).
 */
export async function getSyncJob(
  jobId: number,
  tenantId: string
): Promise<SyncJob | null> {
  const [row] = await db
    .select()
    .from(syncJobs)
    .where(and(eq(syncJobs.id, jobId), eq(syncJobs.tenantId, tenantId)))
    .limit(1);

  return row ? mapRow(row) : null;
}

/**
 * Return the most recent active (pending/running) job for a tenant — used by
 * the UI on mount to resume tracking a job that was started in a previous session.
 */
export async function getActiveSyncJob(tenantId: string): Promise<SyncJob | null> {
  const [row] = await db
    .select()
    .from(syncJobs)
    .where(
      and(
        eq(syncJobs.tenantId, tenantId),
        inArray(syncJobs.status, ['pending', 'running'])
      )
    )
    .orderBy(syncJobs.createdAt)
    .limit(1);

  return row ? mapRow(row) : null;
}

// ---------------------------------------------------------------------------
// Core executor
// ---------------------------------------------------------------------------

/**
 * Execute a sync job in the background (fire-and-forget).
 * Safe on a persistent Node.js server — the async chain continues after the
 * HTTP response has been sent. Do NOT await this from a route handler.
 */
export function fireSyncJob(jobId: number, tenantId: string): void {
  // Intentionally not awaited
  runSyncJob(jobId, tenantId).catch((err) => {
    console.error(`[sync-jobs] Unhandled error in runSyncJob(${jobId}):`, err);
  });
}

async function runSyncJob(jobId: number, tenantId: string): Promise<void> {
  // Mark as running
  await db
    .update(syncJobs)
    .set({ status: 'running', startedAt: new Date() })
    .where(and(eq(syncJobs.id, jobId), eq(syncJobs.tenantId, tenantId)));

  // Load job to get payload + retryCount
  const [jobRow] = await db
    .select()
    .from(syncJobs)
    .where(and(eq(syncJobs.id, jobId), eq(syncJobs.tenantId, tenantId)))
    .limit(1);

  if (!jobRow) {
    console.error(`[sync-jobs] Job ${jobId} not found after marking running`);
    return;
  }

  const { urls, mode, sources } = jobRow.payload as SyncJobPayload;
  const isFirstSync = mode === '6months';

  const result: SyncJobResult = {
    urlsProcessed: urls.length,
    keywordsProcessed: 0,
    gscRowsUpserted: 0,
    sistrixRowsUpserted: 0,
    rankingRowsUpserted: 0,
    rankingsSkipped: 0,
    errors: [],
    skippedGsc: !sources.includes('gsc'),
    skippedSistrix: !sources.includes('sistrix'),
    skippedDataforseo: !sources.includes('dataforseo'),
    completedAt: '',
  };

  try {
    const config = await getConfig(tenantId);

    // ── GSC ─────────────────────────────────────────────────────────────────
    if (sources.includes('gsc')) {
      const gscRefreshToken = config.GSC_REFRESH_TOKEN?.trim();
      const gscSiteUrl = config.GSC_SITE_URL?.trim();

      if (!gscRefreshToken || !gscSiteUrl) {
        result.errors.push('GSC übersprungen: GSC_REFRESH_TOKEN oder GSC_SITE_URL nicht konfiguriert.');
        result.skippedGsc = true;
      } else {
        try {
          const accessToken = await getAccessToken(gscRefreshToken);
          const { gscRowsUpserted, errors } = await syncGscForUrls(urls, accessToken, gscSiteUrl, isFirstSync, tenantId);
          result.gscRowsUpserted = gscRowsUpserted;
          result.errors.push(...errors);
        } catch (err: any) {
          result.errors.push(`GSC Fehler: ${err.message}`);
          result.skippedGsc = true;
        }
      }
    }

    // ── Sistrix ──────────────────────────────────────────────────────────────
    if (sources.includes('sistrix')) {
      const sistrixApiKey = config.SISTRIX_API_KEY?.trim();

      if (!sistrixApiKey) {
        result.errors.push('Sistrix übersprungen: SISTRIX_API_KEY nicht konfiguriert.');
        result.skippedSistrix = true;
      } else {
        try {
          const { sistrixRowsUpserted, errors } = await syncSistrixForUrls(urls, sistrixApiKey, isFirstSync, tenantId);
          result.sistrixRowsUpserted = sistrixRowsUpserted;
          result.errors.push(...errors);
        } catch (err: any) {
          result.errors.push(`Sistrix Fehler: ${err.message}`);
          result.skippedSistrix = true;
        }
      }
    }

    // ── DataForSEO ───────────────────────────────────────────────────────────
    if (sources.includes('dataforseo')) {
      const dfsUsername = config.DATAFORSEO_USERNAME?.trim();
      const dfsPassword = config.DATAFORSEO_PASSWORD?.trim();
      const tenantDomain = config.TENANT_DOMAIN?.trim();

      if (!dfsUsername || !dfsPassword) {
        result.errors.push('DataForSEO übersprungen: Zugangsdaten nicht konfiguriert.');
        result.skippedDataforseo = true;
      } else {
        try {
          const allKeywords = await getKeywordMap(tenantId);
          const urlKeywords = allKeywords.filter(
            (kw) => kw.Target_URL && urls.includes(kw.Target_URL)
          );

          if (urlKeywords.length > 0) {
            const { keywordsProcessed, rankingRowsUpserted, rankingsSkipped, errors } =
              await syncDataForSeoForKeywords(urlKeywords, dfsUsername, dfsPassword, true, tenantId, tenantDomain);
            result.keywordsProcessed = keywordsProcessed;
            result.rankingRowsUpserted = rankingRowsUpserted;
            result.rankingsSkipped = rankingsSkipped;
            result.errors.push(...errors);
          }
        } catch (err: any) {
          result.errors.push(`DataForSEO Fehler: ${err.message}`);
          result.skippedDataforseo = true;
        }
      }
    }

    result.completedAt = new Date().toISOString();

    // Mark done
    await db
      .update(syncJobs)
      .set({ status: 'done', result: result as any, completedAt: new Date() })
      .where(eq(syncJobs.id, jobId));

  } catch (err: any) {
    console.error(`[sync-jobs] Job ${jobId} failed (retry ${jobRow.retryCount}):`, err);

    const nextRetryCount = jobRow.retryCount + 1;

    if (nextRetryCount <= MAX_RETRIES) {
      // Reset to pending — the status route will re-trigger on next poll
      await db
        .update(syncJobs)
        .set({
          status: 'pending',
          retryCount: nextRetryCount,
          error: `Versuch ${nextRetryCount}/${MAX_RETRIES}: ${err.message}`,
        })
        .where(eq(syncJobs.id, jobId));
    } else {
      await db
        .update(syncJobs)
        .set({
          status: 'failed',
          retryCount: nextRetryCount,
          error: err.message,
          completedAt: new Date(),
        })
        .where(eq(syncJobs.id, jobId));
    }
  }
}

/**
 * Called by the status route when it detects a job in 'pending' state with
 * retryCount > 0. Re-fires the job without the client needing to do anything.
 */
export function retryIfPending(job: SyncJob): void {
  if (job.status === 'pending' && job.retryCount > 0) {
    fireSyncJob(job.id, job.tenantId);
  }
}

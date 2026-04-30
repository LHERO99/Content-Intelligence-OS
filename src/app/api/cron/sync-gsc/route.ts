import { NextRequest, NextResponse } from 'next/server';
import { syncGscChunk } from '@/lib/sync-performance';
import { createAuditLog } from '@/lib/airtable';

/**
 * GET /api/cron/sync-gsc
 *
 * Vercel Cron endpoint — runs every Monday at 04:00 UTC.
 * Processes the next GSC_CHUNK_SIZE URLs from the cursor stored in Airtable Config.
 * On a full cycle completion the cursor resets to 0 automatically.
 *
 * Chunk size (default 50 URLs):
 *   - Vercel Hobby (60s limit): handles ~50 URLs comfortably
 *   - Vercel Pro  (300s limit): increase GSC_CHUNK_SIZE in sync-performance.ts to ~250
 *
 * Auth: Vercel sets `Authorization: Bearer <CRON_SECRET>` automatically on cron invocations.
 * For manual triggers from the admin panel, send the same header.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[Cron] sync-gsc started at', new Date().toISOString());

  try {
    const result = await syncGscChunk();

    console.log('[Cron] sync-gsc completed:', {
      urlsProcessed: result.urlsProcessed,
      gscRowsUpserted: result.gscRowsUpserted,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
      totalItems: result.totalItems,
      errors: result.errors.length,
    });

    // Write AuditLog entries for health monitoring
    await Promise.all([
      createAuditLog(
        result.errors.some(e => e.toLowerCase().includes('gsc'))
          ? `cron:sync-gsc:error`
          : `cron:sync-gsc:success`,
        {
          urlsProcessed: result.urlsProcessed,
          gscRowsUpserted: result.gscRowsUpserted,
          hasMore: result.hasMore,
          errors: result.errors.filter(e => e.toLowerCase().includes('gsc')),
        }
      ),
      createAuditLog(
        result.skippedSistrix
          ? `cron:sync-sistrix:skipped`
          : result.errors.some(e => e.toLowerCase().includes('sistrix'))
          ? `cron:sync-sistrix:error`
          : `cron:sync-sistrix:success`,
        {
          urlsProcessed: result.skippedSistrix ? 0 : result.urlsProcessed,
          sistrixRowsUpserted: result.sistrixRowsUpserted ?? 0,
          skipped: result.skippedSistrix ?? false,
          errors: result.errors.filter(e => e.toLowerCase().includes('sistrix')),
        }
      ),
    ]);

    return NextResponse.json({
      success: true,
      completedAt: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    console.error('[Cron] sync-gsc failed:', err);
    await Promise.all([
      createAuditLog(`cron:sync-gsc:error`, { error: err.message ?? 'Unknown error' }),
      createAuditLog(`cron:sync-sistrix:error`, { error: 'GSC cron fehlgeschlagen — Sistrix nicht ausgeführt' }),
    ]);
    return NextResponse.json(
      { success: false, error: err.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { syncGscChunk, syncDataForSeoChunk } from '@/lib/sync-performance';

/**
 * GET /api/cron/sync-performance
 *
 * Vercel Cron endpoint — runs every Monday at 04:00 UTC.
 * Configured in vercel.json:
 *   { "crons": [{ "path": "/api/cron/sync-performance", "schedule": "0 4 * * 1" }] }
 *
 * Auth: Vercel automatically sets `Authorization: Bearer <CRON_SECRET>` on cron invocations.
 * For manual triggers (e.g. from the admin UI), send the same header.
 *
 * Syncs ALL known URLs via chunk-based sync (GSC + DataForSEO).
 */
export async function GET(req: NextRequest) {
  // Verify Vercel Cron secret or manual trigger secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[Cron] sync-performance started at', new Date().toISOString());

  try {
    const [gscResult, dfsResult] = await Promise.all([
      syncGscChunk(),
      syncDataForSeoChunk(),
    ]);

    const result = {
      urlsProcessed: gscResult.urlsProcessed + dfsResult.urlsProcessed,
      keywordsProcessed: dfsResult.keywordsProcessed,
      gscRowsUpserted: gscResult.gscRowsUpserted,
      sistrixRowsUpserted: gscResult.sistrixRowsUpserted,
      rankingRowsUpserted: dfsResult.rankingRowsUpserted,
      rankingsSkipped: dfsResult.rankingsSkipped,
      errors: [...gscResult.errors, ...dfsResult.errors],
      gscHasMore: gscResult.hasMore,
      dfsHasMore: dfsResult.hasMore,
    };

    console.log('[Cron] sync-performance completed:', result);

    return NextResponse.json({
      success: true,
      completedAt: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    console.error('[Cron] sync-performance failed:', err);
    return NextResponse.json(
      { success: false, error: err.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { syncDataForSeoChunk } from '@/lib/sync-performance';

/**
 * GET /api/cron/sync-dataforseo
 *
 * Vercel Cron endpoint — runs every Monday at 04:30 UTC (30 min after sync-gsc).
 * Processes the next DFS_CHUNK_SIZE keywords from the cursor stored in Airtable Config.
 * Includes a pre-flight dedup check: keywords that already have a ranking record for
 * the current week are skipped without calling the DataForSEO API (saves credits).
 *
 * Chunk size (default 300 keywords):
 *   - Vercel Hobby (60s limit): 300 keywords ≈ 3 DataForSEO batches + Airtable writes
 *   - Vercel Pro  (300s limit): increase DFS_CHUNK_SIZE in sync-performance.ts to ~1500
 *
 * Auth: Vercel sets `Authorization: Bearer <CRON_SECRET>` automatically on cron invocations.
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

  console.log('[Cron] sync-dataforseo started at', new Date().toISOString());

  try {
    const result = await syncDataForSeoChunk();

    console.log('[Cron] sync-dataforseo completed:', {
      keywordsProcessed: result.keywordsProcessed,
      rankingRowsUpserted: result.rankingRowsUpserted,
      rankingsSkipped: result.rankingsSkipped,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
      totalItems: result.totalItems,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: true,
      completedAt: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    console.error('[Cron] sync-dataforseo failed:', err);
    return NextResponse.json(
      { success: false, error: err.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}

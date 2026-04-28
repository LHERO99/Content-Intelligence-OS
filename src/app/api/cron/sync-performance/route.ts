import { NextRequest, NextResponse } from 'next/server';
import { syncPerformanceForUrls } from '@/lib/sync-performance';

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
 * Syncs ALL known URLs (no targetUrls filter → regular weekly sync mode).
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
    // Pass no targetUrls → sync all known URLs in regular (7-day) mode
    const result = await syncPerformanceForUrls();

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

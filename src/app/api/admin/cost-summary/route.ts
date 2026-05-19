import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { urls } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { recomputeUrlCostSummary } from '@/lib/postgres';

/**
 * POST /api/admin/cost-summary/backfill
 *
 * One-time backfill: recomputes url_cost_summary for every URL of the
 * current tenant that has at least one delivery event.
 * Safe to run multiple times (upserts, never duplicates).
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = session.user?.tenantId;

  try {
    // Fetch all URL IDs for this tenant
    const allUrls = await db
      .select({ id: urls.id })
      .from(urls)
      .where(eq(urls.tenantId, tenantId!));

    let processed = 0;
    let failed = 0;

    // Recompute sequentially to avoid DB connection exhaustion on large datasets
    for (const { id: urlId } of allUrls) {
      try {
        await recomputeUrlCostSummary(urlId, tenantId);
        processed++;
      } catch (err) {
        console.error(`[CostSummaryBackfill] Failed for urlId=${urlId}:`, err);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: allUrls.length,
    });
  } catch (error: any) {
    console.error('[CostSummaryBackfill] Unhandled error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

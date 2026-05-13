import { NextRequest, NextResponse } from 'next/server';
import { syncGscChunk, syncDataForSeoChunk } from '@/lib/sync-performance';
import { getAllTenants } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[Cron] sync-performance started at', new Date().toISOString());

  const tenants = await getAllTenants();
  const allResults: Array<{ tenantId: string; result: any; error?: string }> = [];

  for (const tenant of tenants) {
    try {
      const [gscResult, dfsResult] = await Promise.all([
        syncGscChunk(tenant.id),
        syncDataForSeoChunk(tenant.id),
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

      console.log(`[Cron] sync-performance tenant=${tenant.id}:`, result);
      allResults.push({ tenantId: tenant.id, result });
    } catch (err: any) {
      console.error(`[Cron] sync-performance tenant=${tenant.id} failed:`, err);
      allResults.push({ tenantId: tenant.id, result: null, error: err.message });
    }
  }

  return NextResponse.json({
    success: true,
    completedAt: new Date().toISOString(),
    tenants: allResults,
  });
}

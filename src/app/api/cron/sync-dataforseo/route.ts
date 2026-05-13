import { NextRequest, NextResponse } from 'next/server';
import { syncDataForSeoChunk } from '@/lib/sync-performance';
import { getAllTenants } from '@/lib/postgres';

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

  const tenants = await getAllTenants();
  const allResults: Array<{ tenantId: string; result: any; error?: string }> = [];

  for (const tenant of tenants) {
    try {
      const result = await syncDataForSeoChunk(tenant.id);

      console.log(`[Cron] sync-dataforseo tenant=${tenant.id}:`, {
        keywordsProcessed: result.keywordsProcessed,
        rankingRowsUpserted: result.rankingRowsUpserted,
        rankingsSkipped: result.rankingsSkipped,
        hasMore: result.hasMore,
        errors: result.errors.length,
      });

      allResults.push({ tenantId: tenant.id, result });
    } catch (err: any) {
      console.error(`[Cron] sync-dataforseo tenant=${tenant.id} failed:`, err);
      allResults.push({ tenantId: tenant.id, result: null, error: err.message });
    }
  }

  return NextResponse.json({
    success: true,
    completedAt: new Date().toISOString(),
    tenants: allResults,
  });
}

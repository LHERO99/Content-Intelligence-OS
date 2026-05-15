import { NextRequest, NextResponse } from 'next/server';
import { syncDataForSeoChunk } from '@/lib/sync-performance';
import { getAllTenants, createAuditLog } from '@/lib/postgres';
import { notifySuperAdminDigest } from '@/lib/alerts/superadmin-notifications';
import type { CronErrorEntry } from '@/lib/email/templates/superadmin-alert';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Cron endpoint not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] sync-dataforseo started at', new Date().toISOString());

  const tenants = await getAllTenants();
  const allResults: Array<{ tenantId: string; result: any; error?: string }> = [];
  const cronErrors: CronErrorEntry[] = [];

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

      const hasError = result.errors.length > 0;
      await createAuditLog(
        hasError ? 'cron:sync-dataforseo:error' : 'cron:sync-dataforseo:success',
        {
          keywordsProcessed: result.keywordsProcessed,
          rankingRowsUpserted: result.rankingRowsUpserted,
          rankingsSkipped: result.rankingsSkipped,
          hasMore: result.hasMore,
          errors: result.errors,
        },
        tenant.id
      );

      if (hasError) {
        cronErrors.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          cronJob: 'sync-dataforseo',
          error: result.errors.join('; '),
        });
      }

      allResults.push({ tenantId: tenant.id, result });
    } catch (err: any) {
      const errMsg = err.message ?? 'Unbekannter Fehler';
      console.error(`[Cron] sync-dataforseo tenant=${tenant.id} failed:`, err);
      await createAuditLog('cron:sync-dataforseo:error', { error: errMsg }, tenant.id);
      cronErrors.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        cronJob: 'sync-dataforseo',
        error: errMsg,
      });
      allResults.push({ tenantId: tenant.id, result: null, error: errMsg });
    }
  }

  // SuperAdmin digest – fire & forget
  if (cronErrors.length > 0) {
    notifySuperAdminDigest(cronErrors).catch(e =>
      console.error('[Cron] SuperAdmin digest failed:', e)
    );
  }

  return NextResponse.json({
    success: true,
    completedAt: new Date().toISOString(),
    tenants: allResults,
  });
}

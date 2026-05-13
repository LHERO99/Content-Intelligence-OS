import { NextRequest, NextResponse } from 'next/server';
import { syncGscChunk } from '@/lib/sync-performance';
import { createAuditLog, getAllTenants } from '@/lib/postgres';

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

  const tenants = await getAllTenants();
  const allResults: Array<{ tenantId: string; result: any; error?: string }> = [];

  for (const tenant of tenants) {
    try {
      const result = await syncGscChunk(tenant.id);

      console.log(`[Cron] sync-gsc tenant=${tenant.id}:`, {
        urlsProcessed: result.urlsProcessed,
        gscRowsUpserted: result.gscRowsUpserted,
        hasMore: result.hasMore,
        errors: result.errors.length,
      });

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
          },
          tenant.id
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
          },
          tenant.id
        ),
      ]);

      allResults.push({ tenantId: tenant.id, result });
    } catch (err: any) {
      console.error(`[Cron] sync-gsc tenant=${tenant.id} failed:`, err);
      await Promise.all([
        createAuditLog(`cron:sync-gsc:error`, { error: err.message ?? 'Unknown error' }, tenant.id),
        createAuditLog(`cron:sync-sistrix:error`, { error: 'GSC cron fehlgeschlagen' }, tenant.id),
      ]);
      allResults.push({ tenantId: tenant.id, result: null, error: err.message });
    }
  }

  return NextResponse.json({
    success: true,
    completedAt: new Date().toISOString(),
    tenants: allResults,
  });
}

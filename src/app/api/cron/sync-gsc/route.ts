import { NextRequest, NextResponse } from 'next/server';
import { syncGscChunk } from '@/lib/sync-performance';
import { createAuditLog, getAllTenants } from '@/lib/postgres';
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

  console.log('[Cron] sync-gsc started at', new Date().toISOString());

  const tenants = await getAllTenants();
  const allResults: Array<{ tenantId: string; result: any; error?: string }> = [];
  const cronErrors: CronErrorEntry[] = [];

  for (const tenant of tenants) {
    try {
      const result = await syncGscChunk(tenant.id);

      console.log(`[Cron] sync-gsc tenant=${tenant.id}:`, {
        urlsProcessed: result.urlsProcessed,
        gscRowsUpserted: result.gscRowsUpserted,
        hasMore: result.hasMore,
        errors: result.errors.length,
      });

      const gscErrors = result.errors.filter(e => e.toLowerCase().includes('gsc'));
      const sistrixErrors = result.errors.filter(e => e.toLowerCase().includes('sistrix'));

      await Promise.all([
        createAuditLog(
          gscErrors.length > 0 ? `cron:sync-gsc:error` : `cron:sync-gsc:success`,
          {
            urlsProcessed: result.urlsProcessed,
            gscRowsUpserted: result.gscRowsUpserted,
            hasMore: result.hasMore,
            errors: gscErrors,
          },
          tenant.id
        ),
        createAuditLog(
          result.skippedSistrix
            ? `cron:sync-sistrix:skipped`
            : sistrixErrors.length > 0
            ? `cron:sync-sistrix:error`
            : result.urlsProcessed === 0
            ? `cron:sync-sistrix:no_urls`
            : `cron:sync-sistrix:success`,
          {
            urlsProcessed: result.skippedSistrix ? 0 : result.urlsProcessed,
            sistrixRowsUpserted: result.sistrixRowsUpserted ?? 0,
            skipped: result.skippedSistrix ?? false,
            skippedReason: result.skippedSistrix
              ? 'not_configured'
              : result.urlsProcessed === 0
              ? 'no_urls'
              : undefined,
            errors: sistrixErrors,
          },
          tenant.id
        ),
      ]);

      if (gscErrors.length > 0) {
        cronErrors.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          cronJob: 'sync-gsc',
          error: gscErrors.join('; '),
        });
      }
      if (sistrixErrors.length > 0) {
        cronErrors.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          cronJob: 'sync-sistrix',
          error: sistrixErrors.join('; '),
        });
      }

      allResults.push({ tenantId: tenant.id, result });
    } catch (err: any) {
      const errMsg = err.message ?? 'Unknown error';
      console.error(`[Cron] sync-gsc tenant=${tenant.id} failed:`, err);
      await Promise.all([
        createAuditLog(`cron:sync-gsc:error`, { error: errMsg }, tenant.id),
        createAuditLog(`cron:sync-sistrix:error`, { error: 'GSC cron fehlgeschlagen' }, tenant.id),
      ]);
      cronErrors.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        cronJob: 'sync-gsc',
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

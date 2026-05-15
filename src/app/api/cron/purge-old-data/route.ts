import { NextRequest, NextResponse } from 'next/server';
import { purgeOldAuditLogs, createAuditLog, getAllTenants } from '@/lib/postgres';

/**
 * GET /api/cron/purge-old-data
 *
 * Deletes stale rows to keep the database lean:
 *   - audit_logs older than 180 days
 *
 * Performance-Daten (url_performance) werden NICHT gelöscht.
 *
 * Trigger this via Coolify Cron (or any scheduler) once per week.
 * Protect with CRON_SECRET env variable.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Cron endpoint not configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization');
  if (!auth || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tenants = await getAllTenants();

    let totalDeletedAudit = 0;

    for (const tenant of tenants) {
      const deletedAudit = await purgeOldAuditLogs(180, tenant.id);
      totalDeletedAudit += deletedAudit;

      await createAuditLog('cron:purge-old-data:success', {
        tenantId: tenant.id,
        deletedAuditLogs: deletedAudit,
      }, tenant.id);
    }

    return NextResponse.json({
      ok: true,
      tenantsProcessed: tenants.length,
      deletedAuditLogs: totalDeletedAudit,
    });
  } catch (err: any) {
    console.error('[cron/purge-old-data] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

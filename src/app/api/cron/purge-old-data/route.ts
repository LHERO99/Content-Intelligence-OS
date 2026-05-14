import { NextRequest, NextResponse } from 'next/server';
import { purgeOldAuditLogs, purgeOldPerformanceData, createAuditLog, getAllTenants } from '@/lib/postgres';

/**
 * GET /api/cron/purge-old-data
 *
 * Deletes stale rows to keep the database lean:
 *   - audit_logs older than 180 days
 *   - url_performance older than 400 days (~13 months)
 *
 * Trigger this via Coolify Cron (or any scheduler) once per week.
 * Protect with CRON_SECRET env variable.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const tenants = await getAllTenants();

    let totalDeletedAudit = 0;
    let totalDeletedPerf = 0;

    for (const tenant of tenants) {
      const [deletedAudit, deletedPerf] = await Promise.all([
        purgeOldAuditLogs(180, tenant.id),
        purgeOldPerformanceData(400, tenant.id),
      ]);
      totalDeletedAudit += deletedAudit;
      totalDeletedPerf += deletedPerf;

      await createAuditLog('cron:purge-old-data:success', {
        tenantId: tenant.id,
        deletedAuditLogs: deletedAudit,
        deletedPerformanceRows: deletedPerf,
      }, tenant.id);
    }

    return NextResponse.json({
      ok: true,
      tenantsProcessed: tenants.length,
      deletedAuditLogs: totalDeletedAudit,
      deletedPerformanceRows: totalDeletedPerf,
    });
  } catch (err: any) {
    console.error('[cron/purge-old-data] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

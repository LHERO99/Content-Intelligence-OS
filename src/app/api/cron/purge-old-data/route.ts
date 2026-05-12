import { NextRequest, NextResponse } from 'next/server';
import { purgeOldAuditLogs, purgeOldPerformanceData, createAuditLog } from '@/lib/postgres';

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
    const [deletedAudit, deletedPerf] = await Promise.all([
      purgeOldAuditLogs(180),
      purgeOldPerformanceData(400),
    ]);

    await createAuditLog('cron:purge-old-data:success', {
      deletedAuditLogs: deletedAudit,
      deletedPerformanceRows: deletedPerf,
    });

    return NextResponse.json({
      ok: true,
      deletedAuditLogs: deletedAudit,
      deletedPerformanceRows: deletedPerf,
    });
  } catch (err: any) {
    console.error('[cron/purge-old-data] error:', err);
    await createAuditLog('cron:purge-old-data:error', { error: err.message });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

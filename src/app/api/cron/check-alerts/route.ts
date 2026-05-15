/**
 * Cron Job: /api/cron/check-alerts
 *
 * Prüft täglich alle aktiven Alert-Regeln über alle Tenants und versendet
 * bei Auslösung E-Mail-Benachrichtigungen.
 *
 * Schutz: CRON_SECRET Bearer-Token (identisch zu bestehenden Cron-Jobs)
 * Schedule: täglich 07:00 UTC (vercel.json)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllTenants } from '@/lib/postgres';
import { evaluateAndNotify } from '@/lib/alerts/alert-notifications';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Auth-Check via CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Cron endpoint not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] check-alerts started at', new Date().toISOString());

  const tenants = await getAllTenants();
  const allResults: Array<{
    tenantId: string;
    tenantName: string;
    results: Awaited<ReturnType<typeof evaluateAndNotify>>;
  }> = [];

  let totalTriggered = 0;
  let totalErrors = 0;

  for (const tenant of tenants) {
    try {
      const results = await evaluateAndNotify(tenant.id, tenant.name);

      const triggered = results.filter((r) => r.status === 'triggered').length;
      const errors = results.filter((r) => r.status === 'error').length;

      totalTriggered += triggered;
      totalErrors += errors;

      allResults.push({ tenantId: tenant.id, tenantName: tenant.name, results });

      if (triggered > 0 || errors > 0) {
        console.log(
          `[Cron] check-alerts tenant=${tenant.id}: ${triggered} ausgelöst, ${errors} Fehler`
        );
      }
    } catch (err: any) {
      totalErrors++;
      console.error(`[Cron] check-alerts tenant=${tenant.id} fehlgeschlagen:`, err.message);
      allResults.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        results: [{ ruleId: '-', ruleName: '-', status: 'error', detail: err.message }],
      });
    }
  }

  console.log(
    `[Cron] check-alerts abgeschlossen: ${tenants.length} Tenants, ` +
    `${totalTriggered} ausgelöst, ${totalErrors} Fehler`
  );

  return NextResponse.json({
    success: true,
    completedAt: new Date().toISOString(),
    tenants: allResults,
    totalTriggered,
    totalErrors,
  });
}

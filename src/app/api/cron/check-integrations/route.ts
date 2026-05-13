import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS, getProviderConfigValues } from '@/lib/admin-integrations';
import { testProviderConnection, testAgentWebhook } from '@/lib/integration-tests';
import { createAuditLog, getConfig, getAllTenants } from '@/lib/postgres';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[Cron] check-integrations started at', new Date().toISOString());

  const tenants = await getAllTenants();
  const allTenantResults: Array<{ tenantId: string; results: any[] }> = [];

  for (const tenant of tenants) {
    const tenantId = tenant.id;
    const results: Array<{ provider: string; status: 'ok' | 'error' | 'skipped'; detail: string }> = [];

    // ── Integration provider checks ──────────────────────────────────────────
    for (const provider of PROVIDERS) {
      let values: Record<string, string> = {};

      try {
        values = await getProviderConfigValues(provider.id, tenantId);
      } catch {
        continue;
      }

      const isConfigured = provider.fields.length === 0
        ? true
        : provider.fields.every((f) => Boolean(values[f.key]?.trim()));

      if (!isConfigured) {
        await createAuditLog(`integration:check:${provider.id}:skipped`, { reason: 'Nicht konfiguriert' }, tenantId);
        results.push({ provider: provider.id, status: 'skipped', detail: 'Nicht konfiguriert' });
        continue;
      }

      try {
        await testProviderConnection(provider.id, values);
        await createAuditLog(`integration:check:${provider.id}:ok`, {}, tenantId);
        results.push({ provider: provider.id, status: 'ok', detail: 'Verbindung erfolgreich' });
      } catch (err: any) {
        const msg = err.message ?? 'Unbekannter Fehler';
        await createAuditLog(`integration:check:${provider.id}:error`, { error: msg }, tenantId);
        results.push({ provider: provider.id, status: 'error', detail: msg });
        console.error(`[Cron] check-integrations tenant=${tenantId} ${provider.id} failed:`, msg);
      }
    }

    // ── Agent Webhook check ───────────────────────────────────────────────────
    try {
      const config = await getConfig(tenantId);
      const webhookUrl = config.AGENT_WEBHOOK_URL?.trim();

      if (!webhookUrl) {
        await createAuditLog('integration:check:agent_webhook:skipped', { reason: 'Kein Webhook hinterlegt' }, tenantId);
        results.push({ provider: 'agent_webhook', status: 'skipped', detail: 'Kein Webhook hinterlegt' });
      } else {
        try {
          await testAgentWebhook(webhookUrl);
          await createAuditLog('integration:check:agent_webhook:ok', { url: webhookUrl }, tenantId);
          results.push({ provider: 'agent_webhook', status: 'ok', detail: 'Erreichbar' });
        } catch (err: any) {
          const msg = err.message ?? 'Unbekannter Fehler';
          await createAuditLog('integration:check:agent_webhook:error', { error: msg, url: webhookUrl }, tenantId);
          results.push({ provider: 'agent_webhook', status: 'error', detail: msg });
          console.error(`[Cron] check-integrations tenant=${tenantId} agent_webhook failed:`, msg);
        }
      }
    } catch (configErr: any) {
      console.error(`[Cron] check-integrations tenant=${tenantId}: could not load config:`, configErr.message);
    }

    allTenantResults.push({ tenantId, results });
  }

  const totalErrors = allTenantResults.reduce(
    (sum, t) => sum + t.results.filter(r => r.status === 'error').length, 0
  );
  console.log(`[Cron] check-integrations completed: ${tenants.length} tenants, ${totalErrors} errors`);

  return NextResponse.json({
    success: true,
    completedAt: new Date().toISOString(),
    tenants: allTenantResults,
    totalErrors,
  });
}

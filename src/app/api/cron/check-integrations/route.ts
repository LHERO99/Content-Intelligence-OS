import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS, getProviderConfigValues } from '@/lib/admin-integrations';
import { testProviderConnection, testAgentWebhook } from '@/lib/integration-tests';
import { createAuditLog, getConfig } from '@/lib/postgres';

/**
 * GET /api/cron/check-integrations
 *
 * Vercel Cron endpoint — runs daily at 06:00 UTC.
 * Tests connectivity for all configured integrations and the agent webhook (if set).
 * Results are written to AuditLog for the System Health dashboard to read.
 *
 * AuditLog action format:
 *   integration:check:<provider>:ok
 *   integration:check:<provider>:error
 *   integration:check:agent_webhook:ok
 *   integration:check:agent_webhook:skipped
 *   integration:check:agent_webhook:error
 *
 * Auth: Vercel sets `Authorization: Bearer <CRON_SECRET>` automatically on cron invocations.
 */
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

  const results: Array<{ provider: string; status: 'ok' | 'error' | 'skipped'; detail: string }> = [];

  // ── Integration provider checks ──────────────────────────────────────────
  for (const provider of PROVIDERS) {
    let values: Record<string, string> = {};

    // Check if the provider has credentials configured at all
    try {
      values = await getProviderConfigValues(provider.id);
    } catch {
      // If we can't load values, skip (Airtable issue handled elsewhere)
      continue;
    }

    const isConfigured = provider.fields.length === 0
      ? true // OAuth providers (GSC) — no field values required
      : provider.fields.every((f) => Boolean(values[f.key]?.trim()));

    if (!isConfigured) {
      // Not configured — mark as skipped (not an error)
      await createAuditLog(`integration:check:${provider.id}:skipped`, {
        reason: 'Nicht konfiguriert',
      });
      results.push({ provider: provider.id, status: 'skipped', detail: 'Nicht konfiguriert' });
      continue;
    }

    try {
      await testProviderConnection(provider.id, values);
      await createAuditLog(`integration:check:${provider.id}:ok`, {});
      results.push({ provider: provider.id, status: 'ok', detail: 'Verbindung erfolgreich' });
    } catch (err: any) {
      const msg = err.message ?? 'Unbekannter Fehler';
      await createAuditLog(`integration:check:${provider.id}:error`, { error: msg });
      results.push({ provider: provider.id, status: 'error', detail: msg });
      console.error(`[Cron] check-integrations: ${provider.id} failed:`, msg);
    }
  }

  // ── Agent Webhook check (only if URL is configured) ───────────────────────
  try {
    const config = await getConfig();
    const webhookUrl = config.AGENT_WEBHOOK_URL?.trim();

    if (!webhookUrl) {
      await createAuditLog('integration:check:agent_webhook:skipped', { reason: 'Kein Webhook hinterlegt' });
      results.push({ provider: 'agent_webhook', status: 'skipped', detail: 'Kein Webhook hinterlegt' });
    } else {
      try {
        await testAgentWebhook(webhookUrl);
        await createAuditLog('integration:check:agent_webhook:ok', { url: webhookUrl });
        results.push({ provider: 'agent_webhook', status: 'ok', detail: 'Erreichbar' });
      } catch (err: any) {
        const msg = err.message ?? 'Unbekannter Fehler';
        await createAuditLog('integration:check:agent_webhook:error', { error: msg, url: webhookUrl });
        results.push({ provider: 'agent_webhook', status: 'error', detail: msg });
        console.error('[Cron] check-integrations: agent_webhook failed:', msg);
      }
    }
  } catch (configErr: any) {
    console.error('[Cron] check-integrations: could not load config for webhook check:', configErr.message);
  }

  const errorCount = results.filter((r) => r.status === 'error').length;
  console.log(`[Cron] check-integrations completed: ${results.length} checks, ${errorCount} errors`);

  return NextResponse.json({
    success: true,
    completedAt: new Date().toISOString(),
    results,
    errorCount,
  });
}

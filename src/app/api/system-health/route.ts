import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { base, TABLES, getConfig } from '@/lib/airtable';
import { PROVIDERS } from '@/lib/admin-integrations';
import { createAgentWorkflowServiceV2, DEFAULT_TENANT_ID } from '@/app/api/agent-workflows-v2/_service';

export type HealthStatus = 'ok' | 'warning' | 'error' | 'unknown';

export interface HealthCheck {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
  checkedAt?: string; // ISO timestamp of last relevant log entry
}

export interface SystemHealthResponse {
  overall: HealthStatus;
  checkedAt: string;
  checks: HealthCheck[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Reads the most recent AuditLog entries whose Action starts with a given prefix.
 * Returns up to `limit` records sorted newest first.
 */
async function getLatestAuditLogByPrefix(
  prefix: string,
  limit = 1
): Promise<Array<{ action: string; timestamp: string; rawPayload?: string }>> {
  try {
    const records = await base(TABLES.AUDIT_LOGS)
      .select({
        filterByFormula: `LEFT({Action}, ${prefix.length}) = "${prefix}"`,
        sort: [{ field: 'Timestamp', direction: 'desc' }],
        maxRecords: limit,
      })
      .firstPage();

    return records.map((r) => ({
      action: r.get('Action') as string,
      timestamp: r.get('Timestamp') as string,
      rawPayload: r.get('Raw_Payload') as string | undefined,
    }));
  } catch {
    return [];
  }
}

function daysSince(isoTimestamp: string | undefined): number | null {
  if (!isoTimestamp) return null;
  const ms = Date.now() - new Date(isoTimestamp).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return 'Unbekannt';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Individual checks ────────────────────────────────────────────────────────

async function checkAirtable(): Promise<HealthCheck> {
  try {
    const records = await base(TABLES.USERS).select({ maxRecords: 1 }).firstPage();
    return {
      id: 'airtable',
      label: 'Airtable',
      status: records.length >= 0 ? 'ok' : 'error',
      detail: 'Verbindung aktiv',
    };
  } catch (err: any) {
    return {
      id: 'airtable',
      label: 'Airtable',
      status: 'error',
      detail: err.message ?? 'Verbindung fehlgeschlagen',
    };
  }
}

async function checkCronSync(
  id: 'cron:sync-gsc' | 'cron:sync-dataforseo' | 'cron:sync-sistrix',
  label: string,
  staleAfterDays = 8
): Promise<HealthCheck> {
  const logs = await getLatestAuditLogByPrefix(`${id}:`);
  const latest = logs[0];

  if (!latest) {
    return {
      id,
      label,
      status: 'unknown',
      detail: 'Noch kein Lauf protokolliert',
    };
  }

  const isSuccess = latest.action.endsWith(':success') || latest.action.endsWith(':skipped');
  const isError = latest.action.endsWith(':error');
  const age = daysSince(latest.timestamp);
  const formattedAt = formatTimestamp(latest.timestamp);

  if (isError) {
    let errorMsg = 'Letzter Lauf fehlgeschlagen';
    try {
      const payload = JSON.parse(latest.rawPayload || '{}');
      if (payload.error) errorMsg = `Fehler: ${payload.error}`;
    } catch {}
    return { id, label, status: 'error', detail: errorMsg, checkedAt: latest.timestamp };
  }

  if (latest.action.endsWith(':skipped')) {
    return {
      id,
      label,
      status: 'warning',
      detail: 'Integration nicht konfiguriert — Sync übersprungen',
      checkedAt: latest.timestamp,
    };
  }

  if (age !== null && age > staleAfterDays) {
    return {
      id,
      label,
      status: 'warning',
      detail: `Zuletzt: ${formattedAt} (>${staleAfterDays} Tage)`,
      checkedAt: latest.timestamp,
    };
  }

  return {
    id,
    label,
    status: 'ok',
    detail: `Zuletzt: ${formattedAt}`,
    checkedAt: latest.timestamp,
  };
}

async function checkIntegrations(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  for (const provider of PROVIDERS) {
    const logs = await getLatestAuditLogByPrefix(`integration:check:${provider.id}:`);
    const latest = logs[0];
    const label = provider.name;
    const checkId = `integration:${provider.id}`;

    if (!latest) {
      checks.push({
        id: checkId,
        label,
        status: 'unknown',
        detail: 'Noch kein Check protokolliert',
      });
      continue;
    }

    const formattedAt = formatTimestamp(latest.timestamp);

    if (latest.action.endsWith(':ok')) {
      checks.push({ id: checkId, label, status: 'ok', detail: `Verbunden — ${formattedAt}`, checkedAt: latest.timestamp });
    } else if (latest.action.endsWith(':skipped')) {
      checks.push({ id: checkId, label, status: 'warning', detail: 'Nicht konfiguriert', checkedAt: latest.timestamp });
    } else if (latest.action.endsWith(':error')) {
      let errorMsg = 'Verbindungsfehler';
      try {
        const payload = JSON.parse(latest.rawPayload || '{}');
        if (payload.error) errorMsg = payload.error;
      } catch {}
      checks.push({ id: checkId, label, status: 'error', detail: errorMsg, checkedAt: latest.timestamp });
    } else {
      checks.push({ id: checkId, label, status: 'unknown', detail: 'Unbekannter Status' });
    }
  }

  // Agent Webhook
  const webhookLogs = await getLatestAuditLogByPrefix('integration:check:agent_webhook:');
  const webhookLatest = webhookLogs[0];

  if (!webhookLatest) {
    checks.push({ id: 'integration:agent_webhook', label: 'Agent Webhook', status: 'unknown', detail: 'Noch kein Check protokolliert' });
  } else if (webhookLatest.action.endsWith(':skipped')) {
    checks.push({ id: 'integration:agent_webhook', label: 'Agent Webhook', status: 'ok', detail: 'Kein Webhook konfiguriert', checkedAt: webhookLatest.timestamp });
  } else if (webhookLatest.action.endsWith(':ok')) {
    checks.push({ id: 'integration:agent_webhook', label: 'Agent Webhook', status: 'ok', detail: `Erreichbar — ${formatTimestamp(webhookLatest.timestamp)}`, checkedAt: webhookLatest.timestamp });
  } else {
    let errorMsg = 'Webhook nicht erreichbar';
    try {
      const payload = JSON.parse(webhookLatest.rawPayload || '{}');
      if (payload.error) errorMsg = payload.error;
    } catch {}
    checks.push({ id: 'integration:agent_webhook', label: 'Agent Webhook', status: 'error', detail: errorMsg, checkedAt: webhookLatest.timestamp });
  }

  return checks;
}

async function checkAgentRuns(): Promise<HealthCheck> {
  try {
    const service = createAgentWorkflowServiceV2();
    const runs = await service.listRuns(DEFAULT_TENANT_ID, 100);

    const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
    const staleRuns = runs.filter(
      (r) =>
        r.status === 'running' &&
        Date.now() - new Date(r.updatedAt).getTime() > STALE_THRESHOLD_MS
    );

    if (staleRuns.length > 0) {
      return {
        id: 'agent_runs',
        label: 'Agent Runs',
        status: 'error',
        detail: `${staleRuns.length} Run${staleRuns.length > 1 ? 's' : ''} hängen (>30 Min. ohne Update)`,
      };
    }

    const activeRuns = runs.filter((r) => r.status === 'running');
    if (activeRuns.length > 0) {
      return { id: 'agent_runs', label: 'Agent Runs', status: 'ok', detail: `${activeRuns.length} Run${activeRuns.length > 1 ? 's' : ''} aktiv` };
    }

    return { id: 'agent_runs', label: 'Agent Runs', status: 'ok', detail: 'Keine hängenden Runs' };
  } catch (err: any) {
    return { id: 'agent_runs', label: 'Agent Runs', status: 'error', detail: err.message ?? 'Fehler beim Laden der Runs' };
  }
}

async function checkContentPipeline(): Promise<HealthCheck> {
  try {
    const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
    const staleStatuses = ['Beauftragt', 'In Arbeit'];

    const records = await base(TABLES.KEYWORD_MAP)
      .select({
        filterByFormula: `OR(${staleStatuses.map((s) => `{Status} = "${s}"`).join(',')})`,
        fields: ['Status', 'Last Modified'],
        maxRecords: 200,
      })
      .all();

    const staleCount = records.filter((r) => {
      const lastMod = r.get('Last Modified') as string | undefined;
      if (!lastMod) return true; // No modification date — treat as stale
      return Date.now() - new Date(lastMod).getTime() > STALE_THRESHOLD_MS;
    }).length;

    if (staleCount > 0) {
      return {
        id: 'content_pipeline',
        label: 'Content Pipeline',
        status: 'warning',
        detail: `${staleCount} Keyword${staleCount > 1 ? 's' : ''} seit >24h ohne Update`,
      };
    }

    const activeCount = records.length;
    return {
      id: 'content_pipeline',
      label: 'Content Pipeline',
      status: 'ok',
      detail: activeCount > 0 ? `${activeCount} aktive Job${activeCount > 1 ? 's' : ''}, alle aktuell` : 'Keine aktiven Jobs',
    };
  } catch (err: any) {
    return { id: 'content_pipeline', label: 'Content Pipeline', status: 'error', detail: err.message ?? 'Fehler beim Laden' };
  }
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const [
      airtableCheck,
      cronGscCheck,
      cronDataforseoCheck,
      cronSistrixCheck,
      integrationChecks,
      agentRunsCheck,
      contentPipelineCheck,
    ] = await Promise.all([
      checkAirtable(),
      checkCronSync('cron:sync-gsc', 'GSC Sync'),
      checkCronSync('cron:sync-dataforseo', 'DataForSEO Sync'),
      checkCronSync('cron:sync-sistrix', 'Sistrix Sync'),
      checkIntegrations(),
      checkAgentRuns(),
      checkContentPipeline(),
    ]);

    const checks: HealthCheck[] = [
      airtableCheck,
      cronGscCheck,
      cronSistrixCheck,
      cronDataforseoCheck,
      ...integrationChecks,
      agentRunsCheck,
      contentPipelineCheck,
    ];

    const overall: HealthStatus =
      checks.some((c) => c.status === 'error')
        ? 'error'
        : checks.some((c) => c.status === 'warning')
        ? 'warning'
        : 'ok';

    const response: SystemHealthResponse = {
      overall,
      checkedAt: new Date().toISOString(),
      checks,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] system-health error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

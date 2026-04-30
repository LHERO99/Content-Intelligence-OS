import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { base, TABLES, getConfig } from '@/lib/airtable';
import { PROVIDERS, getIntegrationsState, getProviderConfigValues } from '@/lib/admin-integrations';
import { testProviderConnection, testAgentWebhook } from '@/lib/integration-tests';
import { createAgentWorkflowServiceV2, DEFAULT_TENANT_ID } from '@/app/api/agent-workflows-v2/_service';

export type HealthStatus = 'ok' | 'warning' | 'error' | 'unknown';

export interface HealthCheck {
  id: string;
  label: string;
  status: HealthStatus;
  /** Raw detail string — used directly when detailKey is absent (e.g. external API errors). */
  detail: string;
  /** i18n key under dashboard.systemHealth.* — when present, component translates this instead of detail. */
  detailKey?: string;
  /** Dynamic values interpolated into the translated string, e.g. { time: '…', count: 3 } */
  detailParams?: Record<string, string | number>;
  checkedAt?: string;
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

// ── Individual checks ────────────────────────────────────────────────────────

async function checkAirtable(): Promise<HealthCheck> {
  try {
    await base(TABLES.USERS).select({ maxRecords: 1 }).firstPage();
    return {
      id: 'airtable',
      label: 'Airtable',
      status: 'ok',
      detail: 'Connected',
      detailKey: 'dashboard.systemHealth.airtable.ok',
    };
  } catch (err: any) {
    return {
      id: 'airtable',
      label: 'Airtable',
      status: 'error',
      detail: err.message ?? 'Connection failed',
      detailKey: 'dashboard.systemHealth.airtable.error',
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
      detail: 'No run logged yet',
      detailKey: 'dashboard.systemHealth.cron.noLog',
    };
  }

  const isError = latest.action.endsWith(':error');
  const age = daysSince(latest.timestamp);

  if (isError) {
    let rawError = 'Last run failed';
    try {
      const payload = JSON.parse(latest.rawPayload || '{}');
      if (payload.error) rawError = payload.error;
    } catch {}
    return {
      id,
      label,
      status: 'error',
      detail: rawError,
      detailKey: 'dashboard.systemHealth.cron.failed',
      detailParams: { error: rawError },
      checkedAt: latest.timestamp,
    };
  }

  if (latest.action.endsWith(':skipped')) {
    return {
      id,
      label,
      status: 'warning',
      detail: 'Integration not configured — sync skipped',
      detailKey: 'dashboard.systemHealth.cron.skipped',
      checkedAt: latest.timestamp,
    };
  }

  if (age !== null && age > staleAfterDays) {
    return {
      id,
      label,
      status: 'warning',
      detail: `Last run: ${latest.timestamp} (>${staleAfterDays} days)`,
      detailKey: 'dashboard.systemHealth.cron.stale',
      detailParams: { days: staleAfterDays, timestamp: latest.timestamp },
      checkedAt: latest.timestamp,
    };
  }

  return {
    id,
    label,
    status: 'ok',
    detail: `Last run: ${latest.timestamp}`,
    detailKey: 'dashboard.systemHealth.cron.lastRun',
    detailParams: { timestamp: latest.timestamp },
    checkedAt: latest.timestamp,
  };
}

async function checkIntegrations(): Promise<HealthCheck[]> {
  // 1. Determine which providers are configured
  const integrationStates = await getIntegrationsState();
  const configuredProviders = integrationStates.filter((s) => s.configured);

  // 2. Load config values for all configured providers in parallel
  const valueResults = await Promise.allSettled(
    configuredProviders.map((s) => getProviderConfigValues(s.provider))
  );

  // 3. Run live connectivity tests for all configured providers in parallel
  const testResults = await Promise.allSettled(
    configuredProviders.map((s, i) => {
      const settled = valueResults[i];
      if (settled.status === 'rejected') return Promise.reject(settled.reason);
      return testProviderConnection(s.provider, settled.value);
    })
  );

  // 4. Map results to HealthCheck entries (only configured providers appear)
  const checks: HealthCheck[] = configuredProviders.map((s, i) => {
    const provider = PROVIDERS.find((p) => p.id === s.provider)!;
    const result = testResults[i];
    const checkId = `integration:${s.provider}`;

    if (result.status === 'fulfilled') {
      return {
        id: checkId,
        label: provider.name,
        status: 'ok',
        detail: 'Connected',
        detailKey: 'dashboard.systemHealth.integration.ok',
      };
    }

    const errorMsg = result.reason?.message ?? 'Connection error';
    return {
      id: checkId,
      label: provider.name,
      status: 'error',
      detail: errorMsg,
      // No detailKey — raw external error message is shown directly
    };
  });

  // 5. Agent Webhook — only include if a URL is configured
  try {
    const config = await getConfig();
    const webhookUrl = config.AGENT_WEBHOOK_URL?.trim();

    if (webhookUrl) {
      const result = await testAgentWebhook(webhookUrl).then(
        () => ({ status: 'ok' as const }),
        (err: any) => ({ status: 'error' as const, error: err.message ?? 'Webhook not reachable' })
      );

      checks.push({
        id: 'integration:agent_webhook',
        label: 'Agent Webhook',
        status: result.status,
        detail: result.status === 'ok' ? 'Reachable' : (result as any).error,
        detailKey: result.status === 'ok' ? 'dashboard.systemHealth.integration.ok' : undefined,
      });
    }
  } catch {
    // Config load failure is already surfaced by the Airtable check
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
        detail: `${staleRuns.length} run(s) stuck (>30 min)`,
        detailKey: 'dashboard.systemHealth.runs.stale',
        detailParams: { count: staleRuns.length },
      };
    }

    const activeRuns = runs.filter((r) => r.status === 'running');
    if (activeRuns.length > 0) {
      return {
        id: 'agent_runs',
        label: 'Agent Runs',
        status: 'ok',
        detail: `${activeRuns.length} active run(s)`,
        detailKey: 'dashboard.systemHealth.runs.active',
        detailParams: { count: activeRuns.length },
      };
    }

    return {
      id: 'agent_runs',
      label: 'Agent Runs',
      status: 'ok',
      detail: 'No stale runs',
      detailKey: 'dashboard.systemHealth.runs.noStale',
    };
  } catch (err: any) {
    return {
      id: 'agent_runs',
      label: 'Agent Runs',
      status: 'error',
      detail: err.message ?? 'Error loading runs',
      detailKey: 'dashboard.systemHealth.runs.loadError',
    };
  }
}

async function checkContentPipeline(): Promise<HealthCheck> {
  try {
    const activeStatuses = ['Beauftragt', 'In Arbeit'];

    const records = await base(TABLES.KEYWORD_MAP)
      .select({
        filterByFormula: `OR(${activeStatuses.map((s) => `{Status} = "${s}"`).join(',')})`,
        fields: ['Status'],
        maxRecords: 500,
      })
      .all();

    const activeCount = records.length;
    return {
      id: 'content_pipeline',
      label: 'Content Pipeline',
      status: 'ok',
      detail: activeCount > 0 ? `${activeCount} active job(s)` : 'No active jobs',
      detailKey: activeCount > 0
        ? 'dashboard.systemHealth.pipeline.active'
        : 'dashboard.systemHealth.pipeline.none',
      detailParams: activeCount > 0 ? { count: activeCount } : undefined,
    };
  } catch (err: any) {
    return {
      id: 'content_pipeline',
      label: 'Content Pipeline',
      status: 'error',
      detail: err.message ?? 'Error loading pipeline',
      detailKey: 'dashboard.systemHealth.pipeline.loadError',
    };
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

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getConfig, getAuditLogs, getKeywordMap } from '@/lib/postgres';
import { PROVIDERS, getIntegrationsState, getProviderConfigValues } from '@/lib/admin-integrations';
import { testProviderConnection, testAgentWebhook } from '@/lib/integration-tests';
import { createAgentWorkflowServiceV2 } from '@/app/api/agent-workflows-v2/_service';
import { testSmtpConnection, isSmtpConfigured } from '@/lib/email/smtp-client';

export type HealthStatus = 'ok' | 'warning' | 'error' | 'unknown';

export interface HealthCheck {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
  detailKey?: string;
  detailParams?: Record<string, string | number>;
  checkedAt?: string;
}

export interface SystemHealthResponse {
  overall: HealthStatus;
  checkedAt: string;
  checks: HealthCheck[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getLatestAuditLogByPrefix(
  prefix: string,
  limit = 1,
  tenantId?: string
): Promise<Array<{ action: string; timestamp: string; rawPayload?: string }>> {
  try {
    const all = await getAuditLogs(tenantId);
    return all
      .filter(r => r.Action.startsWith(prefix))
      .sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime())
      .slice(0, limit)
      .map(r => ({ action: r.Action, timestamp: r.Timestamp, rawPayload: r.Raw_Payload }));
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

async function checkDatabase(tenantId?: string): Promise<HealthCheck> {
  try {
    await getConfig(tenantId);
    return {
      id: 'database',
      label: 'PostgreSQL',
      status: 'ok',
      detail: 'Connected',
      detailKey: 'dashboard.systemHealth.database.ok',
    };
  } catch (err: any) {
    return {
      id: 'database',
      label: 'PostgreSQL',
      status: 'error',
      detail: err.message ?? 'Connection failed',
      detailKey: 'dashboard.systemHealth.database.error',
    };
  }
}

async function checkCronSync(
  id: 'cron:sync-gsc' | 'cron:sync-dataforseo' | 'cron:sync-sistrix',
  label: string,
  tenantId?: string,
  staleAfterDays = 8
): Promise<HealthCheck> {
  const logs = await getLatestAuditLogByPrefix(`${id}:`, 1, tenantId);
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
    let skippedReason = 'not_configured';
    try {
      const p = JSON.parse(latest.rawPayload || '{}');
      if (p.skippedReason) skippedReason = String(p.skippedReason);
    } catch {}

    if (skippedReason === 'no_urls') {
      return {
        id,
        label,
        status: 'ok',
        detail: 'Nothing to sync — no URLs in this run',
        detailKey: 'dashboard.systemHealth.cron.noUrls',
        checkedAt: latest.timestamp,
      };
    }

    return {
      id,
      label,
      status: 'warning',
      detail: 'Integration not configured — sync skipped',
      detailKey: 'dashboard.systemHealth.cron.skipped',
      checkedAt: latest.timestamp,
    };
  }

  if (latest.action.endsWith(':no_urls')) {
    return {
      id,
      label,
      status: 'ok',
      detail: 'Nothing to sync — no URLs in this run',
      detailKey: 'dashboard.systemHealth.cron.noUrls',
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

async function checkIntegrations(tenantId?: string): Promise<HealthCheck[]> {
  const integrationStates = await getIntegrationsState(tenantId);
  const configuredProviders = integrationStates.filter((s) => s.configured);

  const valueResults = await Promise.allSettled(
    configuredProviders.map((s) => getProviderConfigValues(s.provider, tenantId))
  );

  const testResults = await Promise.allSettled(
    configuredProviders.map((s, i) => {
      const settled = valueResults[i];
      if (settled.status === 'rejected') return Promise.reject(settled.reason);
      return testProviderConnection(s.provider, settled.value);
    })
  );

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
    };
  });

  // Agent Webhook check
  try {
    const config = await getConfig(tenantId);
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
    // Config load failure is already surfaced by the database check
  }

  return checks;
}

async function checkAgentRuns(tenantId?: string): Promise<HealthCheck> {
  try {
    const service = createAgentWorkflowServiceV2();
    const runs = await service.listRuns(tenantId ?? '', 100);

    const STALE_THRESHOLD_MS = 30 * 60 * 1000;
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

async function checkAgentCallback(tenantId?: string): Promise<HealthCheck | null> {
  try {
    const config = await getConfig(tenantId);
    if (config.EXTERNAL_AGENT_ENABLED !== 'true') return null;

    const logs = await getLatestAuditLogByPrefix('agent_webhook:callback:unauthorized', 50, tenantId);

    // Only count entries from the last 24h
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = logs.filter(l => new Date(l.timestamp).getTime() > cutoff);

    if (recent.length === 0) {
      return {
        id: 'agent_webhook:callback',
        label: 'Agent Callback Auth',
        status: 'ok',
        detail: 'No unauthorized callback requests in the last 24h',
        detailKey: 'dashboard.systemHealth.agentCallback.ok',
      };
    }

    const reasons = recent.map(l => {
      try { return (JSON.parse(l.rawPayload ?? '{}')).reason ?? 'unknown'; } catch { return 'unknown'; }
    });
    const missingCount = reasons.filter(r => r === 'missing_secret').length;
    const invalidCount = reasons.filter(r => r === 'invalid_secret').length;

    return {
      id: 'agent_webhook:callback',
      label: 'Agent Callback Auth',
      status: 'warning',
      detail: `${recent.length} unauthorized callback request(s) in the last 24h — missing secret: ${missingCount}, invalid secret: ${invalidCount}. Check X-API-KEY configuration in your external tool.`,
      detailKey: 'dashboard.systemHealth.agentCallback.unauthorized',
      detailParams: { count: recent.length, missingCount, invalidCount },
    };
  } catch {
    return null;
  }
}


async function checkContentPipeline(tenantId?: string): Promise<HealthCheck> {
  try {
    const activeStatuses = ['Beauftragt', 'In Arbeit'];
    const allKeywords = await getKeywordMap(tenantId);
    const activeCount = allKeywords.filter(k => activeStatuses.includes(k.Status)).length;
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

async function checkSmtp(): Promise<HealthCheck> {
  if (!isSmtpConfigured()) {
    return {
      id: 'smtp',
      label: 'SMTP',
      status: 'warning',
      detail: 'Not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS',
      detailKey: 'dashboard.systemHealth.smtp.notConfigured',
    };
  }
  try {
    await testSmtpConnection();
    return {
      id: 'smtp',
      label: 'SMTP',
      status: 'ok',
      detail: 'Connected',
      detailKey: 'dashboard.systemHealth.smtp.ok',
    };
  } catch (err: any) {
    return {
      id: 'smtp',
      label: 'SMTP',
      status: 'error',
      detail: err.message ?? 'Connection failed',
      detailKey: 'dashboard.systemHealth.smtp.error',
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
    const tenantId = session.user?.tenantId;
    const isSuperAdmin = (session.user as any).role === 'SuperAdmin';

    const [
      databaseCheck,
      cronGscCheck,
      cronDataforseoCheck,
      cronSistrixCheck,
      integrationChecks,
      agentRunsCheck,
      contentPipelineCheck,
      agentCallbackCheck,
    ] = await Promise.all([
      checkDatabase(tenantId),
      checkCronSync('cron:sync-gsc', 'GSC Sync', tenantId),
      checkCronSync('cron:sync-dataforseo', 'DataForSEO Sync', tenantId),
      checkCronSync('cron:sync-sistrix', 'Sistrix Sync', tenantId),
      checkIntegrations(tenantId),
      checkAgentRuns(tenantId),
      checkContentPipeline(tenantId),
      checkAgentCallback(tenantId),
    ]);

    const smtpCheck = isSuperAdmin ? await checkSmtp() : null;

    const checks: HealthCheck[] = [
      databaseCheck,
      ...(smtpCheck ? [smtpCheck] : []),
      cronGscCheck,
      cronSistrixCheck,
      cronDataforseoCheck,
      ...integrationChecks,
      agentRunsCheck,
      contentPipelineCheck,
      ...(agentCallbackCheck ? [agentCallbackCheck] : []),
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

/**
 * GET /api/super-admin/health
 *
 * Cross-Tenant System-Health-Summary für SuperAdmin.
 * Liest die letzten Audit-Log-Einträge aller Tenants und berechnet
 * einen zusammengefassten Health-Status pro Tenant und Cron-Job.
 *
 * Kein Live-Test – rein audit-log-basiert.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { tenants, auditLogs } from '@/lib/db/schema';
import { eq, desc, inArray, gte } from 'drizzle-orm';

const CRON_JOBS = [
  'cron:sync-gsc',
  'cron:sync-sistrix',
  'cron:sync-dataforseo',
  'cron:check-integrations',
] as const;

type CronJobKey = typeof CRON_JOBS[number];

export interface TenantHealthStatus {
  tenantId: string;
  tenantName: string;
  jobs: Record<string, {
    status: 'ok' | 'error' | 'skipped' | 'unknown';
    lastRunAt: string | null;
    detail: string | null;
  }>;
  hasErrors: boolean;
  lastActivityAt: string | null;
}

export interface HealthSummaryResponse {
  tenants: TenantHealthStatus[];
  totalTenants: number;
  tenantsWithErrors: number;
  generatedAt: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'SuperAdmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Load all tenants
    const allTenants = await db
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants)
      .orderBy(tenants.name);

    if (allTenants.length === 0) {
      return NextResponse.json({
        tenants: [],
        totalTenants: 0,
        tenantsWithErrors: 0,
        generatedAt: new Date().toISOString(),
      } satisfies HealthSummaryResponse);
    }

    // Load recent audit logs for all tenants (last 48h)
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const tenantIds = allTenants.map(t => t.id);

    const logs = await db
      .select({
        tenantId: auditLogs.tenantId,
        action: auditLogs.action,
        timestamp: auditLogs.timestamp,
        rawPayload: auditLogs.rawPayload,
      })
      .from(auditLogs)
      .where(
        inArray(auditLogs.tenantId, tenantIds)
      )
      .orderBy(desc(auditLogs.timestamp))
      .limit(5000);

    // Build health summary per tenant
    const tenantHealth: TenantHealthStatus[] = allTenants.map(tenant => {
      const tenantLogs = logs.filter(l => l.tenantId === tenant.id);

      const jobs: TenantHealthStatus['jobs'] = {};

      for (const cronJob of CRON_JOBS) {
        // Find the most recent log entry for this cron job
        const relevantLog = tenantLogs
          .filter(l => l.action.startsWith(cronJob))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        if (!relevantLog) {
          jobs[cronJob] = { status: 'unknown', lastRunAt: null, detail: null };
          continue;
        }

        let status: 'ok' | 'error' | 'skipped' | 'unknown';
        if (relevantLog.action.endsWith(':success') || relevantLog.action.endsWith(':ok')) {
          status = 'ok';
        } else if (relevantLog.action.endsWith(':error')) {
          status = 'error';
        } else if (relevantLog.action.endsWith(':skipped')) {
          status = 'skipped';
        } else {
          status = 'unknown';
        }

        const payload = relevantLog.rawPayload as Record<string, unknown> | null;
        const detail = payload?.error
          ? String(payload.error)
          : payload?.errors && Array.isArray(payload.errors) && payload.errors.length > 0
          ? (payload.errors as string[]).join('; ')
          : null;

        jobs[cronJob] = {
          status,
          lastRunAt: new Date(relevantLog.timestamp).toISOString(),
          detail,
        };
      }

      const hasErrors = Object.values(jobs).some(j => j.status === 'error');
      const lastActivityAt = tenantLogs.length > 0
        ? new Date(tenantLogs[0].timestamp).toISOString()
        : null;

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        jobs,
        hasErrors,
        lastActivityAt,
      };
    });

    const tenantsWithErrors = tenantHealth.filter(t => t.hasErrors).length;

    return NextResponse.json({
      tenants: tenantHealth,
      totalTenants: allTenants.length,
      tenantsWithErrors,
      generatedAt: new Date().toISOString(),
    } satisfies HealthSummaryResponse);
  } catch (err: any) {
    console.error('[SuperAdmin] /health API error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

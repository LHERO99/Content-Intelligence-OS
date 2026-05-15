/**
 * GET /api/super-admin/health
 *
 * Cross-Tenant System-Health-Summary für SuperAdmin.
 * Liest die letzten Audit-Log-Einträge aller Tenants und berechnet
 * einen zusammengefassten Health-Status pro Tenant und Cron-Job.
 *
 * Sistrix wird bewusst in zwei separate Jobs aufgeteilt:
 *   - integration:check:sistrix  → API-Key-Gültigkeit (authoritative Quelle)
 *   - cron:sync-sistrix          → Datensync-Status (hat der Sync Daten geholt?)
 *
 * Damit kann ein ungültiger API-Key nicht mehr durch einen scheinbar erfolgreichen
 * (aber leeren) Datensync-Eintrag verdeckt werden.
 *
 * Kein Live-Test – rein audit-log-basiert.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { tenants, auditLogs } from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { testSmtpConnection, isSmtpConfigured } from '@/lib/email/smtp-client';

// Each job definition contains all audit-log prefixes that are relevant for it.
// The most recent entry across ALL prefixes wins.
//
// IMPORTANT: Sistrix is intentionally split into two independent jobs:
//   1. `integration:check:sistrix` — authoritative for API key validity
//   2. `cron:sync-sistrix`         — authoritative for data sync health
// Mixing both into one job would allow a "no-op" sync (0 URLs) to mask
// an API key error written by the check-integrations cron.
const JOBS = [
  {
    key: 'cron:sync-gsc',
    prefixes: ['cron:sync-gsc', 'integration:check:google_search_console'],
  },
  {
    key: 'integration:check:sistrix',
    prefixes: ['integration:check:sistrix'],
  },
  {
    key: 'cron:sync-sistrix',
    prefixes: ['cron:sync-sistrix'],
  },
  {
    key: 'cron:sync-dataforseo',
    prefixes: ['cron:sync-dataforseo', 'integration:check:dataforseo'],
  },
  {
    key: 'cron:check-integrations',
    prefixes: ['cron:check-integrations'],
  },
] as const;

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
  smtp: {
    status: 'ok' | 'error' | 'not_configured';
    detail: string;
  };
}

function deriveStatus(action: string): 'ok' | 'error' | 'skipped' | 'unknown' {
  if (action.endsWith(':success') || action.endsWith(':ok')) return 'ok';
  if (action.endsWith(':error')) return 'error';
  if (action.endsWith(':skipped')) return 'skipped';
  return 'unknown';
}

function extractDetail(payload: unknown): string | null {
  const p = payload as Record<string, unknown> | null;
  if (!p) return null;
  if (p.error) return String(p.error);
  if (Array.isArray(p.errors) && p.errors.length > 0) return (p.errors as string[]).join('; ');
  return null;
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

    const tenantIds = allTenants.map(t => t.id);

    // Load recent audit logs for all tenants (last 48h)
    const logs = await db
      .select({
        tenantId: auditLogs.tenantId,
        action: auditLogs.action,
        timestamp: auditLogs.timestamp,
        rawPayload: auditLogs.rawPayload,
      })
      .from(auditLogs)
      .where(inArray(auditLogs.tenantId, tenantIds))
      .orderBy(desc(auditLogs.timestamp))
      .limit(5000);

    // Build health summary per tenant
    const tenantHealth: TenantHealthStatus[] = allTenants.map(tenant => {
      const tenantLogs = logs.filter(l => l.tenantId === tenant.id);
      const jobs: TenantHealthStatus['jobs'] = {};

      for (const job of JOBS) {
        // Collect all log entries matching ANY of the job's prefixes
        const relevantLogs = tenantLogs
          .filter(l => job.prefixes.some(prefix => l.action.startsWith(prefix)))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Take the most recent entry across all prefix sources
        const mostRecent = relevantLogs[0];

        if (!mostRecent) {
          jobs[job.key] = { status: 'unknown', lastRunAt: null, detail: null };
          continue;
        }

        jobs[job.key] = {
          status: deriveStatus(mostRecent.action),
          lastRunAt: new Date(mostRecent.timestamp).toISOString(),
          detail: extractDetail(mostRecent.rawPayload),
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

    // SMTP live check — only relevant for SuperAdmin
    let smtp: HealthSummaryResponse['smtp'];
    if (!isSmtpConfigured()) {
      smtp = { status: 'not_configured', detail: 'SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS' };
    } else {
      try {
        await testSmtpConnection();
        smtp = { status: 'ok', detail: 'SMTP connection successful' };
      } catch (err: any) {
        smtp = { status: 'error', detail: err?.message ?? 'SMTP connection failed' };
      }
    }

    return NextResponse.json({
      tenants: tenantHealth,
      totalTenants: allTenants.length,
      tenantsWithErrors,
      generatedAt: new Date().toISOString(),
      smtp,
    } satisfies HealthSummaryResponse);
  } catch (err: any) {
    console.error('[SuperAdmin] /health API error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

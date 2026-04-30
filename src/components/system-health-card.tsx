'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import type { HealthCheck, HealthStatus, SystemHealthResponse } from '@/app/api/system-health/route';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ── i18n helper ───────────────────────────────────────────────────────────────

/**
 * Resolves a translation key and interpolates {param} placeholders.
 * Falls back to `fallback` when no key is provided (e.g. raw external error messages).
 */
function resolveDetail(
  t: (key: string) => string,
  locale: string,
  detailKey: string | undefined,
  detailParams: Record<string, string | number> | undefined,
  fallback: string
): string {
  if (!detailKey) return fallback;

  let resolved = t(detailKey);
  // If key was not found, t() returns the key itself — fall back to raw detail
  if (resolved === detailKey) return fallback;

  if (detailParams) {
    // Handle {timestamp} specially — format as locale date string
    if (detailParams.timestamp) {
      const formatted = new Date(detailParams.timestamp as string).toLocaleString(
        locale === 'de' ? 'de-DE' : 'en-US',
        { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      );
      resolved = resolved.replace('{time}', formatted);
    }
    Object.entries(detailParams).forEach(([key, value]) => {
      if (key !== 'timestamp') {
        resolved = resolved.replace(`{${key}}`, String(value));
      }
    });
  }

  return resolved;
}

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusIcon({ status, className = 'h-4 w-4' }: { status: HealthStatus; className?: string }) {
  switch (status) {
    case 'ok':
      return <CheckCircle2 className={`${className} text-emerald-500`} />;
    case 'warning':
      return <AlertTriangle className={`${className} text-amber-500`} />;
    case 'error':
      return <XCircle className={`${className} text-red-500`} />;
    default:
      return <HelpCircle className={`${className} text-gray-400`} />;
  }
}

function OverallBanner({
  status,
  errorCount,
  warningCount,
  t,
}: {
  status: HealthStatus;
  errorCount: number;
  warningCount: number;
  t: (key: string) => string;
}) {
  if (status === 'ok') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
        <span className="font-semibold text-emerald-800 text-sm">
          {t('dashboard.systemHealth.overall.ok')}
        </span>
      </div>
    );
  }

  if (status === 'error') {
    const msg =
      warningCount > 0
        ? t('dashboard.systemHealth.overall.errorsWithWarnings')
            .replace('{errors}', String(errorCount))
            .replace('{warnings}', String(warningCount))
        : t('dashboard.systemHealth.overall.errors').replace('{count}', String(errorCount));
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
        <XCircle className="h-5 w-5 text-red-600 shrink-0" />
        <span className="font-semibold text-red-800 text-sm">{msg}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
      <span className="font-semibold text-amber-800 text-sm">
        {t('dashboard.systemHealth.overall.warnings').replace('{count}', String(warningCount))}
      </span>
    </div>
  );
}

function CheckRow({
  check,
  t,
  locale,
}: {
  check: HealthCheck;
  t: (key: string) => string;
  locale: string;
}) {
  const detail = resolveDetail(t, locale, check.detailKey, check.detailParams, check.detail);

  return (
    <div className="flex items-start gap-3 py-2 border-b border-primary/5 last:border-0">
      <div className="mt-0.5 shrink-0">
        <StatusIcon status={check.status} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary leading-tight">{check.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{detail}</p>
      </div>
    </div>
  );
}

// ── Group checks by section ───────────────────────────────────────────────────

const SECTION_KEYS: Record<string, string> = {
  infra: 'dashboard.systemHealth.sections.infra',
  syncs: 'dashboard.systemHealth.sections.syncs',
  integrations: 'dashboard.systemHealth.sections.integrations',
  workflows: 'dashboard.systemHealth.sections.workflows',
};

function groupChecks(checks: HealthCheck[]): Record<string, HealthCheck[]> {
  const groups: Record<string, HealthCheck[]> = {
    infra: [],
    syncs: [],
    integrations: [],
    workflows: [],
  };

  for (const check of checks) {
    if (check.id === 'airtable') {
      groups.infra.push(check);
    } else if (check.id.startsWith('cron:')) {
      groups.syncs.push(check);
    } else if (check.id.startsWith('integration:')) {
      groups.integrations.push(check);
    } else {
      groups.workflows.push(check);
    }
  }

  return groups;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SystemHealthCard() {
  const { data: session } = useSession();
  const { t, locale } = useI18n();
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/system-health');
      if (res.ok) {
        const data: SystemHealthResponse = await res.json();
        setHealth(data);
      }
    } catch {
      // Silently fail — health card is non-critical UI
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Only render for Admins
  if ((session?.user as any)?.role !== 'Admin') return null;

  const errorCount = health?.checks.filter((c) => c.status === 'error').length ?? 0;
  const warningCount = health?.checks.filter((c) => c.status === 'warning').length ?? 0;
  const groups = health ? groupChecks(health.checks) : {};

  const lastChecked = health?.checkedAt
    ? t('dashboard.systemHealth.lastChecked').replace(
        '{time}',
        new Date(health.checkedAt).toLocaleTimeString(
          locale === 'de' ? 'de-DE' : 'en-US',
          { hour: '2-digit', minute: '2-digit' }
        )
      )
    : t('dashboard.systemHealth.checking');

  return (
    <Card className="col-span-3 bg-white border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-primary flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {t('dashboard.systemHealth.title')}
            </CardTitle>
            <CardDescription>{lastChecked}</CardDescription>
          </div>
          <button
            onClick={() => fetchHealth(true)}
            disabled={refreshing}
            className="text-primary/60 hover:text-primary transition-colors disabled:opacity-40"
            title={t('dashboard.systemHealth.checkNow')}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 rounded bg-primary/5 animate-pulse" />
            ))}
          </div>
        ) : health ? (
          <>
            <OverallBanner
              status={health.overall}
              errorCount={errorCount}
              warningCount={warningCount}
              t={t}
            />

            <div className="space-y-4 pt-1">
              {Object.entries(groups).map(([key, checks]) => {
                if (checks.length === 0) return null;
                return (
                  <div key={key}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-0.5">
                      {t(SECTION_KEYS[key])}
                    </p>
                    <div>
                      {checks.map((check) => (
                        <CheckRow key={check.id} check={check} t={t} locale={locale} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('dashboard.systemHealth.loadError')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

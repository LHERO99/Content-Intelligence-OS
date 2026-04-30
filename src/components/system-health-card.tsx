'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import type { HealthCheck, HealthStatus, SystemHealthResponse } from '@/app/api/system-health/route';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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

function OverallBanner({ status, errorCount, warningCount }: { status: HealthStatus; errorCount: number; warningCount: number }) {
  if (status === 'ok') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
        <span className="font-semibold text-emerald-800 text-sm">Alle Systeme laufen</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
        <XCircle className="h-5 w-5 text-red-600 shrink-0" />
        <span className="font-semibold text-red-800 text-sm">
          {errorCount} Fehler erkannt{warningCount > 0 ? `, ${warningCount} Warnung${warningCount > 1 ? 'en' : ''}` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
      <span className="font-semibold text-amber-800 text-sm">
        {warningCount} Warnung{warningCount > 1 ? 'en' : ''}
      </span>
    </div>
  );
}

function CheckRow({ check }: { check: HealthCheck }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-primary/5 last:border-0">
      <div className="mt-0.5 shrink-0">
        <StatusIcon status={check.status} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary leading-tight">{check.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{check.detail}</p>
      </div>
    </div>
  );
}

// Group checks for a cleaner layout
const SECTION_LABELS: Record<string, string> = {
  infra: 'Infrastruktur',
  syncs: 'Daten-Sync (Cron)',
  integrations: 'Integrationen',
  workflows: 'Workflows & Content',
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
    ? new Date(health.checkedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Card className="col-span-3 bg-white border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-primary flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              System Health
            </CardTitle>
            <CardDescription>
              {lastChecked ? `Letzte Prüfung: ${lastChecked}` : 'Wird geprüft…'}
            </CardDescription>
          </div>
          <button
            onClick={() => fetchHealth(true)}
            disabled={refreshing}
            className="text-primary/60 hover:text-primary transition-colors disabled:opacity-40"
            title="Jetzt prüfen"
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
            />

            <div className="space-y-4 pt-1">
              {Object.entries(groups).map(([key, checks]) => {
                if (checks.length === 0) return null;
                return (
                  <div key={key}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-0.5">
                      {SECTION_LABELS[key]}
                    </p>
                    <div>
                      {checks.map((check) => (
                        <CheckRow key={check.id} check={check} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            System Health konnte nicht geladen werden.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

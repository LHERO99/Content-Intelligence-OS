"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  HelpCircle,
  RefreshCw,
  Loader2,
  ChevronDown,
  Activity,
  AlertTriangle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus = "ok" | "error" | "skipped" | "unknown";

interface JobInfo {
  status: JobStatus;
  lastRunAt: string | null;
  detail: string | null;
}

interface TenantHealth {
  tenantId: string;
  tenantName: string;
  jobs: Record<string, JobInfo>;
  hasErrors: boolean;
  lastActivityAt: string | null;
}

interface HealthSummary {
  tenants: TenantHealth[];
  totalTenants: number;
  tenantsWithErrors: number;
  generatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CRON_JOBS = [
  { key: "cron:sync-gsc", label: "GSC Sync" },
  { key: "cron:sync-sistrix", label: "Sistrix Sync" },
  { key: "cron:sync-dataforseo", label: "DataForSEO Sync" },
  { key: "cron:check-integrations", label: "Integration Check" },
];

const SYNC_SOURCES = [
  { value: "all", label: "Alle Quellen" },
  { value: "gsc", label: "GSC" },
  { value: "sistrix", label: "Sistrix" },
  { value: "dataforseo", label: "DataForSEO" },
];

// ─── Helper components ────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: JobStatus }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "skipped":
      return <MinusCircle className="h-4 w-4 text-yellow-500" />;
    default:
      return <HelpCircle className="h-4 w-4 text-gray-400" />;
  }
}

function StatusBadge({ status }: { status: JobStatus }) {
  const variants: Record<JobStatus, string> = {
    ok: "bg-green-100 text-green-800 border-green-200",
    error: "bg-red-100 text-red-800 border-red-200",
    skipped: "bg-yellow-100 text-yellow-800 border-yellow-200",
    unknown: "bg-gray-100 text-gray-500 border-gray-200",
  };
  const labels: Record<JobStatus, string> = {
    ok: "OK",
    error: "Fehler",
    skipped: "Übersprungen",
    unknown: "Unbekannt",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variants[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "–";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days !== 1 ? "en" : ""}`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SuperAdminHealthPage() {
  const [data, setData] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingTenant, setSyncingTenant] = useState<string | null>(null);
  const [syncMessages, setSyncMessages] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message ?? "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function triggerSync(tenantId: string, source: string) {
    setSyncingTenant(`${tenantId}:${source}`);
    setSyncMessages(prev => ({ ...prev, [tenantId]: "" }));

    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const json = await res.json();

      if (!res.ok) {
        setSyncMessages(prev => ({ ...prev, [tenantId]: `Fehler: ${json.error}` }));
      } else {
        const errCount = json.errors?.length ?? 0;
        setSyncMessages(prev => ({
          ...prev,
          [tenantId]: errCount === 0
            ? `Sync gestartet (${source}).`
            : `Sync abgeschlossen mit ${errCount} Fehler(n).`,
        }));
        // Reload health data after short delay
        setTimeout(load, 3000);
      }
    } catch (err: any) {
      setSyncMessages(prev => ({ ...prev, [tenantId]: `Fehler: ${err.message}` }));
    } finally {
      setSyncingTenant(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            System-Gesundheit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cross-Tenant Übersicht der Cron-Job-Statusmeldungen (letzte 48h)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Aktualisieren
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 text-red-700 text-sm">{error}</CardContent>
        </Card>
      )}

      {/* KPI row */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Tenants gesamt</p>
              <p className="text-2xl font-bold">{data.totalTenants}</p>
            </CardContent>
          </Card>
          <Card className={data.tenantsWithErrors > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Tenants mit Fehlern</p>
              <p className={`text-2xl font-bold ${data.tenantsWithErrors > 0 ? "text-red-600" : "text-green-600"}`}>
                {data.tenantsWithErrors}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Fehlerlos</p>
              <p className="text-2xl font-bold text-green-600">
                {data.totalTenants - data.tenantsWithErrors}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Stand</p>
              <p className="text-sm font-medium">
                {formatRelativeTime(data.generatedAt)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tenant grid */}
      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.tenants.map((tenant) => {
            const isSyncing = syncingTenant?.startsWith(tenant.tenantId);
            const msg = syncMessages[tenant.tenantId];

            return (
              <Card
                key={tenant.tenantId}
                className={tenant.hasErrors ? "border-red-200" : ""}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">
                        {tenant.tenantName}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5 font-mono truncate">
                        {tenant.tenantId}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {tenant.hasErrors && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      {/* Sync dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          disabled={!!isSyncing}
                          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSyncing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              Sync
                              <ChevronDown className="h-3 w-3" />
                            </>
                          )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {SYNC_SOURCES.map((s) => (
                            <DropdownMenuItem
                              key={s.value}
                              onClick={() => triggerSync(tenant.tenantId, s.value)}
                            >
                              {s.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {msg && (
                    <p className={`text-xs mt-1 ${msg.startsWith("Fehler") ? "text-red-600" : "text-green-600"}`}>
                      {msg}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {CRON_JOBS.map(({ key, label }) => {
                      const job = tenant.jobs[key] ?? {
                        status: "unknown" as JobStatus,
                        lastRunAt: null,
                        detail: null,
                      };
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <StatusIcon status={job.status} />
                            <span className="text-muted-foreground truncate">{label}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {job.detail && job.status === "error" && (
                              <span
                                className="text-red-500 max-w-[120px] truncate"
                                title={job.detail}
                              >
                                {job.detail}
                              </span>
                            )}
                            <span className="text-muted-foreground whitespace-nowrap">
                              {formatRelativeTime(job.lastRunAt)}
                            </span>
                            <StatusBadge status={job.status} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {tenant.lastActivityAt && (
                    <p className="text-xs text-muted-foreground mt-3 border-t pt-2">
                      Letzte Aktivität: {formatRelativeTime(tenant.lastActivityAt)}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {data && data.tenants.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Keine Tenants gefunden.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

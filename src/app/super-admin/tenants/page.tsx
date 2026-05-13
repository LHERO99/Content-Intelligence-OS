"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Bot,
  Loader2,
  Plus,
  Users,
  FileText,
  Link2,
  Activity,
  Plug,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  userCount: number;
  tierId: string | null;
  billingCycle: "monthly" | "yearly" | null;
  subStatus: "active" | "inactive" | "trial" | null;
  tierName: string | null;
  monthlyPrice: string | null;
  yearlyPrice: string | null;
}

interface HealthCriterion {
  key: string;
  label: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  detail: string;
}

interface IntegrationDetail {
  name: string;
  connected: boolean;
  detail: string;
}

interface TenantHealth {
  tenant: { id: string; name: string; createdAt: string };
  health: {
    score: number;
    status: "healthy" | "warning" | "critical";
    criteria: HealthCriterion[];
  };
  stats: {
    keywordCount: number;
    urlCount: number;
    erstellungen30d: number;
    optimierungen30d: number;
    totalContentLogs: number;
    lastActivityDate: string | null;
    daysSinceActivity: number | null;
    userCount: number;
    keywordsByStatus: { status: string; count: number }[];
  };
  integrationDetails: IntegrationDetail[];
  agentType: string;
  subscription: {
    tierId: string | null;
    billingCycle: "monthly" | "yearly";
    status: string;
    tierName: string | null;
    monthlyPrice: string | null;
    yearlyPrice: string | null;
  } | null;
}

interface PricingTier {
  id: string;
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  features: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function HealthBadge({ status }: { status: "healthy" | "warning" | "critical" }) {
  if (status === "healthy") return (
    <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
      <CheckCircle2 className="w-3 h-3" /> Healthy
    </Badge>
  );
  if (status === "warning") return (
    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1">
      <AlertTriangle className="w-3 h-3" /> Warning
    </Badge>
  );
  return (
    <Badge className="bg-red-100 text-red-800 border-red-200 gap-1">
      <XCircle className="w-3 h-3" /> Critical
    </Badge>
  );
}

function formatPrice(price: string | null, cycle: "monthly" | "yearly" | null): string {
  if (!price) return "—";
  const num = parseFloat(price);
  return `€${num.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} / ${cycle === "yearly" ? "Jahr" : "Monat"}`;
}

const KEYWORD_STATUS_ORDER = [
  "Published", "In Arbeit", "Angeliefert", "Review",
  "Optimierung", "Beauftragt", "Planned", "Backlog",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const [tenants, setTenants]               = useState<Tenant[]>([]);
  const [loading, setLoading]               = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<TenantHealth | null>(null);
  const [detailLoading, setDetailLoading]   = useState(false);
  const [tiers, setTiers]                   = useState<PricingTier[]>([]);
  const [subForm, setSubForm]               = useState<{ tierId: string; billingCycle: string } | null>(null);
  const [savingSub, setSavingSub]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantsRes, tiersRes] = await Promise.all([
        fetch("/api/super-admin/tenants"),
        fetch("/api/super-admin/pricing-tiers"),
      ]);
      setTenants(await tenantsRes.json());
      setTiers(await tiersRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (tenantId: string) => {
    setDetailLoading(true);
    setSelectedTenant(null);
    const res  = await fetch(`/api/super-admin/tenants/${tenantId}`);
    const data = await res.json();
    setSelectedTenant(data);
    setSubForm({
      tierId:       data.subscription?.tierId       ?? "",
      billingCycle: data.subscription?.billingCycle ?? "monthly",
    });
    setDetailLoading(false);
  };

  const saveSub = async () => {
    if (!selectedTenant || !subForm) return;
    setSavingSub(true);
    await fetch("/api/super-admin/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId:     selectedTenant.tenant.id,
        tierId:       subForm.tierId || null,
        billingCycle: subForm.billingCycle,
        status:       "active",
      }),
    });
    setSavingSub(false);
    setSelectedTenant(null);
    load();
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6" /> Tenants
          </h1>
          <p className="text-muted-foreground mt-1">
            Alle registrierten Kunden-Accounts. Klicke auf einen Eintrag für den Health-Status und Details.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Tenant-Übersicht</CardTitle>
              <CardDescription>
                Klicke auf einen Eintrag für den vollständigen Health-Breakdown und Subscription-Verwaltung.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load} className="gap-1">
              <RefreshCw className="w-3 h-3" /> Aktualisieren
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Preis</TableHead>
                    <TableHead>Nutzer</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(t.id)}
                    >
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        {t.tierName
                          ? <Badge variant="outline">{t.tierName}</Badge>
                          : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell>
                        {t.billingCycle
                          ? <Badge variant="secondary">{t.billingCycle === "yearly" ? "Jährlich" : "Monatlich"}</Badge>
                          : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatPrice(
                          t.billingCycle === "yearly" ? t.yearlyPrice : t.monthlyPrice,
                          t.billingCycle
                        )}
                      </TableCell>
                      <TableCell>{t.userCount}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(t.createdAt).toLocaleDateString("de-DE")}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {tenants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Noch keine Tenants angelegt.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tenant Detail Dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={!!selectedTenant || detailLoading}
        onOpenChange={(o) => { if (!o) setSelectedTenant(null); }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailLoading || !selectedTenant ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedTenant.tenant.name}</DialogTitle>
                <DialogDescription>
                  Tenant seit {new Date(selectedTenant.tenant.createdAt).toLocaleDateString("de-DE")}
                  {" · "}
                  {selectedTenant.stats.userCount} Nutzer
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-2">

                {/* ── Health Score Bar ─────────────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Health Score</span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{selectedTenant.health.score}</span>
                      <span className="text-muted-foreground text-sm">/ 100</span>
                      <HealthBadge status={selectedTenant.health.status} />
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedTenant.health.status === "healthy" ? "bg-green-500" :
                        selectedTenant.health.status === "warning"  ? "bg-yellow-500" :
                        "bg-red-500"
                      }`}
                      style={{ width: `${selectedTenant.health.score}%` }}
                    />
                  </div>
                </div>

                {/* ── Health Criteria Breakdown ─────────────────────────────── */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Health Breakdown
                  </div>
                  <div className="divide-y">
                    {selectedTenant.health.criteria.map((c) => (
                      <div key={c.key} className="flex items-start gap-3 px-4 py-3">
                        <div className="mt-0.5 shrink-0">
                          {c.passed
                            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                            : <XCircle className="w-4 h-4 text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{c.label}</span>
                            <span className={`text-xs font-mono font-bold shrink-0 ${
                              c.passed ? "text-green-600" : "text-muted-foreground"
                            }`}>
                              +{c.points} / {c.maxPoints} Pkt.
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{c.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Stats Overview ────────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MiniStat icon={<FileText className="w-4 h-4" />}  label="Keywords"         value={selectedTenant.stats.keywordCount.toLocaleString("de-DE")} />
                  <MiniStat icon={<Link2 className="w-4 h-4" />}     label="URLs"             value={selectedTenant.stats.urlCount.toLocaleString("de-DE")} />
                  <MiniStat icon={<Activity className="w-4 h-4" />}  label="Logs gesamt"      value={selectedTenant.stats.totalContentLogs.toLocaleString("de-DE")} />
                  <MiniStat icon={<Users className="w-4 h-4" />}     label="Nutzer"           value={String(selectedTenant.stats.userCount)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MiniStat icon={<Plus className="w-4 h-4" />}      label="Erstellungen (30d)"  value={String(selectedTenant.stats.erstellungen30d)} />
                  <MiniStat icon={<RefreshCw className="w-4 h-4" />} label="Optimierungen (30d)" value={String(selectedTenant.stats.optimierungen30d)} />
                </div>

                {selectedTenant.stats.lastActivityDate && (
                  <p className="text-xs text-muted-foreground px-1">
                    Letzte Aktivität:{" "}
                    <span className="font-medium text-foreground">
                      {new Date(selectedTenant.stats.lastActivityDate).toLocaleDateString("de-DE")}
                    </span>
                    {selectedTenant.stats.daysSinceActivity !== null && (
                      <> &mdash; vor {selectedTenant.stats.daysSinceActivity} Tagen</>
                    )}
                  </p>
                )}

                {/* ── Keyword Status Breakdown ──────────────────────────────── */}
                {selectedTenant.stats.keywordsByStatus.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-semibold mb-2">Keywords nach Status</p>
                      <div className="flex flex-wrap gap-2">
                        {[...selectedTenant.stats.keywordsByStatus]
                          .sort((a, b) => {
                            const ai = KEYWORD_STATUS_ORDER.indexOf(a.status);
                            const bi = KEYWORD_STATUS_ORDER.indexOf(b.status);
                            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                          })
                          .map((ks) => (
                            <div
                              key={ks.status}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-muted/30 text-xs"
                            >
                              <span className="font-medium">{ks.status}</span>
                              <span className="text-muted-foreground bg-background px-1.5 py-0.5 rounded-full font-mono">
                                {ks.count}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ── Integrations ──────────────────────────────────────────── */}
                <Separator />
                <div>
                  <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Plug className="w-4 h-4" /> Integrationen
                  </p>
                  <div className="space-y-2">
                    {selectedTenant.integrationDetails.map((intg) => (
                      <div key={intg.name} className="flex items-start gap-2.5">
                        {intg.connected
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          : <XCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                        <div>
                          <span className={`text-sm font-medium ${!intg.connected ? "text-muted-foreground" : ""}`}>
                            {intg.name}
                          </span>
                          <p className="text-xs text-muted-foreground">{intg.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Agent Type ────────────────────────────────────────────── */}
                <div className="flex items-center gap-2 text-sm">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Agent-Typ:</span>
                  <Badge variant="secondary">
                    {selectedTenant.agentType === "internal"  ? "Intern (n8n)" :
                     selectedTenant.agentType === "external"  ? "Extern" :
                     "Nicht konfiguriert"}
                  </Badge>
                </div>

                {/* ── Subscription ──────────────────────────────────────────── */}
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Subscription</p>
                  {subForm && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Pricing Tier</Label>
                        <Select
                          value={subForm.tierId}
                          onValueChange={(v) => setSubForm({ ...subForm, tierId: v ?? "" })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Kein Tier" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Kein Tier</SelectItem>
                            {tiers.map((tier) => (
                              <SelectItem key={tier.id} value={tier.id}>{tier.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Billing Cycle</Label>
                        <Select
                          value={subForm.billingCycle}
                          onValueChange={(v) => setSubForm({ ...subForm, billingCycle: v ?? "monthly" })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Monatlich</SelectItem>
                            <SelectItem value="yearly">Jährlich</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTenant(null)}>Schließen</Button>
                <Button onClick={saveSub} disabled={savingSub}>
                  {savingSub && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Subscription speichern
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Mini Stat Card ───────────────────────────────────────────────────────────

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
      <div className="text-muted-foreground shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

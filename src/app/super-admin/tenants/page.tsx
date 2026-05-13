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
  Link2,
  Bot,
  FileText,
  Loader2,
  Plus,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface TenantHealth {
  tenant: { id: string; name: string; createdAt: string };
  health: { score: number; status: "healthy" | "warning" | "critical" };
  stats: {
    keywordCount: number;
    urlCount: number;
    erstellungen30d: number;
    optimierungen30d: number;
    totalContentLogs: number;
  };
  integrations: string[];
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value.toLocaleString("de-DE")}</p>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<TenantHealth | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [subForm, setSubForm] = useState<{ tierId: string; billingCycle: string } | null>(null);
  const [savingSub, setSavingSub] = useState(false);

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
    const res = await fetch(`/api/super-admin/tenants/${tenantId}`);
    const data = await res.json();
    setSelectedTenant(data);
    setSubForm({
      tierId: data.subscription?.tierId ?? "",
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="w-6 h-6" /> Tenants
        </h1>
        <p className="text-muted-foreground mt-1">Alle registrierten Kunden-Accounts im System.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tenant-Übersicht</CardTitle>
            <CardDescription>Klicke auf einen Eintrag für Details, Health-Status und Subscription-Verwaltung.</CardDescription>
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
                      {t.tierName ? (
                        <Badge variant="outline">{t.tierName}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.billingCycle ? (
                        <Badge variant="secondary">
                          {t.billingCycle === "yearly" ? "Jährlich" : "Monatlich"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
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

      {/* Tenant Detail Dialog */}
      <Dialog
        open={!!selectedTenant || detailLoading}
        onOpenChange={(o) => { if (!o) setSelectedTenant(null); }}
      >
        <DialogContent className="max-w-2xl">
          {detailLoading || !selectedTenant ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTenant.tenant.name}</DialogTitle>
                <DialogDescription>Tenant Health &amp; Details</DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* Health Score */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Health Score</span>
                      <HealthBadge status={selectedTenant.health.status} />
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          selectedTenant.health.status === "healthy" ? "bg-green-500" :
                          selectedTenant.health.status === "warning"  ? "bg-yellow-500" :
                          "bg-red-500"
                        }`}
                        style={{ width: `${selectedTenant.health.score}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-2xl font-bold w-12 text-right">
                    {selectedTenant.health.score}
                  </span>
                </div>

                <Separator />

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={<FileText className="w-4 h-4" />}  label="Keywords in DB"           value={selectedTenant.stats.keywordCount} />
                  <StatCard icon={<Link2 className="w-4 h-4" />}     label="URLs in DB"               value={selectedTenant.stats.urlCount} />
                  <StatCard icon={<Plus className="w-4 h-4" />}      label="Erstellungen (30 Tage)"   value={selectedTenant.stats.erstellungen30d} />
                  <StatCard icon={<RefreshCw className="w-4 h-4" />} label="Optimierungen (30 Tage)"  value={selectedTenant.stats.optimierungen30d} />
                </div>

                <Separator />

                {/* Integrations & Agent */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Verbundene Integrationen</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTenant.integrations.length > 0 ? (
                      selectedTenant.integrations.map((i) => (
                        <Badge key={i} variant="outline" className="gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-500" /> {i}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">Keine Integrationen verbunden</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Agent-Typ:</span>
                  <Badge variant="secondary">
                    {selectedTenant.agentType === "internal"  ? "Intern (n8n)" :
                     selectedTenant.agentType === "external"  ? "Extern" :
                     "Nicht konfiguriert"}
                  </Badge>
                </div>

                <Separator />

                {/* Subscription */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">Subscription</p>
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
    </div>
  );
}

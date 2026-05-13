"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  BarChart3,
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Link2,
  Bot,
  FileText,
  Loader2,
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
  createdAt: string;
  updatedAt: string;
}

type FeatureStatus = "Open" | "InValidation" | "Planned" | "InDevelopment" | "Released" | "Cancelled";

interface FeatureRequest {
  id: string;
  type: "feature" | "bug";
  title: string;
  description: string | null;
  status: FeatureStatus;
  priority: "low" | "medium" | "high";
  createdAt: string;
  tenantId: string;
  tenantName: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function StatusBadge({ status }: { status: FeatureStatus }) {
  const map: Record<FeatureStatus, string> = {
    Open:          "bg-slate-100 text-slate-800",
    InValidation:  "bg-blue-100 text-blue-800",
    Planned:       "bg-purple-100 text-purple-800",
    InDevelopment: "bg-orange-100 text-orange-800",
    Released:      "bg-green-100 text-green-800",
    Cancelled:     "bg-red-100 text-red-800",
  };
  const labels: Record<FeatureStatus, string> = {
    Open:          "Open",
    InValidation:  "In Validation",
    Planned:       "Planned",
    InDevelopment: "In Development",
    Released:      "Released",
    Cancelled:     "Cancelled",
  };
  return <Badge className={map[status]}>{labels[status]}</Badge>;
}

function PriorityBadge({ priority }: { priority: "low" | "medium" | "high" }) {
  const map = {
    low:    "bg-slate-100 text-slate-700",
    medium: "bg-yellow-100 text-yellow-800",
    high:   "bg-red-100 text-red-800",
  };
  return <Badge className={map[priority]}>{priority}</Badge>;
}

function formatPrice(price: string | null, cycle: "monthly" | "yearly" | null): string {
  if (!price) return "—";
  const num = parseFloat(price);
  return `€${num.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} / ${cycle === "yearly" ? "Jahr" : "Monat"}`;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "SuperAdmin") {
      router.replace("/");
    }
  }, [session, status, router]);

  if (status === "loading" || !session || session.user.role !== "SuperAdmin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Super-Admin</h1>
        <p className="text-muted-foreground mt-1">
          Zentrale Verwaltung aller Tenants, Pricing-Tiers und Feedback.
        </p>
      </div>

      <Tabs defaultValue="tenants">
        <TabsList className="mb-6">
          <TabsTrigger value="tenants" className="gap-2">
            <Building2 className="w-4 h-4" /> Tenants
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <BarChart3 className="w-4 h-4" /> Pricing Tiers
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-2">
            <MessageSquare className="w-4 h-4" /> Feature &amp; Bugs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tenants">
          <TenantsTab />
        </TabsContent>
        <TabsContent value="pricing">
          <PricingTab />
        </TabsContent>
        <TabsContent value="feedback">
          <FeedbackTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tenants Tab ─────────────────────────────────────────────────────────────

function TenantsTab() {
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
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tenants</CardTitle>
            <CardDescription>Alle registrierten Kunden-Accounts im System</CardDescription>
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
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(t.id)}>
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
      <Dialog open={!!selectedTenant || detailLoading} onOpenChange={(o) => { if (!o) setSelectedTenant(null); }}>
        <DialogContent className="max-w-2xl">
          {detailLoading || !selectedTenant ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTenant.tenant.name}</DialogTitle>
                <DialogDescription>Tenant Health & Details</DialogDescription>
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
                          selectedTenant.health.status === "warning" ? "bg-yellow-500" :
                          "bg-red-500"
                        }`}
                        style={{ width: `${selectedTenant.health.score}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-2xl font-bold w-12 text-right">{selectedTenant.health.score}</span>
                </div>

                <Separator />

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={<FileText className="w-4 h-4" />} label="Keywords in DB" value={selectedTenant.stats.keywordCount} />
                  <StatCard icon={<Link2 className="w-4 h-4" />} label="URLs in DB" value={selectedTenant.stats.urlCount} />
                  <StatCard icon={<Plus className="w-4 h-4" />} label="Erstellungen (30 Tage)" value={selectedTenant.stats.erstellungen30d} />
                  <StatCard icon={<RefreshCw className="w-4 h-4" />} label="Optimierungen (30 Tage)" value={selectedTenant.stats.optimierungen30d} />
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
                    {selectedTenant.agentType === "internal" ? "Intern (n8n)" :
                     selectedTenant.agentType === "external" ? "Extern" : "Nicht konfiguriert"}
                  </Badge>
                </div>

                <Separator />

                {/* Subscription Management */}
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
    </>
  );
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

// ─── Pricing Tab ─────────────────────────────────────────────────────────────

function PricingTab() {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTier, setEditTier] = useState<PricingTier | null>(null);
  const [form, setForm] = useState({ name: "", monthlyPrice: "", yearlyPrice: "", features: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/pricing-tiers");
    setTiers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTier(null);
    setForm({ name: "", monthlyPrice: "", yearlyPrice: "", features: "" });
    setDialogOpen(true);
  };

  const openEdit = (tier: PricingTier) => {
    setEditTier(tier);
    setForm({
      name: tier.name,
      monthlyPrice: tier.monthlyPrice,
      yearlyPrice: tier.yearlyPrice,
      features: (tier.features ?? []).join("\n"),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      name:         form.name,
      monthlyPrice: parseFloat(form.monthlyPrice) || 0,
      yearlyPrice:  parseFloat(form.yearlyPrice) || 0,
      features:     form.features.split("\n").map((f) => f.trim()).filter(Boolean),
    };

    if (editTier) {
      await fetch(`/api/super-admin/pricing-tiers/${editTier.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/super-admin/pricing-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const deleteTier = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/super-admin/pricing-tiers/${id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pricing Tiers</CardTitle>
            <CardDescription>Definiere Abonnement-Pläne und Preise</CardDescription>
          </div>
          <Button size="sm" className="gap-1" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Neuer Tier
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tiers.map((tier) => (
                <Card key={tier.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{tier.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tier)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteTier(tier.id)}
                          disabled={deletingId === tier.id}
                        >
                          {deletingId === tier.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-md bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">Monatlich</p>
                        <p className="font-bold text-sm">€{parseFloat(tier.monthlyPrice).toLocaleString("de-DE")}</p>
                      </div>
                      <div className="p-2 rounded-md bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">Jährlich</p>
                        <p className="font-bold text-sm">€{parseFloat(tier.yearlyPrice).toLocaleString("de-DE")}</p>
                      </div>
                    </div>
                    {tier.features && tier.features.length > 0 && (
                      <ul className="space-y-1">
                        {tier.features.map((f, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
              {tiers.length === 0 && (
                <div className="col-span-3 text-center text-muted-foreground py-12">
                  Noch keine Pricing Tiers angelegt. Klicke &quot;Neuer Tier&quot; um zu beginnen.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTier ? "Tier bearbeiten" : "Neuen Tier anlegen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. Starter, Pro, Enterprise"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monatspreis (€)</Label>
                <Input
                  type="number"
                  value={form.monthlyPrice}
                  onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Jahrespreis (€)</Label>
                <Input
                  type="number"
                  value={form.yearlyPrice}
                  onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Features (eine pro Zeile)</Label>
              <textarea
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                placeholder={"Unbegrenzte Keywords\nGSC Integration\nPriority Support"}
                rows={5}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving || !form.name}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editTier ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Feedback Tab ─────────────────────────────────────────────────────────────

const FEATURE_STATUSES: FeatureStatus[] = ["Open", "InValidation", "Planned", "InDevelopment", "Released", "Cancelled"];

function FeedbackTab() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/super-admin/feature-requests?${params}`);
    setRequests(await res.json());
    setLoading(false);
  }, [typeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: FeatureStatus) => {
    setUpdatingId(id);
    await fetch(`/api/super-admin/feature-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    setUpdatingId(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Feature Requests &amp; Bug Reports</CardTitle>
            <CardDescription>Zentrale Ansicht aller Einreichungen von Tenants</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {FEATURE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={load}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
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
                <TableHead className="w-20">Typ</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Priorität</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erstellt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={r.type === "bug" ? "border-red-300 text-red-700" : "border-blue-300 text-blue-700"}
                    >
                      {r.type === "bug" ? "Bug" : "Feature"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{r.title}</p>
                      {r.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.tenantName ?? r.tenantId}
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={r.priority} />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.status}
                      onValueChange={(v) => updateStatus(r.id, v as FeatureStatus)}
                      disabled={updatingId === r.id}
                    >
                      <SelectTrigger className="h-7 text-xs w-40 border-0 p-0 shadow-none focus:ring-0">
                        <StatusBadge status={r.status} />
                      </SelectTrigger>
                      <SelectContent>
                        {FEATURE_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            <StatusBadge status={s} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString("de-DE")}
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Keine Einträge gefunden.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

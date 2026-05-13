"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ArrowLeft,
  Bot,
  Loader2,
  Plus,
  Users,
  FileText,
  Link2,
  Activity,
  Plug,
  Pencil,
  Clock,
  HelpCircle,
  CreditCard,
  CalendarDays,
  ShieldCheck,
  ShieldOff,
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

interface CronEntry {
  key: string;
  label: string;
  status: "ok" | "warning" | "error" | "unknown";
  timestamp: string | null;
  detail: string;
}

interface TenantUser {
  id: string;
  name: string | null;
  email: string;
  role: "Admin" | "Editor" | "Viewer" | "SuperAdmin";
  passwordChanged: boolean | null;
  isActive: boolean;
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
    status: "active" | "inactive" | "trial";
    startDate: string | null;
    tierName: string | null;
    monthlyPrice: string | null;
    yearlyPrice: string | null;
  } | null;
  cronStatus: CronEntry[];
}

interface PricingTier {
  id: string;
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
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

function relativeTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) return "—";
  const ms = Date.now() - new Date(isoTimestamp).getTime();
  const mins  = Math.floor(ms / 60_000);
  const hours = Math.floor(ms / 3_600_000);
  const days  = Math.floor(ms / 86_400_000);
  if (mins  < 2)  return "gerade eben";
  if (mins  < 60) return `vor ${mins} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  if (days  < 30) return `vor ${days} Tag${days !== 1 ? "en" : ""}`;
  return new Date(isoTimestamp).toLocaleDateString("de-DE");
}

const KEYWORD_STATUS_ORDER = [
  "Published", "In Arbeit", "Angeliefert", "Review",
  "Optimierung", "Beauftragt", "Planned", "Backlog",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const [tenants, setTenants]                     = useState<Tenant[]>([]);
  const [tiers, setTiers]                         = useState<PricingTier[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [selectedTenantId, setSelectedTenantId]   = useState<string | null>(null);
  const [tenantDetail, setTenantDetail]           = useState<TenantHealth | null>(null);
  const [detailLoading, setDetailLoading]         = useState(false);
  const [subForm, setSubForm]                     = useState<{ tierId: string; billingCycle: string } | null>(null);
  const [subEditOpen, setSubEditOpen]             = useState(false);
  const [savingSub, setSavingSub]                 = useState(false);

  // Users state
  const [tenantUsers, setTenantUsers]             = useState<TenantUser[]>([]);
  const [usersLoading, setUsersLoading]           = useState(false);
  const [editUser, setEditUser]                   = useState<TenantUser | null>(null);
  const [userForm, setUserForm]                   = useState({ name: "", email: "", role: "Editor", isActive: true });
  const [savingUser, setSavingUser]               = useState(false);
  const [userError, setUserError]                 = useState<string | null>(null);

  // Create tenant dialog
  const [createOpen, setCreateOpen]   = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating]       = useState(false);
  const [createForm, setCreateForm]   = useState({
    tenantName:    "",
    adminName:     "",
    adminEmail:    "",
    adminPassword: "",
    tierId:        "",
    billingCycle:  "monthly",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [tenantsRes, tiersRes] = await Promise.all([
      fetch("/api/super-admin/tenants"),
      fetch("/api/super-admin/pricing-tiers"),
    ]);
    setTenants(await tenantsRes.json());
    setTiers(await tiersRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadUsers = useCallback(async (tenantId: string) => {
    setUsersLoading(true);
    const res = await fetch(`/api/super-admin/tenants/${tenantId}/users`);
    setTenantUsers(await res.json());
    setUsersLoading(false);
  }, []);

  // Open detail view
  const openDetail = useCallback(async (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setDetailLoading(true);
    setTenantDetail(null);
    setSubEditOpen(false);
    const res  = await fetch(`/api/super-admin/tenants/${tenantId}`);
    const data = await res.json();
    setTenantDetail(data);
    setSubForm({
      tierId:       data.subscription?.tierId       ?? "",
      billingCycle: data.subscription?.billingCycle ?? "monthly",
    });
    setDetailLoading(false);
    loadUsers(tenantId);
  }, [loadUsers]);

  const closeDetail = () => {
    setSelectedTenantId(null);
    setTenantDetail(null);
    setTenantUsers([]);
    setSubEditOpen(false);
  };

  const saveSub = async () => {
    if (!tenantDetail || !subForm) return;
    setSavingSub(true);
    await fetch("/api/super-admin/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId:     tenantDetail.tenant.id,
        tierId:       subForm.tierId || null,
        billingCycle: subForm.billingCycle,
        status:       "active",
      }),
    });
    setSavingSub(false);
    setSubEditOpen(false);
    openDetail(tenantDetail.tenant.id);
    load();
  };

  const openEditUser = (u: TenantUser) => {
    setEditUser(u);
    setUserForm({ name: u.name ?? "", email: u.email, role: u.role, isActive: u.isActive });
    setUserError(null);
  };

  const saveUser = async () => {
    if (!editUser || !selectedTenantId) return;
    setUserError(null);
    setSavingUser(true);
    const res = await fetch(`/api/super-admin/tenants/${selectedTenantId}/users/${editUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });
    const data = await res.json();
    setSavingUser(false);
    if (!res.ok) {
      setUserError(data.error ?? "Fehler beim Speichern.");
      return;
    }
    setEditUser(null);
    loadUsers(selectedTenantId);
  };

  const submitCreate = async () => {
    setCreateError(null);
    if (!createForm.tenantName || !createForm.adminEmail || !createForm.adminPassword) {
      setCreateError("Unternehmensname, E-Mail und Passwort sind Pflichtfelder.");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/super-admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setCreateError(data.error ?? "Fehler beim Anlegen des Tenants.");
      return;
    }
    setCreateOpen(false);
    setCreateForm({ tenantName: "", adminName: "", adminEmail: "", adminPassword: "", tierId: "", billingCycle: "monthly" });
    load();
  };

  // ── Detail view (full page, Monitoring pattern) ──────────────────────────
  if (selectedTenantId) {
    return (
      <>
        <TenantDetailView
          tenantDetail={tenantDetail}
          loading={detailLoading}
          tiers={tiers}
          subForm={subForm}
          setSubForm={setSubForm}
          subEditOpen={subEditOpen}
          setSubEditOpen={setSubEditOpen}
          savingSub={savingSub}
          onSaveSub={saveSub}
          onBack={closeDetail}
          onRefresh={() => openDetail(selectedTenantId)}
          tenantUsers={tenantUsers}
          usersLoading={usersLoading}
          onEditUser={openEditUser}
        />

        {/* Edit User Dialog */}
        <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nutzer bearbeiten</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {userError && (
                <Alert variant="destructive">
                  <AlertDescription>{userError}</AlertDescription>
                </Alert>
              )}
              <div>
                <Label>Name</Label>
                <Input
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="Vorname Nachname"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>E-Mail</Label>
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Rolle</Label>
                <Select
                  value={userForm.role}
                  onValueChange={(v) => setUserForm({ ...userForm, role: v ?? userForm.role })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Editor">Editor</SelectItem>
                    <SelectItem value="Viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Account aktiv</p>
                  <p className="text-xs text-muted-foreground">
                    Gesperrte Nutzer können sich nicht einloggen.
                  </p>
                </div>
                <Switch
                  checked={userForm.isActive}
                  onCheckedChange={(v) => setUserForm({ ...userForm, isActive: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUser(null)}>Abbrechen</Button>
              <Button onClick={saveUser} disabled={savingUser || !userForm.email}>
                {savingUser && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────
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

      {/* ── FAB ── */}
      <Button
        className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-xl z-50"
        size="icon"
        onClick={() => setCreateOpen(true)}
        title="Neuen Tenant anlegen"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* ── Create Tenant Dialog ── */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreateError(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neuen Tenant anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Unternehmen
              </p>
              <div>
                <Label>Unternehmensname <span className="text-destructive">*</span></Label>
                <Input
                  value={createForm.tenantName}
                  onChange={(e) => setCreateForm({ ...createForm, tenantName: e.target.value })}
                  placeholder="z.B. Acme GmbH"
                  className="mt-1"
                />
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Admin-Account
              </p>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={createForm.adminName}
                    onChange={(e) => setCreateForm({ ...createForm, adminName: e.target.value })}
                    placeholder="Vorname Nachname"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>E-Mail <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    value={createForm.adminEmail}
                    onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                    placeholder="admin@unternehmen.de"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Initiales Passwort <span className="text-destructive">*</span></Label>
                  <Input
                    type="password"
                    value={createForm.adminPassword}
                    onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
                    placeholder="Min. 8 Zeichen"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Der Admin wird beim ersten Login aufgefordert, das Passwort zu ändern.
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Subscription (optional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Pricing Tier</Label>
                  <Select
                    value={createForm.tierId || "none"}
                    onValueChange={(v) => setCreateForm({ ...createForm, tierId: v === "none" ? "" : (v ?? "") })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Kein Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Tier</SelectItem>
                      {tiers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Billing Cycle</Label>
                  <Select
                    value={createForm.billingCycle}
                    onValueChange={(v) => setCreateForm({ ...createForm, billingCycle: v ?? "monthly" })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monatlich</SelectItem>
                      <SelectItem value="yearly">Jährlich</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
            <Button
              onClick={submitCreate}
              disabled={creating || !createForm.tenantName || !createForm.adminEmail || !createForm.adminPassword}
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Tenant anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Detail View Component (full page, no modal) ──────────────────────────────

function TenantDetailView({
  tenantDetail,
  loading,
  tiers,
  subForm,
  setSubForm,
  subEditOpen,
  setSubEditOpen,
  savingSub,
  onSaveSub,
  onBack,
  onRefresh,
  tenantUsers,
  usersLoading,
  onEditUser,
}: {
  tenantDetail: TenantHealth | null;
  loading: boolean;
  tiers: PricingTier[];
  subForm: { tierId: string; billingCycle: string } | null;
  setSubForm: (f: { tierId: string; billingCycle: string }) => void;
  subEditOpen: boolean;
  setSubEditOpen: (o: boolean) => void;
  savingSub: boolean;
  onSaveSub: () => void;
  onBack: () => void;
  onRefresh: () => void;
  tenantUsers: TenantUser[];
  usersLoading: boolean;
  onEditUser: (u: TenantUser) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2 -ml-2">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
        </Button>
        {tenantDetail && (
          <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1">
            <RefreshCw className="w-3 h-3" /> Aktualisieren
          </Button>
        )}
      </div>

      {loading || !tenantDetail ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Page title */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{tenantDetail.tenant.name}</h1>
            <p className="text-muted-foreground mt-1">
              Tenant seit {new Date(tenantDetail.tenant.createdAt).toLocaleDateString("de-DE")}
              {" · "}
              {tenantDetail.stats.userCount} Nutzer
            </p>
          </div>

          {/* Top row: Health + Subscription */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Health Score */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Health Score</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold">{tenantDetail.health.score}</span>
                      <span className="text-muted-foreground">/ 100</span>
                    </div>
                    <HealthBadge status={tenantDetail.health.status} />
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        tenantDetail.health.status === "healthy" ? "bg-green-500" :
                        tenantDetail.health.status === "warning"  ? "bg-yellow-500" :
                        "bg-red-500"
                      }`}
                      style={{ width: `${tenantDetail.health.score}%` }}
                    />
                  </div>
                </div>

                {/* Breakdown */}
                <div className="rounded-lg border divide-y">
                  {tenantDetail.health.criteria.map((c) => (
                    <div key={c.key} className="flex items-start gap-3 px-3 py-2.5">
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
                            +{c.points}/{c.maxPoints}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Subscription — redesigned */}
            <SubscriptionCard
              subscription={tenantDetail.subscription}
              tiers={tiers}
              subForm={subForm}
              setSubForm={setSubForm}
              subEditOpen={subEditOpen}
              setSubEditOpen={setSubEditOpen}
              savingSub={savingSub}
              onSaveSub={onSaveSub}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat icon={<FileText className="w-4 h-4" />}  label="Keywords"         value={tenantDetail.stats.keywordCount.toLocaleString("de-DE")} />
            <MiniStat icon={<Link2 className="w-4 h-4" />}     label="URLs"             value={tenantDetail.stats.urlCount.toLocaleString("de-DE")} />
            <MiniStat icon={<Activity className="w-4 h-4" />}  label="Content-Logs"     value={tenantDetail.stats.totalContentLogs.toLocaleString("de-DE")} />
            <MiniStat icon={<Users className="w-4 h-4" />}     label="Nutzer"           value={String(tenantDetail.stats.userCount)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat icon={<Plus className="w-4 h-4" />}      label="Erstellungen (30 Tage)"  value={String(tenantDetail.stats.erstellungen30d)} />
            <MiniStat icon={<RefreshCw className="w-4 h-4" />} label="Optimierungen (30 Tage)" value={String(tenantDetail.stats.optimierungen30d)} />
          </div>
          {tenantDetail.stats.lastActivityDate && (
            <p className="text-xs text-muted-foreground">
              Letzte Aktivität:{" "}
              <span className="font-medium text-foreground">
                {new Date(tenantDetail.stats.lastActivityDate).toLocaleDateString("de-DE")}
              </span>
              {tenantDetail.stats.daysSinceActivity !== null && (
                <> — vor {tenantDetail.stats.daysSinceActivity} Tagen</>
              )}
            </p>
          )}

          {/* Cron Status */}
          <CronStatusCard cronStatus={tenantDetail.cronStatus} />

          {/* Bottom row: Keywords by status + Integrations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Keyword status breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Keywords nach Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tenantDetail.stats.keywordsByStatus.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {[...tenantDetail.stats.keywordsByStatus]
                      .sort((a, b) => {
                        const ai = KEYWORD_STATUS_ORDER.indexOf(a.status);
                        const bi = KEYWORD_STATUS_ORDER.indexOf(b.status);
                        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                      })
                      .map((ks) => (
                        <div
                          key={ks.status}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border bg-muted/30 text-xs"
                        >
                          <span className="font-medium">{ks.status}</span>
                          <span className="text-muted-foreground bg-background px-1.5 py-0.5 rounded-full font-mono">
                            {ks.count}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine Keywords vorhanden.</p>
                )}
              </CardContent>
            </Card>

            {/* Integrations + Agent */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plug className="w-4 h-4" /> Integrationen &amp; Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2.5">
                  {tenantDetail.integrationDetails.map((intg) => (
                    <div key={intg.name} className="flex items-start gap-2.5">
                      {intg.connected
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        : <XCircle className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />}
                      <div>
                        <span className={`text-sm font-medium ${!intg.connected ? "text-muted-foreground" : ""}`}>
                          {intg.name}
                        </span>
                        <p className="text-xs text-muted-foreground">{intg.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="flex items-center gap-2 text-sm">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Agent-Typ:</span>
                  <Badge variant="secondary">
                    {tenantDetail.agentType === "external" ? "Extern (Custom Webhook)" :
                     tenantDetail.agentType === "internal" ? "Intern (n8n)" :
                     "Nicht konfiguriert"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Card */}
          <UsersCard
            users={tenantUsers}
            loading={usersLoading}
            onEdit={onEditUser}
          />
        </>
      )}
    </div>
  );
}

// ─── Subscription Card ────────────────────────────────────────────────────────

function SubscriptionCard({
  subscription,
  tiers,
  subForm,
  setSubForm,
  subEditOpen,
  setSubEditOpen,
  savingSub,
  onSaveSub,
}: {
  subscription: TenantHealth["subscription"];
  tiers: PricingTier[];
  subForm: { tierId: string; billingCycle: string } | null;
  setSubForm: (f: { tierId: string; billingCycle: string }) => void;
  subEditOpen: boolean;
  setSubEditOpen: (o: boolean) => void;
  savingSub: boolean;
  onSaveSub: () => void;
}) {
  const statusConfig = {
    active:   { label: "Aktiv",   className: "bg-green-100 text-green-800 border-green-200" },
    trial:    { label: "Trial",   className: "bg-blue-100 text-blue-800 border-blue-200" },
    inactive: { label: "Inaktiv", className: "bg-gray-100 text-gray-600 border-gray-200" },
  };

  const price = subscription
    ? formatPrice(
        subscription.billingCycle === "yearly" ? subscription.yearlyPrice : subscription.monthlyPrice,
        subscription.billingCycle
      )
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> Subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {subscription ? (
          <div className="space-y-3">
            {/* Tier + Status */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-bold leading-tight">
                  {subscription.tierName ?? "Kein Tier"}
                </p>
                {price && (
                  <p className="text-2xl font-bold text-primary mt-0.5">{price}</p>
                )}
              </div>
              {subscription.status && (
                <Badge className={`${statusConfig[subscription.status]?.className ?? ""} shrink-0`}>
                  {statusConfig[subscription.status]?.label ?? subscription.status}
                </Badge>
              )}
            </div>

            {/* Details row */}
            <div className="rounded-lg bg-muted/30 border divide-y text-sm">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Billing
                </span>
                <span className="font-medium">
                  {subscription.billingCycle === "yearly" ? "Jährlich" : "Monatlich"}
                </span>
              </div>
              {subscription.startDate && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Seit
                  </span>
                  <span className="font-medium">
                    {new Date(subscription.startDate).toLocaleDateString("de-DE")}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <CreditCard className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Keine Subscription hinterlegt</p>
          </div>
        )}

        {/* Edit toggle */}
        <div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => setSubEditOpen(!subEditOpen)}
          >
            <Pencil className="w-3.5 h-3.5" />
            {subEditOpen ? "Abbrechen" : "Subscription bearbeiten"}
          </Button>

          {subEditOpen && subForm && (
            <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Tier</Label>
                  <Select
                    value={subForm.tierId || "none"}
                    onValueChange={(v) => setSubForm({ ...subForm, tierId: v === "none" ? "" : (v ?? "") })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kein Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Tier</SelectItem>
                      {tiers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Cycle</Label>
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
              <Button onClick={onSaveSub} disabled={savingSub} className="w-full" size="sm">
                {savingSub && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Speichern
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Cron Status Card ─────────────────────────────────────────────────────────

function CronStatusCard({ cronStatus }: { cronStatus: CronEntry[] }) {
  function CronIcon({ status }: { status: CronEntry["status"] }) {
    if (status === "ok")      return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
    if (status === "error")   return <XCircle      className="w-4 h-4 text-red-500 shrink-0" />;
    if (status === "warning") return <Clock        className="w-4 h-4 text-yellow-500 shrink-0" />;
    return                           <HelpCircle   className="w-4 h-4 text-muted-foreground/50 shrink-0" />;
  }

  function CronBadge({ status }: { status: CronEntry["status"] }) {
    if (status === "ok")      return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">OK</Badge>;
    if (status === "error")   return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Fehler</Badge>;
    if (status === "warning") return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">Warnung</Badge>;
    return                           <Badge variant="outline" className="text-xs text-muted-foreground">Unbekannt</Badge>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Datenaktualisierungen (Cronjobs)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cronStatus.map((job) => (
            <div key={job.key} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CronIcon status={job.status} />
                  <span className="text-sm font-medium">{job.label}</span>
                </div>
                <CronBadge status={job.status} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{job.detail}</p>
              {job.timestamp && (
                <p className="text-xs text-muted-foreground/70">
                  {relativeTime(job.timestamp)}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Users Card ───────────────────────────────────────────────────────────────

function UsersCard({
  users,
  loading,
  onEdit,
}: {
  users: TenantUser[];
  loading: boolean;
  onEdit: (u: TenantUser) => void;
}) {
  const roleConfig: Record<string, string> = {
    Admin:   "bg-purple-100 text-purple-800 border-purple-200",
    Editor:  "bg-blue-100 text-blue-800 border-blue-200",
    Viewer:  "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4" /> Nutzer
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Keine Nutzer vorhanden.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Eingeloggt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name ?? <span className="text-muted-foreground italic">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${roleConfig[u.role] ?? ""}`}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.passwordChanged ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ja
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" /> Ausstehend
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.isActive ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <ShieldCheck className="w-3.5 h-3.5" /> Aktiv
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-500">
                        <ShieldOff className="w-3.5 h-3.5" /> Gesperrt
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.role !== "SuperAdmin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(u)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Mini Stat ────────────────────────────────────────────────────────────────

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

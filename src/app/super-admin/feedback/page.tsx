"use client";

import { useState, useEffect, useCallback } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, MessageSquare, Plus, RefreshCw, X, Globe, Lock } from "lucide-react";
import { useI18n } from "@/i18n/use-i18n";

// ─── Types ───────────────────────────────────────────────────────────────────

type FeatureStatus = "Open" | "InValidation" | "Planned" | "InDevelopment" | "Released" | "Cancelled";

interface FeatureRequest {
  id: string;
  type: "feature" | "bug";
  title: string;
  description: string | null;
  status: FeatureStatus;
  priority: "low" | "medium" | "high";
  plannedQuarter: string | null;
  isPublic: boolean;
  createdAt: string;
  tenantId: string;
  tenantName: string | null;
}

interface Tenant {
  id: string;
  name: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FEATURE_STATUSES: FeatureStatus[] = [
  "Open", "InValidation", "Planned", "InDevelopment", "Released", "Cancelled",
];

const STATUS_CONFIG: Record<FeatureStatus, { labelKey: string; className: string }> = {
  Open:          { labelKey: "superAdmin.feedbackOpen",          className: "bg-slate-100 text-slate-800" },
  InValidation:  { labelKey: "superAdmin.feedbackInValidation",  className: "bg-blue-100 text-blue-800" },
  Planned:       { labelKey: "superAdmin.feedbackPlanned",       className: "bg-purple-100 text-purple-800" },
  InDevelopment: { labelKey: "superAdmin.feedbackInDevelopment", className: "bg-orange-100 text-orange-800" },
  Released:      { labelKey: "superAdmin.feedbackReleased",      className: "bg-green-100 text-green-800" },
  Cancelled:     { labelKey: "superAdmin.feedbackCancelled",     className: "bg-red-100 text-red-800" },
};

function getQuarterOptions(): { label: string; value: string }[] {
  const currentYear = new Date().getFullYear();
  const options: { label: string; value: string }[] = [];
  for (const year of [currentYear, currentYear + 1]) {
    for (const q of [1, 2, 3, 4]) {
      options.push({ label: `Q${q} ${year}`, value: `Q${q} ${year}` });
    }
  }
  return options;
}

const QUARTER_OPTIONS = getQuarterOptions();

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: FeatureStatus; t: (key: string) => string }) {
  const c = STATUS_CONFIG[status];
  return <Badge className={c.className}>{t(c.labelKey)}</Badge>;
}

function PriorityBadge({ priority, t }: { priority: "low" | "medium" | "high"; t: (key: string) => string }) {
  const map = {
    low:    "bg-slate-100 text-slate-700",
    medium: "bg-yellow-100 text-yellow-800",
    high:   "bg-red-100 text-red-800",
  };
  const labelKey = {
    low:    "superAdmin.feedbackPriorityLow",
    medium: "superAdmin.feedbackPriorityMedium",
    high:   "superAdmin.feedbackPriorityHigh",
  };
  return <Badge className={map[priority]}>{t(labelKey[priority])}</Badge>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const { t } = useI18n();

  const [requests, setRequests]     = useState<FeatureRequest[]>([]);
  const [tenants, setTenants]       = useState<Tenant[]>([]);
  const [loading, setLoading]       = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filters
  const [typeFilter,    setTypeFilter]    = useState("all");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [quarterFilter, setQuarterFilter] = useState("all");

  // FAB dialog
  const [fabOpen, setFabOpen] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [fabForm, setFabForm] = useState({
    tenantId:       "",
    type:           "feature" as "feature" | "bug",
    title:          "",
    description:    "",
    priority:       "medium" as "low" | "medium" | "high",
    plannedQuarter: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter    !== "all") params.set("type",    typeFilter);
    if (statusFilter  !== "all") params.set("status",  statusFilter);
    if (quarterFilter !== "all") params.set("quarter", quarterFilter);

    const [reqRes, tenantRes] = await Promise.all([
      fetch(`/api/super-admin/feature-requests?${params}`),
      fetch("/api/super-admin/tenants"),
    ]);
    setRequests(await reqRes.json());
    const tenantData = await tenantRes.json();
    setTenants(tenantData.map((ten: any) => ({ id: ten.id, name: ten.name })));
    setLoading(false);
  }, [typeFilter, statusFilter, quarterFilter]);

  useEffect(() => { load(); }, [load]);

  const updateField = async (id: string, field: "status" | "plannedQuarter", value: string) => {
    setUpdatingId(id);
    await fetch(`/api/super-admin/feature-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setRequests((prev) =>
      prev.map((r) => r.id === id ? { ...r, [field]: value || null } : r)
    );
    setUpdatingId(null);
  };

  const togglePublic = async (id: string, current: boolean) => {
    setUpdatingId(id);
    // Optimistic update
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, isPublic: !current } : r));
    await fetch(`/api/super-admin/feature-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !current }),
    });
    setUpdatingId(null);
  };

  const submitFab = async () => {
    if (!fabForm.tenantId || !fabForm.title) return;
    setSaving(true);
    await fetch("/api/super-admin/feature-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...fabForm,
        plannedQuarter: fabForm.plannedQuarter || null,
      }),
    });
    setSaving(false);
    setFabOpen(false);
    setFabForm({ tenantId: "", type: "feature", title: "", description: "", priority: "medium", plannedQuarter: "" });
    load();
  };

  const openFab = () => {
    setFabForm({ tenantId: tenants[0]?.id ?? "", type: "feature", title: "", description: "", priority: "medium", plannedQuarter: "" });
    setFabOpen(true);
  };

  const activeFilters = [typeFilter, statusFilter, quarterFilter].filter((f) => f !== "all").length;

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6" /> {t("superAdmin.feedbackPageTitle")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("superAdmin.feedbackPageSubtitle")}</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>{t("superAdmin.feedbackAllEntries")}</CardTitle>
                <CardDescription>{t("superAdmin.feedbackAllEntriesDesc")}</CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                {/* Type filter */}
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
                   <SelectTrigger className="w-36">
                     <SelectValue>
                       {typeFilter === "all"
                         ? t("superAdmin.feedbackAllTypes")
                         : typeFilter === "feature"
                         ? t("superAdmin.feedbackTypeFeature")
                         : t("superAdmin.feedbackTypeBug")}
                     </SelectValue>
                   </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("superAdmin.feedbackAllTypes")}</SelectItem>
                    <SelectItem value="feature">{t("superAdmin.feedbackTypeFeature")}</SelectItem>
                    <SelectItem value="bug">{t("superAdmin.feedbackTypeBug")}</SelectItem>
                  </SelectContent>
                </Select>

                {/* Status filter */}
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
                   <SelectTrigger className="w-44">
                     <SelectValue>
                       {statusFilter === "all"
                         ? t("superAdmin.feedbackAllStatus")
                         : t(STATUS_CONFIG[statusFilter as FeatureStatus]?.labelKey ?? "superAdmin.feedbackAllStatus")}
                     </SelectValue>
                   </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("superAdmin.feedbackAllStatus")}</SelectItem>
                    {FEATURE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{t(STATUS_CONFIG[s].labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Quarter filter */}
                <Select value={quarterFilter} onValueChange={(v) => setQuarterFilter(v ?? "all")}>
                   <SelectTrigger className="w-36">
                     <SelectValue>
                       {quarterFilter === "all"
                         ? t("superAdmin.feedbackAllQuarters")
                         : quarterFilter === "none"
                         ? t("superAdmin.feedbackNoQuarter")
                         : quarterFilter}
                     </SelectValue>
                   </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("superAdmin.feedbackAllQuarters")}</SelectItem>
                    <SelectItem value="none">{t("superAdmin.feedbackNoQuarter")}</SelectItem>
                    {QUARTER_OPTIONS.map((q) => (
                      <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Reset filters */}
                {activeFilters > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground"
                    onClick={() => { setTypeFilter("all"); setStatusFilter("all"); setQuarterFilter("all"); }}
                  >
                    <X className="w-3 h-3" /> {t("superAdmin.feedbackFilterLabel").replace("{count}", String(activeFilters))}
                  </Button>
                )}

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
                    <TableHead className="w-20">{t("superAdmin.feedbackColType")}</TableHead>
                    <TableHead>{t("superAdmin.feedbackColTitle")}</TableHead>
                    <TableHead>{t("superAdmin.feedbackColTenant")}</TableHead>
                    <TableHead>{t("superAdmin.feedbackColPriority")}</TableHead>
                    <TableHead>{t("superAdmin.feedbackColQuarter")}</TableHead>
                    <TableHead>{t("superAdmin.feedbackColStatus")}</TableHead>
                    <TableHead className="w-28">{t("superAdmin.feedbackColGlobal")}</TableHead>
                    <TableHead>{t("superAdmin.feedbackColCreated")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={r.type === "bug"
                            ? "border-red-300 text-red-700"
                            : "border-blue-300 text-blue-700"}
                        >
                          {r.type === "bug" ? t("superAdmin.feedbackTypeBug") : t("superAdmin.feedbackTypeFeature")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{r.title}</p>
                          {r.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {r.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.tenantName ?? r.tenantId}
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={r.priority} t={t} />
                      </TableCell>

                      {/* Quarter — inline editable */}
                      <TableCell>
                        <Select
                          value={r.plannedQuarter ?? "none"}
                          onValueChange={(v) =>
                            updateField(r.id, "plannedQuarter", (v ?? "") === "none" ? "" : (v ?? ""))
                          }
                          disabled={updatingId === r.id}
                        >
                         <SelectTrigger className="h-7 w-32 text-xs border-dashed">
                             <SelectValue>
                               {(r.plannedQuarter ?? "none") === "none"
                                 ? t("superAdmin.feedbackNoQuarter")
                                 : r.plannedQuarter}
                             </SelectValue>
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="none">
                               {t("superAdmin.feedbackNoQuarter")}
                             </SelectItem>
                            {QUARTER_OPTIONS.map((q) => (
                              <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                       {/* Status — inline editable */}
                       <TableCell>
                         <Select
                           value={r.status}
                           onValueChange={(v) => v && updateField(r.id, "status", v)}
                           disabled={updatingId === r.id}
                         >
                           <SelectTrigger className="h-7 w-40 border-0 p-0 shadow-none focus:ring-0">
                             {updatingId === r.id ? (
                               <Loader2 className="w-3.5 h-3.5 animate-spin" />
                             ) : (
                               <StatusBadge status={r.status} t={t} />
                             )}
                           </SelectTrigger>
                           <SelectContent>
                             {FEATURE_STATUSES.map((s) => (
                               <SelectItem key={s} value={s}>
                                 <StatusBadge status={s} t={t} />
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </TableCell>

                       {/* Global toggle */}
                       <TableCell>
                         <button
                           onClick={() => togglePublic(r.id, r.isPublic)}
                           disabled={updatingId === r.id}
                           title={r.isPublic ? t("superAdmin.feedbackGlobalOn") : t("superAdmin.feedbackGlobalOff")}
                           className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 transition-colors ${
                             r.isPublic
                               ? "bg-green-100 text-green-700 hover:bg-green-200"
                               : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                           }`}
                         >
                           {r.isPublic
                             ? <><Globe className="w-3.5 h-3.5" /> {t("superAdmin.feedbackGlobalOn")}</>
                             : <><Lock className="w-3.5 h-3.5" /> {t("superAdmin.feedbackGlobalOff")}</>
                           }
                         </button>
                       </TableCell>

                       <TableCell className="text-xs text-muted-foreground">
                         {new Date(r.createdAt).toLocaleDateString("de-DE")}
                       </TableCell>
                     </TableRow>
                   ))}
                   {requests.length === 0 && (
                     <TableRow>
                       <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                        {t("superAdmin.feedbackNoEntries")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── FAB Button ── */}
      <Button
        className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-xl z-50"
        size="icon"
        onClick={openFab}
        title={t("superAdmin.feedbackCreateTitle")}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* ── FAB Dialog ── */}
      <Dialog open={fabOpen} onOpenChange={setFabOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("superAdmin.feedbackCreateTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Tenant */}
            <div>
              <Label>{t("superAdmin.feedbackTenantLabel")}</Label>
              <Select
                value={fabForm.tenantId}
                onValueChange={(v) => setFabForm({ ...fabForm, tenantId: v ?? "" })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("superAdmin.feedbackSelectTenant")} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((ten) => (
                    <SelectItem key={ten.id} value={ten.id}>{ten.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("superAdmin.feedbackTypeLabel")}</Label>
                <Select
                  value={fabForm.type}
                  onValueChange={(v) => setFabForm({ ...fabForm, type: (v ?? "feature") as "feature" | "bug" })}
                >
                   <SelectTrigger className="mt-1">
                     <SelectValue>
                       {fabForm.type === "feature"
                         ? t("superAdmin.feedbackTypeFeature")
                         : t("superAdmin.feedbackTypeBug")}
                     </SelectValue>
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="feature">{t("superAdmin.feedbackTypeFeature")}</SelectItem>
                     <SelectItem value="bug">{t("superAdmin.feedbackTypeBug")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("superAdmin.feedbackPriorityLabel")}</Label>
                <Select
                  value={fabForm.priority}
                  onValueChange={(v) => setFabForm({ ...fabForm, priority: (v ?? "medium") as "low" | "medium" | "high" })}
                >
                   <SelectTrigger className="mt-1">
                     <SelectValue>
                       {fabForm.priority === "low"
                         ? t("superAdmin.feedbackPriorityLow")
                         : fabForm.priority === "medium"
                         ? t("superAdmin.feedbackPriorityMedium")
                         : t("superAdmin.feedbackPriorityHigh")}
                     </SelectValue>
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="low">{t("superAdmin.feedbackPriorityLow")}</SelectItem>
                     <SelectItem value="medium">{t("superAdmin.feedbackPriorityMedium")}</SelectItem>
                     <SelectItem value="high">{t("superAdmin.feedbackPriorityHigh")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Title */}
            <div>
              <Label>{t("superAdmin.feedbackTitleLabel")}</Label>
              <Input
                value={fabForm.title}
                onChange={(e) => setFabForm({ ...fabForm, title: e.target.value })}
                placeholder={t("superAdmin.feedbackTitlePlaceholder")}
                className="mt-1"
              />
            </div>

            {/* Description */}
            <div>
              <Label>{t("superAdmin.feedbackDescLabel")}</Label>
              <textarea
                value={fabForm.description}
                onChange={(e) => setFabForm({ ...fabForm, description: e.target.value })}
                placeholder={t("superAdmin.feedbackDescPlaceholder")}
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* Quarter */}
            <div>
              <Label>{t("superAdmin.feedbackQuarterLabel")}</Label>
              <Select
                value={fabForm.plannedQuarter || "none"}
                onValueChange={(v) => setFabForm({ ...fabForm, plannedQuarter: v === "none" ? "" : (v ?? "") })}
              >
               <SelectTrigger className="mt-1">
                   <SelectValue>
                     {!fabForm.plannedQuarter || fabForm.plannedQuarter === "none"
                       ? t("superAdmin.feedbackNoQuarter")
                       : fabForm.plannedQuarter}
                   </SelectValue>
                 </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("superAdmin.feedbackNoQuarter")}</SelectItem>
                  {QUARTER_OPTIONS.map((q) => (
                    <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFabOpen(false)}>
              {t("superAdmin.feedbackCancel")}
            </Button>
            <Button onClick={submitFab} disabled={saving || !fabForm.title || !fabForm.tenantId}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t("superAdmin.feedbackCreateButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

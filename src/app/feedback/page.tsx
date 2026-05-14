"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  Rocket,
  XCircle,
  Wrench,
  AlertTriangle,
  MessageSquare,
  CalendarDays,
} from "lucide-react";
import { useI18n } from "@/i18n/use-i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type FeatureStatus =
  | "Open"
  | "InValidation"
  | "Planned"
  | "InDevelopment"
  | "Released"
  | "Cancelled";

interface FeedbackItem {
  id: string;
  type: "feature" | "bug";
  title: string;
  description: string | null;
  status: FeatureStatus;
  priority: "low" | "medium" | "high";
  plannedQuarter: string | null;
  createdAt: string;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  t,
}: {
  status: FeatureStatus;
  t: (key: string) => string;
}) {
  const config: Record<
    FeatureStatus,
    { labelKey: string; className: string; icon: React.ReactNode }
  > = {
    Open:          { labelKey: "feedback.statusOpen",          className: "bg-slate-100 text-slate-800",   icon: <Clock className="w-3 h-3" /> },
    InValidation:  { labelKey: "feedback.statusInValidation",  className: "bg-blue-100 text-blue-800",     icon: <AlertTriangle className="w-3 h-3" /> },
    Planned:       { labelKey: "feedback.statusPlanned",       className: "bg-purple-100 text-purple-800", icon: <CheckCircle2 className="w-3 h-3" /> },
    InDevelopment: { labelKey: "feedback.statusInDevelopment", className: "bg-orange-100 text-orange-800", icon: <Wrench className="w-3 h-3" /> },
    Released:      { labelKey: "feedback.statusReleased",      className: "bg-green-100 text-green-800",   icon: <Rocket className="w-3 h-3" /> },
    Cancelled:     { labelKey: "feedback.statusCancelled",     className: "bg-red-100 text-red-800",       icon: <XCircle className="w-3 h-3" /> },
  };
  const c = config[status];
  return (
    <Badge className={`${c.className} gap-1`}>
      {c.icon} {t(c.labelKey)}
    </Badge>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const { t } = useI18n();

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    type:        "feature" as "feature" | "bug",
    title:       "",
    description: "",
    priority:    "medium" as "low" | "medium" | "high",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/feedback");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.title.trim()) {
      setError(t("feedback.errorNoTitle"));
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(t("feedback.errorSubmit"));
      return;
    }

    setSuccess(true);
    setShowForm(false);
    setForm({ type: "feature", title: "", description: "", priority: "medium" });
    setTimeout(() => setSuccess(false), 3000);
    load();
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />
          {t("feedback.title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("feedback.subtitle")}</p>
      </div>

      {/* ── Submit Card ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("feedback.submitCardTitle")}</CardTitle>
            <CardDescription>{t("feedback.submitCardDesc")}</CardDescription>
          </div>
          {!showForm && (
            <Button size="sm" className="gap-1" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> {t("feedback.submitNew")}
            </Button>
          )}
        </CardHeader>

        {showForm && (
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("feedback.typeLabel")}</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as "feature" | "bug" })}
                >
                   <SelectTrigger className="mt-1">
                     <SelectValue>
                       {form.type === "feature"
                         ? t("feedback.typeFeature")
                         : t("feedback.typeBug")}
                     </SelectValue>
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="feature">{t("feedback.typeFeature")}</SelectItem>
                     <SelectItem value="bug">{t("feedback.typeBug")}</SelectItem>
                   </SelectContent>
                 </Select>
              </div>
              <div>
                <Label>{t("feedback.priorityLabel")}</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm({ ...form, priority: v as "low" | "medium" | "high" })
                  }
                >
                   <SelectTrigger className="mt-1">
                     <SelectValue>
                       {form.priority === "low"
                         ? t("feedback.priorityLow")
                         : form.priority === "medium"
                         ? t("feedback.priorityMedium")
                         : t("feedback.priorityHigh")}
                     </SelectValue>
                   </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t("feedback.priorityLow")}</SelectItem>
                    <SelectItem value="medium">{t("feedback.priorityMedium")}</SelectItem>
                    <SelectItem value="high">{t("feedback.priorityHigh")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("feedback.titleLabel")}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("feedback.titlePlaceholder")}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("feedback.descLabel")}</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("feedback.descPlaceholder")}
                rows={4}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
              >
                {t("feedback.cancel")}
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t("feedback.submit")}
              </Button>
            </div>
          </CardContent>
        )}

        {success && (
          <CardContent>
            <div className="rounded-md bg-green-50 text-green-800 text-sm p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {t("feedback.successMessage")}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── My Submissions ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("feedback.mySubmissionsTitle")}</CardTitle>
          <CardDescription>{t("feedback.mySubmissionsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">{t("feedback.colType")}</TableHead>
                  <TableHead>{t("feedback.colTitle")}</TableHead>
                  <TableHead>{t("feedback.colPriority")}</TableHead>
                  <TableHead>{t("feedback.colStatus")}</TableHead>
                  <TableHead>{t("feedback.colQuarter")}</TableHead>
                  <TableHead>{t("feedback.colCreated")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          item.type === "bug"
                            ? "border-red-300 text-red-700"
                            : "border-blue-300 text-blue-700"
                        }
                      >
                        {item.type === "bug"
                          ? t("feedback.typeBug")
                          : t("feedback.typeFeature")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          item.priority === "high"
                            ? "bg-red-100 text-red-800"
                            : item.priority === "medium"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-slate-100 text-slate-700"
                        }
                      >
                        {item.priority === "high"
                          ? t("feedback.priorityHigh")
                          : item.priority === "medium"
                          ? t("feedback.priorityMedium")
                          : t("feedback.priorityLow")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} t={t} />
                    </TableCell>
                    <TableCell>
                      {item.plannedQuarter ? (
                        <span className="flex items-center gap-1.5 text-sm font-medium text-purple-700">
                          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                          {item.plannedQuarter}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {item.status === "Planned" || item.status === "InDevelopment"
                            ? t("feedback.noQuarterYet")
                            : "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("de-DE")}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      {t("feedback.noSubmissions")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

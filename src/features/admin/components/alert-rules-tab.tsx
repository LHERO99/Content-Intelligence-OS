"use client";

import { useEffect, useState, useRef, KeyboardEvent } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Loader2, Bell, Plus, Trash2, X } from "lucide-react";
import { useI18n } from "@/i18n/use-i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertMetric = "gsc_clicks_drop" | "keyword_rank_drop";
type AlertOperator = "lt" | "gt" | "pct_drop";

interface AlertRule {
  id: string;
  name: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  windowDays: number;
  notifyEmails: string[];
  enabled: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

interface FormState {
  name: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: string;
  windowDays: string;
  notifyEmails: string[];
  enabled: boolean;
}

const DEFAULT_FORM: FormState = {
  name: "",
  metric: "gsc_clicks_drop",
  operator: "pct_drop",
  threshold: "20",
  windowDays: "7",
  notifyEmails: [],
  enabled: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const METRIC_LABELS: Record<AlertMetric, { de: string; en: string }> = {
  gsc_clicks_drop: { de: "GSC-Klicks Abfall", en: "GSC Clicks Drop" },
  keyword_rank_drop: { de: "Keyword-Ranking Abfall", en: "Keyword Rank Drop" },
};

const OPERATOR_LABELS: Record<AlertOperator, { de: string; en: string }> = {
  lt: { de: "unter Schwellenwert (absolut)", en: "below threshold (absolute)" },
  gt: { de: "über Schwellenwert (absolut)", en: "above threshold (absolute)" },
  pct_drop: { de: "prozentualer Abfall", en: "percentage drop" },
};

// Default operators per metric
const METRIC_DEFAULT_OPERATOR: Record<AlertMetric, AlertOperator> = {
  gsc_clicks_drop: "pct_drop",
  keyword_rank_drop: "gt",
};

function formatCondition(rule: AlertRule, locale: string): string {
  const de = locale === "de";
  const metricLabel = de
    ? METRIC_LABELS[rule.metric]?.de
    : METRIC_LABELS[rule.metric]?.en;
  const opLabel =
    rule.operator === "pct_drop"
      ? de ? "Abfall ≥" : "drop ≥"
      : rule.operator === "lt"
      ? "<"
      : ">";
  const unit = rule.operator === "pct_drop" ? "%" : "";
  return `${metricLabel}: ${opLabel} ${rule.threshold}${unit}`;
}

// ---------------------------------------------------------------------------
// Tag input subcomponent
// ---------------------------------------------------------------------------

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

function TagInput({ tags, onChange, placeholder }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const emails = raw
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && !tags.includes(e));
    if (emails.length > 0) {
      onChange([...tags, ...emails]);
    }
    setInputValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", " ", "Tab"].includes(e.key)) {
      e.preventDefault();
      if (inputValue.trim()) addTag(inputValue);
    }
    if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (idx: number) => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-text focus-within:ring-1 focus-within:ring-ring"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, idx) => (
        <Badge
          key={idx}
          variant="secondary"
          className="flex items-center gap-1 pr-1"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(idx);
            }}
            className="ml-0.5 rounded-full outline-none hover:bg-muted-foreground/20"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[160px] bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AlertRulesTab() {
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/alert-rules");
      if (!res.ok) throw new Error(tr("Fehler beim Laden", "Error loading rules"));
      const data = await res.json();
      setRules(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  // ── Form handlers ─────────────────────────────────────────────────────────

  const handleMetricChange = (metric: AlertMetric) => {
    setForm((prev) => ({
      ...prev,
      metric,
      operator: METRIC_DEFAULT_OPERATOR[metric],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.notifyEmails.length === 0) {
      setError(tr("Bitte mindestens eine E-Mail-Adresse angeben.", "Please add at least one email address."));
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/alert-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          metric: form.metric,
          operator: form.operator,
          threshold: parseFloat(form.threshold),
          windowDays: parseInt(form.windowDays, 10),
          notifyEmails: form.notifyEmails,
          enabled: form.enabled,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || tr("Fehler beim Speichern", "Error saving rule"));
      }
      setSuccess(tr("Regel erfolgreich angelegt.", "Rule created successfully."));
      setForm(DEFAULT_FORM);
      await loadRules();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle enabled ────────────────────────────────────────────────────────

  const handleToggle = async (rule: AlertRule) => {
    setTogglingId(rule.id);
    try {
      const res = await fetch(`/api/admin/alert-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (!res.ok) throw new Error();
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
      );
    } catch {
      setError(tr("Fehler beim Aktualisieren.", "Error updating rule."));
    } finally {
      setTogglingId(null);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm(tr("Regel wirklich löschen?", "Delete this rule?"))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/alert-rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError(tr("Fehler beim Löschen.", "Error deleting rule."));
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const thresholdUnit = form.operator === "pct_drop" ? "%" : "";
  const thresholdPlaceholder =
    form.operator === "pct_drop"
      ? tr("z.B. 20 (= 20% Abfall)", "e.g. 20 (= 20% drop)")
      : form.metric === "keyword_rank_drop"
      ? tr("z.B. 5 (= 5 Plätze)", "e.g. 5 (= 5 positions)")
      : tr("z.B. 100 (Klicks)", "e.g. 100 (clicks)");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Left: Form ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Plus className="h-5 w-5" />
            {tr("Neue Alert-Regel", "New Alert Rule")}
          </CardTitle>
          <CardDescription>
            {tr(
              "Definieren Sie eine Regel, die bei Unterschreitung eines Schwellenwerts eine E-Mail versendet.",
              "Define a rule that sends an email when a metric threshold is breached."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>{tr("Fehler", "Error")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4">
              <AlertTitle>{tr("Erfolg", "Success")}</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {tr("Regelname", "Rule name")}
              </label>
              <Input
                placeholder={tr("z.B. GSC-Klicks Warngrenze", "e.g. GSC clicks warning")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            {/* Metric */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {tr("Metrik", "Metric")}
              </label>
              <Select
                value={form.metric}
                onValueChange={(v) => handleMetricChange(v as AlertMetric)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(METRIC_LABELS) as AlertMetric[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {locale === "de" ? METRIC_LABELS[m].de : METRIC_LABELS[m].en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Operator */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {tr("Operator", "Operator")}
              </label>
              <Select
                value={form.operator}
                onValueChange={(v) => setForm({ ...form, operator: v as AlertOperator })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(OPERATOR_LABELS) as AlertOperator[]).map((op) => (
                    <SelectItem key={op} value={op}>
                      {locale === "de" ? OPERATOR_LABELS[op].de : OPERATOR_LABELS[op].en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Threshold + Window */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {tr("Schwellenwert", "Threshold")}{thresholdUnit && ` (${thresholdUnit})`}
                </label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder={thresholdPlaceholder}
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {tr("Zeitfenster (Tage)", "Window (days)")}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={form.windowDays}
                  onChange={(e) => setForm({ ...form, windowDays: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Notify Emails */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {tr("Empfänger-E-Mails", "Recipient emails")}
              </label>
              <TagInput
                tags={form.notifyEmails}
                onChange={(tags) => setForm({ ...form, notifyEmails: tags })}
                placeholder={tr(
                  "E-Mail eingeben, Enter oder Komma zum Bestätigen",
                  "Enter email, press Enter or comma to confirm"
                )}
              />
              <p className="text-xs text-muted-foreground">
                {tr(
                  "Enter, Komma oder Leerzeichen zum Hinzufügen. Backspace zum Entfernen.",
                  "Press Enter, comma or space to add. Backspace to remove."
                )}
              </p>
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Switch
                id="rule-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
              <label htmlFor="rule-enabled" className="text-sm cursor-pointer select-none">
                {tr("Regel direkt aktivieren", "Enable rule immediately")}
              </label>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {tr("Regel anlegen", "Create rule")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Right: Rules list ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Bell className="h-5 w-5" />
            {tr("Bestehende Regeln", "Existing Rules")}
          </CardTitle>
          <CardDescription>
            {tr(
              "Aktivieren, deaktivieren oder löschen Sie Alert-Regeln.",
              "Enable, disable or delete alert rules."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="text-sm">
                {tr(
                  "Noch keine Alert-Regeln konfiguriert.",
                  "No alert rules configured yet."
                )}
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("Name", "Name")}</TableHead>
                    <TableHead>{tr("Bedingung", "Condition")}</TableHead>
                    <TableHead>{tr("Zeitfenster", "Window")}</TableHead>
                    <TableHead>{tr("Empfänger", "Recipients")}</TableHead>
                    <TableHead>{tr("Aktiv", "Active")}</TableHead>
                    <TableHead className="text-right">{tr("Löschen", "Delete")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium max-w-[140px]">
                        <span className="truncate block">{rule.name}</span>
                        {rule.lastTriggeredAt && (
                          <span className="text-[10px] text-muted-foreground block">
                            {tr("Zuletzt:", "Last:")} {new Date(rule.lastTriggeredAt).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[160px]">
                        <span className="block">{formatCondition(rule, locale)}</span>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {rule.windowDays} {tr("Tage", "days")}
                      </TableCell>
                      <TableCell className="max-w-[140px]">
                        <div className="flex flex-wrap gap-1">
                          {rule.notifyEmails.slice(0, 2).map((email) => (
                            <Badge key={email} variant="outline" className="text-[10px] truncate max-w-[100px]" title={email}>
                              {email}
                            </Badge>
                          ))}
                          {rule.notifyEmails.length > 2 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{rule.notifyEmails.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {togglingId === rule.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={() => handleToggle(rule)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(rule.id)}
                          disabled={deletingId === rule.id}
                        >
                          {deletingId === rule.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

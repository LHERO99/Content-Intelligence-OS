"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Save, SlidersHorizontal, RefreshCw } from "lucide-react";
import { OptimizationRuleSettings } from "@/lib/airtable-types";
import { useI18n } from "@/i18n/use-i18n";

const DEFAULT_SETTINGS: OptimizationRuleSettings = {
  AGE_DAYS: 180,
  TOP_RANK_THRESHOLD: 3,
  URL_MISMATCH_ENABLED: false,
  DROP_WINDOW_DAYS: 14,
  DROP_THRESHOLD_PCT: 40,
  PERFORMANCE_WINDOW_DAYS: 180,
  MIN_IMPROVEMENT_PCT: 20,
};

const FIELD_CONSTRAINTS: Record<keyof OptimizationRuleSettings, { min: number; max: number; step?: number }> = {
  AGE_DAYS: { min: 1, max: 730, step: 1 },
  TOP_RANK_THRESHOLD: { min: 1, max: 100, step: 1 },
  URL_MISMATCH_ENABLED: { min: 0, max: 1, step: 1 },
  DROP_WINDOW_DAYS: { min: 7, max: 90, step: 1 },
  DROP_THRESHOLD_PCT: { min: 1, max: 100, step: 1 },
  PERFORMANCE_WINDOW_DAYS: { min: 14, max: 365, step: 1 },
  MIN_IMPROVEMENT_PCT: { min: 1, max: 200, step: 1 },
};

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function OptimizationRulesTab() {
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);
  const [settings, setSettings] = useState<OptimizationRuleSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/planning/optimization-suggestions');
      if (!res.ok) throw new Error(tr('Fehler beim Laden der Regeln', 'Error loading rules'));
      const data = await res.json();
      setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
    } catch (err: any) {
      setError(err.message || tr('Fehler beim Laden', 'Error loading'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateField = (key: keyof OptimizationRuleSettings, value: number) => {
    const constraints = FIELD_CONSTRAINTS[key];
    if (!constraints) {
      setSettings((prev) => ({ ...prev, [key]: value }));
      return;
    }

    setSettings((prev) => ({
      ...prev,
      [key]: clampNumber(value, constraints.min, constraints.max),
    }));
  };

  const getInputProps = (key: Exclude<keyof OptimizationRuleSettings, 'URL_MISMATCH_ENABLED'>) => {
    const constraints = FIELD_CONSTRAINTS[key];
    return {
      min: constraints.min,
      max: constraints.max,
      step: constraints.step ?? 1,
    };
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        weights: {
          OPT_RULE_AGE_DAYS: settings.AGE_DAYS,
          OPT_RULE_TOP_RANK_THRESHOLD: settings.TOP_RANK_THRESHOLD,
          OPT_RULE_URL_MISMATCH_ENABLED: String(settings.URL_MISMATCH_ENABLED),
          OPT_RULE_DROP_WINDOW_DAYS: settings.DROP_WINDOW_DAYS,
          OPT_RULE_DROP_THRESHOLD_PCT: settings.DROP_THRESHOLD_PCT,
          OPT_RULE_PERFORMANCE_WINDOW_DAYS: settings.PERFORMANCE_WINDOW_DAYS,
          OPT_RULE_MIN_IMPROVEMENT_PCT: settings.MIN_IMPROVEMENT_PCT,
        },
      };

      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(tr('Fehler beim Speichern der Regeln', 'Error saving rules'));

      setSuccess(tr('Regeln erfolgreich gespeichert.', 'Rules saved successfully.'));
      await loadSettings();
    } catch (err: any) {
      setError(err.message || tr('Fehler beim Speichern', 'Error saving'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <SlidersHorizontal className="h-5 w-5" />
          {tr("Optimierungsregeln", "Optimization Rules")}
        </CardTitle>
        <CardDescription>
          {tr(
            "Konfigurieren Sie die Schwellwerte, ab wann veröffentlichte Inhalte wieder als Optimierungsvorschlag erscheinen.",
            "Configure the thresholds for when published content should appear as an optimization suggestion again."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>{tr("Fehler", "Error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertTitle>{tr("Erfolg", "Success")}</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border p-4 space-y-2">
              <p className="text-sm leading-6">
                {tr("Zeige einen Optimierungsvorschlag, wenn der Text älter als", "Show an optimization suggestion when content is older than")}
                <Input
                  type="number"
                  className="mx-2 inline-flex h-8 w-28"
                  value={settings.AGE_DAYS}
                  onChange={(e) => updateField('AGE_DAYS', Number(e.target.value || 0))}
                  {...getInputProps('AGE_DAYS')}
                />
                {tr("Tagen ist und das Main-Keyword schlechter als Top", "days and the main keyword ranks worse than top")}
                <Input
                  type="number"
                  className="mx-2 inline-flex h-8 w-24"
                  value={settings.TOP_RANK_THRESHOLD}
                  onChange={(e) => updateField('TOP_RANK_THRESHOLD', Number(e.target.value || 0))}
                  {...getInputProps('TOP_RANK_THRESHOLD')}
                />
                {tr("rankt.", ".")}
              </p>
              <p className="text-xs text-muted-foreground">
                {tr("Empfehlung für Re-Optimierung bei älteren Inhalten ohne Spitzenranking.", "Recommendation for re-optimization of older content without top rankings.")}
              </p>
            </div>

            <div className="rounded-md border p-4 space-y-2">
              <p className="text-sm leading-6">
                {tr("Zeige einen Optimierungsvorschlag, wenn sich das Ranking im Vergleich der letzten", "Show an optimization suggestion if the ranking dropped in the last")}
                <Input
                  type="number"
                  className="mx-2 inline-flex h-8 w-24"
                  value={settings.DROP_WINDOW_DAYS}
                  onChange={(e) => updateField('DROP_WINDOW_DAYS', Number(e.target.value || 0))}
                  {...getInputProps('DROP_WINDOW_DAYS')}
                />
                {tr("Tage um mindestens", "days by at least")}
                <Input
                  type="number"
                  className="mx-2 inline-flex h-8 w-24"
                  value={settings.DROP_THRESHOLD_PCT}
                  onChange={(e) => updateField('DROP_THRESHOLD_PCT', Number(e.target.value || 0))}
                  {...getInputProps('DROP_THRESHOLD_PCT')}
                />
                % {tr("verschlechtert.", ".")}
              </p>
              <p className="text-xs text-muted-foreground">
                {tr("Erkennt deutliche Verschlechterungen im jüngsten Zeitraum.", "Detects significant drops in the most recent period.")}
              </p>
            </div>

            <div className="rounded-md border p-4 space-y-2">
              <p className="text-sm leading-6">
                {tr("Zeige einen Optimierungsvorschlag, wenn sich die Performance innerhalb von", "Show an optimization suggestion if performance within")}
                <Input
                  type="number"
                  className="mx-2 inline-flex h-8 w-28"
                  value={settings.PERFORMANCE_WINDOW_DAYS}
                  onChange={(e) => updateField('PERFORMANCE_WINDOW_DAYS', Number(e.target.value || 0))}
                  {...getInputProps('PERFORMANCE_WINDOW_DAYS')}
                />
                {tr("Tagen nach Veröffentlichung nicht um mindestens", "days after publication has not improved by at least")}
                <Input
                  type="number"
                  className="mx-2 inline-flex h-8 w-24"
                  value={settings.MIN_IMPROVEMENT_PCT}
                  onChange={(e) => updateField('MIN_IMPROVEMENT_PCT', Number(e.target.value || 0))}
                  {...getInputProps('MIN_IMPROVEMENT_PCT')}
                />
                % {tr("verbessert.", ".")}
              </p>
              <p className="text-xs text-muted-foreground">
                {tr("Prüft, ob nach Veröffentlichung genug Fortschritt bei Klicks, Impressionen oder Position erzielt wurde.", "Checks whether enough progress in clicks, impressions or position was achieved after publication.")}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadSettings} disabled={loading || saving}>
            <RefreshCw className="h-4 w-4 mr-2" /> {tr("Neu laden", "Reload")}
          </Button>
          <Button onClick={save} disabled={loading || saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {tr("Speichern", "Save")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {tr(
            "Hinweis: URL-Mismatch ist aktuell deaktiviert, da die rankende URL im Datenmodell noch nicht verlässlich vorliegt.",
            "Note: URL-Mismatch is currently disabled as the ranking URL is not yet reliably available in the data model."
          )}
        </p>
      </CardContent>
    </Card>
  );
}

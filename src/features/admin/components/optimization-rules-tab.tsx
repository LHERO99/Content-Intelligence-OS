"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Save, SlidersHorizontal, RefreshCw } from "lucide-react";
import { OptimizationRuleSettings } from "@/lib/airtable-types";

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
      if (!res.ok) throw new Error('Fehler beim Laden der Regeln');
      const data = await res.json();
      setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden');
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
      if (!res.ok) throw new Error('Fehler beim Speichern der Regeln');

      setSuccess('Regeln erfolgreich gespeichert.');
      await loadSettings();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <SlidersHorizontal className="h-5 w-5" />
          Optimierungsregeln
        </CardTitle>
        <CardDescription>
          Konfigurieren Sie die Schwellwerte, ab wann veroffentlichte Inhalte wieder als Optimierungsvorschlag erscheinen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Fehler</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertTitle>Erfolg</AlertTitle>
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
                Zeige einen Optimierungsvorschlag, wenn der Text alter als
                <Input
                  type="number"
                  className="mx-2 inline-flex h-8 w-28"
                  value={settings.AGE_DAYS}
                  onChange={(e) => updateField('AGE_DAYS', Number(e.target.value || 0))}
                  {...getInputProps('AGE_DAYS')}
                />
                Tagen ist und das Main-Keyword schlechter als Top
                <Input
                  type="number"
                  className="mx-2 inline-flex h-8 w-24"
                  value={settings.TOP_RANK_THRESHOLD}
                  onChange={(e) => updateField('TOP_RANK_THRESHOLD', Number(e.target.value || 0))}
                  {...getInputProps('TOP_RANK_THRESHOLD')}
                />
                rankt.
              </p>
              <p className="text-xs text-muted-foreground">
                Empfehlung fur Re-Optimierung bei alteren Inhalten ohne Spitzenranking.
              </p>
            </div>

            <div className="rounded-md border p-4 space-y-2">
              <p className="text-sm leading-6">
                Zeige einen Optimierungsvorschlag, wenn sich das Ranking im Vergleich der letzten
                <Input
                  type="number"
                  className="mx-2 inline-flex h-8 w-24"
                  value={settings.DROP_WINDOW_DAYS}
                  onChange={(e) => updateField('DROP_WINDOW_DAYS', Number(e.target.value || 0))}
                  {...getInputProps('DROP_WINDOW_DAYS')}
                />
                Tage um mindestens
                <Input
                  type="number"
                  className="mx-2 inline-flex h-8 w-24"
                  value={settings.DROP_THRESHOLD_PCT}
                  onChange={(e) => updateField('DROP_THRESHOLD_PCT', Number(e.target.value || 0))}
                  {...getInputProps('DROP_THRESHOLD_PCT')}
                />
                % verschlechtert.
              </p>
              <p className="text-xs text-muted-foreground">
                Erkennt deutliche Verschlechterungen im jungsten Zeitraum.
              </p>
            </div>

            <div className="rounded-md border p-4 space-y-2">
              <p className="text-sm leading-6">
                Zeige einen Optimierungsvorschlag, wenn sich die Performance innerhalb von
                <Input
                  type="number"
                  className="mx-2 inline-flex h-8 w-28"
                  value={settings.PERFORMANCE_WINDOW_DAYS}
                  onChange={(e) => updateField('PERFORMANCE_WINDOW_DAYS', Number(e.target.value || 0))}
                  {...getInputProps('PERFORMANCE_WINDOW_DAYS')}
                />
                Tagen nach Veroffentlichung nicht um mindestens
                <Input
                  type="number"
                  className="mx-2 inline-flex h-8 w-24"
                  value={settings.MIN_IMPROVEMENT_PCT}
                  onChange={(e) => updateField('MIN_IMPROVEMENT_PCT', Number(e.target.value || 0))}
                  {...getInputProps('MIN_IMPROVEMENT_PCT')}
                />
                % verbessert.
              </p>
              <p className="text-xs text-muted-foreground">
                Pruft, ob nach Veroffentlichung genug Fortschritt bei Klicks, Impressionen oder Position erzielt wurde.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadSettings} disabled={loading || saving}>
            <RefreshCw className="h-4 w-4 mr-2" /> Neu laden
          </Button>
          <Button onClick={save} disabled={loading || saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Speichern
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Hinweis: URL-Mismatch ist aktuell deaktiviert, da die rankende URL im Datenmodell noch nicht verlasslich vorliegt.
        </p>
      </CardContent>
    </Card>
  );
}

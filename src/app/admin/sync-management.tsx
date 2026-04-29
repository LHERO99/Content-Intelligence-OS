"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Loader2, RefreshCcw, XCircle, Search, AlertTriangle } from "lucide-react";
import { useI18n } from "@/i18n/use-i18n";

type SyncSource = "gsc" | "dataforseo" | "sistrix";
type SyncMode = "week" | "6months";

interface SyncResult {
  success: boolean;
  completedAt?: string;
  urlsProcessed: number;
  keywordsProcessed: number;
  gscRowsUpserted: number;
  sistrixRowsUpserted: number;
  rankingRowsUpserted: number;
  rankingsSkipped: number;
  errors: string[];
  skippedGsc: boolean;
  skippedSistrix: boolean;
  skippedDataforseo: boolean;
}

export function SyncManagement() {
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);

  const [allUrls, setAllUrls] = useState<string[]>([]);
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [urlFilter, setUrlFilter] = useState("");

  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<SyncMode>("week");
  const [sources, setSources] = useState<Set<SyncSource>>(new Set(["gsc", "dataforseo", "sistrix"]));

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load URL list on mount
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingUrls(true);
        const res = await fetch("/api/admin/sync/urls");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load URLs");
        setAllUrls(data.urls || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingUrls(false);
      }
    };
    load();
  }, []);

  const filteredUrls = urlFilter.trim()
    ? allUrls.filter(url => url.toLowerCase().includes(urlFilter.toLowerCase()))
    : allUrls;

  const allFilteredSelected = filteredUrls.length > 0 && filteredUrls.every(u => selectedUrls.has(u));

  const toggleUrl = (url: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredUrls.forEach(u => next.delete(u));
      } else {
        filteredUrls.forEach(u => next.add(u));
      }
      return next;
    });
  };

  const toggleSource = (source: SyncSource) => {
    setSources(prev => {
      const next = new Set(prev);
      next.has(source) ? next.delete(source) : next.add(source);
      return next;
    });
  };

  const handleSync = async () => {
    if (!selectedUrls.size) return;
    if (!sources.size) return;

    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/sync/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: [...selectedUrls],
          mode,
          sources: [...sources],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync fehlgeschlagen");
      setResult(data as SyncResult);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const sourceLabels: Record<SyncSource, string> = {
    gsc: "Google Search Console",
    dataforseo: "DataForSEO Rankings",
    sistrix: "Sistrix VI",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* ── Left: Configuration ── */}
      <div className="space-y-5">

        {/* URL Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {tr("1) URLs auswählen", "1) Select URLs")}
            </CardTitle>
            <CardDescription className="text-xs">
              {tr(
                "Wähle die URLs für die der Sync ausgeführt werden soll. Bereits vorhandene Daten werden überschrieben.",
                "Select the URLs to sync. Existing data will be overwritten."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Filter input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder={tr("URLs filtern…", "Filter URLs…")}
                value={urlFilter}
                onChange={e => setUrlFilter(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Select all toggle */}
            <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
              <button
                type="button"
                onClick={toggleAllFiltered}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {allFilteredSelected
                  ? tr("Alle abwählen", "Deselect all")
                  : tr(`Alle auswählen (${filteredUrls.length})`, `Select all (${filteredUrls.length})`)}
              </button>
              <span>
                {selectedUrls.size} {tr("ausgewählt", "selected")}
              </span>
            </div>

            {/* URL list */}
            {loadingUrls ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("URLs werden geladen…", "Loading URLs…")}
              </div>
            ) : filteredUrls.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {urlFilter ? tr("Keine URLs gefunden.", "No URLs found.") : tr("Keine URLs im System.", "No URLs in system.")}
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                {filteredUrls.map(url => (
                  <label
                    key={url}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/60 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUrls.has(url)}
                      onChange={() => toggleUrl(url)}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    <span className="text-xs truncate text-foreground">{url}</span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mode Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {tr("2) Zeitraum", "2) Time range")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {(["week", "6months"] as SyncMode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    mode === m
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border hover:bg-muted/60"
                  }`}
                >
                  <div className="text-sm font-medium">
                    {m === "week"
                      ? tr("Aktuelle Woche", "Current week")
                      : tr("Letzte 6 Monate", "Last 6 months")}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {m === "week"
                      ? tr("Letzte 7 Tage (GSC + Sistrix) · Aktuelles Wochen-Ranking (DataForSEO)", "Last 7 days (GSC + Sistrix) · Current week ranking (DataForSEO)")
                      : tr("180 Tage GSC · 26 Wochen Sistrix · Aktuelles Ranking DataForSEO", "180 days GSC · 26 weeks Sistrix · Current ranking DataForSEO")}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Source Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {tr("3) Datenquellen", "3) Data sources")}
            </CardTitle>
            <CardDescription className="text-xs">
              {tr(
                "Nur Quellen mit konfigurierter Integration sind aktiv.",
                "Only sources with a configured integration are active."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(["gsc", "dataforseo", "sistrix"] as SyncSource[]).map(src => (
                <label
                  key={src}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/60 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={sources.has(src)}
                    onChange={() => toggleSource(src)}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  <div>
                    <span className="text-sm font-medium">{sourceLabels[src]}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {src === "gsc" && tr("Klicks, Impressionen, Position", "Clicks, impressions, position")}
                      {src === "dataforseo" && tr("Wöchentliches Keyword-Ranking (SERP)", "Weekly keyword ranking (SERP)")}
                      {src === "sistrix" && tr("Sichtbarkeitsindex (page-level)", "Visibility index (page-level)")}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Right: Start + Result ── */}
      <div className="space-y-5">
        {/* Start Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr("Sync starten", "Start sync")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="rounded-md bg-muted/50 border px-3 py-2.5 text-xs space-y-1 text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">{selectedUrls.size}</span>{" "}
                {tr("URL(s) ausgewählt", "URL(s) selected")}
              </div>
              <div>
                {tr("Zeitraum:", "Range:")}{" "}
                <span className="font-medium text-foreground">
                  {mode === "week" ? tr("Aktuelle Woche", "Current week") : tr("Letzte 6 Monate", "Last 6 months")}
                </span>
              </div>
              <div>
                {tr("Quellen:", "Sources:")}{" "}
                <span className="font-medium text-foreground">
                  {sources.size === 0
                    ? tr("keine ausgewählt", "none selected")
                    : [...sources].map(s => sourceLabels[s]).join(", ")}
                </span>
              </div>
            </div>

            {mode === "6months" && selectedUrls.size > 10 && (
              <Alert className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {tr(
                    `${selectedUrls.size} URLs × 6 Monate kann einige Minuten dauern.`,
                    `${selectedUrls.size} URLs × 6 months may take several minutes.`
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full h-10"
              onClick={handleSync}
              disabled={running || !selectedUrls.size || !sources.size}
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {tr("Sync läuft…", "Syncing…")}
                </>
              ) : (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  {tr("Sync starten", "Start sync")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>{tr("Fehler", "Error")}</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {/* Result */}
        {result && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {tr("Sync abgeschlossen", "Sync completed")}
              </CardTitle>
              {result.completedAt && (
                <CardDescription className="text-xs">
                  {new Date(result.completedAt).toLocaleString(locale === "de" ? "de-DE" : "en-GB")}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: tr("URLs verarbeitet", "URLs processed"), value: result.urlsProcessed },
                  { label: tr("Keywords verarbeitet", "Keywords processed"), value: result.keywordsProcessed },
                  { label: tr("GSC Rows", "GSC rows"), value: result.gscRowsUpserted, skip: result.skippedGsc },
                  { label: tr("Sistrix Rows", "Sistrix rows"), value: result.sistrixRowsUpserted, skip: result.skippedSistrix },
                  { label: tr("Rankings gespeichert", "Rankings saved"), value: result.rankingRowsUpserted, skip: result.skippedDataforseo },
                  { label: tr("Rankings übersprungen", "Rankings skipped"), value: result.rankingsSkipped, skip: result.skippedDataforseo },
                ].map(({ label, value, skip }) => (
                  <div key={label} className="rounded-md border bg-muted/30 px-2.5 py-2">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-sm font-semibold mt-0.5">
                      {skip ? <span className="text-muted-foreground text-xs">{tr("übersprungen", "skipped")}</span> : value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Skipped sources */}
              {(result.skippedGsc || result.skippedSistrix || result.skippedDataforseo) && (
                <div className="flex flex-wrap gap-1.5">
                  {result.skippedGsc && <Badge variant="secondary" className="text-xs">GSC {tr("übersprungen", "skipped")}</Badge>}
                  {result.skippedSistrix && <Badge variant="secondary" className="text-xs">Sistrix {tr("übersprungen", "skipped")}</Badge>}
                  {result.skippedDataforseo && <Badge variant="secondary" className="text-xs">DataForSEO {tr("übersprungen", "skipped")}</Badge>}
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive">
                    {result.errors.length} {tr("Fehler", "error(s)")}:
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1">{e}</p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

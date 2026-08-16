"use client";

import * as React from "react";
import { Plus, X, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FunnelPhase, JourneyPageMapping } from "@/lib/db/topic-journey-types";
import { useI18n } from "@/i18n/use-i18n";
import Link from "next/link";

const PHASE_COLORS: Record<FunnelPhase, string> = {
  awareness:     "#3b82f6",
  consideration: "#6366f1",
  decision:      "#22c55e",
  retention:     "#f97316",
};

const STATUS_LABELS: Record<string, string> = {
  backlog:   "Backlog",
  planned:   "Geplant",
  in_progress: "In Arbeit",
  published: "Published",
};

const STATUS_COLORS: Record<string, string> = {
  backlog:     "bg-slate-100 text-slate-600",
  planned:     "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  published:   "bg-green-100 text-green-700",
};

interface FunnelPhaseColumnProps {
  phase: FunnelPhase;
  label: string;
  mappings: JourneyPageMapping[];
  onAddPage: () => void;
  onRemovePage: (mappingId: string) => void;
}

export function FunnelPhaseColumn({
  phase,
  label,
  mappings,
  onAddPage,
  onRemovePage,
}: FunnelPhaseColumnProps) {
  const { locale } = useI18n();
  const tr = (de: string, en: string) => locale === "de" ? de : en;
  const color = PHASE_COLORS[phase];

  return (
    <div className="flex flex-col min-w-[220px] flex-1 border border-border rounded-lg overflow-hidden bg-background">
      {/* Column header */}
      <div
        className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wider flex items-center justify-between"
        style={{ backgroundColor: `${color}15`, color, borderBottom: `2px solid ${color}40` }}
      >
        <span>{label}</span>
        <span
          className="rounded-full px-1.5 py-0.5 text-xs font-bold"
          style={{ backgroundColor: `${color}25`, color }}
        >
          {mappings.length}
        </span>
      </div>

      {/* URL cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px]">
        {mappings.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {tr("Noch keine Seiten.", "No pages yet.")}
          </p>
        )}
        {mappings.map((m) => (
          <div
            key={m.id}
            className="bg-card border border-border rounded-md p-2.5 group relative hover:shadow-sm transition-shadow"
          >
            {/* Remove button */}
            <button
              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              onClick={() => onRemovePage(m.id)}
              title={tr("Entfernen", "Remove")}
            >
              <X className="w-3 h-3" />
            </button>

            {/* URL */}
            <p className="text-xs text-muted-foreground truncate pr-5" title={m.url}>
              {m.url ? m.url.replace(/^https?:\/\/[^/]+/, "") || "/" : "—"}
            </p>

            {/* Main keyword */}
            {m.mainKeyword && (
              <p className="text-xs font-medium truncate mt-1">{m.mainKeyword}</p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {m.planningStatus && (
                <span
                  className={cn(
                    "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                    STATUS_COLORS[m.planningStatus] ?? "bg-slate-100 text-slate-600",
                  )}
                >
                  {STATUS_LABELS[m.planningStatus] ?? m.planningStatus}
                </span>
              )}
              {m.ranking != null && (
                <span className="text-[10px] text-muted-foreground">#{m.ranking}</span>
              )}
              {m.searchVolume != null && (
                <span className="text-[10px] text-muted-foreground">
                  {m.searchVolume.toLocaleString("de-DE")} SV
                </span>
              )}
              {m.clicks30d != null && m.clicks30d > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {m.clicks30d.toLocaleString("de-DE")} Klicks
                </span>
              )}
            </div>

            {/* Planning link */}
            {m.url && (
              <div className="mt-1.5">
                <Link
                  href={`/planning?tab=keyword-map&url=${encodeURIComponent(m.url)}`}
                  className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  {tr("In Planung ansehen", "View in planning")}
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add page button */}
      <div className="p-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground hover:text-primary"
          onClick={onAddPage}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {tr("Seite hinzufügen", "Add page")}
        </Button>
      </div>
    </div>
  );
}

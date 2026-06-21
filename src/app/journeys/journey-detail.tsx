"use client";

import * as React from "react";
import { Loader2, Pencil, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { FUNNEL_PHASES, FunnelPhase, Journey } from "@/lib/db/topic-journey-types";
import { useJourneyDetail } from "@/features/journeys/hooks/use-journey-detail";
import { useI18n } from "@/i18n/use-i18n";
import { JourneyCoverageChart } from "./journey-coverage-chart";
import { FunnelPhaseColumn } from "./funnel-phase-column";
import { CreateJourneyModal } from "./create-journey-modal";
import { UrlPickerModal } from "./url-picker-modal";

interface JourneyDetailProps {
  journeyId: string;
  onUpdated: (updated: Journey) => void;
  onDeleted: () => void;
}

export function JourneyDetail({ journeyId, onUpdated, onDeleted }: JourneyDetailProps) {
  const { t } = useI18n();
  const { journey, mappings, isLoading, error, refresh, addMapping, removeMapping } =
    useJourneyDetail(journeyId);

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [pickerPhase, setPickerPhase] = React.useState<FunnelPhase | null>(null);

  // Load detail whenever journeyId changes
  React.useEffect(() => {
    refresh();
  }, [refresh, journeyId]);

  const handleSaveEdit = async (data: { name: string; description?: string }) => {
    const res = await fetch(`/api/journeys/${journeyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    const updated = await res.json();
    onUpdated(updated);
    refresh();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await fetch(`/api/journeys/${journeyId}`, { method: "DELETE" });
      setDeleteConfirmOpen(false);
      onDeleted();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddPage = async (urlId: string) => {
    if (!pickerPhase) return;
    await addMapping(urlId, pickerPhase);
    setPickerPhase(null);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !journey) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          {error ?? "Journey konnte nicht geladen werden."}
        </div>
      </div>
    );
  }

  const alreadyMappedUrlIds = mappings.map((m) => m.urlId);

  const phaseCoverage = {
    awareness:     mappings.filter((m) => m.funnelPhase === "awareness").length,
    consideration: mappings.filter((m) => m.funnelPhase === "consideration").length,
    decision:      mappings.filter((m) => m.funnelPhase === "decision").length,
    retention:     mappings.filter((m) => m.funnelPhase === "retention").length,
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{journey.name}</h2>
          {journey.description && (
            <p className="text-sm text-muted-foreground mt-1">{journey.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            {t("journeys.editJourney")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            {t("journeys.deleteJourney")}
          </Button>
        </div>
      </div>

      {/* Coverage chart */}
      <div className="border border-border rounded-lg p-4 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {t("journeys.coverage")}
        </p>
        <JourneyCoverageChart phaseCoverage={phaseCoverage} />
      </div>

      {/* 4-column funnel */}
      <div className="flex gap-3 flex-1 overflow-x-auto pb-2">
        {FUNNEL_PHASES.map(({ key, labelDe }) => (
          <FunnelPhaseColumn
            key={key}
            phase={key}
            label={labelDe}
            mappings={mappings.filter((m) => m.funnelPhase === key)}
            onAddPage={() => setPickerPhase(key)}
            onRemovePage={removeMapping}
          />
        ))}
      </div>

      {/* Edit modal */}
      <CreateJourneyModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        journey={journey}
        onSave={handleSaveEdit}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Journey löschen?</DialogTitle>
            <DialogDescription>
              Die Journey &ldquo;{journey.name}&rdquo; und alle URL-Zuordnungen werden dauerhaft
              gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* URL picker modal */}
      <UrlPickerModal
        open={pickerPhase !== null}
        onClose={() => setPickerPhase(null)}
        onSelect={handleAddPage}
        phase={pickerPhase ?? "awareness"}
        alreadyMappedUrlIds={alreadyMappedUrlIds}
      />
    </div>
  );
}

"use client";

import * as React from "react";
import { Loader2, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/use-i18n";
import { Journey, JourneyWithStats } from "@/lib/db/topic-journey-types";
import { useJourneys } from "@/features/journeys/hooks/use-journeys";
import { JourneyList } from "./journey-list";
import { JourneyDetail } from "./journey-detail";
import { CreateJourneyModal } from "./create-journey-modal";

export default function JourneysPage() {
  const { t } = useI18n();
  const { journeys, isLoading, error, refresh, createJourney, updateJourney, deleteJourney } =
    useJourneys();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  // Load journeys on mount
  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-select first journey when list loads
  React.useEffect(() => {
    if (journeys.length > 0 && !selectedId) {
      setSelectedId(journeys[0].id);
    }
  }, [journeys, selectedId]);

  const handleCreate = async (data: { name: string; description?: string }) => {
    const created = await createJourney(data);
    setSelectedId(created.id);
  };

  const handleJourneyUpdated = (updated: Journey) => {
    updateJourney(updated.id, { name: updated.name, description: updated.description ?? undefined });
  };

  const handleJourneyDeleted = () => {
    // Re-fetch list; select first remaining journey or none
    refresh().then(() => {
      setSelectedId((prev) => {
        const remaining = journeys.filter((j) => j.id !== prev);
        return remaining[0]?.id ?? null;
      });
    });
  };

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            {t("journeys.title")}
          </h1>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <GitBranch className="w-4 h-4 mr-2" />
          {t("journeys.createJourney")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error}</p>
        </div>
      ) : journeys.length === 0 ? (
        /* Empty state */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm">
            <div className="text-5xl">🗺️</div>
            <h2 className="text-lg font-semibold">{t("journeys.empty")}</h2>
            <p className="text-sm text-muted-foreground">
              Erstelle deine erste Customer Journey um die Funnel-Abdeckung deiner Seiten zu
              visualisieren.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              {t("journeys.createJourney")}
            </Button>
          </div>
        </div>
      ) : (
        /* Two-column layout */
        <div className="flex flex-1 gap-0 border border-border rounded-lg overflow-hidden min-h-0">
          {/* Left sidebar — journey list */}
          <div className="w-[280px] shrink-0 border-r border-border overflow-y-auto">
            <JourneyList
              journeys={journeys}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreate={() => setCreateOpen(true)}
            />
          </div>

          {/* Right main area — journey detail */}
          <div className="flex-1 p-6 overflow-y-auto min-w-0">
            {selectedId ? (
              <JourneyDetail
                key={selectedId}
                journeyId={selectedId}
                onUpdated={handleJourneyUpdated}
                onDeleted={handleJourneyDeleted}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Wähle eine Journey aus der Liste.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create modal */}
      <CreateJourneyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
      />
    </div>
  );
}

"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JourneyWithStats } from "@/lib/db/topic-journey-types";
import { useI18n } from "@/i18n/use-i18n";

interface JourneyListProps {
  journeys: JourneyWithStats[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function JourneyList({ journeys, selectedId, onSelect, onCreate }: JourneyListProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Meine Journeys
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {journeys.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-4">
            {t("journeys.empty")}
          </p>
        ) : (
          journeys.map((journey) => {
            const phaseCount = Object.values(journey.phaseCoverage).filter((n) => n > 0).length;
            return (
              <button
                key={journey.id}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border/50 last:border-0",
                  selectedId === journey.id && "bg-primary/10 border-l-2 border-l-primary",
                )}
                onClick={() => onSelect(journey.id)}
              >
                <p className="text-sm font-medium truncate">{journey.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {journey.totalMappings} {journey.totalMappings === 1 ? "Seite" : "Seiten"}
                  {phaseCount > 0 && ` · ${phaseCount} Phase${phaseCount !== 1 ? "n" : ""}`}
                </p>
              </button>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full border-primary/20 text-primary hover:bg-primary/10"
          onClick={onCreate}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("journeys.createJourney")}
        </Button>
      </div>
    </div>
  );
}

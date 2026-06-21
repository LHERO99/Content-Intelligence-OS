"use client";

import * as React from "react";
import { useI18n } from "@/i18n/use-i18n";

interface JourneyCoverageChartProps {
  phaseCoverage: {
    awareness: number;
    consideration: number;
    decision: number;
    retention: number;
  };
}

const PHASES: { key: keyof JourneyCoverageChartProps["phaseCoverage"]; color: string }[] = [
  { key: "awareness",     color: "#3b82f6" },
  { key: "consideration", color: "#6366f1" },
  { key: "decision",      color: "#22c55e" },
  { key: "retention",     color: "#f97316" },
];

export function JourneyCoverageChart({ phaseCoverage }: JourneyCoverageChartProps) {
  const { t } = useI18n();
  const max = Math.max(...Object.values(phaseCoverage), 1);

  return (
    <div className="space-y-2">
      {PHASES.map(({ key, color }) => {
        const count = phaseCoverage[key];
        const width = Math.round((count / max) * 100);
        return (
          <div key={key} className="flex items-center gap-3">
            <span
              className="text-xs font-medium w-28 shrink-0 capitalize"
              style={{ color }}
            >
              {t(`journeys.phases.${key}` as any)}
            </span>
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${width}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-4 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

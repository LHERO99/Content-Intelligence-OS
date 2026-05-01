"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { RunRecord, RunStep, statusVariant } from "../types";

// ─── LiveDuration ─────────────────────────────────────────────────────────────

export function LiveDuration({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  );
  useEffect(() => {
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)),
      1000
    );
    return () => clearInterval(id);
  }, [startedAt]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <span className="text-[10px] font-mono text-green-600">
      {m > 0 ? `${m}m ` : ""}
      {s}s
    </span>
  );
}

// ─── RunCard ──────────────────────────────────────────────────────────────────

export function RunCard({
  run,
  queueIndex,
  selectedRunId,
  runActionLoading,
  runSteps,
  localeTag,
  onOpen,
  onLoadDetails,
  onCancel,
  onSoftDelete,
  onRestore,
  stopLabel,
  hideLabel,
  restoreLabel,
}: {
  run: RunRecord;
  queueIndex?: number;
  selectedRunId: string | null;
  runActionLoading: string | null;
  runSteps: RunStep[];
  localeTag: string;
  onOpen: () => void;
  onLoadDetails: () => void;
  onCancel: () => void;
  onSoftDelete: () => void;
  onRestore: () => void;
  stopLabel: string;
  hideLabel: string;
  restoreLabel: string;
}) {
  const isActive = run.status === "running" || run.status === "pending";
  const isSelected = selectedRunId === run.id;

  return (
    <div
      className={`w-full rounded-lg border p-3 text-left transition-all ${
        isSelected
          ? "border-primary/50 bg-primary/8 shadow-[0_0_0_1px_rgba(0,70,60,0.15)]"
          : isActive
          ? "border-primary/25 bg-primary/5 hover:bg-primary/8"
          : "border-border bg-white hover:bg-muted/50 hover:border-primary/20"
      }`}
    >
      <button type="button" onClick={onLoadDetails} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            {run.status === "running" && (
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            )}
            {run.status === "pending" && (
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400 shrink-0" />
            )}
            <span className="font-mono text-muted-foreground">Run</span>
            <span className="font-bold text-foreground">{run.id.slice(0, 8)}</span>
            {typeof queueIndex === "number" && (
              <span className="text-[10px] text-amber-700 font-mono bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                #{queueIndex + 1} Queue
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {run.status === "running" && <LiveDuration startedAt={run.startedAt} />}
            <Badge variant={statusVariant(run.status)} className="text-xs">
              {run.status}
            </Badge>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
          <span>{new Date(run.startedAt).toLocaleString(localeTag)}</span>
          {run.durationMs && (
            <span className="font-medium">{(run.durationMs / 1000).toFixed(1)}s</span>
          )}
          {run.deletedAt && <span className="text-amber-600">versteckt</span>}
        </div>
      </button>

      <div className="mt-2.5 flex gap-1.5 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2.5 text-xs border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50"
          onClick={onOpen}
        >
          Details
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2.5 text-xs disabled:opacity-30"
          disabled={run.status !== "running" || runActionLoading === `cancel:${run.id}`}
          onClick={onCancel}
        >
          {runActionLoading === `cancel:${run.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : stopLabel}
        </Button>
        {!run.deletedAt ? (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 disabled:opacity-30"
            disabled={runActionLoading === `delete:${run.id}`}
            onClick={onSoftDelete}
          >
            {runActionLoading === `delete:${run.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : hideLabel}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2.5 text-xs border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 disabled:opacity-30"
            disabled={runActionLoading === `restore:${run.id}`}
            onClick={onRestore}
          >
            {runActionLoading === `restore:${run.id}` ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              restoreLabel
            )}
          </Button>
        )}
      </div>

      {isSelected &&
        run.status === "failed" &&
        (() => {
          const failedStep = runSteps.find((s) => s.status === "failed" && s.error);
          if (!failedStep) return null;
          return (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2.5">
              <p className="text-[11px] font-bold text-red-700 mb-1 uppercase tracking-wide">
                Fehler: {failedStep.nodeName}
              </p>
              <p className="text-xs text-red-600 font-mono break-words whitespace-pre-wrap leading-relaxed">
                {failedStep.error}
              </p>
            </div>
          );
        })()}
    </div>
  );
}

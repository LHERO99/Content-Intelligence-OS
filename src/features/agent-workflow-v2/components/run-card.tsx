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
    <span className="text-[10px] font-mono text-green-400">
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
          ? "border-blue-400/60 bg-blue-500/12 shadow-[0_0_0_1px_rgba(96,165,250,0.2)]"
          : isActive
          ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/8"
          : "border-white/12 bg-white/4 hover:bg-white/8 hover:border-white/20"
      }`}
    >
      <button type="button" onClick={onLoadDetails} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            {run.status === "running" && (
              <span className="inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse shrink-0" />
            )}
            {run.status === "pending" && (
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-400/80 shrink-0" />
            )}
            <span className="font-mono text-slate-300">Run</span>
            <span className="font-bold text-slate-100">{run.id.slice(0, 8)}</span>
            {typeof queueIndex === "number" && (
              <span className="text-[10px] text-yellow-300/90 font-mono bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded">
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
        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
          <span>{new Date(run.startedAt).toLocaleString(localeTag)}</span>
          {run.durationMs && (
            <span className="text-slate-400 font-medium">{(run.durationMs / 1000).toFixed(1)}s</span>
          )}
          {run.deletedAt && <span className="text-amber-500/70">versteckt</span>}
        </div>
      </button>

      <div className="mt-2.5 flex gap-1.5 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2.5 text-xs border-blue-400/40 text-blue-300 hover:bg-blue-500/15 hover:border-blue-400/60 bg-transparent"
          onClick={onOpen}
        >
          Details
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2.5 text-xs border-white/20 text-slate-400 hover:bg-white/10 hover:text-slate-200 bg-transparent disabled:opacity-30"
          disabled={run.status !== "running" || runActionLoading === `cancel:${run.id}`}
          onClick={onCancel}
        >
          {runActionLoading === `cancel:${run.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : stopLabel}
        </Button>
        {!run.deletedAt ? (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2.5 text-xs border-amber-500/30 text-amber-400/80 hover:bg-amber-500/10 hover:border-amber-400/50 bg-transparent disabled:opacity-30"
            disabled={runActionLoading === `delete:${run.id}`}
            onClick={onSoftDelete}
          >
            {runActionLoading === `delete:${run.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : hideLabel}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2.5 text-xs border-emerald-500/30 text-emerald-400/80 hover:bg-emerald-500/10 hover:border-emerald-400/50 bg-transparent disabled:opacity-30"
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
            <div className="mt-3 rounded-md border border-red-500/30 bg-red-950/40 p-2.5">
              <p className="text-[11px] font-bold text-red-300 mb-1 uppercase tracking-wide">
                Fehler: {failedStep.nodeName}
              </p>
              <p className="text-xs text-red-200/90 font-mono break-words whitespace-pre-wrap leading-relaxed">
                {failedStep.error}
              </p>
            </div>
          );
        })()}
    </div>
  );
}

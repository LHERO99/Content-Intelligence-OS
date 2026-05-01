"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { RunCard } from "./run-card";
import { RunRecord, RunStep } from "../types";

// ─── ExecutionPanel ───────────────────────────────────────────────────────────

export function ExecutionPanel({
  executionPanelHeight,
  onResizeStart,
  runActionLoading,
  showHiddenRuns,
  onToggleHiddenRuns,
  onCleanupStaleRuns,
  runStatusFilter,
  onRunStatusFilterChange,
  filteredRuns,
  selectedRunId,
  runSteps,
  localeTag,
  onOpenRunDetail,
  onLoadRunDetails,
  onCancelRun,
  onSoftDeleteRun,
  onRestoreRun,
  t,
}: {
  executionPanelHeight: number;
  onResizeStart: (event: React.MouseEvent) => void;
  runActionLoading: string | null;
  showHiddenRuns: boolean;
  onToggleHiddenRuns: () => void;
  onCleanupStaleRuns: () => void;
  runStatusFilter: "all" | RunRecord["status"];
  onRunStatusFilterChange: (value: "all" | RunRecord["status"]) => void;
  filteredRuns: RunRecord[];
  selectedRunId: string | null;
  runSteps: RunStep[];
  localeTag: string;
  onOpenRunDetail: (runId: string) => void;
  onLoadRunDetails: (runId: string) => void;
  onCancelRun: (runId: string) => void;
  onSoftDeleteRun: (runId: string) => void;
  onRestoreRun: (runId: string) => void;
  t: (key: string) => string;
}) {
  return (
    <Card className="border-white/10 bg-[#0b1220] text-slate-100 overflow-hidden">
      {/* Resize handle */}
      <div
        className="h-2.5 cursor-row-resize border-b border-white/8 hover:bg-white/5 transition-colors flex items-center justify-center"
        onMouseDown={onResizeStart}
        title="Panel Größe ändern"
      >
        <div className="w-8 h-0.5 rounded-full bg-white/20" />
      </div>

      <CardHeader className="px-5 py-3 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm font-semibold text-slate-200">
              {t("agentBuilder.executionPanel")}
            </CardTitle>
            {/* Status filter inline */}
            <Select value={runStatusFilter} onValueChange={(v) => onRunStatusFilterChange((v as any) || "all")}>
              <SelectTrigger className="h-6 w-[110px] bg-white/5 border-white/10 text-slate-400 text-xs focus:ring-0 px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f172a] border-white/10 text-slate-200">
                <SelectItem value="all">{t("agentBuilder.all")}</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0f172a] border-white/10 text-slate-200 min-w-[180px]">
              <DropdownMenuItem
                className="text-xs gap-2 cursor-pointer hover:bg-white/8 focus:bg-white/8"
                onClick={onToggleHiddenRuns}
              >
                {showHiddenRuns ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                    {t("agentBuilder.hiddenOn")}
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                    {t("agentBuilder.hiddenOff")}
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                className="text-xs gap-2 cursor-pointer hover:bg-white/8 focus:bg-white/8 text-slate-400"
                disabled={runActionLoading === "cleanup"}
                onClick={onCleanupStaleRuns}
              >
                {runActionLoading === "cleanup" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {t("agentBuilder.staleCleanup")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent style={{ height: executionPanelHeight }} className="overflow-y-auto px-5 py-3 space-y-3">
        {filteredRuns.length === 0 ? (
          <p className="text-sm text-slate-600 italic pt-2">{t("agentBuilder.noRuns")}</p>
        ) : (
          <div className="space-y-1.5">
            {/* Active group */}
            {filteredRuns.filter((r) => r.status === "running" || r.status === "pending").length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold px-0.5 pb-1">
                  Aktiv
                </p>
                {filteredRuns
                  .filter((r) => r.status === "running" || r.status === "pending")
                  .map((run, qi) => (
                    <RunCard
                      key={run.id}
                      run={run}
                      queueIndex={run.status === "pending" ? qi : undefined}
                      selectedRunId={selectedRunId}
                      runActionLoading={runActionLoading}
                      runSteps={runSteps}
                      localeTag={localeTag}
                      onOpen={() => onOpenRunDetail(run.id)}
                      onLoadDetails={() => onLoadRunDetails(run.id)}
                      onCancel={() => onCancelRun(run.id)}
                      onSoftDelete={() => onSoftDeleteRun(run.id)}
                      onRestore={() => onRestoreRun(run.id)}
                      stopLabel={t("agentBuilder.stop")}
                      hideLabel={t("agentBuilder.hide")}
                      restoreLabel={t("agentBuilder.restore")}
                    />
                  ))}
                {filteredRuns.filter((r) => r.status !== "running" && r.status !== "pending").length > 0 && (
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold px-0.5 pt-2 pb-1">
                    Abgeschlossen
                  </p>
                )}
              </>
            )}
            {/* Completed group */}
            {filteredRuns
              .filter((r) => r.status !== "running" && r.status !== "pending")
              .map((run) => (
                <RunCard
                  key={run.id}
                  run={run}
                  selectedRunId={selectedRunId}
                  runActionLoading={runActionLoading}
                  runSteps={runSteps}
                  localeTag={localeTag}
                  onOpen={() => onOpenRunDetail(run.id)}
                  onLoadDetails={() => onLoadRunDetails(run.id)}
                  onCancel={() => onCancelRun(run.id)}
                  onSoftDelete={() => onSoftDeleteRun(run.id)}
                  onRestore={() => onRestoreRun(run.id)}
                  stopLabel={t("agentBuilder.stop")}
                  hideLabel={t("agentBuilder.hide")}
                  restoreLabel={t("agentBuilder.restore")}
                />
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

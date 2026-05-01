"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { RunCard } from "./run-card";
import { RunRecord, RunStep } from "../types";

// ─── ExecutionPanel ───────────────────────────────────────────────────────────

export function ExecutionPanel({
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
    <Card className="overflow-hidden flex flex-col h-full">

      <CardHeader className="px-4 py-3 border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm font-semibold text-primary">
              {t("agentBuilder.executionPanel")}
            </CardTitle>
            {/* Status filter inline */}
            <Select value={runStatusFilter} onValueChange={(v) => onRunStatusFilterChange((v as any) || "all")}>
              <SelectTrigger className="h-6 w-[110px] text-xs focus:ring-0 px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
            <DropdownMenuTrigger className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem className="text-xs gap-2 cursor-pointer" onClick={onToggleHiddenRuns}>
                {showHiddenRuns ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    {t("agentBuilder.hiddenOn")}
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    {t("agentBuilder.hiddenOff")}
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs gap-2 cursor-pointer text-muted-foreground"
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

      <CardContent className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {filteredRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground italic pt-2">{t("agentBuilder.noRuns")}</p>
        ) : (
          <div className="space-y-1.5">
            {/* Active group */}
            {filteredRuns.filter((r) => r.status === "running" || r.status === "pending").length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-0.5 pb-1">
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
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-0.5 pt-2 pb-1">
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

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Circle, Clock, Loader2, MessageSquare, Send, XCircle } from "lucide-react";
import { RunCard } from "./run-card";
import { ExecutionView, RunMessage, RunRecord, RunStep, statusVariant } from "../types";

// ─── Step status icon (reused from run-detail-modal concept) ──────────────────

function StepStatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  if (status === "failed")  return <XCircle      className="h-3.5 w-3.5 text-red-400 shrink-0" />;
  if (status === "running") return <Loader2      className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0" />;
  if (status === "pending") return <Clock        className="h-3.5 w-3.5 text-yellow-400/70 shrink-0" />;
  return                           <Circle       className="h-3.5 w-3.5 text-slate-600 shrink-0" />;
}

// ─── ExecutionPanel ───────────────────────────────────────────────────────────

export function ExecutionPanel({
  executionPanelHeight,
  onResizeStart,
  executionView,
  onExecutionViewChange,
  runActionLoading,
  showHiddenRuns,
  onToggleHiddenRuns,
  onCleanupStaleRuns,
  runStatusFilter,
  onRunStatusFilterChange,
  filteredRuns,
  selectedRunId,
  runSteps,
  runMessages,
  selectedRun,
  selectedStepId,
  onSelectStep,
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
  executionView: ExecutionView;
  onExecutionViewChange: (view: ExecutionView) => void;
  runActionLoading: string | null;
  showHiddenRuns: boolean;
  onToggleHiddenRuns: () => void;
  onCleanupStaleRuns: () => void;
  runStatusFilter: "all" | RunRecord["status"];
  onRunStatusFilterChange: (value: "all" | RunRecord["status"]) => void;
  filteredRuns: RunRecord[];
  selectedRunId: string | null;
  runSteps: RunStep[];
  runMessages: RunMessage[];
  selectedRun: RunRecord | null;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
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
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-sm font-semibold text-slate-200">
              {t("agentBuilder.executionPanel")}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/8"
              disabled={runActionLoading === "cleanup"}
              onClick={onCleanupStaleRuns}
            >
              {runActionLoading === "cleanup" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("agentBuilder.staleCleanup")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`h-7 px-2.5 text-xs transition-colors ${
                showHiddenRuns
                  ? "text-blue-300 bg-blue-500/10 hover:bg-blue-500/15"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/8"
              }`}
              onClick={onToggleHiddenRuns}
            >
              {showHiddenRuns ? t("agentBuilder.hiddenOn") : t("agentBuilder.hiddenOff")}
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs text-slate-500 mt-1">
          {t("agentBuilder.executionDescription")}
        </CardDescription>
      </CardHeader>

      <CardContent style={{ height: executionPanelHeight }} className="overflow-hidden p-0">
        <Tabs
          value={executionView}
          onValueChange={(v) => onExecutionViewChange((v as ExecutionView) || "executions")}
          className="h-full flex flex-col"
        >
          {/* Tab bar */}
          <div className="flex border-b border-white/10 px-5 shrink-0">
            {(["executions", "timeline", "messages"] as const).map((view) => {
              const labels: Record<string, string> = {
                executions: t("agentBuilder.executions"),
                timeline:   t("agentBuilder.timeline"),
                messages:   t("agentBuilder.messages"),
              };
              return (
                <TabsTrigger
                  key={view}
                  value={view}
                  className="px-4 py-2.5 text-xs font-medium border-b-2 -mb-px rounded-none bg-transparent
                    text-slate-500 border-transparent
                    data-[state=active]:text-white data-[state=active]:border-blue-400
                    hover:text-slate-300 transition-colors"
                >
                  {labels[view]}
                </TabsTrigger>
              );
            })}
          </div>

          {/* ── Executions Tab ── */}
          <TabsContent value="executions" className="flex-1 overflow-hidden m-0">
            <div className="h-full overflow-y-auto px-5 py-3 space-y-3">
              {/* Filter */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-500 shrink-0">{t("agentBuilder.status")}</Label>
                <Select value={runStatusFilter} onValueChange={(v) => onRunStatusFilterChange((v as any) || "all")}>
                  <SelectTrigger className="w-[140px] h-7 bg-white/5 border-white/10 text-slate-300 text-xs focus:ring-0">
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
            </div>
          </TabsContent>

          {/* ── Timeline Tab ── */}
          <TabsContent value="timeline" className="flex-1 overflow-hidden m-0">
            <div className="h-full overflow-y-auto px-5 py-3">
              {!selectedRun ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-slate-500 italic">{t("agentBuilder.chooseRun")}</p>
                  <p className="text-xs text-slate-600 mt-1">Klicke in der Runs-Liste auf einen Eintrag.</p>
                </div>
              ) : runSteps.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-4">{t("agentBuilder.noSteps")}</p>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-400">
                      Run <span className="font-mono text-slate-500">{selectedRun.id.slice(0, 8)}</span>
                      {" · "}{runSteps.length} Schritt{runSteps.length !== 1 ? "e" : ""}
                    </p>
                    <button
                      type="button"
                      className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                      onClick={() => onOpenRunDetail(selectedRun.id)}
                    >
                      Details öffnen →
                    </button>
                  </div>
                  {runSteps.map((step, index) => (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => onSelectStep(step.id)}
                      className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                        selectedStepId === step.id
                          ? "border-blue-400/40 bg-blue-500/10"
                          : "border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15"
                      }`}
                    >
                      <StepStatusIcon status={step.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-100 truncate">{step.nodeName}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {step.durationMs != null && (
                              <span className="text-[10px] text-slate-600 font-mono">
                                {(step.durationMs / 1000).toFixed(1)}s
                              </span>
                            )}
                            <Badge variant={statusVariant(step.status)} className="text-[10px] px-1.5 py-0">
                              {step.status}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                          <span className="text-slate-700">#{index + 1}</span>
                          {" · "}R{step.round ?? "–"}
                          {" · "}{step.phase === "orchestrator_decision" ? "Orchestrator" : step.phase === "subagent_execution" ? "Sub-Agent" : step.phase ?? "–"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Messages Tab ── */}
          <TabsContent value="messages" className="flex-1 overflow-hidden m-0">
            <div className="h-full overflow-y-auto px-5 py-3 space-y-1.5">
              {!selectedRun ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-slate-500 italic">{t("agentBuilder.chooseRun")}</p>
                  <p className="text-xs text-slate-600 mt-1">Klicke in der Runs-Liste auf einen Eintrag.</p>
                </div>
              ) : runMessages.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-4">{t("agentBuilder.noMessages")}</p>
              ) : (
                runMessages.map((message) => (
                  <div
                    key={message.id}
                    className="flex items-start gap-3 rounded-lg border border-white/8 bg-white/3 px-3 py-2.5"
                  >
                    <Send className="h-3.5 w-3.5 text-slate-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-200 truncate">
                          {message.fromNodeName}
                          <span className="text-slate-600 mx-1">→</span>
                          {message.toNodeName}
                        </span>
                        <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                          message.messageType === "control"
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                            : message.messageType === "task_result"
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                            : "bg-blue-500/15 border-blue-500/30 text-blue-300"
                        }`}>
                          {message.messageType ?? "msg"}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5 truncate font-mono">{message.channel}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

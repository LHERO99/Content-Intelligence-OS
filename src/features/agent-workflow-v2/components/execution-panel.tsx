"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { RunCard } from "./run-card";
import { ExecutionView, RunMessage, RunRecord, RunStep, statusVariant } from "../types";

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
    <Card className="border-white/15 bg-[#0b1220] text-slate-100 overflow-hidden shadow-xl">
      <div
        className="h-3 cursor-row-resize border-b border-white/10 bg-gradient-to-r from-white/3 via-white/8 to-white/3 hover:bg-white/10 transition-colors"
        onMouseDown={onResizeStart}
        title="Execution Panel Größe ändern"
      />
      <CardHeader className="pb-2 border-b border-white/10">
        <CardTitle className="text-base flex items-center justify-between text-slate-100">
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-slate-400" />
            {t("agentBuilder.executionPanel")}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-white/20 text-slate-300 hover:bg-white/10 hover:text-slate-100 bg-transparent"
              disabled={runActionLoading === "cleanup"}
              onClick={onCleanupStaleRuns}
            >
              {runActionLoading === "cleanup" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                t("agentBuilder.staleCleanup")
              )}
            </Button>
            <Button
              size="sm"
              variant={showHiddenRuns ? "default" : "outline"}
              className={
                showHiddenRuns
                  ? "h-7 bg-white/20 text-white border-white/30"
                  : "h-7 border-white/20 text-slate-300 hover:bg-white/10 hover:text-slate-100 bg-transparent"
              }
              onClick={onToggleHiddenRuns}
            >
              {showHiddenRuns ? t("agentBuilder.hiddenOn") : t("agentBuilder.hiddenOff")}
            </Button>
          </div>
        </CardTitle>
        <CardDescription className="text-slate-400">{t("agentBuilder.executionDescription")}</CardDescription>
      </CardHeader>

      <CardContent style={{ height: executionPanelHeight }} className="overflow-hidden pt-3">
        <Tabs
          value={executionView}
          onValueChange={(v) => onExecutionViewChange((v as ExecutionView) || "executions")}
        >
          <TabsList className="bg-white/8 border border-white/15 rounded-lg p-0.5 gap-0.5">
            <TabsTrigger value="executions" className="text-slate-400 data-[state=active]:bg-white/15 data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-slate-200 rounded-md px-3 py-1.5 text-xs font-medium transition-colors">
              {t("agentBuilder.executions")}
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-slate-400 data-[state=active]:bg-white/15 data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-slate-200 rounded-md px-3 py-1.5 text-xs font-medium transition-colors">
              {t("agentBuilder.timeline")}
            </TabsTrigger>
            <TabsTrigger value="messages" className="text-slate-400 data-[state=active]:bg-white/15 data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-slate-200 rounded-md px-3 py-1.5 text-xs font-medium transition-colors">
              {t("agentBuilder.messages")}
            </TabsTrigger>
          </TabsList>

          {/* ── Executions Tab ── */}
          <TabsContent value="executions" className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs text-slate-400 font-medium">{t("agentBuilder.status")}</Label>
              <Select
                value={runStatusFilter}
                onValueChange={(v) => onRunStatusFilterChange((v as any) || "all")}
              >
                <SelectTrigger className="w-[160px] bg-white/8 border-white/20 text-slate-200 hover:bg-white/12 text-xs h-7">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f172a] border-white/20 text-slate-200">
                  <SelectItem value="all">{t("agentBuilder.all")}</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredRuns.length === 0 ? (
              <p className="text-sm text-slate-500 italic">{t("agentBuilder.noRuns")}</p>
            ) : (
              <div className="grid gap-1.5 max-h-[calc(100%-48px)] overflow-auto pr-1">
                {/* Active runs */}
                {filteredRuns.filter((r) => r.status === "running" || r.status === "pending").length > 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold px-1 pb-0.5 border-b border-white/10 mb-1">
                      Aktiv
                    </p>
                    {filteredRuns
                      .filter((r) => r.status === "running" || r.status === "pending")
                      .map((run, queueIndex) => (
                        <RunCard
                          key={run.id}
                          run={run}
                          queueIndex={run.status === "pending" ? queueIndex : undefined}
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
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold px-1 pb-0.5 border-b border-white/10 mb-1 mt-2">
                        Abgeschlossen
                      </p>
                    )}
                  </>
                )}
                {/* Completed runs */}
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
          </TabsContent>

          {/* ── Timeline Tab ── */}
          <TabsContent value="timeline" className="mt-3 space-y-3">
            {!selectedRun ? (
              <p className="text-sm text-slate-500 italic">{t("agentBuilder.chooseRun")}</p>
            ) : runSteps.length === 0 ? (
              <p className="text-sm text-slate-500 italic">{t("agentBuilder.noSteps")}</p>
            ) : (
              <>
                <div className="space-y-1.5 max-h-[210px] overflow-auto pr-1">
                  {runSteps.map((step, index) => (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => onSelectStep(step.id)}
                      className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                        selectedStepId === step.id
                          ? "border-blue-400/50 bg-blue-500/12"
                          : "border-white/12 bg-white/4 hover:bg-white/8 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                          {step.status === "running" && (
                            <span className="inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                          )}
                          <span className="text-slate-600 font-mono text-[10px]">#{index + 1}</span>
                          {step.nodeName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {step.durationMs != null && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {(step.durationMs / 1000).toFixed(1)}s
                            </span>
                          )}
                          <Badge variant={statusVariant(step.status)} className="text-[10px]">
                            {step.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Runde {step.round ?? "–"} · {step.phase || "–"} · {step.provider}/{step.model}
                      </div>
                    </button>
                  ))}
                </div>
                {(() => {
                  const selectedStep = runSteps.find((e) => e.id === selectedStepId) || runSteps[0];
                  if (!selectedStep) return null;
                  return (
                    <div className="rounded-lg border border-white/15 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-bold text-slate-100">{selectedStep.nodeName}</div>
                        <Badge variant={statusVariant(selectedStep.status)}>{selectedStep.status}</Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Runde: {selectedStep.round ?? "–"} · Phase: {selectedStep.phase || "–"}
                        {selectedStep.durationMs != null
                          ? ` · ${(selectedStep.durationMs / 1000).toFixed(1)}s`
                          : ""}
                        {selectedStep.correlationId ? ` · ${selectedStep.correlationId.slice(0, 8)}` : ""}
                      </div>
                      <div className="mt-2 rounded-md bg-black/40 border border-white/8 px-3 py-2 text-[11px] font-mono text-slate-200 overflow-x-auto max-h-48 leading-relaxed">
                        {selectedStep.output
                          ? JSON.stringify(selectedStep.output, null, 2)
                          : selectedStep.error || "–"}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </TabsContent>

          {/* ── Messages Tab ── */}
          <TabsContent value="messages" className="mt-3 space-y-1.5 h-[calc(100%-52px)] overflow-auto pr-1">
            {!selectedRun ? (
              <p className="text-sm text-slate-500 italic">{t("agentBuilder.chooseRun")}</p>
            ) : runMessages.length === 0 ? (
              <p className="text-sm text-slate-500 italic">{t("agentBuilder.noMessages")}</p>
            ) : (
              runMessages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg border p-2.5 ${
                    message.messageType === "control"
                      ? "border-amber-500/30 bg-amber-950/20"
                      : message.messageType === "task_result"
                      ? "border-emerald-500/25 bg-emerald-950/15"
                      : "border-blue-500/25 bg-blue-950/15"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100 flex items-center gap-1">
                      <Send className="h-3 w-3 text-slate-500" />
                      {message.fromNodeName} → {message.toNodeName}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                        message.messageType === "control"
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                          : message.messageType === "task_result"
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : "bg-blue-500/15 border-blue-500/40 text-blue-300"
                      }`}
                    >
                      {message.channel}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {message.messageType || "message"}
                    {message.round ? ` · R${message.round}` : ""}
                    {" · "}
                    {new Date(message.createdAt).toLocaleString(localeTag)}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

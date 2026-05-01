"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Send } from "lucide-react";
import { LiveDuration } from "./run-card";
import { RunMessage, RunRecord, RunStep, statusVariant } from "../types";

export function RunDetailModal({
  open,
  onClose,
  run,
  steps,
  messages,
  loading,
  localeTag,
  workflowMode,
}: {
  open: boolean;
  onClose: () => void;
  run: RunRecord | null;
  steps: RunStep[];
  messages: RunMessage[];
  loading: boolean;
  localeTag: string;
  workflowMode?: "custom" | "default";
}) {
  const [tab, setTab] = useState<"overview" | "timeline" | "messages">("timeline");
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set());
  const [expandedMsgIds, setExpandedMsgIds] = useState<Set<string>>(new Set());
  const [expandedInput, setExpandedInput] = useState(false);

  if (!run) return null;

  const toggleStep = (id: string) =>
    setExpandedStepIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleMsg = (id: string) =>
    setExpandedMsgIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const statusColor = (s: string) => {
    if (s === "success") return "text-emerald-400";
    if (s === "failed") return "text-red-400";
    if (s === "running") return "text-blue-400";
    if (s === "pending") return "text-yellow-400";
    return "text-slate-400";
  };

  const activeStep = steps.find((s) => s.status === "running");
  const activeAgentLabel = activeStep
    ? `${activeStep.nodeName} — ${activeStep.phase === "orchestrator_decision" ? "Orchestrator-Entscheidung" : "Sub-Agent"} · Runde ${activeStep.round ?? "?"}`
    : run.status === "running"
    ? "Parent Agent — Orchestrator-Entscheidung"
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[92vw] w-full bg-[#080f1a] text-slate-100 border-white/10 p-0 overflow-hidden flex flex-col max-h-[95vh]">
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-white/10 shrink-0 bg-[#0b1220]">
          <DialogTitle className="flex flex-wrap items-center gap-3 text-slate-100">
            <span className="font-mono text-xs text-slate-500 select-all">{run.id}</span>
            <div className="flex items-center gap-2">
              {workflowMode && (
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    workflowMode === "custom"
                      ? "bg-violet-500/15 border-violet-500/40 text-violet-300"
                      : "bg-blue-500/15 border-blue-500/40 text-blue-300"
                  }`}
                >
                  {workflowMode === "custom" ? "Custom Flow" : "Default Flow"}
                </span>
              )}
              {run.status === "running" && (
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
              )}
              <span className={`text-sm font-bold ${statusColor(run.status)}`}>{run.status}</span>
              {run.status === "running" && <LiveDuration startedAt={run.startedAt} />}
            </div>
          </DialogTitle>
          {activeAgentLabel && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
              <span className="text-xs text-blue-200 font-medium">Aktuell aktiv:</span>
              <span className="text-xs text-blue-100 font-semibold">{activeAgentLabel}</span>
            </div>
          )}
        </DialogHeader>

        {/* ── Tab bar ── */}
        <div className="flex gap-0 px-6 pt-0 shrink-0 border-b border-white/10 bg-[#0b1220]">
          {(["overview", "timeline", "messages"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-blue-400 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-white/20"
              }`}
            >
              {t === "overview"
                ? "Übersicht"
                : t === "timeline"
                ? `Ausführung (${steps.length})`
                : `Messages (${messages.length})`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#080f1a]">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Lade Run-Details…
            </div>
          ) : (
            <>
              {/* ── Overview Tab ── */}
              {tab === "overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      {
                        label: "Status",
                        value: <span className={`font-bold ${statusColor(run.status)}`}>{run.status}</span>,
                      },
                      {
                        label: "Flow",
                        value: workflowMode ? (
                          <span
                            className={
                              workflowMode === "custom"
                                ? "text-violet-300 font-semibold"
                                : "text-blue-300 font-semibold"
                            }
                          >
                            {workflowMode === "custom" ? "Custom Flow" : "Default Flow"}
                          </span>
                        ) : (
                          <span className="text-slate-500">–</span>
                        ),
                      },
                      { label: "Gestartet", value: new Date(run.startedAt).toLocaleString(localeTag) },
                      {
                        label: "Beendet",
                        value: run.finishedAt
                          ? new Date(run.finishedAt).toLocaleString(localeTag)
                          : run.status === "running"
                          ? <LiveDuration startedAt={run.startedAt} />
                          : "–",
                      },
                      {
                        label: "Dauer",
                        value: run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "–",
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">{label}</div>
                        <div className="text-sm text-slate-100">{value}</div>
                      </div>
                    ))}
                  </div>
                  {activeAgentLabel && (
                    <div className="flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-3">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
                      <span className="text-xs text-blue-200 font-medium">Aktuell aktiv:</span>
                      <span className="text-xs text-blue-100 font-semibold">{activeAgentLabel}</span>
                    </div>
                  )}
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <button
                      type="button"
                      className="flex items-center justify-between w-full"
                      onClick={() => setExpandedInput((v) => !v)}
                    >
                      <span className="text-sm font-semibold text-slate-100">Input Payload</span>
                      <span className="text-xs text-slate-400 font-mono">
                        {expandedInput ? "▲ Einklappen" : "▼ Aufklappen"}
                      </span>
                    </button>
                    {expandedInput && (
                      <pre className="mt-3 text-[11px] font-mono text-slate-200 whitespace-pre-wrap break-words bg-black/40 rounded-md p-4 overflow-x-auto border border-white/5">
                        {run.input ? JSON.stringify(run.input, null, 2) : "–"}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* ── Timeline Tab ── */}
              {tab === "timeline" && (
                <div className="space-y-2">
                  {steps.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Noch keine Steps aufgezeichnet.</p>
                  ) : (
                    steps.map((step, index) => (
                      <div
                        key={step.id}
                        className={`rounded-lg border transition-colors ${
                          step.status === "failed"
                            ? "border-red-500/40 bg-red-950/30"
                            : step.status === "running"
                            ? "border-blue-400/50 bg-blue-950/30"
                            : step.status === "success"
                            ? "border-emerald-500/30 bg-emerald-950/20"
                            : "border-white/10 bg-white/3"
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full px-4 py-3 text-left"
                          onClick={() => toggleStep(step.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-100">
                              <span className="text-slate-600 font-mono text-xs w-6 text-right shrink-0">
                                #{index + 1}
                              </span>
                              {step.status === "running" && (
                                <span className="inline-block h-2 w-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
                              )}
                              {step.nodeName}
                              {step.phase === "orchestrator_decision" && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 font-medium">
                                  Orchestrator
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              {step.durationMs != null && (
                                <span className="text-[10px] font-mono text-slate-500">
                                  {(step.durationMs / 1000).toFixed(1)}s
                                </span>
                              )}
                              <span className={`text-xs font-bold ${statusColor(step.status)}`}>
                                {step.status}
                              </span>
                              <span className="text-slate-600 text-xs">
                                {expandedStepIds.has(step.id) ? "▲" : "▼"}
                              </span>
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 pl-8">
                            Runde {step.round ?? "–"} ·{" "}
                            {step.phase === "orchestrator_decision"
                              ? "Orchestrator-Entscheidung"
                              : step.phase === "subagent_execution"
                              ? "Sub-Agent-Ausführung"
                              : step.phase ?? "–"}
                            {" · "}
                            <span className="font-mono">
                              {step.provider}/{step.model}
                            </span>
                            {step.correlationId ? ` · corr: ${step.correlationId.slice(0, 8)}` : ""}
                          </div>
                        </button>
                        {expandedStepIds.has(step.id) && (
                          <div className="border-t border-white/8 px-4 py-4 space-y-3">
                            {step.error && (
                              <div className="rounded-md bg-red-950/60 border border-red-500/40 p-3">
                                <p className="text-xs font-semibold text-red-300 mb-2 uppercase tracking-wider">
                                  Fehler
                                </p>
                                <pre className="text-xs text-red-200 font-mono whitespace-pre-wrap break-words leading-relaxed">
                                  {step.error}
                                </pre>
                              </div>
                            )}
                            {step.input && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">
                                  Input
                                </p>
                                <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-words bg-black/40 rounded-md p-4 overflow-x-auto max-h-72 border border-white/5 leading-relaxed">
                                  {JSON.stringify(step.input, null, 2)}
                                </pre>
                              </div>
                            )}
                            {step.output && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">
                                  Output
                                </p>
                                <pre className="text-[11px] font-mono text-slate-200 whitespace-pre-wrap break-words bg-black/40 rounded-md p-4 overflow-x-auto border border-white/5 leading-relaxed">
                                  {JSON.stringify(step.output, null, 2)}
                                </pre>
                              </div>
                            )}
                            {!step.error && !step.input && !step.output && (
                              <p className="text-xs text-slate-600 italic">Kein Output verfügbar.</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── Messages Tab ── */}
              {tab === "messages" && (
                <div className="space-y-2">
                  {messages.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Noch keine Messages aufgezeichnet.</p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`rounded-lg border ${
                          msg.messageType === "control"
                            ? "border-amber-500/30 bg-amber-950/20"
                            : msg.messageType === "task_result"
                            ? "border-emerald-500/30 bg-emerald-950/20"
                            : "border-blue-500/25 bg-blue-950/20"
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full px-4 py-3 text-left"
                          onClick={() => toggleMsg(msg.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold flex items-center gap-2">
                              <Send className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                              <span className="text-slate-100">{msg.fromNodeName}</span>
                              <span className="text-slate-600">→</span>
                              <span className="text-slate-100">{msg.toNodeName}</span>
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  msg.messageType === "control"
                                    ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                                    : msg.messageType === "task_result"
                                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                    : "bg-blue-500/15 border-blue-500/40 text-blue-300"
                                }`}
                              >
                                {msg.messageType ?? "message"}
                              </span>
                              <span className="text-slate-600 text-xs">
                                {expandedMsgIds.has(msg.id) ? "▲" : "▼"}
                              </span>
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 pl-5.5">
                            <span className="font-mono text-slate-600">{msg.channel}</span>
                            {msg.round ? <span className="ml-2">· Runde {msg.round}</span> : ""}
                            {msg.correlationId ? (
                              <span className="ml-2 font-mono">· corr: {msg.correlationId.slice(0, 8)}</span>
                            ) : (
                              ""
                            )}
                            <span className="ml-2">· {new Date(msg.createdAt).toLocaleString(localeTag)}</span>
                          </div>
                        </button>
                        {expandedMsgIds.has(msg.id) && (
                          <div className="border-t border-white/8 px-4 py-4">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">
                              Payload
                            </p>
                            <pre className="text-[11px] font-mono text-slate-200 whitespace-pre-wrap break-words bg-black/40 rounded-md p-4 overflow-x-auto border border-white/5 leading-relaxed">
                              {msg.payload ? JSON.stringify(msg.payload, null, 2) : "–"}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

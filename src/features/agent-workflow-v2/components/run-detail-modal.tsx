"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, CheckCircle2, XCircle, Circle, Clock } from "lucide-react";
import { LiveDuration } from "./run-card";
import { RunMessage, RunRecord, RunStep } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    success:   { label: "Erfolgreich", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    failed:    { label: "Fehlgeschlagen", className: "bg-red-500/15 text-red-300 border-red-500/30" },
    running:   { label: "Läuft", className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
    pending:   { label: "Wartend", className: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
    cancelled: { label: "Abgebrochen", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
    skipped:   { label: "Übersprungen", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  };
  const s = map[status] ?? { label: status, className: "bg-slate-500/15 text-slate-400 border-slate-500/30" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>
      {s.label}
    </span>
  );
}

function StepIcon({ status }: { status: string }) {
  if (status === "success")
    return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (status === "failed")
    return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
  if (status === "running")
    return <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />;
  if (status === "pending")
    return <Clock className="h-4 w-4 text-yellow-400/70 shrink-0" />;
  return <Circle className="h-4 w-4 text-slate-600 shrink-0" />;
}

function MsgTypePill({ type }: { type?: string }) {
  const map: Record<string, string> = {
    task_request: "bg-blue-500/15 border-blue-500/30 text-blue-300",
    task_result:  "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    control:      "bg-amber-500/15 border-amber-500/30 text-amber-300",
  };
  const cls = map[type ?? ""] ?? "bg-slate-500/15 border-slate-500/30 text-slate-400";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {type ?? "message"}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  const [tab, setTab] = useState<"timeline" | "messages" | "overview">("timeline");
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set());
  const [expandedMsgIds, setExpandedMsgIds] = useState<Set<string>>(new Set());

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

  const activeStep = steps.find((s) => s.status === "running");

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl bg-[#0b1220] text-slate-100 border-l border-white/10 p-0 flex flex-col overflow-hidden"
      >
        {/* ── Header ── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/10 shrink-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {run && <StatusBadge status={run.status} />}
                {workflowMode && (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    workflowMode === "custom"
                      ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                      : "bg-blue-500/15 border-blue-500/30 text-blue-300"
                  }`}>
                    {workflowMode === "custom" ? "Custom Flow" : "Default Flow"}
                  </span>
                )}
                {run?.status === "running" && <LiveDuration startedAt={run.startedAt} />}
              </div>
              <SheetTitle className="sr-only">Run Details</SheetTitle>
              <SheetDescription className="font-mono text-[11px] text-slate-500 select-all truncate">
                {run?.id ?? "–"}
              </SheetDescription>
              {run && (
                <p className="text-xs text-slate-500">
                  Gestartet: {new Date(run.startedAt).toLocaleString(localeTag)}
                  {run.durationMs ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ""}
                </p>
              )}
            </div>
          </div>

          {/* Active agent banner */}
          {run?.status === "running" && (
            <div className="flex items-center gap-2.5 rounded-lg border border-blue-500/25 bg-blue-500/8 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
              <span className="text-xs text-slate-400">Aktiv:</span>
              <span className="text-xs text-blue-200 font-medium truncate">
                {activeStep
                  ? `${activeStep.nodeName} · ${activeStep.phase === "orchestrator_decision" ? "Orchestrator" : "Sub-Agent"} · R${activeStep.round ?? "?"}`
                  : "Parent Agent · Orchestrator"}
              </span>
            </div>
          )}
        </SheetHeader>

        {/* ── Tab bar ── */}
        <div className="flex border-b border-white/10 shrink-0 bg-[#0b1220]">
          {(["timeline", "messages", "overview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-blue-400 text-white"
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:border-white/20"
              }`}
            >
              {t === "timeline"
                ? `Schritte${steps.length > 0 ? ` (${steps.length})` : ""}`
                : t === "messages"
                ? `Nachrichten${messages.length > 0 ? ` (${messages.length})` : ""}`
                : "Übersicht"}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          {!run || loading ? (
            <div className="flex items-center justify-center h-40 gap-3 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Lade Details…</span>
            </div>
          ) : (
            <>
              {/* ── Timeline ── */}
              {tab === "timeline" && (
                <div className="py-4">
                  {steps.length === 0 ? (
                    <div className="px-6 py-8 text-center text-sm text-slate-500 italic">
                      Noch keine Schritte aufgezeichnet.
                    </div>
                  ) : (
                    <ol className="relative">
                      {steps.map((step, index) => {
                        const isExpanded = expandedStepIds.has(step.id);
                        const isLast = index === steps.length - 1;
                        return (
                          <li key={step.id} className="relative flex gap-0">
                            {/* Timeline line */}
                            <div className="flex flex-col items-center ml-6 mr-4">
                              <div className="mt-3.5 z-10">
                                <StepIcon status={step.status} />
                              </div>
                              {!isLast && <div className="w-px flex-1 bg-white/10 mt-1 mb-0" />}
                            </div>

                            {/* Step content */}
                            <div className={`flex-1 pb-4 pr-6 ${isLast ? "" : ""}`}>
                              <button
                                type="button"
                                className="w-full text-left group"
                                onClick={() => toggleStep(step.id)}
                              >
                                <div className="flex items-start justify-between gap-2 pt-2.5">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-semibold text-slate-100">
                                        {step.nodeName}
                                      </span>
                                      {step.phase === "orchestrator_decision" && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/25 font-medium">
                                          Orchestrator
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      {step.phase === "orchestrator_decision"
                                        ? "Orchestrator-Entscheidung"
                                        : step.phase === "subagent_execution"
                                        ? "Sub-Agent"
                                        : step.phase ?? "–"}
                                      {step.round != null ? ` · Runde ${step.round}` : ""}
                                      {" · "}
                                      <span className="font-mono">{step.provider}/{step.model}</span>
                                      {step.durationMs != null
                                        ? ` · ${(step.durationMs / 1000).toFixed(1)}s`
                                        : ""}
                                    </p>
                                  </div>
                                  <span className="text-[10px] text-slate-600 mt-3 shrink-0 group-hover:text-slate-400 transition-colors">
                                    {isExpanded ? "▲" : "▼"}
                                  </span>
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="mt-3 space-y-3 rounded-xl border border-white/8 bg-slate-900/60 p-4">
                                  {step.error && (
                                    <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3">
                                      <p className="text-[10px] uppercase tracking-wider text-red-400 font-semibold mb-1.5">Fehler</p>
                                      <pre className="text-xs text-red-200 font-mono whitespace-pre-wrap break-words leading-relaxed">{step.error}</pre>
                                    </div>
                                  )}
                                  {step.input && (
                                    <div>
                                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Input</p>
                                      <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-words bg-black/30 rounded-lg p-3 overflow-x-auto max-h-60 border border-white/5 leading-relaxed">
                                        {JSON.stringify(step.input, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {step.output && (
                                    <div>
                                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Output</p>
                                      {typeof (step.output as any).finalHtml === 'string' && (step.output as any).finalHtml ? (
                                        <div className="space-y-2">
                                          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-3">
                                            <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-2">
                                              finalHtml — HTML-Vorschau
                                            </p>
                                            <div
                                              className="prose prose-invert prose-sm max-w-none text-slate-200 bg-black/20 rounded-lg p-3 border border-white/5 max-h-80 overflow-y-auto"
                                              dangerouslySetInnerHTML={{ __html: (step.output as any).finalHtml }}
                                            />
                                          </div>
                                          <details className="group">
                                            <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300 transition-colors select-none">
                                              Rohdaten anzeigen ▼
                                            </summary>
                                            <pre className="mt-1.5 text-[11px] font-mono text-slate-200 whitespace-pre-wrap break-words bg-black/30 rounded-lg p-3 overflow-x-auto border border-white/5 leading-relaxed">
                                              {JSON.stringify(step.output, null, 2)}
                                            </pre>
                                          </details>
                                        </div>
                                      ) : (
                                        <pre className="text-[11px] font-mono text-slate-200 whitespace-pre-wrap break-words bg-black/30 rounded-lg p-3 overflow-x-auto border border-white/5 leading-relaxed">
                                          {JSON.stringify(step.output, null, 2)}
                                        </pre>
                                      )}
                                    </div>
                                  )}
                                  {!step.error && !step.input && !step.output && (
                                    <p className="text-xs text-slate-600 italic">Kein Output verfügbar.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              )}

              {/* ── Messages ── */}
              {tab === "messages" && (
                <div className="px-6 py-4 space-y-2">
                  {messages.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500 italic">
                      Noch keine Nachrichten aufgezeichnet.
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isExpanded = expandedMsgIds.has(msg.id);
                      return (
                        <div
                          key={msg.id}
                          className="rounded-xl border border-white/8 bg-slate-900/40 overflow-hidden"
                        >
                          <button
                            type="button"
                            className="w-full px-4 py-3 text-left group"
                            onClick={() => toggleMsg(msg.id)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <Send className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                <span className="text-sm font-medium text-slate-200 truncate">
                                  <span className="text-slate-100">{msg.fromNodeName}</span>
                                  <span className="text-slate-600 mx-1.5">→</span>
                                  <span className="text-slate-100">{msg.toNodeName}</span>
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <MsgTypePill type={msg.messageType} />
                                <span className="text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors">
                                  {isExpanded ? "▲" : "▼"}
                                </span>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-1 pl-5.5">
                              <span className="font-mono">{msg.channel}</span>
                              {msg.round ? ` · R${msg.round}` : ""}
                              {msg.correlationId ? ` · corr:${msg.correlationId.slice(0, 8)}` : ""}
                              {" · "}{new Date(msg.createdAt).toLocaleString(localeTag)}
                            </p>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-white/8 px-4 py-3 bg-black/20">
                              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Payload</p>
                              <pre className="text-[11px] font-mono text-slate-200 whitespace-pre-wrap break-words bg-black/30 rounded-lg p-3 overflow-x-auto border border-white/5 leading-relaxed">
                                {msg.payload ? JSON.stringify(msg.payload, null, 2) : "–"}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ── Overview ── */}
              {tab === "overview" && (
                <div className="px-6 py-4 space-y-4">
                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Status", value: <StatusBadge status={run.status} /> },
                      {
                        label: "Flow",
                        value: workflowMode ? (
                          <span className={`text-sm font-semibold ${workflowMode === "custom" ? "text-violet-300" : "text-blue-300"}`}>
                            {workflowMode === "custom" ? "Custom Flow" : "Default Flow"}
                          </span>
                        ) : <span className="text-slate-500 text-sm">–</span>,
                      },
                      { label: "Gestartet", value: <span className="text-sm text-slate-200">{new Date(run.startedAt).toLocaleString(localeTag)}</span> },
                      {
                        label: "Beendet",
                        value: run.finishedAt
                          ? <span className="text-sm text-slate-200">{new Date(run.finishedAt).toLocaleString(localeTag)}</span>
                          : run.status === "running"
                          ? <LiveDuration startedAt={run.startedAt} />
                          : <span className="text-slate-500 text-sm">–</span>,
                      },
                      {
                        label: "Dauer",
                        value: <span className="text-sm text-slate-200">{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "–"}</span>,
                      },
                      {
                        label: "Schritte",
                        value: <span className="text-sm text-slate-200">{steps.length}</span>,
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl border border-white/8 bg-slate-900/40 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-medium">{label}</div>
                        <div>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Run ID */}
                  <div className="rounded-xl border border-white/8 bg-slate-900/40 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-medium">Run ID</p>
                    <p className="font-mono text-xs text-slate-300 select-all break-all">{run.id}</p>
                  </div>

                  {/* Input Payload */}
                  {run.input && (
                    <div className="rounded-xl border border-white/8 bg-slate-900/40 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-medium">Input Payload</p>
                      <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-words bg-black/30 rounded-lg p-3 overflow-x-auto border border-white/5 leading-relaxed">
                        {JSON.stringify(run.input, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

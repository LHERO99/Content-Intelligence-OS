"use client";

import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, RefreshCcw, CircleDot } from "lucide-react";
import { Node } from "@xyflow/react";
import { ConfigSection, DataMappingBuilder } from "./node-palette";
import {
  AgentNodeData,
  AgentProvider,
  AgentStepType,
  DiscoveredModel,
  NODE_STYLE_BY_TYPE,
  STEP_TYPES,
  WorkflowNodeRecord,
} from "../types";

export function NodeEditorSheet({
  open,
  onOpenChange,
  selectedNodeRecord,
  selectedProvider,
  selectedProviderModels,
  selectedProviderModelsLoading,
  selectedProviderModelError,
  selectedProviderSupportsDiscovery,
  selectedProviderHasModels,
  selectedModelInProviderList,
  modelsByProvider,
  onUpdateSelectedNode,
  onRemoveNode,
  onLoadProviderModels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedNodeRecord: WorkflowNodeRecord | null;
  selectedProvider: AgentProvider;
  selectedProviderModels: DiscoveredModel[];
  selectedProviderModelsLoading: boolean;
  selectedProviderModelError: string | null;
  selectedProviderSupportsDiscovery: boolean;
  selectedProviderHasModels: boolean;
  selectedModelInProviderList: boolean;
  modelsByProvider: Record<string, DiscoveredModel[]>;
  onUpdateSelectedNode: (patcher: (node: Node<AgentNodeData>) => Node<AgentNodeData>) => void;
  onRemoveNode: (nodeId: string) => void;
  onLoadProviderModels: (provider: AgentProvider, refresh?: boolean) => void;
}) {
  const outputSchemaPills = [
    "research.summary",
    "analysis.keyFindings",
    "briefing.outline",
    "draft.content",
    "review.todo",
  ];

  const inputMappingState = [
    { key: "context", value: "" },
    { key: "constraints", value: "" },
    { key: "previousOutput", value: "" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[480px] bg-[#0b1220] text-slate-100 border-white/10">
        <SheetHeader>
          <SheetTitle>Node Konfiguration</SheetTitle>
          <SheetDescription className="text-slate-400">Inputs, Provider, Prompt, Mapping</SheetDescription>
        </SheetHeader>

        {!selectedNodeRecord ? (
          <div className="px-4 pb-4 text-sm text-slate-400">Kein Node selektiert.</div>
        ) : (
          <div className="px-4 pb-24 space-y-3 overflow-y-auto">
            {/* ── Section 1: Rolle & Identität ── */}
            <ConfigSection
              title="1) Rolle & Identität"
              description="Name und Agent-Typ festlegen. Das ist die Grundlage für den Workflow."
              defaultOpen
            >
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={selectedNodeRecord.name}
                    onChange={(event) =>
                      onUpdateSelectedNode((node) => ({
                        ...node,
                        data: { ...node.data, label: event.target.value },
                      }))
                    }
                    className="bg-[#0f172a] border-white/10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Typ</Label>
                    {selectedNodeRecord.isParent ? (
                      <Input value="orchestrator" disabled className="bg-[#0f172a] border-white/10 text-slate-300" />
                    ) : (
                      <Select
                        value={selectedNodeRecord.type}
                        onValueChange={(value) =>
                          onUpdateSelectedNode((node) => ({
                            ...node,
                            data: {
                              ...node.data,
                              type: value as AgentStepType,
                              icon: NODE_STYLE_BY_TYPE[value as AgentStepType].icon,
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="w-full bg-[#0f172a] border-white/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STEP_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={Boolean((selectedNodeRecord.config as any).enabled ?? true) ? "enabled" : "disabled"}
                      onValueChange={(value) =>
                        onUpdateSelectedNode((node) => ({
                          ...node,
                          data: {
                            ...node.data,
                            enabled: value === "enabled",
                          } as any,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full bg-[#0f172a] border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enabled">Aktiv</SelectItem>
                        <SelectItem value="disabled">Deaktiviert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedNodeRecord.isParent && (
                  <Alert>
                    <AlertTitle>Parent Agent</AlertTitle>
                    <AlertDescription>
                      Dieser Node orchestriert den Ablauf und delegiert Aufgaben an Subagents.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </ConfigSection>

            {/* ── Section 2: Aufgabe ── */}
            <ConfigSection
              title="2) Aufgabe"
              description="Beschreibe Zweck und Arbeitsanweisung so, dass der Agent selbstständig handeln kann."
              defaultOpen
            >
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>
                    {selectedNodeRecord.isParent ? "Orchestrator Purpose" : "Subagent Purpose"}
                  </Label>
                  <textarea
                    value={(selectedNodeRecord.config as any).purpose || ""}
                    onChange={(event) =>
                      onUpdateSelectedNode((node) => ({
                        ...node,
                        data: { ...node.data, purpose: event.target.value } as any,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-sm min-h-20"
                    placeholder={
                      selectedNodeRecord.isParent
                        ? "Z. B. Priorisiere Aufgaben, entscheide den nächsten Subagenten, finalisiere wenn Ziel erreicht ist."
                        : "Z. B. Recherchiert SERP-Fakten, extrahiert Quellen und liefert belastbare Kernaussagen."
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Prompt / Instruction</Label>
                  <textarea
                    value={selectedNodeRecord.config.instruction}
                    onChange={(event) =>
                      onUpdateSelectedNode((node) => ({
                        ...node,
                        data: { ...node.data, instruction: event.target.value } as any,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-sm min-h-28"
                    placeholder="Detaillierte Arbeitsanweisung für diesen Agenten..."
                  />
                </div>
              </div>
            </ConfigSection>

            {/* ── Section 3: LLM Setup ── */}
            <ConfigSection
              title="3) LLM Setup"
              description="Provider, Modell und Laufzeitparameter für diesen Node konfigurieren."
            >
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={selectedNodeRecord.config.provider}
                    onValueChange={(value) => {
                      const nextProvider = value as AgentProvider;
                      const knownModels = modelsByProvider[nextProvider] || [];
                      onUpdateSelectedNode((node) => ({
                        ...node,
                        data: {
                          ...node.data,
                          provider: nextProvider,
                          model: knownModels[0]?.id || (node.data as any).model || "",
                        },
                      }));
                      onLoadProviderModels(nextProvider, false);
                    }}
                  >
                    <SelectTrigger className="w-full bg-[#0f172a] border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="openrouter">OpenRouter</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                      <SelectItem value="copilot">Copilot (GitHub Models)</SelectItem>
                      <SelectItem value="perplexity">Perplexity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  {selectedProviderSupportsDiscovery ? (
                    <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400">
                          {selectedProviderHasModels
                            ? `${selectedProviderModels.length} verfügbare Modelle`
                            : selectedProviderModelsLoading
                            ? "Lade Modelle..."
                            : "Noch keine Modelle geladen"}
                        </span>
                        <div className="flex items-center gap-2">
                          {!selectedProviderHasModels && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 border-white/20 bg-transparent text-slate-200 hover:bg-white/10"
                              onClick={() => onLoadProviderModels(selectedProvider, false)}
                              disabled={selectedProviderModelsLoading}
                            >
                              {selectedProviderModelsLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Laden"
                              )}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-300 hover:bg-white/10"
                            onClick={() => onLoadProviderModels(selectedProvider, true)}
                            disabled={selectedProviderModelsLoading}
                            title="Modelle aktualisieren"
                            aria-label="Modelle aktualisieren"
                          >
                            {selectedProviderModelsLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCcw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {selectedProviderHasModels ? (
                        <Select
                          value={selectedModelInProviderList ? selectedNodeRecord.config.model : undefined}
                          onValueChange={(value) =>
                            onUpdateSelectedNode((node) => ({
                              ...node,
                              data: { ...node.data, model: value } as any,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full bg-[#0f172a] border-white/10 text-slate-100">
                            <SelectValue placeholder="Modell wählen" />
                          </SelectTrigger>
                          <SelectContent
                            side="bottom"
                            align="start"
                            sideOffset={6}
                            className="border border-white/10 bg-[#0b1220] text-slate-100 shadow-2xl"
                          >
                            {selectedProviderModels.map((model) => (
                              <SelectItem
                                key={model.id}
                                value={model.id}
                                className="text-slate-100 focus:bg-white/10 focus:text-slate-100"
                              >
                                {model.label !== model.id ? `${model.label} (${model.id})` : model.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={selectedNodeRecord.config.model}
                          onChange={(event) =>
                            onUpdateSelectedNode((node) => ({
                              ...node,
                              data: { ...node.data, model: event.target.value } as any,
                            }))
                          }
                          className="bg-[#0f172a] border-white/10"
                          placeholder="Model-ID manuell eingeben"
                        />
                      )}

                      {selectedProviderModelError && (
                        <div className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100">
                          <div>{selectedProviderModelError}</div>
                          <Link href="/admin" className="mt-1 inline-block underline underline-offset-2">
                            Im Admin-Panel Provider anbinden und Modelle laden
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Input
                      value={selectedNodeRecord.config.model}
                      onChange={(event) =>
                        onUpdateSelectedNode((node) => ({
                          ...node,
                          data: { ...node.data, model: event.target.value } as any,
                        }))
                      }
                      className="bg-[#0f172a] border-white/10"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Timeout (ms)</Label>
                    <Input
                      type="number"
                      value={selectedNodeRecord.config.timeoutMs}
                      onChange={(event) =>
                        onUpdateSelectedNode((node) => ({
                          ...node,
                          data: { ...node.data, timeoutMs: Number(event.target.value || 0) } as any,
                        }))
                      }
                      className="bg-[#0f172a] border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Retries</Label>
                    <Input
                      type="number"
                      value={selectedNodeRecord.config.retries}
                      onChange={(event) =>
                        onUpdateSelectedNode((node) => ({
                          ...node,
                          data: { ...node.data, retries: Number(event.target.value || 0) } as any,
                        }))
                      }
                      className="bg-[#0f172a] border-white/10"
                    />
                  </div>
                </div>
              </div>
            </ConfigSection>

            {/* ── Section 4: I/O Vertrag ── */}
            <ConfigSection
              title="4) I/O Vertrag"
              description="Definiert die erwarteten Eingaben und die Form der Ausgabe für sauberes Agent-to-Agent Routing."
            >
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <Label>Input Contract</Label>
                  <textarea
                    value={(selectedNodeRecord.config as any).inputContract || ""}
                    onChange={(event) =>
                      onUpdateSelectedNode((node) => ({
                        ...node,
                        data: { ...node.data, inputContract: event.target.value } as any,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-sm min-h-20"
                    placeholder="Welche Inputs erwartet der Agent?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Output Contract</Label>
                  <textarea
                    value={(selectedNodeRecord.config as any).outputContract || ""}
                    onChange={(event) =>
                      onUpdateSelectedNode((node) => ({
                        ...node,
                        data: { ...node.data, outputContract: event.target.value } as any,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-sm min-h-20"
                    placeholder="Wie soll der Agent strukturierte Ergebnisse zurückgeben?"
                  />
                </div>
              </div>
            </ConfigSection>

            {/* ── Section 5: Erweitert ── */}
            <ConfigSection
              title="5) Erweitert"
              description="Optional: Mapping-Hinweise und node-spezifische Spezialfunktionen."
            >
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <CircleDot className="h-4 w-4" />
                    Data Mapping (Simulation)
                  </div>
                  <DataMappingBuilder
                    outputSchema={outputSchemaPills}
                    inputMappings={inputMappingState}
                    onAssign={(inputKey, value) => {
                      onUpdateSelectedNode((node) => ({
                        ...node,
                        data: {
                          ...node.data,
                          instruction: `${(node.data as any).instruction || ""}\nMapping: ${inputKey} <- ${value}`,
                        } as any,
                      }));
                    }}
                  />
                </div>

              </div>
            </ConfigSection>

            {/* ── Footer Actions ── */}
            <div className="fixed bottom-0 right-0 z-20 w-full sm:max-w-[480px] border-t border-white/10 bg-[#0b1220]/95 p-3 backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  className="border-red-500/40 text-red-200 hover:bg-red-500/10"
                  onClick={() => onRemoveNode(selectedNodeRecord.id)}
                >
                  Node entfernen
                </Button>
                <Button onClick={() => onOpenChange(false)}>Fertig</Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

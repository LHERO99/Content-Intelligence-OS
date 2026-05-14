"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Bot, Loader2, Play, Save, Sparkles, Workflow } from "lucide-react";

type AgentStepType = "research" | "analysis" | "briefing" | "draft" | "review";
type AgentProvider = "openrouter" | "gemini";

type WorkflowNode = {
  id: string;
  name: string;
  type: AgentStepType;
  position: number;
  config: {
    instruction: string;
    provider: AgentProvider;
    model: string;
    timeoutMs: number;
    retries: number;
    enabled: boolean;
  };
};

type WorkflowEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
};

type WorkflowVersion = {
  id: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isPublished: boolean;
};

type WorkflowRecord = {
  id: string;
  name: string;
  description?: string;
  mode: "default" | "custom";
  state: "draft" | "published" | "archived";
  activeVersionId?: string;
  draftVersion?: WorkflowVersion;
  activeVersion?: WorkflowVersion;
};

type RunStep = {
  id: string;
  nodeName: string;
  nodeType: AgentStepType;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  provider: AgentProvider;
  model: string;
  durationMs?: number;
  error?: string;
};

type RunRecord = {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  createdAt: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
};

const STEP_TYPES: AgentStepType[] = ["research", "analysis", "briefing", "draft", "review"];

function formatStatusLabel(status: string): string {
  switch (status) {
    case "success":
      return "Erfolgreich";
    case "failed":
      return "Fehlgeschlagen";
    case "running":
      return "Läuft";
    case "pending":
      return "Wartend";
    case "skipped":
      return "Übersprungen";
    default:
      return status;
  }
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "success") return "default";
  if (status === "failed") return "destructive";
  if (status === "running") return "outline";
  return "secondary";
}

export function AgentWorkflowManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRunSteps, setSelectedRunSteps] = useState<RunStep[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newWorkflowName, setNewWorkflowName] = useState("");

  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [draftNodes, setDraftNodes] = useState<WorkflowNode[]>([]);
  const [draftEdges, setDraftEdges] = useState<WorkflowEdge[]>([]);

  const activeWorkflow = useMemo(() => workflows.find((workflow) => workflow.id === activeWorkflowId) || null, [workflows, activeWorkflowId]);

  const loadWorkflows = async () => {
    const res = await fetch("/api/agent-workflows");
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Workflows konnten nicht geladen werden");
    }
    const list = (data?.workflows || []) as WorkflowRecord[];
    setWorkflows(list);

    const selectedId = activeWorkflowId && list.some((entry) => entry.id === activeWorkflowId)
      ? activeWorkflowId
      : list[0]?.id || null;
    setActiveWorkflowId(selectedId);

    if (selectedId) {
      const selected = list.find((entry) => entry.id === selectedId);
      const editableVersion = selected?.draftVersion || selected?.activeVersion;
      setDraftNodes(editableVersion?.nodes?.slice().sort((a, b) => a.position - b.position) || []);
      setDraftEdges(editableVersion?.edges || []);
    }
  };

  const loadRuns = async () => {
    const res = await fetch("/api/agent-workflows/runs?limit=50");
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Ausführungen konnten nicht geladen werden");
    }
    setRuns(data?.runs || []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        await Promise.all([loadWorkflows(), loadRuns()]);
      } catch (err: any) {
        setError(err.message || "Daten konnten nicht geladen werden");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!activeWorkflow) return;
    const editableVersion = activeWorkflow.draftVersion || activeWorkflow.activeVersion;
    setDraftNodes(editableVersion?.nodes?.slice().sort((a, b) => a.position - b.position) || []);
    setDraftEdges(editableVersion?.edges || []);
  }, [activeWorkflow]);

  const createCustomWorkflow = async () => {
    if (!newWorkflowName.trim()) {
      setError("Bitte einen Workflow-Namen eingeben.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await fetch("/api/agent-workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWorkflowName.trim(),
          mode: "custom",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Workflow konnte nicht erstellt werden");

      setSuccess("Custom Workflow erstellt.");
      setNewWorkflowName("");
      await loadWorkflows();
      setActiveWorkflowId(data?.workflow?.id || null);
    } catch (err: any) {
      setError(err.message || "Workflow konnte nicht erstellt werden");
    } finally {
      setSaving(false);
    }
  };

  const updateNode = (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => {
    setDraftNodes((prev) => prev.map((node) => (node.id === nodeId ? updater(node) : node)));
  };

  const addNode = () => {
    const nextPosition = draftNodes.length;
    const id = crypto.randomUUID();
    setDraftNodes((prev) => [
      ...prev,
      {
        id,
        name: `Step ${nextPosition + 1}`,
        type: "research",
        position: nextPosition,
        config: {
          instruction: "Beschreibe den Zweck dieses Schritts.",
          provider: "openrouter",
          model: "openai/gpt-4o-mini",
          timeoutMs: 45000,
          retries: 1,
          enabled: true,
        },
      },
    ]);
  };

  const removeNode = (nodeId: string) => {
    setDraftNodes((prev) => prev.filter((node) => node.id !== nodeId));
    setDraftEdges((prev) => prev.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId));
  };

  const saveWorkflowConfig = async () => {
    if (!activeWorkflow) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const normalizedNodes = draftNodes.map((node, index) => ({
        ...node,
        position: index,
      }));

      const res = await fetch(`/api/agent-workflows/${activeWorkflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: normalizedNodes,
          edges: draftEdges,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Workflow konnte nicht gespeichert werden");

      setSuccess("Workflow-Konfiguration gespeichert.");
      await loadWorkflows();
    } catch (err: any) {
      setError(err.message || "Workflow konnte nicht gespeichert werden");
    } finally {
      setSaving(false);
    }
  };

  const publishWorkflow = async () => {
    if (!activeWorkflow) return;
    try {
      setPublishing(true);
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/agent-workflows/${activeWorkflow.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Workflow konnte nicht publiziert werden");

      setSuccess("Workflow publiziert.");
      await loadWorkflows();
    } catch (err: any) {
      setError(err.message || "Workflow konnte nicht publiziert werden");
    } finally {
      setPublishing(false);
    }
  };

  const runWorkflow = async () => {
    if (!activeWorkflow) return;
    try {
      setRunning(true);
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/agent-workflows/${activeWorkflow.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          input: {
            workflowName: activeWorkflow.name,
            source: "manual-agent-workflow-tab",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Workflow-Ausführung fehlgeschlagen");

      setSuccess("Workflow wurde erfolgreich ausgeführt.");
      await loadRuns();
      if (data?.run?.id) {
        setSelectedRunId(data.run.id);
        setSelectedRunSteps(data?.steps || []);
      }
    } catch (err: any) {
      setError(err.message || "Workflow-Ausführung fehlgeschlagen");
    } finally {
      setRunning(false);
    }
  };

  const loadRunDetail = async (runId: string) => {
    try {
      setSelectedRunId(runId);
      const res = await fetch(`/api/agent-workflows/runs/${runId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Run-Details konnten nicht geladen werden");
      setSelectedRunSteps(data?.run?.steps || []);
    } catch (err: any) {
      setError(err.message || "Run-Details konnten nicht geladen werden");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertTitle>Erfolg</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Workflow Setup
          </CardTitle>
          <CardDescription>
            Nutze den Default-Workflow sofort oder erstelle eigene Multi-Agent Workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2 min-w-[280px]">
              <Label>Aktiver Workflow</Label>
              <Select value={activeWorkflowId || ""} onValueChange={(value) => setActiveWorkflowId(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Workflow wählen" />
                </SelectTrigger>
                <SelectContent>
                  {workflows.map((workflow) => (
                    <SelectItem key={workflow.id} value={workflow.id}>
                      {workflow.name} ({workflow.mode === "default" ? "Default" : "Custom"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-[280px]">
              <Label>Neuer Custom Workflow</Label>
              <Input
                placeholder="z. B. Kategorie Optimierung V2"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={createCustomWorkflow} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Custom Workflow erstellen"}
            </Button>
          </div>

          {activeWorkflow && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Modus: {activeWorkflow.mode === "default" ? "Default" : "Custom"}</Badge>
              <Badge variant={activeWorkflow.state === "published" ? "default" : "outline"}>
                Status: {activeWorkflow.state}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {activeWorkflow && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5" />
              Custom Multi-Agent Setup
            </CardTitle>
            <CardDescription>
              Konfiguriere die Agenten-Schritte, Modelle und Reihenfolge. Verbindungen werden als Basis-DAG gespeichert.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {draftNodes.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Keine Steps vorhanden.</p>
                <Button variant="outline" size="sm" onClick={addNode}>Ersten Step hinzufügen</Button>
              </div>
            ) : (
              draftNodes
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((node, index) => (
                  <div key={node.id} className="rounded-md border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        Step {index + 1}: {node.name}
                      </div>
                      <Badge variant="outline">{node.type}</Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={node.name}
                          onChange={(e) => updateNode(node.id, (prev) => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Step-Typ</Label>
                        <Select
                          value={node.type}
                          onValueChange={(value) => updateNode(node.id, (prev) => ({ ...prev, type: value as AgentStepType }))}
                        >
                          <SelectTrigger>
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
                      </div>
                      <div className="space-y-2">
                        <Label>Provider</Label>
                        <Select
                          value={node.config.provider}
                          onValueChange={(value) =>
                            updateNode(node.id, (prev) => ({
                              ...prev,
                              config: { ...prev.config, provider: value as AgentProvider },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openrouter">OpenRouter</SelectItem>
                            <SelectItem value="gemini">Gemini</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Model</Label>
                        <Input
                          value={node.config.model}
                          onChange={(e) =>
                            updateNode(node.id, (prev) => ({
                              ...prev,
                              config: { ...prev.config, model: e.target.value },
                            }))
                          }
                          placeholder={node.config.provider === "gemini" ? "gemini-1.5-flash" : "openai/gpt-4o-mini"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Timeout (ms)</Label>
                        <Input
                          type="number"
                          value={node.config.timeoutMs}
                          onChange={(e) =>
                            updateNode(node.id, (prev) => ({
                              ...prev,
                              config: { ...prev.config, timeoutMs: Number(e.target.value || 0) },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Retries</Label>
                        <Input
                          type="number"
                          value={node.config.retries}
                          onChange={(e) =>
                            updateNode(node.id, (prev) => ({
                              ...prev,
                              config: { ...prev.config, retries: Number(e.target.value || 0) },
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Instruction</Label>
                      <textarea
                        value={node.config.instruction}
                        onChange={(e) =>
                          updateNode(node.id, (prev) => ({
                            ...prev,
                            config: { ...prev.config, instruction: e.target.value },
                          }))
                        }
                        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm min-h-24"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant={node.config.enabled ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          updateNode(node.id, (prev) => ({
                            ...prev,
                            config: { ...prev.config, enabled: !prev.config.enabled },
                          }))
                        }
                      >
                        {node.config.enabled ? "Aktiv" : "Inaktiv"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => removeNode(node.id)}>
                        Entfernen
                      </Button>
                    </div>
                  </div>
                ))
            )}

            <Separator />

            <Button variant="outline" size="sm" onClick={addNode}>
              Step hinzufügen
            </Button>

            <div className="space-y-2">
              <Label>Verbindungen (Basis-DAG)</Label>
              <div className="space-y-2">
                {draftEdges.length === 0 && <p className="text-sm text-muted-foreground">Keine Verbindungen definiert.</p>}
                {draftEdges.map((edge) => (
                  <div key={edge.id} className="grid gap-2 md:grid-cols-2">
                    <Select
                      value={edge.sourceNodeId}
                      onValueChange={(value) => {
                        if (!value) return;
                        setDraftEdges((prev) =>
                          prev.map((entry) => (entry.id === edge.id ? { ...entry, sourceNodeId: value } : entry))
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Von" />
                      </SelectTrigger>
                      <SelectContent>
                        {draftNodes.map((node) => (
                          <SelectItem key={node.id} value={node.id}>
                            {node.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={edge.targetNodeId}
                      onValueChange={(value) => {
                        if (!value) return;
                        setDraftEdges((prev) =>
                          prev.map((entry) => (entry.id === edge.id ? { ...entry, targetNodeId: value } : entry))
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nach" />
                      </SelectTrigger>
                      <SelectContent>
                        {draftNodes.map((node) => (
                          <SelectItem key={node.id} value={node.id}>
                            {node.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (draftNodes.length < 2) return;
                  setDraftEdges((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      sourceNodeId: draftNodes[0].id,
                      targetNodeId: draftNodes[draftNodes.length - 1].id,
                    },
                  ]);
                }}
              >
                Verbindung hinzufügen
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveWorkflowConfig} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Speichern
              </Button>
              <Button variant="outline" onClick={publishWorkflow} disabled={publishing}>
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publizieren"}
              </Button>
              <Button variant="secondary" onClick={runWorkflow} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Jetzt ausführen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ausführungen</CardTitle>
          <CardDescription>Status, Dauer und Logs der letzten Workflow-Runs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Ausführungen vorhanden.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => loadRunDetail(run.id)}
                  className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/40 ${
                    selectedRunId === run.id ? "border-primary" : "border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">Run {run.id.slice(0, 8)}</div>
                    <Badge variant={statusVariant(run.status)}>{formatStatusLabel(run.status)}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Start: {new Date(run.startedAt).toLocaleString("de-DE")} | Dauer: {run.durationMs ? `${run.durationMs} ms` : "-"}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedRunId && (
            <div className="rounded-md border p-4 space-y-3">
              <h4 className="text-sm font-semibold">Step-Log für Run {selectedRunId.slice(0, 8)}</h4>
              {selectedRunSteps.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine Step-Details vorhanden.</p>
              ) : (
                <div className="space-y-2">
                  {selectedRunSteps.map((step) => (
                    <div key={step.id} className="rounded border p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">{step.nodeName}</div>
                        <Badge variant={statusVariant(step.status)}>{formatStatusLabel(step.status)}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {step.nodeType} | {step.provider} / {step.model} | Dauer: {step.durationMs ? `${step.durationMs} ms` : "-"}
                      </div>
                      {step.error && <div className="text-xs text-red-600 mt-1">Fehler: {step.error}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

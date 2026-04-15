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
import { Bot, Loader2, Play, Save, Sparkles, Workflow, Plus, MessageSquare, Plug2, Send } from "lucide-react";

type AgentStepType = "research" | "analysis" | "briefing" | "draft" | "review";
type AgentProvider = "openrouter" | "gemini";

type WorkflowNode = {
  id: string;
  name: string;
  type: AgentStepType;
  position: number;
  x: number;
  y: number;
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
  channel: string;
  targetInputKey: string;
};

type WorkflowVersion = {
  id: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

type WorkflowRecord = {
  id: string;
  name: string;
  description?: string;
  mode: "default" | "custom";
  state: "draft" | "published" | "archived";
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
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  startedAt: string;
  durationMs?: number;
};

type RunMessage = {
  id: string;
  fromNodeName: string;
  toNodeName: string;
  channel: string;
  targetInputKey: string;
  createdAt: string;
};

const STEP_TYPES: AgentStepType[] = ["research", "analysis", "briefing", "draft", "review"];

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "success") return "default";
  if (status === "failed") return "destructive";
  if (status === "running") return "outline";
  return "secondary";
}

export function AgentWorkflowV2Management() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [newWorkflowName, setNewWorkflowName] = useState("");

  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runSteps, setRunSteps] = useState<RunStep[]>([]);
  const [runMessages, setRunMessages] = useState<RunMessage[]>([]);

  const activeWorkflow = useMemo(() => workflows.find((workflow) => workflow.id === activeWorkflowId) || null, [workflows, activeWorkflowId]);
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  const nodeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    nodes.forEach((node) => map.set(node.id, node.name));
    return map;
  }, [nodes]);

  const loadWorkflows = async () => {
    const res = await fetch("/api/agent-workflows-v2");
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Workflows konnten nicht geladen werden");

    const list = (data?.workflows || []) as WorkflowRecord[];
    setWorkflows(list);

    const selectedId = activeWorkflowId && list.some((entry) => entry.id === activeWorkflowId)
      ? activeWorkflowId
      : list[0]?.id || null;
    setActiveWorkflowId(selectedId);

    if (selectedId) {
      const workflow = list.find((entry) => entry.id === selectedId);
      const version = workflow?.draftVersion || workflow?.activeVersion;
      const versionNodes = version?.nodes?.slice().sort((a, b) => a.position - b.position) || [];
      const versionEdges = version?.edges || [];
      setNodes(versionNodes);
      setEdges(versionEdges);
      setSelectedNodeId(versionNodes[0]?.id || null);
    } else {
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
    }
  };

  const loadRuns = async () => {
    const res = await fetch("/api/agent-workflows-v2/runs?limit=50");
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Runs konnten nicht geladen werden");
    setRuns(data?.runs || []);
  };

  const loadRunDetails = async (runId: string) => {
    const [runRes, messageRes] = await Promise.all([
      fetch(`/api/agent-workflows-v2/runs/${runId}`),
      fetch(`/api/agent-workflows-v2/runs/${runId}/messages`),
    ]);
    const runData = await runRes.json();
    const messageData = await messageRes.json();
    if (!runRes.ok) throw new Error(runData?.error || "Run-Details konnten nicht geladen werden");
    if (!messageRes.ok) throw new Error(messageData?.error || "Nachrichten konnten nicht geladen werden");

    setSelectedRunId(runId);
    setRunSteps(runData?.run?.steps || []);
    setRunMessages(messageData?.messages || []);
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

  const addNode = (type: AgentStepType = "research") => {
    const id = crypto.randomUUID();
    const index = nodes.length;
    setNodes((prev) => [
      ...prev,
      {
        id,
        name: `${type} agent ${index + 1}`,
        type,
        position: index,
        x: 120 + index * 220,
        y: 80 + (index % 2) * 120,
        config: {
          instruction: "Beschreiben Sie die Aufgabe dieses Agenten.",
          provider: "openrouter",
          model: "openai/gpt-4o-mini",
          timeoutMs: 45000,
          retries: 1,
          enabled: true,
        },
      },
    ]);
    setSelectedNodeId(id);
  };

  const removeNode = (nodeId: string) => {
    const nextNodes = nodes.filter((node) => node.id !== nodeId);
    setNodes(nextNodes);
    setEdges((prev) => prev.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(nextNodes[0]?.id || null);
    }
  };

  const updateNode = (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => {
    setNodes((prev) => prev.map((node) => (node.id === nodeId ? updater(node) : node)));
  };

  const createCustomWorkflow = async () => {
    if (!newWorkflowName.trim()) {
      setError("Bitte einen Namen für den Workflow eingeben.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await fetch("/api/agent-workflows-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkflowName.trim(), mode: "custom" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Workflow konnte nicht erstellt werden");

      setSuccess("Custom Workflow V2 erstellt.");
      setNewWorkflowName("");
      await loadWorkflows();
      setActiveWorkflowId(data?.workflow?.id || null);
    } catch (err: any) {
      setError(err.message || "Workflow konnte nicht erstellt werden");
    } finally {
      setSaving(false);
    }
  };

  const saveWorkflow = async () => {
    if (!activeWorkflow) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const normalizedNodes = nodes.map((node, index) => ({ ...node, position: index }));
      const res = await fetch(`/api/agent-workflows-v2/${activeWorkflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: normalizedNodes, edges }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Workflow konnte nicht gespeichert werden");

      setSuccess("Workflow gespeichert.");
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
      const res = await fetch(`/api/agent-workflows-v2/${activeWorkflow.id}/publish`, { method: "POST" });
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
      const res = await fetch(`/api/agent-workflows-v2/${activeWorkflow.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          input: {
            workflowName: activeWorkflow.name,
            source: "agent-workflow-v2-page",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ausführung fehlgeschlagen");

      setSuccess("Workflow wurde ausgeführt.");
      await loadRuns();
      if (data?.run?.id) {
        await loadRunDetails(data.run.id);
      }
    } catch (err: any) {
      setError(err.message || "Ausführung fehlgeschlagen");
    } finally {
      setRunning(false);
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
            Agent Workflow V2
          </CardTitle>
          <CardDescription>
            n8n/Make-inspirierter Builder mit Agent-to-Agent Kommunikation via Message-Edges.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2 min-w-[260px]">
            <Label>Aktiver Workflow</Label>
            <Select value={activeWorkflowId || ""} onValueChange={(value) => setActiveWorkflowId(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Workflow wählen" />
              </SelectTrigger>
              <SelectContent>
                {workflows.map((workflow) => (
                  <SelectItem key={workflow.id} value={workflow.id}>
                    {workflow.name} ({workflow.mode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 min-w-[260px]">
            <Label>Neuer Custom Workflow</Label>
            <Input value={newWorkflowName} onChange={(e) => setNewWorkflowName(e.target.value)} placeholder="z. B. Product Optimization Flow" />
          </div>
          <Button variant="outline" onClick={createCustomWorkflow} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Custom erstellen"}
          </Button>
          {activeWorkflow && (
            <>
              <Badge variant="secondary">Mode: {activeWorkflow.mode}</Badge>
              <Badge variant={activeWorkflow.state === "published" ? "default" : "outline"}>Status: {activeWorkflow.state}</Badge>
            </>
          )}
        </CardContent>
      </Card>

      {activeWorkflow && (
        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Node Palette</CardTitle>
              <CardDescription>Agent-Nodes hinzufügen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {STEP_TYPES.map((type) => (
                <Button key={type} variant="outline" className="w-full justify-start" onClick={() => addNode(type)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {type}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Workflow className="h-4 w-4" />
                Canvas Board (V2)
              </CardTitle>
              <CardDescription>
                Nodes auswählen, verschieben (x/y), verbinden und Kommunikationskanäle definieren.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {nodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Nodes vorhanden. Fügen Sie links einen Agenten hinzu.</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {nodes
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`rounded-md border p-3 text-left transition-colors ${selectedNodeId === node.id ? "border-primary bg-primary/5" : "hover:bg-muted/30"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4" />
                            <span className="text-sm font-medium">{node.name}</span>
                          </div>
                          <Badge variant={node.config.enabled ? "default" : "secondary"}>{node.type}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Position: ({Math.round(node.x)}, {Math.round(node.y)})
                        </div>
                      </button>
                    ))}
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Plug2 className="h-4 w-4" />
                  Agent-Verbindungen (A2A)
                </Label>
                {edges.length === 0 && <p className="text-xs text-muted-foreground">Keine Edges vorhanden.</p>}
                {edges.map((edge) => (
                  <div key={edge.id} className="rounded border p-2 space-y-2">
                    <div className="grid gap-2 md:grid-cols-2">
                      <Select
                        value={edge.sourceNodeId}
                        onValueChange={(value) => {
                          if (!value) return;
                          setEdges((prev) => prev.map((entry) => (entry.id === edge.id ? { ...entry, sourceNodeId: value } : entry)));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Von Agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {nodes.map((node) => (
                            <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={edge.targetNodeId}
                        onValueChange={(value) => {
                          if (!value) return;
                          setEdges((prev) => prev.map((entry) => (entry.id === edge.id ? { ...entry, targetNodeId: value } : entry)));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Zu Agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {nodes.map((node) => (
                            <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input
                        value={edge.channel}
                        onChange={(e) => setEdges((prev) => prev.map((entry) => (entry.id === edge.id ? { ...entry, channel: e.target.value } : entry)))}
                        placeholder="channel z. B. analysis.output"
                      />
                      <Input
                        value={edge.targetInputKey}
                        onChange={(e) => setEdges((prev) => prev.map((entry) => (entry.id === edge.id ? { ...entry, targetInputKey: e.target.value } : entry)))}
                        placeholder="targetInputKey"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEdges((prev) => prev.filter((entry) => entry.id !== edge.id))}>
                      Verbindung entfernen
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (nodes.length < 2) return;
                    setEdges((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        sourceNodeId: nodes[0].id,
                        targetNodeId: nodes[nodes.length - 1].id,
                        channel: `${nodes[0].type}.output`,
                        targetInputKey: `${nodes[nodes.length - 1].type}Input`,
                      },
                    ]);
                  }}
                >
                  Verbindung hinzufügen
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Node Inspector</CardTitle>
              <CardDescription>Konfiguration des selektierten Agenten.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedNode ? (
                <p className="text-sm text-muted-foreground">Node im Canvas auswählen.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={selectedNode.name} onChange={(e) => updateNode(selectedNode.id, (prev) => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Typ</Label>
                    <Select value={selectedNode.type} onValueChange={(value) => updateNode(selectedNode.id, (prev) => ({ ...prev, type: value as AgentStepType }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STEP_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>X</Label>
                      <Input type="number" value={selectedNode.x} onChange={(e) => updateNode(selectedNode.id, (prev) => ({ ...prev, x: Number(e.target.value || 0) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Y</Label>
                      <Input type="number" value={selectedNode.y} onChange={(e) => updateNode(selectedNode.id, (prev) => ({ ...prev, y: Number(e.target.value || 0) }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={selectedNode.config.provider} onValueChange={(value) => updateNode(selectedNode.id, (prev) => ({ ...prev, config: { ...prev.config, provider: value as AgentProvider } }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Input value={selectedNode.config.model} onChange={(e) => updateNode(selectedNode.id, (prev) => ({ ...prev, config: { ...prev.config, model: e.target.value } }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Timeout</Label>
                      <Input type="number" value={selectedNode.config.timeoutMs} onChange={(e) => updateNode(selectedNode.id, (prev) => ({ ...prev, config: { ...prev.config, timeoutMs: Number(e.target.value || 0) } }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Retries</Label>
                      <Input type="number" value={selectedNode.config.retries} onChange={(e) => updateNode(selectedNode.id, (prev) => ({ ...prev, config: { ...prev.config, retries: Number(e.target.value || 0) } }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Instruction</Label>
                    <textarea
                      value={selectedNode.config.instruction}
                      onChange={(e) => updateNode(selectedNode.id, (prev) => ({ ...prev, config: { ...prev.config, instruction: e.target.value } }))}
                      className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm min-h-24"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant={selectedNode.config.enabled ? "default" : "outline"} size="sm" onClick={() => updateNode(selectedNode.id, (prev) => ({ ...prev, config: { ...prev.config, enabled: !prev.config.enabled } }))}>
                      {selectedNode.config.enabled ? "Aktiv" : "Inaktiv"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => removeNode(selectedNode.id)}>Entfernen</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeWorkflow && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workflow Aktionen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={saveWorkflow} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Speichern
            </Button>
            <Button variant="outline" onClick={publishWorkflow} disabled={publishing}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publizieren"}
            </Button>
            <Button variant="secondary" onClick={runWorkflow} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Run starten
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ausführungen</CardTitle>
            <CardDescription>Run-Status und Step-Details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Ausführungen vorhanden.</p>
            ) : (
              runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => loadRunDetails(run.id)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${selectedRunId === run.id ? "border-primary bg-primary/5" : "hover:bg-muted/30"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Run {run.id.slice(0, 8)}</span>
                    <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Start: {new Date(run.startedAt).toLocaleString("de-DE")} | Dauer: {run.durationMs ? `${run.durationMs} ms` : "-"}
                  </div>
                </button>
              ))
            )}
            {selectedRunId && (
              <div className="rounded-md border p-3 space-y-2">
                <h4 className="text-sm font-semibold">Step-Status</h4>
                {runSteps.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Keine Step-Daten vorhanden.</p>
                ) : (
                  runSteps.map((step) => (
                    <div key={step.id} className="rounded border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{step.nodeName}</span>
                        <Badge variant={statusVariant(step.status)}>{step.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{step.nodeType} | {step.provider} / {step.model}</div>
                      {step.error && <div className="text-xs text-red-600 mt-1">{step.error}</div>}
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Agent-to-Agent Kommunikation
            </CardTitle>
            <CardDescription>Message Trace zwischen Nodes innerhalb eines Runs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedRunId ? (
              <p className="text-sm text-muted-foreground">Wählen Sie einen Run, um Nachrichten zu sehen.</p>
            ) : runMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Nachrichten für diesen Run.</p>
            ) : (
              runMessages.map((msg) => (
                <div key={msg.id} className="rounded border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium flex items-center gap-1">
                      <Send className="h-3.5 w-3.5" />
                      {msg.fromNodeName} → {msg.toNodeName}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{msg.channel}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ziel-Input: <span className="font-mono">{msg.targetInputKey}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleString("de-DE")}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

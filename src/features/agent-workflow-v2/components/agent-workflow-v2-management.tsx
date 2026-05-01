"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Connection,
  MarkerType,
  Node,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Calendar, Copy, Loader2, Pencil, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/use-i18n";
import { toLocaleTag } from "@/i18n/locale-utils";

import {
  AgentNodeData,
  AgentProvider,
  AgentStepType,
  DiscoveredModel,
  ExecutionView,
  FlowMode,
  NODE_STYLE_BY_TYPE,
  RunMessage,
  RunRecord,
  RunState,
  RunStep,
  WorkflowEdgeRecord,
  WorkflowNodeRecord,
  WorkflowRecord,
} from "../types";
import { BezierDataEdge, FlowCanvas } from "./flow-canvas";
import { NodePalette } from "./node-palette";
import { ExecutionPanel } from "./execution-panel";
import { NodeEditorSheet } from "./node-editor-sheet";
import { RunDetailModal } from "./run-detail-modal";
import { useRunPolling } from "../hooks/use-run-polling";
import { useWorkflowAutosave } from "../hooks/use-workflow-autosave";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toFlowNodes(
  workflowNodes: WorkflowNodeRecord[],
  runStateByNode: Record<string, RunState>,
  outputPreviewByNode: Record<string, string>,
  executionOrderByNode: Record<string, number>
): Node<AgentNodeData>[] {
  return workflowNodes
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((node) => ({
      id: node.id,
      type: "agentNode",
      position: { x: node.x, y: node.y },
      data: {
        label: node.name,
        type: node.type,
        status: runStateByNode[node.id] || "idle",
        outputPreview: outputPreviewByNode[node.id],
        executionOrder: executionOrderByNode[node.id],
        provider: node.config.provider,
        icon: NODE_STYLE_BY_TYPE[node.type].icon,
        isParent: Boolean(node.isParent),
        instruction: node.config.instruction,
        purpose: (node.config as any).purpose || "",
        inputContract: (node.config as any).inputContract || "",
        outputContract: (node.config as any).outputContract || "",
        model: node.config.model,
        timeoutMs: node.config.timeoutMs,
        retries: node.config.retries,
        enabled: node.config.enabled,
      } as any,
    }));
}

function toFlowEdges(
  workflowEdges: WorkflowEdgeRecord[],
  runStateByNode: Record<string, RunState>
): BezierDataEdge[] {
  return workflowEdges.map((edge) => {
    const fromRunning = runStateByNode[edge.sourceNodeId] === "running";
    return {
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      type: "streamingBezier",
      animated: fromRunning,
      data: { label: edge.channel, streaming: fromRunning, targetInputKey: edge.targetInputKey },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#60a5fa" },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AgentWorkflowV2Management() {
  const { t, locale } = useI18n();
  const localeTag = toLocaleTag(locale);

  // ── Loading & feedback ──
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Workflow state ──
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [activeFlowTab, setActiveFlowTab] = useState<FlowMode>("default");
  const [runStateByNode, setRunStateByNode] = useState<Record<string, RunState>>({});
  const [outputPreviewByNode, setOutputPreviewByNode] = useState<Record<string, string>>({});
  const [executionOrderByNode, setExecutionOrderByNode] = useState<Record<string, number>>({});

  // ── Canvas state ──
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);

  // ── Runs state ──
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [runSteps, setRunSteps] = useState<RunStep[]>([]);
  const [runMessages, setRunMessages] = useState<RunMessage[]>([]);
  const [executionView, setExecutionView] = useState<ExecutionView>("executions");
  const [runActionLoading, setRunActionLoading] = useState<string | null>(null);
  const [showHiddenRuns, setShowHiddenRuns] = useState(false);
  const [runStatusFilter, setRunStatusFilter] = useState<"all" | RunRecord["status"]>("all");

  // ── Run detail modal ──
  const [runDetailModalOpen, setRunDetailModalOpen] = useState(false);
  const [runDetailModalRunId, setRunDetailModalRunId] = useState<string | null>(null);
  const [runDetailSteps, setRunDetailSteps] = useState<RunStep[]>([]);
  const [runDetailMessages, setRunDetailMessages] = useState<RunMessage[]>([]);
  const [runDetailLoading, setRunDetailLoading] = useState(false);

  // ── Execution panel resize ──
  const [executionPanelHeight, setExecutionPanelHeight] = useState(360);
  const resizeStartYRef = useRef<number | null>(null);
  const resizeStartHeightRef = useRef<number>(360);

  // ── Model discovery ──
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, DiscoveredModel[]>>({});
  const [modelsLoadingByProvider, setModelsLoadingByProvider] = useState<Record<string, boolean>>({});
  const [modelErrorsByProvider, setModelErrorsByProvider] = useState<Record<string, string>>({});

  // ── React Flow ──
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AgentNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BezierDataEdge>([]);
  const skipNextAutosaveRef = useRef(false);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const activeWorkflow = useMemo(
    () => workflows.find((w) => w.id === activeWorkflowId) || null,
    [workflows, activeWorkflowId]
  );
  const defaultFlowOptions = useMemo(() => workflows.filter((w) => w.mode === "default"), [workflows]);
  const customFlowOptions = useMemo(() => workflows.filter((w) => w.mode === "custom"), [workflows]);

  const nodeRecordMap = useMemo(() => {
    const map = new Map<string, WorkflowNodeRecord>();
    nodes.forEach((node) => {
      map.set(node.id, {
        id: node.id,
        name: node.data.label,
        type: node.data.type,
        position: 0,
        x: node.position.x,
        y: node.position.y,
        isParent: Boolean(node.data.isParent),
        config: {
          instruction: (node.data as any).instruction || "",
          purpose: (node.data as any).purpose || "",
          inputContract: (node.data as any).inputContract || "",
          outputContract: (node.data as any).outputContract || "",
          provider: node.data.provider,
          model: (node.data as any).model || "openai/gpt-4o-mini",
          timeoutMs: Number((node.data as any).timeoutMs || 45000),
          retries: Number((node.data as any).retries || 1),
          enabled: Boolean((node.data as any).enabled ?? true),
        },
      });
    });
    return map;
  }, [nodes]);

  const selectedNodeRecord = selectedNodeId ? nodeRecordMap.get(selectedNodeId) || null : null;
  const selectedProvider = (selectedNodeRecord?.config.provider || "openrouter") as AgentProvider;
  const selectedProviderModels = modelsByProvider[selectedProvider] || [];
  const selectedProviderModelsLoading = Boolean(modelsLoadingByProvider[selectedProvider]);
  const selectedProviderModelError = modelErrorsByProvider[selectedProvider] || null;

  const isModelDiscoverySupported = useCallback(
    (provider: AgentProvider) => provider === "openai" || provider === "openrouter" || provider === "gemini",
    []
  );
  const selectedProviderSupportsDiscovery = isModelDiscoverySupported(selectedProvider);
  const selectedProviderHasModels = selectedProviderModels.length > 0;
  const selectedModelInProviderList = selectedProviderModels.some(
    (m) => m.id === selectedNodeRecord?.config.model
  );

  const parentNodes = nodes.filter((n) => n.data.isParent || n.data.type === "orchestrator");
  const enabledParentNodes = parentNodes.filter((n) => Boolean((n.data as any).enabled ?? true));
  const enabledSubNodes = nodes.filter(
    (n) => !(n.data.isParent || n.data.type === "orchestrator") && Boolean((n.data as any).enabled ?? true)
  );

  const selectedRun = useMemo(() => runs.find((r) => r.id === selectedRunId) || null, [runs, selectedRunId]);

  const filteredRuns = useMemo(() => {
    if (runStatusFilter === "all") return runs;
    return runs.filter((r) => r.status === runStatusFilter);
  }, [runs, runStatusFilter]);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadRuns = useCallback(async () => {
    const response = await fetch(
      `/api/agent-workflows-v2/runs?limit=80${showHiddenRuns ? "&includeDeleted=1" : ""}`
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Runs konnten nicht geladen werden");
    setRuns(data?.runs || []);
  }, [showHiddenRuns]);

  const loadRunDetails = useCallback(async (runId: string) => {
    const [runResponse, messageResponse] = await Promise.all([
      fetch(`/api/agent-workflows-v2/runs/${runId}`),
      fetch(`/api/agent-workflows-v2/runs/${runId}/messages`),
    ]);
    const runData = await runResponse.json();
    const messageData = await messageResponse.json();
    if (!runResponse.ok) throw new Error(runData?.error || "Run-Details konnten nicht geladen werden");
    if (!messageResponse.ok) throw new Error(messageData?.error || "Messages konnten nicht geladen werden");

    const steps = (runData?.run?.steps || []) as RunStep[];
    setSelectedRunId(runId);
    setRunSteps(steps);
    setSelectedStepId(steps[0]?.id || null);
    setRunMessages(messageData?.messages || []);

    const nextStatus: Record<string, RunState> = {};
    const nextPreview: Record<string, string> = {};
    const nextOrder: Record<string, number> = {};
    steps.forEach((step) => {
      nextStatus[step.nodeId] =
        step.status === "success" ? "success" : step.status === "failed" ? "failed" : step.status === "running" ? "running" : "idle";
      nextPreview[step.nodeId] = step.output ? JSON.stringify(step.output).slice(0, 90) : step.error ? `Error: ${step.error}` : "-";
      if (!nextOrder[step.nodeId]) nextOrder[step.nodeId] = Object.keys(nextOrder).length + 1;
    });
    setRunStateByNode(nextStatus);
    setOutputPreviewByNode(nextPreview);
    setExecutionOrderByNode(nextOrder);
  }, []);

  const loadRunModalDetails = useCallback(async (runId: string) => {
    const [runResponse, messageResponse] = await Promise.all([
      fetch(`/api/agent-workflows-v2/runs/${runId}`),
      fetch(`/api/agent-workflows-v2/runs/${runId}/messages`),
    ]);
    const runData = await runResponse.json();
    const messageData = await messageResponse.json();
    if (!runResponse.ok) throw new Error(runData?.error || "Run-Details konnten nicht geladen werden");
    if (!messageResponse.ok) throw new Error(messageData?.error || "Messages konnten nicht geladen werden");
    setRunDetailSteps((runData?.run?.steps || []) as RunStep[]);
    setRunDetailMessages(messageData?.messages || []);
    setRuns((prev) =>
      prev.map((r) =>
        r.id === runId
          ? { ...r, status: runData?.run?.status ?? r.status, durationMs: runData?.run?.durationMs ?? r.durationMs }
          : r
      )
    );
  }, []);

  const loadWorkflows = useCallback(async () => {
    const response = await fetch("/api/agent-workflows-v2");
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Workflows konnten nicht geladen werden");

    const list = (data?.workflows || []) as WorkflowRecord[];
    setWorkflows(list);

    const selectedId =
      activeWorkflowId && list.some((e) => e.id === activeWorkflowId) ? activeWorkflowId : list[0]?.id || null;
    setActiveWorkflowId(selectedId);

    if (selectedId) {
      const workflow = list.find((e) => e.id === selectedId);
      const version = workflow?.draftVersion || workflow?.activeVersion;
      skipNextAutosaveRef.current = true;
      setNodes(toFlowNodes(version?.nodes || [], {}, {}, {}));
      setEdges(toFlowEdges(version?.edges || [], {}));
      setIsDirty(false);
      setAutoSaveError(null);
      setLastSavedAt(new Date().toISOString());
      setSelectedNodeId(version?.nodes?.[0]?.id || null);
      if (workflow?.mode) setActiveFlowTab(workflow.mode);
    } else {
      skipNextAutosaveRef.current = true;
      setNodes([]);
      setEdges([]);
      setIsDirty(false);
      setSelectedNodeId(null);
    }
  }, [activeWorkflowId]);

  // ─── Hooks ─────────────────────────────────────────────────────────────────

  useRunPolling({
    runs,
    selectedRunId,
    runDetailModalOpen,
    runDetailModalRunId,
    loadRuns,
    loadRunDetails,
    loadRunModalDetails,
  });

  useWorkflowAutosave({
    nodes,
    edges,
    activeWorkflow,
    loading,
    onSave: async ({ silent }) => {
      if (!activeWorkflow) return;
      try {
        setAutoSaving(true);
        if (!silent) { setError(null); setSuccess(null); }
        setAutoSaveError(null);
        const payloadNodes = nodes.map((node, index) => ({
          id: node.id, name: node.data.label, type: node.data.type, position: index,
          x: node.position.x, y: node.position.y, isParent: Boolean(node.data.isParent),
          config: {
            instruction: (node.data as any).instruction || "",
            purpose: (node.data as any).purpose || "",
            inputContract: (node.data as any).inputContract || "",
            outputContract: (node.data as any).outputContract || "",
            provider: node.data.provider,
            model: (node.data as any).model || "openai/gpt-4o-mini",
            timeoutMs: Number((node.data as any).timeoutMs || 45000),
            retries: Number((node.data as any).retries || 1),
            enabled: Boolean((node.data as any).enabled ?? true),
          },
        }));
        const payloadEdges = edges.map((edge) => ({
          id: edge.id, sourceNodeId: edge.source, targetNodeId: edge.target,
          channel: String(edge.data?.label || "message"),
          targetInputKey: String((edge.data as any)?.targetInputKey || "input"),
        }));
        const response = await fetch(`/api/agent-workflows-v2/${activeWorkflow.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodes: payloadNodes, edges: payloadEdges }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Workflow konnte nicht gespeichert werden");
        setIsDirty(false);
        setLastSavedAt(new Date().toISOString());
        if (!silent) setSuccess("Workflow gespeichert.");
      } catch (err: any) {
        const message = err.message || "Workflow konnte nicht gespeichert werden";
        setAutoSaveError(message);
        if (!silent) setError(message);
      } finally {
        setAutoSaving(false);
      }
    },
  });

  // ─── Effects ───────────────────────────────────────────────────────────────

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
  }, [showHiddenRuns]);

  useEffect(() => {
    // Only sanitize when there are already nodes — never auto-create on empty canvas
    if (!loading && nodes.length > 0) sanitizeParentNode();
  }, [loading, nodes.length]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    if (!activeWorkflowId) return;
    const workflow = workflows.find((e) => e.id === activeWorkflowId);
    const version = workflow?.draftVersion || workflow?.activeVersion;
    if (!version) return;
    skipNextAutosaveRef.current = true;
    setNodes(toFlowNodes(version.nodes || [], runStateByNode, outputPreviewByNode, executionOrderByNode));
    setEdges(toFlowEdges(version.edges || [], runStateByNode));
    setIsDirty(false);
    setAutoSaveError(null);
    setSelectedNodeId(version.nodes?.[0]?.id || null);
  }, [activeWorkflowId, workflows]);

  useEffect(() => {
    if (!selectedNodeRecord) return;
    const provider = selectedNodeRecord.config.provider;
    if (!isModelDiscoverySupported(provider)) return;
    if ((modelsByProvider[provider] || []).length > 0) return;
    if (modelsLoadingByProvider[provider]) return;
    void loadProviderModels(provider, false);
  }, [selectedNodeRecord, isModelDiscoverySupported, modelsByProvider, modelsLoadingByProvider]);

  useEffect(() => {
    if (!selectedNodeRecord || !selectedProviderSupportsDiscovery || !selectedProviderHasModels || selectedModelInProviderList) return;
    const fallback = selectedProviderModels[0]?.id;
    if (!fallback) return;
    updateSelectedNode((node) => ({ ...node, data: { ...node.data, model: fallback } as any }));
  }, [selectedNodeRecord, selectedProviderSupportsDiscovery, selectedProviderHasModels, selectedModelInProviderList, selectedProviderModels]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (resizeStartYRef.current === null) return;
      const delta = resizeStartYRef.current - event.clientY;
      setExecutionPanelHeight(Math.max(260, Math.min(640, resizeStartHeightRef.current + delta)));
    };
    const onUp = () => { resizeStartYRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (selectedEdgeIds.length === 0) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      setEdges((prev) => prev.filter((edge) => !selectedEdgeIds.includes(edge.id)));
      setSelectedEdgeIds([]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEdgeIds]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const loadProviderModels = useCallback(async (provider: AgentProvider, refresh = false) => {
    if (!isModelDiscoverySupported(provider)) return;
    setModelsLoadingByProvider((prev) => ({ ...prev, [provider]: true }));
    setModelErrorsByProvider((prev) => { const n = { ...prev }; delete n[provider]; return n; });
    try {
      const query = refresh ? "?refresh=1" : "";
      const response = await fetch(`/api/admin/integrations/${provider}/models${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Modelle für ${provider} konnten nicht geladen werden.`);
      setModelsByProvider((prev) => ({ ...prev, [provider]: Array.isArray(data?.models) ? data.models : [] }));
    } catch (err: any) {
      setModelErrorsByProvider((prev) => ({ ...prev, [provider]: err.message || `Modelle für ${provider} konnten nicht geladen werden.` }));
    } finally {
      setModelsLoadingByProvider((prev) => ({ ...prev, [provider]: false }));
    }
  }, [isModelDiscoverySupported]);

  const sameIds = useCallback((a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    return a.every((id, i) => id === b[i]);
  }, []);

  const handleSelectionChangeEdges = useCallback(
    (edgeIds: string[]) => setSelectedEdgeIds((prev) => (sameIds(prev, edgeIds) ? prev : edgeIds)),
    [sameIds]
  );

  const createOrchestratorNode = (): Node<AgentNodeData> => ({
    id: crypto.randomUUID(),
    type: "agentNode",
    position: { x: 80, y: 80 },
    data: {
      label: "Parent Agent (Orchestrator)", type: "orchestrator", status: "idle",
      outputPreview: "Noch kein Run", provider: "openrouter",
      icon: NODE_STYLE_BY_TYPE.orchestrator.icon, isParent: true,
      instruction: "Orchestriere die nachgelagerten Agenten, strukturiere den Kontext und delegiere Aufgaben entlang des Flows.",
      purpose: "Du bist der Orchestrator und entscheidest in jeder Runde, welcher Subagent als nächstes die höchste Priorität hat.",
      inputContract: "Du erhältst runInput, agentCatalog, workingMemory, completedTasks und lastTaskResult.",
      outputContract: '{"finalize": boolean, "summary"?: string, "next"?: {"targetNodeId": string, "objective": string, "expectedOutput"?: string}, "memoryPatch"?: object}',
      model: "openai/gpt-4o-mini", timeoutMs: 45000, retries: 1, enabled: true,
    } as any,
  });

  const initCustomFlow = () => {
    const orchestrator = createOrchestratorNode();
    setNodes([orchestrator]);
    setEdges([]);
    setSelectedNodeId(orchestrator.id);
    setDrawerOpen(true);
  };

  const sanitizeParentNode = () => {
    // Only called when nodes.length > 0 — never auto-creates on empty canvas
    const parents = nodes.filter((n) => n.data.isParent || n.data.type === "orchestrator");
    if (parents.length === 0) {
      // Nodes exist but no orchestrator — add one
      setNodes((prev) => [createOrchestratorNode(), ...prev]);
      return;
    }
    if (parents.length > 1) {
      const firstId = parents[0].id;
      setNodes((prev) => prev.map((node) => {
        if (node.id === firstId) return { ...node, data: { ...node.data, type: "orchestrator", isParent: true, icon: NODE_STYLE_BY_TYPE.orchestrator.icon } as any };
        if (node.data.isParent || node.data.type === "orchestrator") return { ...node, data: { ...node.data, type: "research", isParent: false, icon: NODE_STYLE_BY_TYPE.research.icon } as any };
        return node;
      }));
      return;
    }
    const parent = parents[0];
    if (!parent.data.isParent || parent.data.type !== "orchestrator") {
      setNodes((prev) => prev.map((node) => node.id === parent.id
        ? { ...node, data: { ...node.data, type: "orchestrator", isParent: true, icon: NODE_STYLE_BY_TYPE.orchestrator.icon } as any }
        : node
      ));
    }
  };

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const sourceNode = nodeRecordMap.get(connection.source);
    const targetNode = nodeRecordMap.get(connection.target);
    if (!sourceNode || !targetNode) return;
    const edgeRecord: WorkflowEdgeRecord = {
      id: crypto.randomUUID(),
      sourceNodeId: connection.source,
      targetNodeId: connection.target,
      channel: `${sourceNode.type}.output`,
      targetInputKey: `${targetNode.type}Input`,
    };
    const flowEdge = toFlowEdges([edgeRecord], runStateByNode)[0];
    setEdges((eds) => addEdge(flowEdge, eds));
  }, [nodeRecordMap, runStateByNode]);

  const updateSelectedNode = (patcher: (node: Node<AgentNodeData>) => Node<AgentNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.map((node) => (node.id === selectedNodeId ? patcher(node) : node)));
  };

  const addNode = (type: AgentStepType, position?: { x: number; y: number }) => {
    const id = crypto.randomUUID();
    const newNode: Node<AgentNodeData> = {
      id, type: "agentNode",
      position: { x: position?.x ?? 320, y: position?.y ?? 180 + nodes.length * 160 },
      data: {
        label: `${type} agent ${nodes.length + 1}`, type, status: "idle",
        outputPreview: "Noch kein Run", provider: "openrouter",
        icon: NODE_STYLE_BY_TYPE[type].icon, isParent: false,
        instruction: "Beschreiben Sie die Aufgabe dieses Agenten.",
        purpose: "Beschreibe klar, wofür dieser Subagent verantwortlich ist.",
        inputContract: "Erhält task objective, runInput, workingMemory und letzte Ergebnisse als Kontext.",
        outputContract: "Liefert strukturiertes JSON mit Ergebnis, Annahmen, offenen Fragen und nextHints.",
        model: "openai/gpt-4o-mini", timeoutMs: 45000, retries: 1, enabled: true,
      } as any,
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(id);
    setDrawerOpen(true);
  };

  const removeNode = (nodeId: string) => {
    const target = nodes.find((n) => n.id === nodeId);
    if (target?.data.isParent) { setError("Der Parent Agent kann nicht gelöscht werden."); return; }
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) { setSelectedNodeId(null); setDrawerOpen(false); }
  };

  const duplicateNode = (nodeId: string) => {
    const source = nodes.find((n) => n.id === nodeId);
    if (!source) return;
    const id = crypto.randomUUID();
    setNodes((prev) => [...prev, { ...source, id, position: { x: source.position.x + 80, y: source.position.y + 50 }, data: { ...source.data, label: `${source.data.label} Copy`, isParent: false } }]);
    setSelectedNodeId(id);
    setDrawerOpen(true);
  };

  const renameNode = (nodeId: string) => {
    const source = nodes.find((n) => n.id === nodeId);
    if (!source) return;
    const renamed = window.prompt("Neuer Node-Name", source.data.label);
    if (!renamed?.trim()) return;
    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label: renamed.trim() } } : n));
  };

  const cancelRun = async (runId: string) => {
    try {
      setRunActionLoading(`cancel:${runId}`); setError(null);
      const response = await fetch(`/api/agent-workflows-v2/runs/${runId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Run konnte nicht abgebrochen werden");
      setSuccess("Run wurde abgebrochen.");
      await loadRuns();
      if (selectedRunId === runId) await loadRunDetails(runId);
    } catch (err: any) { setError(err.message || "Run konnte nicht abgebrochen werden"); }
    finally { setRunActionLoading(null); }
  };

  const softDeleteRun = async (runId: string) => {
    try {
      setRunActionLoading(`delete:${runId}`); setError(null);
      const response = await fetch(`/api/agent-workflows-v2/runs/${runId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Run konnte nicht ausgeblendet werden");
      setSuccess("Run wurde aus der Historie ausgeblendet.");
      await loadRuns();
      if (selectedRunId === runId) { setSelectedRunId(null); setSelectedStepId(null); setRunSteps([]); setRunMessages([]); setExecutionOrderByNode({}); }
    } catch (err: any) { setError(err.message || "Run konnte nicht ausgeblendet werden"); }
    finally { setRunActionLoading(null); }
  };

  const restoreRun = async (runId: string) => {
    try {
      setRunActionLoading(`restore:${runId}`); setError(null);
      const response = await fetch(`/api/agent-workflows-v2/runs/${runId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Run konnte nicht wiederhergestellt werden");
      setSuccess("Run wurde wiederhergestellt.");
      await loadRuns();
    } catch (err: any) { setError(err.message || "Run konnte nicht wiederhergestellt werden"); }
    finally { setRunActionLoading(null); }
  };

  const cleanupStaleRuns = async () => {
    try {
      setRunActionLoading("cleanup"); setError(null);
      const response = await fetch(`/api/agent-workflows-v2/runs`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cleanup_stale_running" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Cleanup fehlgeschlagen");
      const count = Array.isArray(data?.updatedRunIds) ? data.updatedRunIds.length : 0;
      setSuccess(count > 0 ? `${count} hängende Runs wurden auf 'cancelled' gesetzt.` : "Keine hängenden Runs gefunden.");
      await loadRuns();
      if (selectedRunId) await loadRunDetails(selectedRunId);
    } catch (err: any) { setError(err.message || "Cleanup fehlgeschlagen"); }
    finally { setRunActionLoading(null); }
  };

  const openRunDetailModal = async (runId: string) => {
    setRunDetailModalRunId(runId);
    setRunDetailModalOpen(true);
    setRunDetailLoading(true);
    try { await loadRunModalDetails(runId); }
    catch { /* shown in modal */ }
    finally { setRunDetailLoading(false); }
  };

  const runWorkflow = async () => {
    if (!activeWorkflow) return;
    try {
      if (parentNodes.length !== 1) { setError("Ein Workflow benötigt genau einen Parent Agent (Orchestrator)."); return; }
      if (enabledParentNodes.length !== 1) { setError("Der Parent Agent ist deaktiviert. Bitte aktiviere ihn vor dem Run."); return; }
      if (enabledSubNodes.length === 0) { setError("Mindestens ein aktiver Subagent ist erforderlich, damit der Parent delegieren kann."); return; }
      const missingPurpose = enabledSubNodes.find((n) => !String((n.data as any).purpose || "").trim());
      if (missingPurpose) { setError(`Subagent "${missingPurpose.data.label}" benötigt eine Purpose-Beschreibung.`); return; }

      setRunning(true); setError(null); setSuccess(null); setExecutionOrderByNode({});
      const pendingStatus: Record<string, RunState> = {};
      nodes.forEach((n) => { pendingStatus[n.id] = "running"; });
      setRunStateByNode(pendingStatus);

      const response = await fetch(`/api/agent-workflows-v2/${activeWorkflow.id}/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), input: { workflowName: activeWorkflow.name, source: "content-agent-builder-canvas" } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Run fehlgeschlagen");
      setSuccess("Workflow erfolgreich ausgeführt.");
      await loadRuns();
      if (data?.run?.id) await loadRunDetails(data.run.id);
    } catch (err: any) { setError(err.message || "Run fehlgeschlagen"); setRunStateByNode({}); }
    finally { setRunning(false); }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="space-y-6 text-slate-100 pb-6">
        {/* ── Flow tabs ── */}
        <Tabs
          value={activeFlowTab}
          onValueChange={(value) => {
            const next = (value as FlowMode) || "default";
            setActiveFlowTab(next);
            const options = next === "default" ? defaultFlowOptions : customFlowOptions;
            setActiveWorkflowId(options.length > 0 ? options[0].id : null);
          }}
        >
          <TabsList className="bg-primary/10 border-primary/10">
            <TabsTrigger value="default" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Calendar className="mr-2 h-4 w-4" /> Default Flow
            </TabsTrigger>
            <TabsTrigger value="custom" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Sparkles className="mr-2 h-4 w-4" /> Custom Flow
            </TabsTrigger>
          </TabsList>
          <TabsContent value="default" />
          <TabsContent value="custom" />
        </Tabs>

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

        {/* ── Canvas area ── */}
        <div className="space-y-3">
          {/* Amber info-banner when Custom Flow has nodes */}
          {activeFlowTab === "custom" && nodes.length > 0 && (
            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <AlertTitle className="text-amber-300">Custom Flow aktiv</AlertTitle>
              <AlertDescription className="text-amber-200/80">
                Dieser Custom Flow überschreibt beim Beauftragen den Default Flow. Nur dieser Flow wird ausgeführt.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-4">
              <NodePalette />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("agentBuilder.runControls")}</CardTitle>
                  <CardDescription>{t("agentBuilder.autoSaveExecute")}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div className="space-y-1.5 rounded-md border border-white/10 bg-[#0f172a]/60 p-2 text-xs text-slate-300">
                    <div className="font-medium text-slate-200">{t("agentBuilder.autoSave")}</div>
                    {autoSaving ? <div>{t("agentBuilder.saving")}</div> : isDirty ? <div>{t("agentBuilder.unsaved")}</div> : <div>{t("agentBuilder.allSaved")}</div>}
                    {lastSavedAt && <div className="text-slate-400">{t("agentBuilder.last")}: {new Date(lastSavedAt).toLocaleTimeString(localeTag)}</div>}
                    {autoSaveError && <div className="text-red-300">{autoSaveError}</div>}
                  </div>
                  <Button variant="secondary" onClick={runWorkflow} disabled={!activeWorkflow || running}>
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                    {t("agentBuilder.runStart")}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Custom Flow empty state */}
            {activeFlowTab === "custom" && nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-[#0b1220]/60 min-h-[420px] gap-5 px-8 text-center">
                <div className="rounded-full border border-primary/30 bg-primary/10 p-4">
                  <Sparkles className="h-8 w-8 text-primary/80" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="text-lg font-semibold text-slate-100">Kein Custom Flow vorhanden</h3>
                  <p className="text-sm text-slate-400">
                    Ein Custom Flow erlaubt dir, einen eigenen Agenten-Workflow zu definieren. Er überschreibt beim Beauftragen vollständig den Default Flow — nur dein Custom Flow wird dann ausgeführt.
                  </p>
                  <p className="text-xs text-amber-400/80 flex items-center justify-center gap-1.5 pt-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Der Default Flow wird beim Beauftragen deaktiviert, sobald ein Custom Flow aktiv ist.
                  </p>
                </div>
                <Button onClick={initCustomFlow} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Ersten Agenten hinzufügen
                </Button>
              </div>
            ) : (
              <FlowCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(nodeId) => { setSelectedNodeId(nodeId); setDrawerOpen(true); }}
                onNodeContextMenu={(nodeId, position) => { setSelectedNodeId(nodeId); setContextMenu({ nodeId, ...position }); }}
                onCanvasInteraction={() => setContextMenu(null)}
                onDropNode={addNode}
                onAddNodeInView={addNode}
                onSelectionChangeEdges={handleSelectionChangeEdges}
              />
            )}
          </div>
        </div>

        {/* ── Context menu ── */}
        {contextMenu && (
          <div
            className="fixed z-[120] min-w-[200px] rounded-lg border border-white/15 bg-[#0f172a] shadow-2xl p-1"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { icon: <Copy className="h-4 w-4" />, label: "Duplizieren", action: () => { duplicateNode(contextMenu.nodeId); setContextMenu(null); }, className: "text-slate-100" },
              { icon: <Pencil className="h-4 w-4" />, label: "Umbenennen", action: () => { renameNode(contextMenu.nodeId); setContextMenu(null); }, className: "text-slate-100" },
              { icon: <Trash2 className="h-4 w-4" />, label: "Löschen", action: () => { removeNode(contextMenu.nodeId); setContextMenu(null); }, className: "text-red-200" },
            ].map(({ icon, label, action, className }) => (
              <button key={label} className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-white/10 ${className}`} onClick={action}>
                {icon} {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Execution Panel ── */}
        <ExecutionPanel
          executionPanelHeight={executionPanelHeight}
          onResizeStart={(event) => {
            resizeStartYRef.current = event.clientY;
            resizeStartHeightRef.current = executionPanelHeight;
            event.preventDefault();
          }}
          executionView={executionView}
          onExecutionViewChange={setExecutionView}
          runActionLoading={runActionLoading}
          showHiddenRuns={showHiddenRuns}
          onToggleHiddenRuns={() => setShowHiddenRuns((prev) => !prev)}
          onCleanupStaleRuns={cleanupStaleRuns}
          runStatusFilter={runStatusFilter}
          onRunStatusFilterChange={setRunStatusFilter}
          filteredRuns={filteredRuns}
          selectedRunId={selectedRunId}
          runSteps={runSteps}
          runMessages={runMessages}
          selectedRun={selectedRun}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
          localeTag={localeTag}
          onOpenRunDetail={openRunDetailModal}
          onLoadRunDetails={loadRunDetails}
          onCancelRun={cancelRun}
          onSoftDeleteRun={softDeleteRun}
          onRestoreRun={restoreRun}
          t={t}
        />

        {/* ── Node Editor Sheet ── */}
        <NodeEditorSheet
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          selectedNodeRecord={selectedNodeRecord}
          selectedProvider={selectedProvider}
          selectedProviderModels={selectedProviderModels}
          selectedProviderModelsLoading={selectedProviderModelsLoading}
          selectedProviderModelError={selectedProviderModelError}
          selectedProviderSupportsDiscovery={selectedProviderSupportsDiscovery}
          selectedProviderHasModels={selectedProviderHasModels}
          selectedModelInProviderList={selectedModelInProviderList}
          modelsByProvider={modelsByProvider}
          onUpdateSelectedNode={updateSelectedNode}
          onRemoveNode={removeNode}
          onLoadProviderModels={loadProviderModels}
        />

        {/* ── Run Detail Modal ── */}
        <RunDetailModal
          open={runDetailModalOpen}
          onClose={() => setRunDetailModalOpen(false)}
          run={runs.find((r) => r.id === runDetailModalRunId) ?? null}
          steps={runDetailSteps}
          messages={runDetailMessages}
          loading={runDetailLoading}
          localeTag={localeTag}
          workflowMode={(() => {
            const run = runs.find((r) => r.id === runDetailModalRunId);
            return workflows.find((w) => w.id === run?.workflowId)?.mode;
          })()}
        />
      </div>
    </ReactFlowProvider>
  );
}

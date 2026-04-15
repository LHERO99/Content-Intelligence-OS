"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  BaseEdge,
  Connection,
  Controls,
  Edge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useStore,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Bot,
  Brain,
  Calendar,
  CircleDot,
  Copy,
  GitBranch,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Pencil,
  Save,
  Send,
  Sparkles,
  SquareTerminal,
  Trash2,
  X,
  Wand2,
} from "lucide-react";

type AgentStepType = "orchestrator" | "research" | "analysis" | "briefing" | "draft" | "review" | "custom";
type AgentProvider = "openrouter" | "gemini" | "vertex_legal";
type RunState = "idle" | "running" | "success" | "failed";

type WorkflowNodeRecord = {
  id: string;
  name: string;
  type: AgentStepType;
  position: number;
  x: number;
  y: number;
  isParent?: boolean;
  config: {
    instruction: string;
    provider: AgentProvider;
    model: string;
    timeoutMs: number;
    retries: number;
    enabled: boolean;
  };
};

type WorkflowEdgeRecord = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  channel: string;
  targetInputKey: string;
};

type WorkflowVersion = {
  id: string;
  nodes: WorkflowNodeRecord[];
  edges: WorkflowEdgeRecord[];
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

type FlowMode = "default" | "custom";

type RunRecord = {
  id: string;
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  startedAt: string;
  durationMs?: number;
};

type RunStep = {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: AgentStepType;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  provider: AgentProvider;
  model: string;
  output?: Record<string, unknown>;
  durationMs?: number;
  error?: string;
};

type RunMessage = {
  id: string;
  fromNodeId: string;
  fromNodeName: string;
  toNodeId: string;
  toNodeName: string;
  channel: string;
  targetInputKey: string;
  payload?: Record<string, unknown>;
  createdAt: string;
};

type AgentNodeData = {
  label: string;
  type: AgentStepType;
  status: RunState;
  outputPreview?: string;
  provider: AgentProvider;
  icon: "trigger" | "agent" | "tool";
  isParent?: boolean;
  isFocused?: boolean;
};

const STEP_TYPES: AgentStepType[] = ["research", "analysis", "briefing", "draft", "review", "custom"];

const TOOLBOX_NODE_TYPES: Array<{ type: AgentStepType; label: string }> = [
  { type: "research", label: "Research" },
  { type: "analysis", label: "Analysis" },
  { type: "briefing", label: "Briefing-Creator" },
  { type: "draft", label: "Conent-Creator" },
  { type: "review", label: "Reviewer" },
  { type: "custom", label: "Custom" },
];

const NODE_STYLE_BY_TYPE: Record<AgentStepType, { color: string; glow: string; icon: "trigger" | "agent" | "tool" }> = {
  orchestrator: { color: "#8B5CF6", glow: "rgba(139,92,246,0.35)", icon: "trigger" },
  research: { color: "#3B82F6", glow: "rgba(59,130,246,0.35)", icon: "agent" },
  analysis: { color: "#2563EB", glow: "rgba(37,99,235,0.35)", icon: "agent" },
  briefing: { color: "#14B8A6", glow: "rgba(20,184,166,0.35)", icon: "tool" },
  draft: { color: "#F59E0B", glow: "rgba(245,158,11,0.35)", icon: "trigger" },
  review: { color: "#22C55E", glow: "rgba(34,197,94,0.35)", icon: "tool" },
  custom: { color: "#6366F1", glow: "rgba(99,102,241,0.35)", icon: "agent" },
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "success") return "default";
  if (status === "failed") return "destructive";
  if (status === "running") return "outline";
  return "secondary";
}

function AgentNodeCard({ data, selected }: NodeProps<Node<AgentNodeData>>) {
  const style = NODE_STYLE_BY_TYPE[data.type];
  const statusColor =
    data.status === "success"
      ? "#22C55E"
      : data.status === "failed"
        ? "#EF4444"
        : data.status === "running"
          ? "#F59E0B"
          : "#94A3B8";

  return (
    <div
      className="rounded-2xl border border-white/10 bg-[#111828]/95 backdrop-blur-sm min-w-[240px] p-3 text-white shadow-2xl"
      style={{
        boxShadow: selected ? `0 0 0 1px ${style.color}, 0 0 24px ${style.glow}` : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-300 !border-[#0f172a] !w-2.5 !h-2.5" />
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${style.color}33` }}>
            {data.icon === "trigger" ? (
              <Wand2 className="h-4 w-4" style={{ color: style.color }} />
            ) : data.icon === "tool" ? (
              <SquareTerminal className="h-4 w-4" style={{ color: style.color }} />
            ) : (
              <Brain className="h-4 w-4" style={{ color: style.color }} />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">{data.label}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">{data.type}</div>
          </div>
        </div>
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColor }} />
      </div>

      {data.isParent && (
        <div className="mb-2 inline-flex rounded-md border border-violet-400/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
          Parent Agent
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-slate-300">
        <div className="font-semibold text-slate-200">Last Output</div>
        <div className="truncate">{data.outputPreview || "Noch kein Run"}</div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-300 !border-[#0f172a] !w-2.5 !h-2.5" />
    </div>
  );
}

type BezierDataEdge = Edge<{ label?: string; streaming?: boolean }>;

function StreamingBezierEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data }: any) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const isStreaming = Boolean(data?.streaming);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={isStreaming ? "agentic-edge-streaming" : "agentic-edge"}
      />
      <EdgeLabelRenderer>
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex items-center gap-1 rounded bg-[#0f172a] border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-200"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          <span>{data?.label || "message"}</span>
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-white/10"
            onClick={(event) => {
              event.stopPropagation();
              setEdges((prev) => prev.filter((edge) => edge.id !== id));
            }}
            aria-label="Verbindung löschen"
            title="Verbindung löschen"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = {
  agentNode: AgentNodeCard,
};

const edgeTypes = {
  streamingBezier: StreamingBezierEdge,
};

function NodePalette() {
  const handleDragStart = (event: React.DragEvent, type: AgentStepType) => {
    event.dataTransfer.setData("application/agent-node-type", type);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <Card className="border-white/10 bg-[#0b1220]/80 text-slate-100">
      <CardHeader>
        <CardTitle className="text-base">Toolbox</CardTitle>
        <CardDescription className="text-slate-400">Neue Agenten-Nodes hinzufügen</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {TOOLBOX_NODE_TYPES.map((entry) => (
          <Button
            key={entry.type}
            draggable
            onDragStart={(event) => handleDragStart(event, entry.type)}
            variant="outline"
            className="w-full justify-start border-white/15 bg-transparent text-slate-100 hover:bg-white/10"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("agent-builder:add-node", { detail: { type: entry.type } }));
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {entry.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onNodeContextMenu,
  onCanvasInteraction,
  onDropNode,
  onAddNodeInView,
  onSelectionChangeEdges,
}: {
  nodes: Node<AgentNodeData>[];
  edges: BezierDataEdge[];
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: (connection: Connection) => void;
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string, position: { x: number; y: number }) => void;
  onCanvasInteraction: () => void;
  onDropNode: (type: AgentStepType, position: { x: number; y: number }) => void;
  onAddNodeInView: (type: AgentStepType, position: { x: number; y: number }) => void;
  onSelectionChangeEdges: (edgeIds: string[]) => void;
}) {
  const reactFlowInstance = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const getVisibleCenter = useCallback(() => {
    if (!wrapperRef.current) {
      return reactFlowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
    const bounds = wrapperRef.current.getBoundingClientRect();
    return reactFlowInstance.screenToFlowPosition({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    });
  }, [reactFlowInstance]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/agent-node-type") as AgentStepType;
      if (!type || !wrapperRef.current) return;

      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      onDropNode(type, position);
    },
    [onDropNode, reactFlowInstance]
  );

  useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{ type: AgentStepType }>;
      const type = customEvent?.detail?.type;
      if (!type) return;
      const center = getVisibleCenter();
      onAddNodeInView(type, center);
    };

    window.addEventListener("agent-builder:add-node", listener as EventListener);
    return () => window.removeEventListener("agent-builder:add-node", listener as EventListener);
  }, [getVisibleCenter, onAddNodeInView]);

  return (
    <div ref={wrapperRef} className="h-[72vh] rounded-2xl border border-white/10 bg-[#0a101d] overflow-hidden" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          onNodeContextMenu(node.id, { x: event.clientX, y: event.clientY });
        }}
        onPaneClick={onCanvasInteraction}
        onSelectionChange={({ edges: selectedEdges }) => onSelectionChangeEdges(selectedEdges.map((edge) => edge.id))}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        connectionLineStyle={{ stroke: "#60a5fa", strokeWidth: 2 }}
      >
        <MiniMap pannable zoomable nodeColor={() => "#1e293b"} className="!bg-[#0f172a] !border !border-white/10" />
        <Controls className="!bg-[#0f172a] !border !border-white/10 !text-slate-200" />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="rgba(148,163,184,0.35)" />
      </ReactFlow>
    </div>
  );
}

function DataMappingBuilder({
  outputSchema,
  inputMappings,
  onAssign,
}: {
  outputSchema: string[];
  inputMappings: Array<{ key: string; value: string }>;
  onAssign: (inputKey: string, value: string) => void;
}) {
  const onDragStart = (event: React.DragEvent, pill: string) => {
    event.dataTransfer.setData("application/mapping-pill", pill);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-300">Output Schema</div>
        <div className="space-y-1.5">
          {outputSchema.map((pill) => (
            <button
              key={pill}
              draggable
              onDragStart={(event) => onDragStart(event, pill)}
              className="w-full rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-left text-[11px] text-blue-100 cursor-grab active:cursor-grabbing"
            >
              {pill}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-300">Input Mapping</div>
        <div className="space-y-1.5">
          {inputMappings.map((mapping) => (
            <div
              key={mapping.key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const pill = event.dataTransfer.getData("application/mapping-pill");
                if (!pill) return;
                onAssign(mapping.key, pill);
              }}
              className="rounded-md border border-white/15 bg-black/20 px-2 py-1.5 text-[11px] text-slate-200"
            >
              <div className="font-semibold text-[10px] uppercase tracking-wider text-slate-400">{mapping.key}</div>
              <div className="mt-0.5">{mapping.value || "Drop value here"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
  const [activeFlowTab, setActiveFlowTab] = useState<FlowMode>("default");

  const [runStateByNode, setRunStateByNode] = useState<Record<string, RunState>>({});
  const [outputPreviewByNode, setOutputPreviewByNode] = useState<Record<string, string>>({});

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);

  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runSteps, setRunSteps] = useState<RunStep[]>([]);
  const [runMessages, setRunMessages] = useState<RunMessage[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AgentNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BezierDataEdge>([]);

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

  const sanitizeParentNode = () => {
    const parentNodes = nodes.filter((node) => node.data.isParent || node.data.type === "orchestrator");
    if (parentNodes.length === 0) {
      const id = crypto.randomUUID();
      const orchestratorNode: Node<AgentNodeData> = {
        id,
        type: "agentNode",
        position: { x: 80, y: 80 },
        data: {
          label: "Parent Agent (Orchestrator)",
          type: "orchestrator",
          status: "idle",
          outputPreview: "Noch kein Run",
          provider: "openrouter",
          icon: NODE_STYLE_BY_TYPE.orchestrator.icon,
          isParent: true,
          instruction: "Orchestriere die nachgelagerten Agenten, strukturiere den Kontext und delegiere Aufgaben entlang des Flows.",
          model: "openai/gpt-4o-mini",
          timeoutMs: 45000,
          retries: 1,
          enabled: true,
        } as any,
      };
      setNodes((prev) => [orchestratorNode, ...prev]);
      return;
    }

    if (parentNodes.length > 1) {
      const firstParentId = parentNodes[0].id;
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id === firstParentId) {
            return {
              ...node,
              data: {
                ...node.data,
                type: "orchestrator",
                isParent: true,
                icon: NODE_STYLE_BY_TYPE.orchestrator.icon,
              } as any,
            };
          }

          if (node.data.isParent || node.data.type === "orchestrator") {
            return {
              ...node,
              data: {
                ...node.data,
                type: "research",
                isParent: false,
                icon: NODE_STYLE_BY_TYPE.research.icon,
              } as any,
            };
          }

          return node;
        })
      );
      return;
    }

    const parent = parentNodes[0];
    if (!parent.data.isParent || parent.data.type !== "orchestrator") {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === parent.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  type: "orchestrator",
                  isParent: true,
                  icon: NODE_STYLE_BY_TYPE.orchestrator.icon,
                } as any,
              }
            : node
        )
      );
    }
  };

  const toFlowNodes = (workflowNodes: WorkflowNodeRecord[]): Node<AgentNodeData>[] =>
    workflowNodes
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
          provider: node.config.provider,
          icon: NODE_STYLE_BY_TYPE[node.type].icon,
          isParent: Boolean(node.isParent),
          instruction: node.config.instruction,
          model: node.config.model,
          timeoutMs: node.config.timeoutMs,
          retries: node.config.retries,
          enabled: node.config.enabled,
        } as any,
      }));

  const toFlowEdges = (workflowEdges: WorkflowEdgeRecord[]): BezierDataEdge[] =>
    workflowEdges.map((edge) => {
      const fromRunning = runStateByNode[edge.sourceNodeId] === "running";
      return {
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        type: "streamingBezier",
        animated: fromRunning,
        data: {
          label: edge.channel,
          streaming: fromRunning,
          targetInputKey: edge.targetInputKey,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#60a5fa",
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      };
    });

  const activeWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === activeWorkflowId) || null,
    [workflows, activeWorkflowId]
  );

  const defaultFlowOptions = useMemo(() => workflows.filter((workflow) => workflow.mode === "default"), [workflows]);
  const customFlowOptions = useMemo(() => workflows.filter((workflow) => workflow.mode === "custom"), [workflows]);

  const loadWorkflows = async () => {
    const response = await fetch("/api/agent-workflows-v2");
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Workflows konnten nicht geladen werden");

    const list = (data?.workflows || []) as WorkflowRecord[];
    setWorkflows(list);

    const selectedId = activeWorkflowId && list.some((entry) => entry.id === activeWorkflowId)
      ? activeWorkflowId
      : list[0]?.id || null;
    setActiveWorkflowId(selectedId);

    if (selectedId) {
      const workflow = list.find((entry) => entry.id === selectedId);
      const version = workflow?.draftVersion || workflow?.activeVersion;
      const nodes = version?.nodes || [];
      const edges = version?.edges || [];
      setNodes(toFlowNodes(nodes));
      setEdges(toFlowEdges(edges));
      setSelectedNodeId(nodes[0]?.id || null);

      const selectedWorkflow = list.find((entry) => entry.id === selectedId);
      if (selectedWorkflow?.mode) {
        setActiveFlowTab(selectedWorkflow.mode);
      }
    } else {
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
    }
  };

  const loadRuns = async () => {
    const response = await fetch("/api/agent-workflows-v2/runs?limit=50");
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Runs konnten nicht geladen werden");
    setRuns(data?.runs || []);
  };

  const loadRunDetails = async (runId: string) => {
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
    setRunMessages(messageData?.messages || []);

    const nextStatus: Record<string, RunState> = {};
    const nextPreview: Record<string, string> = {};
    steps.forEach((step) => {
      nextStatus[step.nodeId] =
        step.status === "success"
          ? "success"
          : step.status === "failed"
            ? "failed"
            : step.status === "running"
              ? "running"
              : "idle";
      const raw = step.output ? JSON.stringify(step.output).slice(0, 90) : "";
      nextPreview[step.nodeId] = raw || (step.error ? `Error: ${step.error}` : "-");
    });

    setRunStateByNode(nextStatus);
    setOutputPreviewByNode(nextPreview);
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
    if (!loading) {
      sanitizeParentNode();
    }
  }, [loading, nodes.length]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (selectedEdgeIds.length === 0) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      setEdges((prev) => prev.filter((edge) => !selectedEdgeIds.includes(edge.id)));
      setSelectedEdgeIds([]);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEdgeIds]);

  useEffect(() => {
    if (!activeWorkflowId) return;
    const workflow = workflows.find((entry) => entry.id === activeWorkflowId);
    const version = workflow?.draftVersion || workflow?.activeVersion;
    if (!version) return;
    setNodes(toFlowNodes(version.nodes || []));
    setEdges(toFlowEdges(version.edges || []));
    setSelectedNodeId(version.nodes?.[0]?.id || null);
  }, [activeWorkflowId, workflows]);

  const buildEdgeRecord = (connection: Connection): WorkflowEdgeRecord | null => {
    if (!connection.source || !connection.target) return null;
    const sourceNode = nodeRecordMap.get(connection.source);
    const targetNode = nodeRecordMap.get(connection.target);
    if (!sourceNode || !targetNode) return null;
    return {
      id: crypto.randomUUID(),
      sourceNodeId: connection.source,
      targetNodeId: connection.target,
      channel: `${sourceNode.type}.output`,
      targetInputKey: `${targetNode.type}Input`,
    };
  };

  const onConnect = useCallback(
    (connection: Connection) => {
      const edgeRecord = buildEdgeRecord(connection);
      if (!edgeRecord) return;
      const flowEdge = toFlowEdges([edgeRecord])[0];
      setEdges((eds) => addEdge(flowEdge, eds));
    },
    [nodeRecordMap]
  );

  const addNode = (type: AgentStepType, position?: { x: number; y: number }) => {
    const id = crypto.randomUUID();
    const style = NODE_STYLE_BY_TYPE[type];
    const defaultPosition = {
      x: position?.x ?? 320,
      y: position?.y ?? 180 + nodes.length * 160,
    };

    const newNode: Node<AgentNodeData> = {
      id,
      type: "agentNode",
      position: defaultPosition,
      data: {
        label: `${type} agent ${nodes.length + 1}`,
        type,
        status: "idle",
        outputPreview: "Noch kein Run",
        provider: "openrouter",
        icon: style.icon,
        isParent: false,
        instruction: "Beschreiben Sie die Aufgabe dieses Agenten.",
        model: "openai/gpt-4o-mini",
        timeoutMs: 45000,
        retries: 1,
        enabled: true,
      } as any,
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(id);
    setDrawerOpen(true);
  };

  const removeNode = (nodeId: string) => {
    const target = nodes.find((node) => node.id === nodeId);
    if (target?.data.isParent) {
      setError("Der Parent Agent kann nicht gelöscht werden.");
      return;
    }
    setNodes((prev) => prev.filter((node) => node.id !== nodeId));
    setEdges((prev) => prev.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
      setDrawerOpen(false);
    }
  };

  const updateSelectedNode = (patcher: (node: Node<AgentNodeData>) => Node<AgentNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.map((node) => (node.id === selectedNodeId ? patcher(node) : node)));
  };

  const duplicateNode = (nodeId: string) => {
    const source = nodes.find((node) => node.id === nodeId);
    if (!source) return;
    const id = crypto.randomUUID();
    const clone: Node<AgentNodeData> = {
      ...source,
      id,
      position: {
        x: source.position.x + 80,
        y: source.position.y + 50,
      },
      data: {
        ...source.data,
        label: `${source.data.label} Copy`,
        isParent: false,
      },
    };
    setNodes((prev) => [...prev, clone]);
    setSelectedNodeId(id);
    setDrawerOpen(true);
  };

  const renameNode = (nodeId: string) => {
    const source = nodes.find((node) => node.id === nodeId);
    if (!source) return;
    const renamed = window.prompt("Neuer Node-Name", source.data.label);
    if (!renamed || !renamed.trim()) return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: { ...node.data, label: renamed.trim() },
            }
          : node
      )
    );
  };

  const saveWorkflow = async () => {
    if (!activeWorkflow) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payloadNodes = nodes.map((node, index) => ({
        id: node.id,
        name: node.data.label,
        type: node.data.type,
        position: index,
        x: node.position.x,
        y: node.position.y,
        isParent: Boolean(node.data.isParent),
        config: {
          instruction: (node.data as any).instruction || "",
          provider: node.data.provider,
          model: (node.data as any).model || "openai/gpt-4o-mini",
          timeoutMs: Number((node.data as any).timeoutMs || 45000),
          retries: Number((node.data as any).retries || 1),
          enabled: Boolean((node.data as any).enabled ?? true),
        },
      }));

      const payloadEdges = edges.map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        channel: String(edge.data?.label || "message"),
        targetInputKey: String((edge.data as any)?.targetInputKey || "input"),
      }));

      const response = await fetch(`/api/agent-workflows-v2/${activeWorkflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: payloadNodes,
          edges: payloadEdges,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Workflow konnte nicht gespeichert werden");

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
      const response = await fetch(`/api/agent-workflows-v2/${activeWorkflow.id}/publish`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Workflow konnte nicht publiziert werden");
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

      const pendingStatus: Record<string, RunState> = {};
      nodes.forEach((node) => {
        pendingStatus[node.id] = "running";
      });
      setRunStateByNode(pendingStatus);

      const response = await fetch(`/api/agent-workflows-v2/${activeWorkflow.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          input: {
            workflowName: activeWorkflow.name,
            source: "content-agent-builder-canvas",
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Run fehlgeschlagen");

      setSuccess("Workflow erfolgreich ausgeführt.");
      await loadRuns();
      if (data?.run?.id) {
        await loadRunDetails(data.run.id);
      }
    } catch (err: any) {
      setError(err.message || "Run fehlgeschlagen");
      setRunStateByNode({});
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
    <ReactFlowProvider>
      <div className="space-y-6 text-slate-100">
        <Tabs value={activeFlowTab} onValueChange={(value) => {
          const next = (value as FlowMode) || "default";
          setActiveFlowTab(next);
          const options = next === "default" ? defaultFlowOptions : customFlowOptions;
          if (options.length > 0) {
            setActiveWorkflowId(options[0].id);
          } else {
            setActiveWorkflowId(null);
          }
        }}>
          <TabsList className="bg-primary/10 border-primary/10">
            <TabsTrigger value="default" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Calendar className="mr-2 h-4 w-4" />
              Default Flow
            </TabsTrigger>
            <TabsTrigger value="custom" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Sparkles className="mr-2 h-4 w-4" />
              Custom Flow
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

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            <NodePalette />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Run Controls</CardTitle>
                <CardDescription>Save, Publish, Execute</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button onClick={saveWorkflow} disabled={!activeWorkflow || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Speichern
                </Button>
                <Button variant="outline" onClick={publishWorkflow} disabled={!activeWorkflow || publishing}>
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4 mr-2" />}
                  Publizieren
                </Button>
                <Button variant="secondary" onClick={runWorkflow} disabled={!activeWorkflow || running}>
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Run starten
                </Button>
              </CardContent>
            </Card>
          </div>

          <FlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(nodeId) => {
              setSelectedNodeId(nodeId);
              setDrawerOpen(true);
            }}
            onNodeContextMenu={(nodeId, position) => {
              setSelectedNodeId(nodeId);
              setContextMenu({ nodeId, ...position });
            }}
            onCanvasInteraction={() => setContextMenu(null)}
            onDropNode={addNode}
            onAddNodeInView={addNode}
            onSelectionChangeEdges={setSelectedEdgeIds}
          />
        </div>

        {contextMenu && (
          <div
            className="fixed z-[120] min-w-[200px] rounded-lg border border-white/15 bg-[#0f172a] shadow-2xl p-1"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-100 hover:bg-white/10"
              onClick={() => {
                duplicateNode(contextMenu.nodeId);
                setContextMenu(null);
              }}
            >
              <Copy className="h-4 w-4" />
              Duplizieren
            </button>
            <button
              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-100 hover:bg-white/10"
              onClick={() => {
                renameNode(contextMenu.nodeId);
                setContextMenu(null);
              }}
            >
              <Pencil className="h-4 w-4" />
              Umbenennen
            </button>
            <button
              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-red-200 hover:bg-red-500/15"
              onClick={() => {
                removeNode(contextMenu.nodeId);
                setContextMenu(null);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Löschen
            </button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Executions</CardTitle>
              <CardDescription>Runs und Node Outputs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {runs.length === 0 ? (
                <p className="text-sm text-slate-400">Keine Runs vorhanden.</p>
              ) : (
                runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => loadRunDetails(run.id)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      selectedRunId === run.id ? "border-blue-400/70 bg-blue-500/10" : "border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Run {run.id.slice(0, 8)}</span>
                      <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Start: {new Date(run.startedAt).toLocaleString("de-DE")} | Dauer: {run.durationMs ? `${run.durationMs} ms` : "-"}
                    </div>
                  </button>
                ))
              )}

              {selectedRunId && (
                <div className="rounded-md border border-white/10 p-3 space-y-2">
                  <h4 className="text-sm font-semibold">Node Outputs (Preview)</h4>
                  {runSteps.length === 0 ? (
                    <p className="text-xs text-slate-400">Keine Step-Daten vorhanden.</p>
                  ) : (
                    runSteps.map((step) => (
                      <div key={step.id} className="rounded border border-white/10 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{step.nodeName}</span>
                          <Badge variant={statusVariant(step.status)}>{step.status}</Badge>
                        </div>
                        <div className="text-xs text-slate-400">{step.nodeType} | {step.provider} / {step.model}</div>
                        <div className="mt-1 rounded bg-black/30 border border-white/10 px-2 py-1 text-[11px] font-mono text-slate-300 overflow-x-auto">
                          {step.output ? JSON.stringify(step.output, null, 2) : step.error || "-"}
                        </div>
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
                Agent-to-Agent Messages
              </CardTitle>
              <CardDescription>Datenfluss zwischen Nodes pro Run</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!selectedRunId ? (
                <p className="text-sm text-slate-400">Wähle einen Run, um Messages zu sehen.</p>
              ) : runMessages.length === 0 ? (
                <p className="text-sm text-slate-400">Keine Messages für diesen Run.</p>
              ) : (
                runMessages.map((message) => (
                  <div key={message.id} className="rounded border border-white/10 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium flex items-center gap-1">
                        <Send className="h-3.5 w-3.5" />
                        {message.fromNodeName} → {message.toNodeName}
                      </span>
                      <Badge variant="outline">{message.channel}</Badge>
                    </div>
                    <div className="text-xs text-slate-400">
                      targetInput: <span className="font-mono">{message.targetInputKey}</span>
                    </div>
                    <div className="text-xs text-slate-400">{new Date(message.createdAt).toLocaleString("de-DE")}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="sm:max-w-[480px] bg-[#0b1220] text-slate-100 border-white/10">
            <SheetHeader>
              <SheetTitle>Node Konfiguration</SheetTitle>
              <SheetDescription className="text-slate-400">Inputs, Provider, Prompt, Mapping</SheetDescription>
            </SheetHeader>

            {!selectedNodeRecord ? (
              <div className="px-4 pb-4 text-sm text-slate-400">Kein Node selektiert.</div>
            ) : (
              <div className="px-4 pb-4 space-y-4 overflow-y-auto">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={selectedNodeRecord.name}
                    onChange={(event) =>
                      updateSelectedNode((node) => ({
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
                          updateSelectedNode((node) => ({
                            ...node,
                            data: {
                              ...node.data,
                              type: value as AgentStepType,
                              icon: NODE_STYLE_BY_TYPE[value as AgentStepType].icon,
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="bg-[#0f172a] border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STEP_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={selectedNodeRecord.config.provider}
                      onValueChange={(value) =>
                        updateSelectedNode((node) => ({
                          ...node,
                          data: { ...node.data, provider: value as AgentProvider },
                        }))
                      }
                    >
                      <SelectTrigger className="bg-[#0f172a] border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="vertex_legal">Vertex Legal Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedNodeRecord.isParent && (
                  <Alert>
                    <AlertTitle>Parent Agent</AlertTitle>
                    <AlertDescription>
                      Dieser Node ist der Startpunkt (Orchestrator) des Flows und kann nicht gelöscht werden.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    value={selectedNodeRecord.config.model}
                    onChange={(event) =>
                      updateSelectedNode((node) => ({
                        ...node,
                        data: { ...node.data, model: event.target.value } as any,
                      }))
                    }
                    className="bg-[#0f172a] border-white/10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Timeout (ms)</Label>
                    <Input
                      type="number"
                      value={selectedNodeRecord.config.timeoutMs}
                      onChange={(event) =>
                        updateSelectedNode((node) => ({
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
                        updateSelectedNode((node) => ({
                          ...node,
                          data: { ...node.data, retries: Number(event.target.value || 0) } as any,
                        }))
                      }
                      className="bg-[#0f172a] border-white/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Prompt / Instruction</Label>
                  <textarea
                    value={selectedNodeRecord.config.instruction}
                    onChange={(event) =>
                      updateSelectedNode((node) => ({
                        ...node,
                        data: { ...node.data, instruction: event.target.value } as any,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-sm min-h-28"
                  />
                </div>

                <Separator className="bg-white/10" />

                <div className="space-y-2">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <CircleDot className="h-4 w-4" />
                    Data Mapping (Drag-and-Drop Simulation)
                  </div>
                  <DataMappingBuilder
                    outputSchema={outputSchemaPills}
                    inputMappings={inputMappingState}
                    onAssign={(inputKey, value) => {
                      updateSelectedNode((node) => ({
                        ...node,
                        data: {
                          ...node.data,
                          instruction: `${(node.data as any).instruction || ""}\nMapping: ${inputKey} <- ${value}`,
                        } as any,
                      }));
                    }}
                  />
                </div>

                <Button variant="outline" className="border-red-500/40 text-red-200 hover:bg-red-500/10" onClick={() => removeNode(selectedNodeRecord.id)}>
                  Node entfernen
                </Button>
                {selectedNodeRecord.config.provider === "vertex_legal" && (
                  <Alert>
                    <AlertTitle>Vertex Legal Agent aktiv</AlertTitle>
                    <AlertDescription>
                      Dieser Node nutzt den externen Vertex AI Endpoint. Bitte Konfiguration im Integrations-Tab prüfen.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </ReactFlowProvider>
  );
}

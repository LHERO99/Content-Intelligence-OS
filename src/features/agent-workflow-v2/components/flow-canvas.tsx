"use client";

import { useCallback, useEffect, useRef } from "react";
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
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { Brain, SquareTerminal, Wand2, X } from "lucide-react";
import { AgentNodeData, AgentStepType, NODE_STYLE_BY_TYPE } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BezierDataEdge = Edge<{ label?: string; streaming?: boolean }>;

// ─── AgentNodeCard ────────────────────────────────────────────────────────────

export function AgentNodeCard({ data, selected }: NodeProps<Node<AgentNodeData>>) {
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
        <div className="flex items-center gap-2">
          {typeof data.executionOrder === "number" && (
            <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full border border-blue-300/60 bg-blue-500/20 px-1 text-[10px] font-semibold text-blue-100">
              {data.executionOrder}
            </span>
          )}
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColor }} />
        </div>
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

// ─── StreamingBezierEdge ──────────────────────────────────────────────────────

export function StreamingBezierEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data }: any) {
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

// ─── nodeTypes / edgeTypes ────────────────────────────────────────────────────

export const nodeTypes = {
  agentNode: AgentNodeCard,
};

export const edgeTypes = {
  streamingBezier: StreamingBezierEdge,
};

// ─── FlowCanvas ───────────────────────────────────────────────────────────────

export function FlowCanvas({
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
    <div ref={wrapperRef} className="h-[calc(100vh-220px)] rounded-2xl border border-white/10 bg-[#0a101d] overflow-hidden" onDragOver={onDragOver} onDrop={onDrop}>
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

// ─── Domain types for Agent Workflow V2 ──────────────────────────────────────

export type AgentStepType = "orchestrator" | "research" | "analysis" | "briefing" | "draft" | "review" | "custom";
export type AgentProvider = "openai" | "openrouter" | "gemini" | "vertex_legal";
export type RunState = "idle" | "running" | "success" | "failed";
export type FlowMode = "default" | "custom";
export type ExecutionView = "executions" | "timeline" | "messages";

export type DiscoveredModel = {
  id: string;
  label: string;
  contextWindow?: number;
};

export type WorkflowNodeRecord = {
  id: string;
  name: string;
  type: AgentStepType;
  position: number;
  x: number;
  y: number;
  isParent?: boolean;
  config: {
    instruction: string;
    purpose: string;
    inputContract: string;
    outputContract: string;
    provider: AgentProvider;
    model: string;
    timeoutMs: number;
    retries: number;
    enabled: boolean;
  };
};

export type WorkflowEdgeRecord = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  channel: string;
  targetInputKey: string;
};

export type WorkflowVersion = {
  id: string;
  nodes: WorkflowNodeRecord[];
  edges: WorkflowEdgeRecord[];
};

export type WorkflowRecord = {
  id: string;
  name: string;
  description?: string;
  mode: "default" | "custom";
  state: "draft" | "published" | "archived";
  draftVersion?: WorkflowVersion;
  activeVersion?: WorkflowVersion;
};

export type RunRecord = {
  id: string;
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  deletedAt?: string;
  workflowId?: string;
  input?: Record<string, unknown>;
  /** Final HTML produced by the agent run — populated after success */
  finalHtml?: string;
};

export type RunStep = {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: AgentStepType;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  round?: number;
  phase?: "orchestrator_decision" | "subagent_execution";
  correlationId?: string;
  provider: AgentProvider;
  model: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
};

export type RunMessage = {
  id: string;
  fromNodeId: string;
  fromNodeName: string;
  toNodeId: string;
  toNodeName: string;
  channel: string;
  messageType?: "task_request" | "task_result" | "control";
  correlationId?: string;
  round?: number;
  targetInputKey: string;
  payload?: Record<string, unknown>;
  createdAt: string;
};

export type AgentNodeData = {
  label: string;
  type: AgentStepType;
  status: RunState;
  outputPreview?: string;
  provider: AgentProvider;
  icon: "trigger" | "agent" | "tool";
  isParent?: boolean;
  isFocused?: boolean;
  executionOrder?: number;
  /** Current orchestrator round — set when the node's step is running */
  currentRound?: number;
  purpose?: string;
  inputContract?: string;
  outputContract?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const STEP_TYPES: AgentStepType[] = ["research", "analysis", "briefing", "draft", "review", "custom"];

export const TOOLBOX_NODE_TYPES: Array<{ type: AgentStepType; label: string }> = [
  { type: "research", label: "Research" },
  { type: "analysis", label: "Analysis" },
  { type: "briefing", label: "Briefing-Creator" },
  { type: "draft", label: "Conent-Creator" },
  { type: "review", label: "Reviewer" },
  { type: "custom", label: "Custom" },
];

export const NODE_STYLE_BY_TYPE: Record<AgentStepType, { color: string; glow: string; icon: "trigger" | "agent" | "tool" }> = {
  orchestrator: { color: "#8B5CF6", glow: "rgba(139,92,246,0.35)", icon: "trigger" },
  research: { color: "#3B82F6", glow: "rgba(59,130,246,0.35)", icon: "agent" },
  analysis: { color: "#2563EB", glow: "rgba(37,99,235,0.35)", icon: "agent" },
  briefing: { color: "#14B8A6", glow: "rgba(20,184,166,0.35)", icon: "tool" },
  draft: { color: "#F59E0B", glow: "rgba(245,158,11,0.35)", icon: "trigger" },
  review: { color: "#22C55E", glow: "rgba(34,197,94,0.35)", icon: "tool" },
  custom: { color: "#6366F1", glow: "rgba(99,102,241,0.35)", icon: "agent" },
};

export function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "success") return "default";
  if (status === "failed") return "destructive";
  if (status === "running") return "outline";
  return "secondary";
}

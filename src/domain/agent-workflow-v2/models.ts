export type TenantId = string;

export type WorkflowMode = 'default' | 'custom';
export type WorkflowState = 'draft' | 'published' | 'archived';

export type AgentStepType = 'orchestrator' | 'research' | 'analysis' | 'briefing' | 'draft' | 'review' | 'custom';
export type AgentProvider = 'openai' | 'openrouter' | 'gemini' | 'vertex_legal';

export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface WorkflowNodeConfig {
  instruction: string;
  purpose: string;
  inputContract: string;
  outputContract: string;
  provider: AgentProvider;
  model: string;
  timeoutMs: number;
  retries: number;
  enabled: boolean;
  /** Max orchestrator rounds for the run. Only used on the orchestrator node. Default: 20 */
  maxRounds?: number;
}

export interface WorkflowNodeV2 {
  id: string;
  tenantId: TenantId;
  workflowVersionId: string;
  name: string;
  type: AgentStepType;
  position: number;
  x: number;
  y: number;
  isParent?: boolean;
  config: WorkflowNodeConfig;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEdgeV2 {
  id: string;
  tenantId: TenantId;
  workflowVersionId: string;
  sourceNodeId: string;
  targetNodeId: string;
  channel: string;
  targetInputKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersionV2 {
  id: string;
  tenantId: TenantId;
  workflowId: string;
  version: number;
  isPublished: boolean;
  nodes: WorkflowNodeV2[];
  edges: WorkflowEdgeV2[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowV2 {
  id: string;
  tenantId: TenantId;
  name: string;
  description?: string;
  mode: WorkflowMode;
  state: WorkflowState;
  draftVersionId: string;
  activeVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowWithVersionsV2 extends WorkflowV2 {
  draftVersion?: WorkflowVersionV2;
  activeVersion?: WorkflowVersionV2;
}

export interface WorkflowRunV2 {
  id: string;
  tenantId: TenantId;
  workflowId: string;
  workflowVersionId: string;
  trigger: 'manual';
  status: RunStatus;
  idempotencyKey: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  /** The final rendered HTML output — stored in its own column for easy access */
  finalHtml?: string;
  /** When true the running loop will stop after the current LLM call completes */
  cancelRequested?: boolean;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRunStepV2 {
  id: string;
  tenantId: TenantId;
  runId: string;
  nodeId: string;
  nodeName: string;
  nodeType: AgentStepType;
  provider: AgentProvider;
  model: string;
  attempt: number;
  status: StepStatus;
  round?: number;
  phase?: 'orchestrator_decision' | 'subagent_execution';
  correlationId?: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowMessageV2 {
  id: string;
  tenantId: TenantId;
  runId: string;
  fromNodeId: string;
  fromNodeName: string;
  toNodeId: string;
  toNodeName: string;
  channel: string;
  messageType?: 'task_request' | 'task_result' | 'control';
  correlationId?: string;
  round?: number;
  targetInputKey: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowRunWithDetailsV2 extends WorkflowRunV2 {
  steps: WorkflowRunStepV2[];
  messages: WorkflowMessageV2[];
}

export interface CreateWorkflowInputV2 {
  tenantId: TenantId;
  name: string;
  description?: string;
  mode: WorkflowMode;
}

export interface UpdateWorkflowInputV2 {
  name?: string;
  description?: string;
  state?: WorkflowState;
  nodes?: Array<{
    id: string;
    name: string;
    type: AgentStepType;
    position: number;
    x: number;
    y: number;
    isParent?: boolean;
    config: WorkflowNodeConfig;
  }>;
  edges?: Array<{
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    channel: string;
    targetInputKey: string;
  }>;
}

export interface RunWorkflowInputV2 {
  input?: Record<string, unknown>;
  idempotencyKey?: string;
  runFrom?: 'draft' | 'published';
}

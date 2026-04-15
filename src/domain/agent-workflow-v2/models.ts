export type TenantId = string;

export type WorkflowMode = 'default' | 'custom';
export type WorkflowState = 'draft' | 'published' | 'archived';

export type AgentStepType = 'orchestrator' | 'research' | 'analysis' | 'briefing' | 'draft' | 'review' | 'custom';
export type AgentProvider = 'openai' | 'openrouter' | 'gemini' | 'vertex_legal';

export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface WorkflowNodeConfig {
  instruction: string;
  provider: AgentProvider;
  model: string;
  timeoutMs: number;
  retries: number;
  enabled: boolean;
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
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
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
}

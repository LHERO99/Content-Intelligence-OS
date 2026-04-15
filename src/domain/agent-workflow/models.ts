export type TenantId = string;

export type WorkflowMode = 'default' | 'custom';
export type WorkflowState = 'draft' | 'published' | 'archived';

export type AgentStepType = 'research' | 'analysis' | 'briefing' | 'draft' | 'review';
export type AgentProvider = 'openrouter' | 'gemini';

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

export interface WorkflowNode {
  id: string;
  tenantId: TenantId;
  workflowVersionId: string;
  name: string;
  type: AgentStepType;
  position: number;
  config: WorkflowNodeConfig;
  sourceRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEdge {
  id: string;
  tenantId: TenantId;
  workflowVersionId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersion {
  id: string;
  tenantId: TenantId;
  workflowId: string;
  version: number;
  isPublished: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  sourceRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workflow {
  id: string;
  tenantId: TenantId;
  name: string;
  description?: string;
  mode: WorkflowMode;
  state: WorkflowState;
  draftVersionId: string;
  activeVersionId?: string;
  sourceRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowWithVersions extends Workflow {
  draftVersion?: WorkflowVersion;
  activeVersion?: WorkflowVersion;
}

export interface WorkflowRun {
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
  sourceRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRunStep {
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
  sourceRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRunWithSteps extends WorkflowRun {
  steps: WorkflowRunStep[];
}

export interface CreateWorkflowInput {
  tenantId: TenantId;
  name: string;
  description?: string;
  mode: WorkflowMode;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  nodes?: Array<{
    id: string;
    name: string;
    type: AgentStepType;
    position: number;
    config: WorkflowNodeConfig;
  }>;
  edges?: Array<{
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
  }>;
}

export interface RunWorkflowInput {
  input?: Record<string, unknown>;
  idempotencyKey?: string;
}

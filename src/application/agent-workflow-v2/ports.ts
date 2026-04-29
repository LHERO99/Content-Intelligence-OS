import {
  CreateWorkflowInputV2,
  RunWorkflowInputV2,
  UpdateWorkflowInputV2,
  WorkflowMessageV2,
  WorkflowRunStepV2,
  WorkflowRunV2,
  WorkflowRunWithDetailsV2,
  WorkflowWithVersionsV2,
} from '@/domain/agent-workflow-v2/models';

export interface WorkflowRepositoryV2 {
  list(tenantId: string): Promise<WorkflowWithVersionsV2[]>;
  getById(tenantId: string, workflowId: string): Promise<WorkflowWithVersionsV2 | null>;
  create(input: CreateWorkflowInputV2): Promise<WorkflowWithVersionsV2>;
  update(tenantId: string, workflowId: string, input: UpdateWorkflowInputV2): Promise<WorkflowWithVersionsV2>;
  publish(tenantId: string, workflowId: string): Promise<WorkflowWithVersionsV2>;
}

export interface WorkflowRunRepositoryV2 {
  createRun(run: WorkflowRunV2): Promise<WorkflowRunV2>;
  updateRun(runId: string, updates: Partial<WorkflowRunV2>): Promise<void>;
  createRunStep(step: WorkflowRunStepV2): Promise<WorkflowRunStepV2>;
  updateRunStep(stepId: string, updates: Partial<WorkflowRunStepV2>): Promise<void>;
  createMessage(message: WorkflowMessageV2): Promise<WorkflowMessageV2>;
  listRuns(tenantId: string, limit?: number, includeDeleted?: boolean): Promise<WorkflowRunV2[]>;
  getRunWithDetails(tenantId: string, runId: string): Promise<WorkflowRunWithDetailsV2 | null>;
  getRunMessages(tenantId: string, runId: string): Promise<WorkflowMessageV2[]>;
  findByIdempotencyKey(tenantId: string, workflowVersionId: string, idempotencyKey: string): Promise<WorkflowRunV2 | null>;
  cancelRun(tenantId: string, runId: string): Promise<WorkflowRunV2 | null>;
  softDeleteRun(tenantId: string, runId: string): Promise<WorkflowRunV2 | null>;
  restoreRun(tenantId: string, runId: string): Promise<WorkflowRunV2 | null>;
}

export interface IntegrationSecretProviderV2 {
  getOpenAIApiKey(): Promise<string | null>;
  getOpenRouterApiKey(): Promise<string | null>;
  getGeminiApiKey(): Promise<string | null>;
  getVertexLegalConfig(): Promise<{ projectId: string; location: string; endpointId: string; accessToken?: string } | null>;
}

export interface AgentModelRunnerV2 {
  runStep(input: {
    provider: 'openai' | 'openrouter' | 'gemini' | 'vertex_legal';
    model: string;
    instruction: string;
    payload: Record<string, unknown>;
    timeoutMs: number;
  }): Promise<Record<string, unknown>>;
}

export interface AgentWorkflowServiceV2 {
  list(tenantId: string): Promise<WorkflowWithVersionsV2[]>;
  create(input: CreateWorkflowInputV2): Promise<WorkflowWithVersionsV2>;
  update(tenantId: string, workflowId: string, input: UpdateWorkflowInputV2): Promise<WorkflowWithVersionsV2>;
  publish(tenantId: string, workflowId: string): Promise<WorkflowWithVersionsV2>;
  run(tenantId: string, workflowId: string, input: RunWorkflowInputV2): Promise<WorkflowRunWithDetailsV2>;
  listRuns(tenantId: string, limit?: number, includeDeleted?: boolean): Promise<WorkflowRunV2[]>;
  getRun(tenantId: string, runId: string): Promise<WorkflowRunWithDetailsV2 | null>;
  getRunMessages(tenantId: string, runId: string): Promise<WorkflowMessageV2[]>;
  cancelRun(tenantId: string, runId: string): Promise<WorkflowRunV2 | null>;
  softDeleteRun(tenantId: string, runId: string): Promise<WorkflowRunV2 | null>;
  restoreRun(tenantId: string, runId: string): Promise<WorkflowRunV2 | null>;
}

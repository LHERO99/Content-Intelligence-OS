import {
  CreateWorkflowInput,
  RunWorkflowInput,
  UpdateWorkflowInput,
  Workflow,
  WorkflowRun,
  WorkflowRunStep,
  WorkflowRunWithSteps,
  WorkflowVersion,
  WorkflowWithVersions,
} from '@/domain/agent-workflow/models';

export interface WorkflowRepository {
  list(tenantId: string): Promise<WorkflowWithVersions[]>;
  getById(tenantId: string, workflowId: string): Promise<WorkflowWithVersions | null>;
  create(input: CreateWorkflowInput): Promise<WorkflowWithVersions>;
  update(tenantId: string, workflowId: string, input: UpdateWorkflowInput): Promise<WorkflowWithVersions>;
  publish(tenantId: string, workflowId: string): Promise<WorkflowWithVersions>;
}

export interface WorkflowRunRepository {
  createRun(run: WorkflowRun): Promise<WorkflowRun>;
  updateRun(runId: string, updates: Partial<WorkflowRun>): Promise<void>;
  createRunStep(step: WorkflowRunStep): Promise<WorkflowRunStep>;
  updateRunStep(stepId: string, updates: Partial<WorkflowRunStep>): Promise<void>;
  listRuns(tenantId: string, limit?: number): Promise<WorkflowRun[]>;
  getRunWithSteps(tenantId: string, runId: string): Promise<WorkflowRunWithSteps | null>;
  findByIdempotencyKey(tenantId: string, workflowVersionId: string, idempotencyKey: string): Promise<WorkflowRun | null>;
}

export interface IntegrationSecretProvider {
  getOpenRouterApiKey(): Promise<string | null>;
  getGeminiApiKey(): Promise<string | null>;
}

export interface AgentModelRunner {
  runStep(input: {
    provider: 'openrouter' | 'gemini';
    model: string;
    instruction: string;
    payload: Record<string, unknown>;
    timeoutMs: number;
  }): Promise<Record<string, unknown>>;
}

export interface WorkflowExecutionResult {
  run: WorkflowRun;
  steps: WorkflowRunStep[];
}

export interface AgentWorkflowService {
  list(tenantId: string): Promise<WorkflowWithVersions[]>;
  create(input: CreateWorkflowInput): Promise<WorkflowWithVersions>;
  update(tenantId: string, workflowId: string, input: UpdateWorkflowInput): Promise<WorkflowWithVersions>;
  publish(tenantId: string, workflowId: string): Promise<WorkflowWithVersions>;
  run(tenantId: string, workflowId: string, input: RunWorkflowInput): Promise<WorkflowExecutionResult>;
  listRuns(tenantId: string, limit?: number): Promise<WorkflowRun[]>;
  getRun(tenantId: string, runId: string): Promise<WorkflowRunWithSteps | null>;
}

export interface WorkflowDefaultsProvider {
  getDefaultWorkflowDefinition(tenantId: string): Promise<{
    workflow: Workflow;
    version: WorkflowVersion;
  }>;
}

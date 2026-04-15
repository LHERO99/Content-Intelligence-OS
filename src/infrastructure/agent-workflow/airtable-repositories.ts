import {
  CreateWorkflowInput,
  UpdateWorkflowInput,
  Workflow,
  WorkflowEdge,
  WorkflowRun,
  WorkflowRunStep,
  WorkflowRunWithSteps,
  WorkflowVersion,
  WorkflowWithVersions,
} from '@/domain/agent-workflow/models';
import { AgentModelRunner, IntegrationSecretProvider, WorkflowRepository, WorkflowRunRepository } from '@/application/agent-workflow/ports';
import { getConfig, updateConfig } from '@/lib/airtable';

const WORKFLOWS_KEY = 'AGENT_WORKFLOWS_V1';
const VERSIONS_KEY = 'AGENT_WORKFLOW_VERSIONS_V1';
const RUNS_KEY = 'AGENT_WORKFLOW_RUNS_V1';
const RUN_STEPS_KEY = 'AGENT_WORKFLOW_RUN_STEPS_V1';

function nowIso(): string {
  return new Date().toISOString();
}

function parseJsonValue<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function loadStore() {
  const config = await getConfig();
  return {
    workflows: parseJsonValue<Workflow[]>(config[WORKFLOWS_KEY], []),
    versions: parseJsonValue<WorkflowVersion[]>(config[VERSIONS_KEY], []),
    runs: parseJsonValue<WorkflowRun[]>(config[RUNS_KEY], []),
    runSteps: parseJsonValue<WorkflowRunStep[]>(config[RUN_STEPS_KEY], []),
  };
}

async function persistWorkflows(workflows: Workflow[], versions: WorkflowVersion[]) {
  await updateConfig(WORKFLOWS_KEY, JSON.stringify(workflows));
  await updateConfig(VERSIONS_KEY, JSON.stringify(versions));
}

async function persistRuns(runs: WorkflowRun[], runSteps: WorkflowRunStep[]) {
  await updateConfig(RUNS_KEY, JSON.stringify(runs));
  await updateConfig(RUN_STEPS_KEY, JSON.stringify(runSteps));
}

function toWorkflowWithVersions(workflow: Workflow, versions: WorkflowVersion[]): WorkflowWithVersions {
  return {
    ...workflow,
    draftVersion: versions.find((version) => version.id === workflow.draftVersionId),
    activeVersion: workflow.activeVersionId ? versions.find((version) => version.id === workflow.activeVersionId) : undefined,
  };
}

function cloneNodesAndEdges(input: UpdateWorkflowInput): { nodes: WorkflowVersion['nodes']; edges: WorkflowEdge[] } {
  const nodes = (input.nodes || []).map((node) => ({
    id: node.id,
    tenantId: 'default',
    workflowVersionId: '',
    name: node.name,
    type: node.type,
    position: node.position,
    config: node.config,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));

  const edges = (input.edges || []).map((edge) => ({
    id: edge.id,
    tenantId: 'default',
    workflowVersionId: '',
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));

  return { nodes, edges };
}

export class AirtableWorkflowRepository implements WorkflowRepository {
  async list(tenantId: string): Promise<WorkflowWithVersions[]> {
    const store = await loadStore();
    return store.workflows
      .filter((workflow) => workflow.tenantId === tenantId)
      .map((workflow) => toWorkflowWithVersions(workflow, store.versions));
  }

  async getById(tenantId: string, workflowId: string): Promise<WorkflowWithVersions | null> {
    const store = await loadStore();
    const workflow = store.workflows.find((entry) => entry.id === workflowId && entry.tenantId === tenantId);
    if (!workflow) return null;
    return toWorkflowWithVersions(workflow, store.versions);
  }

  async create(input: CreateWorkflowInput): Promise<WorkflowWithVersions> {
    const store = await loadStore();
    const createdAt = nowIso();
    const draftVersionId = crypto.randomUUID();
    const workflowId = crypto.randomUUID();

    const draftVersion: WorkflowVersion = {
      id: draftVersionId,
      tenantId: input.tenantId,
      workflowId,
      version: 1,
      isPublished: input.mode === 'default',
      nodes: [],
      edges: [],
      createdAt,
      updatedAt: createdAt,
    };

    const workflow: Workflow = {
      id: workflowId,
      tenantId: input.tenantId,
      name: input.name,
      description: input.description,
      mode: input.mode,
      state: input.mode === 'default' ? 'published' : 'draft',
      draftVersionId,
      activeVersionId: input.mode === 'default' ? draftVersionId : undefined,
      createdAt,
      updatedAt: createdAt,
    };

    const nextWorkflows = [...store.workflows, workflow];
    const nextVersions = [...store.versions, draftVersion];
    await persistWorkflows(nextWorkflows, nextVersions);

    return {
      ...workflow,
      draftVersion,
      activeVersion: workflow.activeVersionId ? draftVersion : undefined,
    };
  }

  async update(tenantId: string, workflowId: string, input: UpdateWorkflowInput): Promise<WorkflowWithVersions> {
    const store = await loadStore();
    const workflow = store.workflows.find((entry) => entry.id === workflowId && entry.tenantId === tenantId);
    if (!workflow) {
      throw new Error('Workflow nicht gefunden');
    }

    const draftVersion = store.versions.find((version) => version.id === workflow.draftVersionId);
    if (!draftVersion) {
      throw new Error('Draft-Version nicht gefunden');
    }

    const updatedAt = nowIso();
    const { nodes, edges } = cloneNodesAndEdges(input);
    const hydratedNodes = nodes.map((node) => ({ ...node, tenantId, workflowVersionId: draftVersion.id, createdAt: node.createdAt || updatedAt, updatedAt }));
    const hydratedEdges = edges.map((edge) => ({ ...edge, tenantId, workflowVersionId: draftVersion.id, createdAt: edge.createdAt || updatedAt, updatedAt }));

    const nextVersions = store.versions.map((version) => {
      if (version.id !== draftVersion.id) return version;
      return {
        ...version,
        nodes: input.nodes ? hydratedNodes : version.nodes,
        edges: input.edges ? hydratedEdges : version.edges,
        updatedAt,
      };
    });

    const nextWorkflows = store.workflows.map((entry) =>
      entry.id === workflow.id
        ? {
            ...entry,
            name: input.name ?? entry.name,
            description: input.description ?? entry.description,
            updatedAt,
          }
        : entry
    );

    await persistWorkflows(nextWorkflows, nextVersions);

    const updatedWorkflow = nextWorkflows.find((entry) => entry.id === workflow.id)!;
    return toWorkflowWithVersions(updatedWorkflow, nextVersions);
  }

  async publish(tenantId: string, workflowId: string): Promise<WorkflowWithVersions> {
    const store = await loadStore();
    const workflow = store.workflows.find((entry) => entry.id === workflowId && entry.tenantId === tenantId);
    if (!workflow) {
      throw new Error('Workflow nicht gefunden');
    }

    const draftVersion = store.versions.find((version) => version.id === workflow.draftVersionId);
    if (!draftVersion) {
      throw new Error('Draft-Version nicht gefunden');
    }

    const updatedAt = nowIso();
    const nextVersionNumber =
      Math.max(
        0,
        ...store.versions.filter((version) => version.workflowId === workflow.id).map((version) => version.version)
      ) + 1;

    const publishedVersionId = crypto.randomUUID();
    const publishedVersion: WorkflowVersion = {
      ...draftVersion,
      id: publishedVersionId,
      version: nextVersionNumber,
      isPublished: true,
      nodes: draftVersion.nodes.map((node) => ({ ...node, id: crypto.randomUUID(), workflowVersionId: publishedVersionId, updatedAt })),
      edges: draftVersion.edges.map((edge) => ({ ...edge, id: crypto.randomUUID(), workflowVersionId: publishedVersionId, updatedAt })),
      createdAt: updatedAt,
      updatedAt,
    };

    const nextVersions = [
      ...store.versions.map((version) => ({ ...version, isPublished: version.id === publishedVersion.id })),
      publishedVersion,
    ];

    const nextWorkflows = store.workflows.map((entry) =>
      entry.id === workflow.id
        ? {
            ...entry,
            activeVersionId: publishedVersionId,
            state: 'published' as const,
            updatedAt,
          }
        : entry
    );

    await persistWorkflows(nextWorkflows, nextVersions);

    const updatedWorkflow = nextWorkflows.find((entry) => entry.id === workflow.id)!;
    return toWorkflowWithVersions(updatedWorkflow, nextVersions);
  }
}

export class AirtableWorkflowRunRepository implements WorkflowRunRepository {
  async createRun(run: WorkflowRun): Promise<WorkflowRun> {
    const store = await loadStore();
    const nextRuns = [...store.runs, run];
    await persistRuns(nextRuns, store.runSteps);
    return run;
  }

  async updateRun(runId: string, updates: Partial<WorkflowRun>): Promise<void> {
    const store = await loadStore();
    const nextRuns = store.runs.map((run) => (run.id === runId ? { ...run, ...updates, updatedAt: nowIso() } : run));
    await persistRuns(nextRuns, store.runSteps);
  }

  async createRunStep(step: WorkflowRunStep): Promise<WorkflowRunStep> {
    const store = await loadStore();
    const nextSteps = [...store.runSteps, step];
    await persistRuns(store.runs, nextSteps);
    return step;
  }

  async updateRunStep(stepId: string, updates: Partial<WorkflowRunStep>): Promise<void> {
    const store = await loadStore();
    const nextSteps = store.runSteps.map((step) => (step.id === stepId ? { ...step, ...updates, updatedAt: nowIso() } : step));
    await persistRuns(store.runs, nextSteps);
  }

  async listRuns(tenantId: string, limit: number = 50): Promise<WorkflowRun[]> {
    const store = await loadStore();
    return store.runs
      .filter((run) => run.tenantId === tenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async getRunWithSteps(tenantId: string, runId: string): Promise<WorkflowRunWithSteps | null> {
    const store = await loadStore();
    const run = store.runs.find((entry) => entry.id === runId && entry.tenantId === tenantId);
    if (!run) return null;

    return {
      ...run,
      steps: store.runSteps
        .filter((step) => step.runId === run.id && step.tenantId === tenantId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    };
  }

  async findByIdempotencyKey(tenantId: string, workflowVersionId: string, idempotencyKey: string): Promise<WorkflowRun | null> {
    const store = await loadStore();
    return (
      store.runs.find(
        (run) => run.tenantId === tenantId && run.workflowVersionId === workflowVersionId && run.idempotencyKey === idempotencyKey
      ) || null
    );
  }
}

export class AirtableIntegrationSecretProvider implements IntegrationSecretProvider {
  async getOpenRouterApiKey(): Promise<string | null> {
    const config = await getConfig();
    return (config.OPENROUTER_API_KEY || '').trim() || null;
  }

  async getGeminiApiKey(): Promise<string | null> {
    const config = await getConfig();
    return (config.GEMINI_API_KEY || '').trim() || null;
  }
}

export class LlmAgentModelRunner implements AgentModelRunner {
  constructor(private readonly secrets: IntegrationSecretProvider) {}

  async runStep(input: {
    provider: 'openrouter' | 'gemini';
    model: string;
    instruction: string;
    payload: Record<string, unknown>;
    timeoutMs: number;
  }): Promise<Record<string, unknown>> {
    if (input.provider === 'openrouter') {
      const key = await this.secrets.getOpenRouterApiKey();
      if (!key) throw new Error('OPENROUTER_API_KEY ist nicht hinterlegt.');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.max(1000, input.timeoutMs));

      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: input.model,
            messages: [
              { role: 'system', content: input.instruction },
              { role: 'user', content: JSON.stringify(input.payload) },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenRouter Fehler (${response.status})`);
        }

        const json = await response.json();
        const content = json?.choices?.[0]?.message?.content || '';
        return {
          provider: 'openrouter',
          model: input.model,
          raw: content,
          response: json,
        };
      } finally {
        clearTimeout(timeout);
      }
    }

    const key = await this.secrets.getGeminiApiKey();
    if (!key) throw new Error('GEMINI_API_KEY ist nicht hinterlegt.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, input.timeoutMs));

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${input.instruction}\n\n${JSON.stringify(input.payload)}` }],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini Fehler (${response.status})`);
      }

      const json = await response.json();
      const content = json?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('\n') || '';
      return {
        provider: 'gemini',
        model: input.model,
        raw: content,
        response: json,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

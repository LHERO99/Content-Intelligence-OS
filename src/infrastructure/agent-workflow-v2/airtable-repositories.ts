import {
  CreateWorkflowInputV2,
  UpdateWorkflowInputV2,
  WorkflowMessageV2,
  WorkflowRunStepV2,
  WorkflowRunV2,
  WorkflowRunWithDetailsV2,
  WorkflowVersionV2,
  WorkflowWithVersionsV2,
  WorkflowV2,
} from '@/domain/agent-workflow-v2/models';
import { AgentModelRunnerV2, IntegrationSecretProviderV2, WorkflowRepositoryV2, WorkflowRunRepositoryV2 } from '@/application/agent-workflow-v2/ports';
import { getConfig, updateConfig } from '@/lib/postgres';

const WORKFLOWS_KEY = 'AGENT_WORKFLOWS_V2';
const VERSIONS_KEY = 'AGENT_WORKFLOW_V2_VERSIONS';
const RUNS_KEY = 'AGENT_WORKFLOW_V2_RUNS';
const RUN_STEPS_KEY = 'AGENT_WORKFLOW_V2_RUN_STEPS';
const MESSAGES_KEY = 'AGENT_WORKFLOW_V2_MESSAGES';

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
    workflows: parseJsonValue<WorkflowV2[]>(config[WORKFLOWS_KEY], []),
    versions: parseJsonValue<WorkflowVersionV2[]>(config[VERSIONS_KEY], []),
    runs: parseJsonValue<WorkflowRunV2[]>(config[RUNS_KEY], []),
    runSteps: parseJsonValue<WorkflowRunStepV2[]>(config[RUN_STEPS_KEY], []),
    messages: parseJsonValue<WorkflowMessageV2[]>(config[MESSAGES_KEY], []),
  };
}

async function persistWorkflows(workflows: WorkflowV2[], versions: WorkflowVersionV2[]) {
  await updateConfig(WORKFLOWS_KEY, JSON.stringify(workflows));
  await updateConfig(VERSIONS_KEY, JSON.stringify(versions));
}

/** Maximum number of completed runs to retain in storage. Running runs are always kept. */
const MAX_RETAINED_RUNS = 20;

/** Maximum number of steps to retain per run. */
const MAX_STEPS_PER_RUN = 30;

/** Maximum character length for a single message payload when serialized to JSON. */
const MAX_MESSAGE_PAYLOAD_CHARS = 1000;

/** Maximum character length for a step input/output when serialized to JSON. */
const MAX_STEP_PAYLOAD_CHARS = 1500;

/**
 * Trims the stored arrays before writing to Airtable to prevent the JSON blobs
 * from exceeding the Airtable field character limit (~100k chars).
 *
 * Strategy:
 *  1. Drop soft-deleted runs (deletedAt set) and their associated steps/messages.
 *  2. Cap active runs at MAX_RETAINED_RUNS, keeping the most recent ones.
 *     Running runs are always preserved.
 *  3. Cap steps per run at MAX_STEPS_PER_RUN (most recent first).
 *  4. Truncate oversized step input/output and message payloads.
 */
function pruneStore(
  runs: WorkflowRunV2[],
  runSteps: WorkflowRunStepV2[],
  messages: WorkflowMessageV2[],
): { runs: WorkflowRunV2[]; runSteps: WorkflowRunStepV2[]; messages: WorkflowMessageV2[] } {
  // 1. Remove soft-deleted runs
  const activeRuns = runs.filter((r) => !r.deletedAt);

  // 2. Cap completed runs — always keep running ones
  const runningRuns = activeRuns.filter((r) => r.status === 'running' || r.status === 'pending');
  const completedRuns = activeRuns
    .filter((r) => r.status !== 'running' && r.status !== 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_RETAINED_RUNS);
  const retainedRuns = [...runningRuns, ...completedRuns];
  const retainedRunIds = new Set(retainedRuns.map((r) => r.id));

  // 3. Drop steps/messages for removed runs; cap steps per run; truncate payloads
  const stepsByRun = new Map<string, WorkflowRunStepV2[]>();
  runSteps
    .filter((s) => retainedRunIds.has(s.runId))
    .forEach((s) => {
      const arr = stepsByRun.get(s.runId) ?? [];
      arr.push(s);
      stepsByRun.set(s.runId, arr);
    });

  const truncateStr = (val: unknown, maxLen: number): unknown => {
    if (typeof val !== 'string') return val;
    return val.length > maxLen ? val.slice(0, maxLen) + '…[truncated]' : val;
  };

  const truncatePayload = (payload: Record<string, unknown> | undefined, maxChars: number) => {
    if (!payload) return payload;
    const serialized = JSON.stringify(payload);
    if (serialized.length <= maxChars) return payload;
    return { _truncated: true, preview: serialized.slice(0, maxChars) + '…' };
  };

  const retainedSteps: WorkflowRunStepV2[] = [];
  stepsByRun.forEach((steps, _runId) => {
    const capped = steps
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-MAX_STEPS_PER_RUN);
    capped.forEach((s) => {
      retainedSteps.push({
        ...s,
        input: truncatePayload(s.input, MAX_STEP_PAYLOAD_CHARS) as Record<string, unknown>,
        output: truncatePayload(s.output as Record<string, unknown> | undefined, MAX_STEP_PAYLOAD_CHARS),
        error: typeof s.error === 'string'
          ? (truncateStr(s.error, MAX_STEP_PAYLOAD_CHARS) as string)
          : s.error,
      });
    });
  });

  const retainedMessages = messages
    .filter((m) => retainedRunIds.has(m.runId))
    .map((m) => ({
      ...m,
      payload: truncatePayload(m.payload as Record<string, unknown>, MAX_MESSAGE_PAYLOAD_CHARS) as WorkflowMessageV2['payload'],
    }));

  return { runs: retainedRuns, runSteps: retainedSteps, messages: retainedMessages };
}

async function persistRuns(runs: WorkflowRunV2[], runSteps: WorkflowRunStepV2[], messages: WorkflowMessageV2[]) {
  const pruned = pruneStore(runs, runSteps, messages);
  try {
    await Promise.all([
      updateConfig(RUNS_KEY, JSON.stringify(pruned.runs)),
      updateConfig(RUN_STEPS_KEY, JSON.stringify(pruned.runSteps)),
      updateConfig(MESSAGES_KEY, JSON.stringify(pruned.messages)),
    ]);
  } catch (err: any) {
    // If the blobs are still too large after pruning, log and continue rather than
    // crashing the run. The run result is correct — only history persistence failed.
    console.error('[persistRuns] Failed to persist run data to Airtable (non-fatal):', err?.message ?? err);
  }
}

function toWorkflowWithVersions(workflow: WorkflowV2, versions: WorkflowVersionV2[]): WorkflowWithVersionsV2 {
  return {
    ...workflow,
    draftVersion: versions.find((version) => version.id === workflow.draftVersionId),
    activeVersion: workflow.activeVersionId ? versions.find((version) => version.id === workflow.activeVersionId) : undefined,
  };
}

function buildDraftGraph(tenantId: string, draftVersionId: string, input: UpdateWorkflowInputV2) {
  const createdAt = nowIso();
  const nodes = (input.nodes || []).map((node) => ({
    id: node.id,
    tenantId,
    workflowVersionId: draftVersionId,
    name: node.name,
    type: node.type,
    position: node.position,
    x: node.x,
    y: node.y,
    isParent: Boolean(node.isParent),
    config: node.config,
    createdAt,
    updatedAt: createdAt,
  }));

  const edges = (input.edges || []).map((edge) => ({
    id: edge.id,
    tenantId,
    workflowVersionId: draftVersionId,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    channel: edge.channel,
    targetInputKey: edge.targetInputKey,
    createdAt,
    updatedAt: createdAt,
  }));

  return { nodes, edges };
}

export class AirtableWorkflowRepositoryV2 implements WorkflowRepositoryV2 {
  async list(tenantId: string): Promise<WorkflowWithVersionsV2[]> {
    const store = await loadStore();
    return store.workflows
      .filter((workflow) => workflow.tenantId === tenantId)
      .map((workflow) => toWorkflowWithVersions(workflow, store.versions));
  }

  async getById(tenantId: string, workflowId: string): Promise<WorkflowWithVersionsV2 | null> {
    const store = await loadStore();
    const workflow = store.workflows.find((entry) => entry.id === workflowId && entry.tenantId === tenantId);
    if (!workflow) return null;
    return toWorkflowWithVersions(workflow, store.versions);
  }

  async create(input: CreateWorkflowInputV2): Promise<WorkflowWithVersionsV2> {
    const store = await loadStore();
    const createdAt = nowIso();
    const workflowId = crypto.randomUUID();
    const draftVersionId = crypto.randomUUID();

    const draftVersion: WorkflowVersionV2 = {
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

    const workflow: WorkflowV2 = {
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

  async update(tenantId: string, workflowId: string, input: UpdateWorkflowInputV2): Promise<WorkflowWithVersionsV2> {
    const store = await loadStore();
    const workflow = store.workflows.find((entry) => entry.id === workflowId && entry.tenantId === tenantId);
    if (!workflow) throw new Error('Workflow nicht gefunden');

    const draftVersion = store.versions.find((version) => version.id === workflow.draftVersionId);
    if (!draftVersion) throw new Error('Draft-Version nicht gefunden');

    const updatedAt = nowIso();
    const { nodes, edges } = buildDraftGraph(tenantId, draftVersion.id, input);

    const nextVersions = store.versions.map((version) => {
      if (version.id !== draftVersion.id) return version;
      return {
        ...version,
        nodes: input.nodes ? nodes : version.nodes,
        edges: input.edges ? edges : version.edges,
        updatedAt,
      };
    });

    const nextWorkflows = store.workflows.map((entry) =>
      entry.id === workflow.id
        ? {
            ...entry,
            name: input.name ?? entry.name,
            description: input.description ?? entry.description,
            state: input.state ?? entry.state,
            updatedAt,
          }
        : entry
    );

    await persistWorkflows(nextWorkflows, nextVersions);
    const updated = nextWorkflows.find((entry) => entry.id === workflow.id)!;
    return toWorkflowWithVersions(updated, nextVersions);
  }

  async publish(tenantId: string, workflowId: string): Promise<WorkflowWithVersionsV2> {
    const store = await loadStore();
    const workflow = store.workflows.find((entry) => entry.id === workflowId && entry.tenantId === tenantId);
    if (!workflow) throw new Error('Workflow nicht gefunden');

    const draftVersion = store.versions.find((version) => version.id === workflow.draftVersionId);
    if (!draftVersion) throw new Error('Draft-Version nicht gefunden');

    const updatedAt = nowIso();
    const nextVersionNumber =
      Math.max(0, ...store.versions.filter((version) => version.workflowId === workflow.id).map((version) => version.version)) + 1;
    const publishedVersionId = crypto.randomUUID();

    const nodeIdMap = new Map<string, string>();
    const publishedNodes = draftVersion.nodes.map((node) => {
      const newId = crypto.randomUUID();
      nodeIdMap.set(node.id, newId);
      return {
        ...node,
        id: newId,
        workflowVersionId: publishedVersionId,
        updatedAt,
      };
    });

    const publishedEdges = draftVersion.edges.map((edge) => ({
      ...edge,
      id: crypto.randomUUID(),
      workflowVersionId: publishedVersionId,
      sourceNodeId: nodeIdMap.get(edge.sourceNodeId) || edge.sourceNodeId,
      targetNodeId: nodeIdMap.get(edge.targetNodeId) || edge.targetNodeId,
      updatedAt,
    }));

    const publishedVersion: WorkflowVersionV2 = {
      ...draftVersion,
      id: publishedVersionId,
      version: nextVersionNumber,
      isPublished: true,
      nodes: publishedNodes,
      edges: publishedEdges,
      createdAt: updatedAt,
      updatedAt,
    };

    const nextVersions = [
      ...store.versions.map((version) => ({ ...version, isPublished: false })),
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
    const updated = nextWorkflows.find((entry) => entry.id === workflow.id)!;
    return toWorkflowWithVersions(updated, nextVersions);
  }
}

export class AirtableWorkflowRunRepositoryV2 implements WorkflowRunRepositoryV2 {
  async createRun(run: WorkflowRunV2): Promise<WorkflowRunV2> {
    const store = await loadStore();
    const nextRuns = [...store.runs, run];
    await persistRuns(nextRuns, store.runSteps, store.messages);
    return run;
  }

  async updateRun(runId: string, updates: Partial<WorkflowRunV2>): Promise<void> {
    const store = await loadStore();
    const nextRuns = store.runs.map((run) => (run.id === runId ? { ...run, ...updates, updatedAt: nowIso() } : run));
    await persistRuns(nextRuns, store.runSteps, store.messages);
  }

  async createRunStep(step: WorkflowRunStepV2): Promise<WorkflowRunStepV2> {
    const store = await loadStore();
    const nextSteps = [...store.runSteps, step];
    await persistRuns(store.runs, nextSteps, store.messages);
    return step;
  }

  async updateRunStep(stepId: string, updates: Partial<WorkflowRunStepV2>): Promise<void> {
    const store = await loadStore();
    const nextSteps = store.runSteps.map((step) => (step.id === stepId ? { ...step, ...updates, updatedAt: nowIso() } : step));
    await persistRuns(store.runs, nextSteps, store.messages);
  }

  async createMessage(message: WorkflowMessageV2): Promise<WorkflowMessageV2> {
    const store = await loadStore();
    const nextMessages = [...store.messages, message];
    await persistRuns(store.runs, store.runSteps, nextMessages);
    return message;
  }

  async listRuns(tenantId: string, limit: number = 50, includeDeleted = false): Promise<WorkflowRunV2[]> {
    const store = await loadStore();
    return store.runs
      .filter((run) => run.tenantId === tenantId && (includeDeleted ? true : !run.deletedAt))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async getRunWithDetails(tenantId: string, runId: string): Promise<WorkflowRunWithDetailsV2 | null> {
    const store = await loadStore();
    const run = store.runs.find((entry) => entry.id === runId && entry.tenantId === tenantId);
    if (!run) return null;

    return {
      ...run,
      steps: store.runSteps
        .filter((step) => step.tenantId === tenantId && step.runId === run.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      messages: store.messages
        .filter((message) => message.tenantId === tenantId && message.runId === run.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    };
  }

  async getRunMessages(tenantId: string, runId: string): Promise<WorkflowMessageV2[]> {
    const store = await loadStore();
    return store.messages
      .filter((message) => message.tenantId === tenantId && message.runId === runId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async findByIdempotencyKey(tenantId: string, workflowVersionId: string, idempotencyKey: string): Promise<WorkflowRunV2 | null> {
    const store = await loadStore();
    return (
      store.runs.find(
        (run) =>
          run.tenantId === tenantId &&
          !run.deletedAt &&
          run.workflowVersionId === workflowVersionId &&
          run.idempotencyKey === idempotencyKey
      ) || null
    );
  }

  async isCancelRequested(tenantId: string, runId: string): Promise<boolean> {
    const store = await loadStore();
    const run = store.runs.find((r) => r.id === runId && r.tenantId === tenantId);
    return run?.cancelRequested ?? false;
  }

  async requestCancel(tenantId: string, runId: string): Promise<void> {
    const store = await loadStore();
    const nextRuns = store.runs.map((r) =>
      r.id === runId && r.tenantId === tenantId
        ? { ...r, cancelRequested: true, updatedAt: nowIso() }
        : r
    );
    await persistRuns(nextRuns, store.runSteps, store.messages);
  }

  async cancelRun(tenantId: string, runId: string): Promise<WorkflowRunV2 | null> {
    const store = await loadStore();
    const run = store.runs.find((entry) => entry.id === runId && entry.tenantId === tenantId && !entry.deletedAt);
    if (!run) return null;

    const now = nowIso();
    const durationMs = run.startedAt ? Math.max(0, new Date(now).getTime() - new Date(run.startedAt).getTime()) : undefined;
    const nextRuns = store.runs.map((entry) =>
      entry.id === runId
        ? {
            ...entry,
            status: 'cancelled' as const,
            finishedAt: entry.finishedAt || now,
            durationMs: entry.durationMs ?? durationMs,
            updatedAt: now,
          }
        : entry
    );
    await persistRuns(nextRuns, store.runSteps, store.messages);
    return nextRuns.find((entry) => entry.id === runId) || null;
  }

  async softDeleteRun(tenantId: string, runId: string): Promise<WorkflowRunV2 | null> {
    const store = await loadStore();
    const run = store.runs.find((entry) => entry.id === runId && entry.tenantId === tenantId);
    if (!run) return null;

    const now = nowIso();
    const nextRuns = store.runs.map((entry) =>
      entry.id === runId
        ? {
            ...entry,
            deletedAt: now,
            updatedAt: now,
          }
        : entry
    );
    await persistRuns(nextRuns, store.runSteps, store.messages);
    return nextRuns.find((entry) => entry.id === runId) || null;
  }

  async restoreRun(tenantId: string, runId: string): Promise<WorkflowRunV2 | null> {
    const store = await loadStore();
    const run = store.runs.find((entry) => entry.id === runId && entry.tenantId === tenantId);
    if (!run) return null;

    const now = nowIso();
    const nextRuns = store.runs.map((entry) =>
      entry.id === runId
        ? {
            ...entry,
            deletedAt: undefined,
            updatedAt: now,
          }
        : entry
    );
    await persistRuns(nextRuns, store.runSteps, store.messages);
    return nextRuns.find((entry) => entry.id === runId) || null;
  }
}

export class AirtableIntegrationSecretProviderV2 implements IntegrationSecretProviderV2 {
  async getOpenAIApiKey(): Promise<string | null> {
    const config = await getConfig();
    return (config.OPENAI_API_KEY || '').trim() || null;
  }

  async getOpenRouterApiKey(): Promise<string | null> {
    const config = await getConfig();
    return (config.OPENROUTER_API_KEY || '').trim() || null;
  }

  async getGeminiApiKey(): Promise<string | null> {
    const config = await getConfig();
    return (config.GEMINI_API_KEY || '').trim() || null;
  }

  async getVertexLegalConfig(): Promise<{ projectId: string; location: string; endpointId: string; accessToken?: string } | null> {
    const config = await getConfig();
    const projectId = (config.VERTEX_AI_PROJECT_ID || '').trim();
    const location = (config.VERTEX_AI_LOCATION || '').trim();
    const endpointId = (config.VERTEX_AI_ENDPOINT_ID || '').trim();
    const accessToken = (config.VERTEX_AI_ACCESS_TOKEN || '').trim();

    if (!projectId || !location || !endpointId) return null;

    return {
      projectId,
      location,
      endpointId,
      accessToken: accessToken || undefined,
    };
  }
}

export class LlmAgentModelRunnerV2 implements AgentModelRunnerV2 {
  constructor(private readonly secrets: IntegrationSecretProviderV2) {}

  async runStep(input: {
    provider: 'openai' | 'openrouter' | 'gemini' | 'vertex_legal';
    model: string;
    instruction: string;
    payload: Record<string, unknown>;
    timeoutMs: number;
  }): Promise<Record<string, unknown>> {
    if (input.provider === 'openai') {
      const key = await this.secrets.getOpenAIApiKey();
      if (!key) throw new Error('OPENAI_API_KEY ist nicht hinterlegt.');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.max(1000, input.timeoutMs));
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
          throw new Error(`OpenAI Fehler (${response.status})`);
        }

        const json = await response.json();
        const content = json?.choices?.[0]?.message?.content || '';
        return {
          provider: 'openai',
          model: input.model,
          text: content,
          response: json,
        };
      } finally {
        clearTimeout(timeout);
      }
    }

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
          text: content,
          response: json,
        };
      } finally {
        clearTimeout(timeout);
      }
    }

    if (input.provider === 'vertex_legal') {
      const vertex = await this.secrets.getVertexLegalConfig();
      if (!vertex) {
        throw new Error('Vertex Legal Konfiguration fehlt (PROJECT_ID, LOCATION, ENDPOINT_ID).');
      }

      if (!vertex.accessToken) {
        throw new Error('VERTEX_AI_ACCESS_TOKEN fehlt. Bitte im Integrations-Tab hinterlegen.');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.max(1000, input.timeoutMs));
      try {
        const url = `https://${vertex.location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(vertex.projectId)}/locations/${encodeURIComponent(vertex.location)}/endpoints/${encodeURIComponent(vertex.endpointId)}:predict`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${vertex.accessToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            instances: [
              {
                instruction: input.instruction,
                model: input.model,
                payload: input.payload,
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`Vertex Legal Endpoint Fehler (${response.status})`);
        }

        const json = await response.json();
        return {
          provider: 'vertex_legal',
          model: input.model,
          text: JSON.stringify(json?.predictions?.[0] || json || {}),
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
        text: content,
        response: json,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

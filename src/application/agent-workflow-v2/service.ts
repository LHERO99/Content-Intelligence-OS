import {
  AgentStepType,
  WorkflowMessageV2,
  WorkflowNodeV2,
  WorkflowRunStepV2,
  WorkflowRunV2,
  WorkflowVersionV2,
  WorkflowWithVersionsV2,
} from '@/domain/agent-workflow-v2/models';
import {
  AgentModelRunnerV2,
  AgentWorkflowServiceV2,
  WorkflowRepositoryV2,
  WorkflowRunRepositoryV2,
} from './ports';

const DEFAULT_TENANT_ID = 'default';

const DEFAULT_NODE_ORDER: Array<{ type: AgentStepType; name: string; instruction: string; x: number; y: number }> = [
  {
    type: 'research',
    name: 'Research Agent',
    instruction: 'Sammle relevante Quellen, Suchintentionen und Fakten für die Content-Aufgabe.',
    x: 120,
    y: 80,
  },
  {
    type: 'analysis',
    name: 'Analysis Agent',
    instruction: 'Analysiere die Rechercheergebnisse und identifiziere Chancen, Lücken und Risiken.',
    x: 420,
    y: 80,
  },
  {
    type: 'briefing',
    name: 'Briefing Agent',
    instruction: 'Erzeuge aus der Analyse ein klares Briefing mit Struktur, WDF, Tonalität und Ziel.',
    x: 720,
    y: 80,
  },
  {
    type: 'draft',
    name: 'Draft Agent',
    instruction: 'Erstelle den Entwurf basierend auf dem Briefing und allen relevanten Inputs.',
    x: 1020,
    y: 80,
  },
  {
    type: 'review',
    name: 'Review Agent',
    instruction: 'Prüfe Entwurf auf SEO, Lesbarkeit und Vollständigkeit. Liefere To-dos und Ergebnis.',
    x: 1320,
    y: 80,
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function resolveEdgesBySource(version: WorkflowVersionV2): Map<string, typeof version.edges> {
  const map = new Map<string, typeof version.edges>();
  version.edges.forEach((edge) => {
    const list = map.get(edge.sourceNodeId) || [];
    map.set(edge.sourceNodeId, [...list, edge]);
  });
  return map;
}

function resolveIncomingMessages(messages: WorkflowMessageV2[], nodeId: string): WorkflowMessageV2[] {
  return messages.filter((message) => message.toNodeId === nodeId);
}

function topologicalSort(nodes: WorkflowNodeV2[], edges: WorkflowVersionV2['edges']): WorkflowNodeV2[] {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  nodes.forEach((node) => {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  });

  edges.forEach((edge) => {
    indegree.set(edge.targetNodeId, (indegree.get(edge.targetNodeId) || 0) + 1);
    adjacency.set(edge.sourceNodeId, [...(adjacency.get(edge.sourceNodeId) || []), edge.targetNodeId]);
  });

  const queue = nodes.filter((node) => (indegree.get(node.id) || 0) === 0).sort((a, b) => a.position - b.position);
  const result: WorkflowNodeV2[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    const neighbors = adjacency.get(node.id) || [];
    neighbors.forEach((neighbor) => {
      indegree.set(neighbor, (indegree.get(neighbor) || 0) - 1);
      if ((indegree.get(neighbor) || 0) === 0) {
        const neighborNode = nodes.find((entry) => entry.id === neighbor);
        if (neighborNode) queue.push(neighborNode);
      }
    });
  }

  if (result.length !== nodes.length) {
    return [...nodes].sort((a, b) => a.position - b.position);
  }

  return result;
}

export class DefaultAgentWorkflowServiceV2 implements AgentWorkflowServiceV2 {
  constructor(
    private readonly workflows: WorkflowRepositoryV2,
    private readonly runs: WorkflowRunRepositoryV2,
    private readonly modelRunner: AgentModelRunnerV2
  ) {}

  private async ensureDefaultWorkflow(tenantId: string): Promise<void> {
    const existing = await this.workflows.list(tenantId);
    if (existing.some((workflow) => workflow.mode === 'default')) return;

    const created = await this.workflows.create({
      tenantId,
      name: 'Default Content-Agent Builder Workflow',
      description: 'Canvas-basierter Standard-Workflow mit Agent-to-Agent Kommunikation.',
      mode: 'default',
    });

    const draftVersion = created.draftVersion;
    if (!draftVersion) return;

    const timestamp = nowIso();
    const nodes = DEFAULT_NODE_ORDER.map((nodeDef, index) => ({
      id: crypto.randomUUID(),
      name: nodeDef.name,
      type: nodeDef.type,
      position: index,
      x: nodeDef.x,
      y: nodeDef.y,
      config: {
        instruction: nodeDef.instruction,
        provider: 'openrouter' as const,
        model: 'openai/gpt-4o-mini',
        timeoutMs: 45000,
        retries: 1,
        enabled: true,
      },
      tenantId,
      workflowVersionId: draftVersion.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    const edges = nodes.slice(0, -1).map((node, index) => ({
      id: crypto.randomUUID(),
      sourceNodeId: node.id,
      targetNodeId: nodes[index + 1].id,
      channel: `${node.type}.output`,
      targetInputKey: `${nodes[index + 1].type}Input`,
    }));

    await this.workflows.update(tenantId, created.id, { nodes, edges });
    await this.workflows.publish(tenantId, created.id);
  }

  async list(tenantId: string = DEFAULT_TENANT_ID): Promise<WorkflowWithVersionsV2[]> {
    await this.ensureDefaultWorkflow(tenantId);
    return this.workflows.list(tenantId);
  }

  async create(input: Parameters<WorkflowRepositoryV2['create']>[0]) {
    return this.workflows.create(input);
  }

  async update(tenantId: string, workflowId: string, input: Parameters<WorkflowRepositoryV2['update']>[2]) {
    return this.workflows.update(tenantId, workflowId, input);
  }

  async publish(tenantId: string, workflowId: string) {
    return this.workflows.publish(tenantId, workflowId);
  }

  private getExecutableVersion(workflow: WorkflowWithVersionsV2): WorkflowVersionV2 {
    if (workflow.activeVersion) return workflow.activeVersion;
    if (workflow.draftVersion) return workflow.draftVersion;
    throw new Error('Workflow hat keine ausführbare Version.');
  }

  private async executeNodeWithRetry(run: WorkflowRunV2, node: WorkflowNodeV2, inputPayload: Record<string, unknown>): Promise<WorkflowRunStepV2> {
    const maxAttempts = Math.max(1, node.config.retries + 1);
    let attempt = 1;
    let lastError: string | undefined;
    let output: Record<string, unknown> | undefined;
    let startedAt: string | undefined;
    let finishedAt: string | undefined;

    while (attempt <= maxAttempts) {
      startedAt = nowIso();
      try {
        output = await this.modelRunner.runStep({
          provider: node.config.provider,
          model: node.config.model,
          instruction: node.config.instruction,
          payload: inputPayload,
          timeoutMs: node.config.timeoutMs,
        });
        finishedAt = nowIso();
        lastError = undefined;
        break;
      } catch (error: any) {
        finishedAt = nowIso();
        lastError = error?.message || 'Unbekannter Fehler in Agent-Step';
        if (attempt >= maxAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, attempt * 800));
      }
      attempt += 1;
    }

    const status = lastError ? 'failed' : 'success';
    const step: WorkflowRunStepV2 = {
      id: crypto.randomUUID(),
      tenantId: run.tenantId,
      runId: run.id,
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      provider: node.config.provider,
      model: node.config.model,
      attempt,
      status,
      input: inputPayload,
      output,
      error: lastError,
      startedAt,
      finishedAt,
      durationMs:
        startedAt && finishedAt
          ? Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime())
          : undefined,
      createdAt: startedAt || nowIso(),
      updatedAt: finishedAt || nowIso(),
    };

    await this.runs.createRunStep(step);
    return step;
  }

  async run(tenantId: string, workflowId: string, input: Parameters<AgentWorkflowServiceV2['run']>[2]) {
    const workflow = await this.workflows.getById(tenantId, workflowId);
    if (!workflow) throw new Error('Workflow nicht gefunden');

    const version = this.getExecutableVersion(workflow);
    const idempotencyKey = input.idempotencyKey || crypto.randomUUID();

    const existing = await this.runs.findByIdempotencyKey(tenantId, version.id, idempotencyKey);
    if (existing) {
      const run = await this.runs.getRunWithDetails(tenantId, existing.id);
      if (!run) throw new Error('Bestehender Run nicht ladbar');
      return run;
    }

    const startedAt = nowIso();
    const run: WorkflowRunV2 = {
      id: crypto.randomUUID(),
      tenantId,
      workflowId,
      workflowVersionId: version.id,
      trigger: 'manual',
      status: 'running',
      idempotencyKey,
      input: input.input || {},
      startedAt,
      createdAt: startedAt,
      updatedAt: startedAt,
    };

    await this.runs.createRun(run);

    const nodes = topologicalSort(version.nodes.filter((node) => node.config.enabled), version.edges);
    const edgesBySource = resolveEdgesBySource(version);

    const messages: WorkflowMessageV2[] = [];
    let hasFailed = false;

    for (const node of nodes) {
      const incomingMessages = resolveIncomingMessages(messages, node.id);
      const incomingPayload = incomingMessages.reduce<Record<string, unknown>>((acc, message) => {
        acc[message.targetInputKey] = message.payload;
        return acc;
      }, {});

      const stepPayload: Record<string, unknown> = {
        runInput: input.input || {},
        nodeContext: {
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
        },
        incoming: incomingPayload,
      };

      const step = await this.executeNodeWithRetry(run, node, stepPayload);

      if (step.status === 'failed') {
        hasFailed = true;
        break;
      }

      const outgoingEdges = edgesBySource.get(node.id) || [];
      for (const edge of outgoingEdges) {
        const targetNode = nodes.find((entry) => entry.id === edge.targetNodeId);
        if (!targetNode) continue;

        const message: WorkflowMessageV2 = {
          id: crypto.randomUUID(),
          tenantId,
          runId: run.id,
          fromNodeId: node.id,
          fromNodeName: node.name,
          toNodeId: targetNode.id,
          toNodeName: targetNode.name,
          channel: edge.channel,
          targetInputKey: edge.targetInputKey,
          payload: {
            channel: edge.channel,
            data: step.output || {},
          },
          createdAt: nowIso(),
        };

        await this.runs.createMessage(message);
        messages.push(message);
      }
    }

    const finishedAt = nowIso();
    await this.runs.updateRun(run.id, {
      status: hasFailed ? 'failed' : 'success',
      finishedAt,
      durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
    });

    const finalRun = await this.runs.getRunWithDetails(tenantId, run.id);
    if (!finalRun) throw new Error('Run konnte nach Ausführung nicht geladen werden');
    return finalRun;
  }

  async listRuns(tenantId: string, limit?: number) {
    return this.runs.listRuns(tenantId, limit);
  }

  async getRun(tenantId: string, runId: string) {
    return this.runs.getRunWithDetails(tenantId, runId);
  }

  async getRunMessages(tenantId: string, runId: string) {
    return this.runs.getRunMessages(tenantId, runId);
  }
}

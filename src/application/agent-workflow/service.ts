import {
  AgentStepType,
  CreateWorkflowInput,
  RunWorkflowInput,
  StepStatus,
  UpdateWorkflowInput,
  WorkflowNode,
  WorkflowRun,
  WorkflowRunStep,
  WorkflowVersion,
  WorkflowWithVersions,
} from '@/domain/agent-workflow/models';
import {
  AgentModelRunner,
  AgentWorkflowService,
  WorkflowExecutionResult,
  WorkflowRepository,
  WorkflowRunRepository,
} from './ports';

const DEFAULT_TENANT_ID = 'default';

const DEFAULT_NODE_ORDER: Array<{ type: AgentStepType; name: string; instruction: string }> = [
  {
    type: 'research',
    name: 'Recherche',
    instruction:
      'Sammle die wichtigsten Fakten, Suchintentionen und Quellen zur Ziel-URL und dem Keyword. Gib strukturierte Stichpunkte zur weiteren Verarbeitung aus.',
  },
  {
    type: 'analysis',
    name: 'Analyse',
    instruction:
      'Analysiere die Rechercheergebnisse nach Chancen, Lücken und Risiken. Fasse priorisierte Erkenntnisse zusammen.',
  },
  {
    type: 'briefing',
    name: 'Briefing',
    instruction:
      'Erstelle auf Basis der Analyse ein strukturiertes Content-Briefing mit H2/H3-Struktur, Tonalität und SEO-Hinweisen.',
  },
  {
    type: 'draft',
    name: 'Text-Erstellung',
    instruction:
      'Erstelle den eigentlichen Entwurfstext basierend auf dem Briefing. Berücksichtige die Ziele für Lesbarkeit und SEO.',
  },
  {
    type: 'review',
    name: 'Prüfung',
    instruction:
      'Prüfe den Entwurf auf Vollständigkeit, SEO-Regeln und Konsistenz. Gib konkrete Verbesserungshinweise und eine finale Kurzbewertung aus.',
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function computeStepStatus(output?: Record<string, unknown>, error?: string): StepStatus {
  if (error) return 'failed';
  if (!output) return 'pending';
  return 'success';
}

export class DefaultAgentWorkflowService implements AgentWorkflowService {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly runs: WorkflowRunRepository,
    private readonly modelRunner: AgentModelRunner
  ) {}

  private async ensureDefaultWorkflow(tenantId: string): Promise<void> {
    const existing = await this.workflows.list(tenantId);
    const hasDefault = existing.some((workflow) => workflow.mode === 'default');
    if (hasDefault) return;

    const created = await this.workflows.create({
      tenantId,
      name: 'Default Agent Workflow',
      description: 'Standard-Workflow für Recherche, Analyse, Briefing, Draft und Prüfung.',
      mode: 'default',
    });

    const draftVersion = created.draftVersion;
    if (!draftVersion) return;

    const nodes = DEFAULT_NODE_ORDER.map((nodeDef, index) => ({
      id: crypto.randomUUID(),
      name: nodeDef.name,
      type: nodeDef.type,
      position: index,
      config: {
        instruction: nodeDef.instruction,
        provider: 'openrouter' as const,
        model: 'openai/gpt-4o-mini',
        timeoutMs: 45000,
        retries: 1,
        enabled: true,
      },
    }));

    const now = nowIso();

    const edges = nodes.slice(0, -1).map((node, index) => ({
      id: crypto.randomUUID(),
      tenantId,
      workflowVersionId: draftVersion.id,
      sourceNodeId: node.id,
      targetNodeId: nodes[index + 1].id,
      createdAt: now,
      updatedAt: now,
    }));

    await this.workflows.update(tenantId, created.id, {
      nodes,
      edges,
    });
    await this.workflows.publish(tenantId, created.id);
  }

  async list(tenantId: string = DEFAULT_TENANT_ID): Promise<WorkflowWithVersions[]> {
    await this.ensureDefaultWorkflow(tenantId);
    return this.workflows.list(tenantId);
  }

  async create(input: CreateWorkflowInput): Promise<WorkflowWithVersions> {
    return this.workflows.create(input);
  }

  async update(tenantId: string, workflowId: string, input: UpdateWorkflowInput): Promise<WorkflowWithVersions> {
    return this.workflows.update(tenantId, workflowId, input);
  }

  async publish(tenantId: string, workflowId: string): Promise<WorkflowWithVersions> {
    return this.workflows.publish(tenantId, workflowId);
  }

  private getExecutableVersion(workflow: WorkflowWithVersions): WorkflowVersion {
    if (workflow.activeVersion) return workflow.activeVersion;
    if (workflow.draftVersion) return workflow.draftVersion;
    throw new Error('Workflow hat keine ausführbare Version.');
  }

  private async executeNodeWithRetry(
    run: WorkflowRun,
    node: WorkflowNode,
    input: Record<string, unknown>
  ): Promise<WorkflowRunStep> {
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
          payload: input,
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

    const stepStatus = computeStepStatus(output, lastError);
    const step: WorkflowRunStep = {
      id: crypto.randomUUID(),
      tenantId: run.tenantId,
      runId: run.id,
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      provider: node.config.provider,
      model: node.config.model,
      attempt,
      status: stepStatus,
      input,
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

  async run(tenantId: string, workflowId: string, input: RunWorkflowInput): Promise<WorkflowExecutionResult> {
    const workflow = await this.workflows.getById(tenantId, workflowId);
    if (!workflow) {
      throw new Error('Workflow nicht gefunden.');
    }

    const version = this.getExecutableVersion(workflow);
    const idempotencyKey = input.idempotencyKey || crypto.randomUUID();
    const existingRun = await this.runs.findByIdempotencyKey(tenantId, version.id, idempotencyKey);
    if (existingRun) {
      const existing = await this.runs.getRunWithSteps(tenantId, existingRun.id);
      if (!existing) {
        throw new Error('Vorhandener Run konnte nicht geladen werden.');
      }
      return {
        run: existing,
        steps: existing.steps,
      };
    }

    const startedAt = nowIso();
    const run: WorkflowRun = {
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

    const nodes = [...version.nodes]
      .filter((node) => node.config.enabled)
      .sort((a, b) => a.position - b.position);

    const executedSteps: WorkflowRunStep[] = [];
    let payload: Record<string, unknown> = { ...(input.input || {}) };
    let hasFailed = false;

    for (const node of nodes) {
      const step = await this.executeNodeWithRetry(run, node, payload);
      executedSteps.push(step);

      if (step.status === 'failed') {
        hasFailed = true;
        break;
      }

      payload = {
        ...payload,
        [node.type]: step.output,
        lastStepOutput: step.output,
      };
    }

    const finishedAt = nowIso();
    const status = hasFailed ? 'failed' : 'success';

    await this.runs.updateRun(run.id, {
      status,
      finishedAt,
      durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
    });

    const finalRunWithSteps = await this.runs.getRunWithSteps(tenantId, run.id);
    if (!finalRunWithSteps) {
      throw new Error('Run konnte nach Ausführung nicht geladen werden.');
    }

    return {
      run: finalRunWithSteps,
      steps: finalRunWithSteps.steps,
    };
  }

  async listRuns(tenantId: string, limit?: number) {
    return this.runs.listRuns(tenantId, limit);
  }

  async getRun(tenantId: string, runId: string) {
    return this.runs.getRunWithSteps(tenantId, runId);
  }
}

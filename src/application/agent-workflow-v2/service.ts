import {
  AgentStepType,
  WorkflowMessageV2,
  WorkflowNodeV2,
  WorkflowRunStepV2,
  WorkflowRunV2,
  WorkflowRunWithDetailsV2,
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
    type: 'orchestrator',
    name: 'Parent Agent (Orchestrator)',
    instruction: 'Orchestriere die nachgelagerten Agenten, strukturiere den Kontext und delegiere Aufgaben entlang des Flows.',
    x: 320,
    y: 80,
  },
  {
    type: 'research',
    name: 'Research Agent',
    instruction: 'Sammle relevante Quellen, Suchintentionen und Fakten für die Content-Aufgabe.',
    x: 320,
    y: 250,
  },
  {
    type: 'analysis',
    name: 'Analysis Agent',
    instruction: 'Analysiere die Rechercheergebnisse und identifiziere Chancen, Lücken und Risiken.',
    x: 320,
    y: 420,
  },
  {
    type: 'briefing',
    name: 'Briefing Agent',
    instruction: 'Erzeuge aus der Analyse ein klares Briefing mit Struktur, WDF, Tonalität und Ziel.',
    x: 320,
    y: 590,
  },
  {
    type: 'draft',
    name: 'Draft Agent',
    instruction: 'Erstelle den Entwurf basierend auf dem Briefing und allen relevanten Inputs.',
    x: 320,
    y: 760,
  },
  {
    type: 'review',
    name: 'Review Agent',
    instruction: 'Prüfe Entwurf auf SEO, Lesbarkeit und Vollständigkeit. Liefere den überarbeiteten, fertigen HTML-Text zurück.',
    x: 320,
    y: 930,
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

const MAX_ORCHESTRATOR_ROUNDS = 12;

type OrchestratorDecision = {
  finalize: boolean;
  summary?: string;
  finalHtml?: string;
  next?: {
    targetNodeId: string;
    objective: string;
    expectedOutput?: string;
  };
  memoryPatch?: Record<string, unknown>;
};

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function extractDecisionFromOutput(output?: Record<string, unknown>): OrchestratorDecision | null {
  if (!output) return null;

  const directDecision = output.decision as Record<string, unknown> | undefined;
  const outputText = typeof output.text === 'string' ? output.text : '';
  const fromText = outputText ? tryParseJsonObject(outputText) : null;
  const candidate = directDecision || fromText;
  if (!candidate) return null;

  const finalize = Boolean(candidate.finalize);
  const summary = typeof candidate.summary === 'string' ? candidate.summary : undefined;
  const finalHtml = typeof candidate.finalHtml === 'string' ? candidate.finalHtml : undefined;
  const nextRaw = candidate.next;
  const memoryPatch =
    candidate.memoryPatch && typeof candidate.memoryPatch === 'object' && !Array.isArray(candidate.memoryPatch)
      ? (candidate.memoryPatch as Record<string, unknown>)
      : undefined;

  if (!finalize) {
    if (!nextRaw || typeof nextRaw !== 'object' || Array.isArray(nextRaw)) return null;
    const targetNodeId = String((nextRaw as any).targetNodeId || '').trim();
    const objective = String((nextRaw as any).objective || '').trim();
    const expectedOutput = String((nextRaw as any).expectedOutput || '').trim() || undefined;
    if (!targetNodeId || !objective) return null;
    return {
      finalize,
      summary,
      finalHtml,
      next: {
        targetNodeId,
        objective,
        expectedOutput,
      },
      memoryPatch,
    };
  }

  return {
    finalize,
    summary,
    finalHtml,
    memoryPatch,
  };
}

function buildAgentCatalog(nodes: WorkflowNodeV2[]): Array<{
  nodeId: string;
  name: string;
  type: AgentStepType;
  purpose: string;
  inputContract: string;
  outputContract: string;
}> {
  return nodes
    .filter((node) => !(node.isParent || node.type === 'orchestrator'))
    .map((node) => ({
      nodeId: node.id,
      name: node.name,
      type: node.type,
      purpose: String((node.config as any).purpose || ''),
      inputContract: String((node.config as any).inputContract || ''),
      outputContract: String((node.config as any).outputContract || ''),
    }));
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

  private buildParentNode(tenantId: string, workflowVersionId: string) {
    const timestamp = nowIso();
    return {
      id: crypto.randomUUID(),
      name: 'Parent Agent (Orchestrator)',
      type: 'orchestrator' as const,
      position: 0,
      x: 320,
      y: 80,
      isParent: true,
      config: {
        instruction: 'Orchestriere die nachgelagerten Agenten, strukturiere den Kontext und delegiere Aufgaben entlang des Flows.',
        purpose:
          'Du bist der Orchestrator. Entscheide in jeder Runde, welcher Subagent als nächstes die höchste Priorität hat, basierend auf Agent-Katalog und bisherigen Ergebnissen.',
        inputContract:
          'Du erhältst runInput, agentCatalog, workingMemory, completedTasks und lastTaskResult. Nutze diese, um die nächste Aufgabe zu planen.',
        outputContract:
          'Antworte NUR als JSON: {"finalize": boolean, "summary"?: string, "finalHtml"?: string, "next"?: {"targetNodeId": string, "objective": string, "expectedOutput"?: string}, "memoryPatch"?: object}. Wenn finalize=true, MUSS "finalHtml" den fertigen HTML-Text des Artikels enthalten (aus dem letzten Sub-Agenten-Ergebnis).',
        provider: 'openrouter' as const,
        model: 'openai/gpt-4o-mini',
        timeoutMs: 45000,
        retries: 1,
        enabled: true,
      },
      tenantId,
      workflowVersionId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private ensureParentNode(
    tenantId: string,
    workflowVersionId: string,
    nodes: Array<{
      id: string;
      name: string;
      type: AgentStepType;
      position: number;
      x: number;
      y: number;
      isParent?: boolean;
      config: any;
    }>
  ) {
    const parentNode = nodes.find((node) => node.type === 'orchestrator' || node.isParent);
    const normalized = nodes.filter((node) => node.id !== parentNode?.id).map((node, index) => ({
      ...node,
      isParent: false,
      position: index + 1,
    }));

    if (parentNode) {
      return [
        {
          ...parentNode,
          type: 'orchestrator' as const,
          isParent: true,
          position: 0,
          x: Number.isFinite(parentNode.x) ? parentNode.x : 320,
          y: Number.isFinite(parentNode.y) ? parentNode.y : 80,
        },
        ...normalized,
      ];
    }

    return [this.buildParentNode(tenantId, workflowVersionId), ...normalized];
  }

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
        isParent: nodeDef.type === 'orchestrator',
        config: {
        instruction: nodeDef.instruction,
        purpose: `Verantwortlich für ${nodeDef.type} in der Content-Pipeline.`,
        inputContract: 'Erhält task objective, runInput, workingMemory und letzte Ergebnisse als Kontext.',
        outputContract: 'Liefert strukturiertes JSON mit Ergebnis, Annahmen, offenen Fragen und nextHints.',
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
    const created = await this.workflows.create(input);
    const draftVersion = created.draftVersion;
    if (!draftVersion) return created;

    const parentNode = this.buildParentNode(input.tenantId, draftVersion.id);

    if (input.mode === 'default') {
      const timestamp = nowIso();
      const defaultNodes = DEFAULT_NODE_ORDER
        .filter((node) => node.type !== 'orchestrator')
        .map((nodeDef, index) => ({
          id: crypto.randomUUID(),
          name: nodeDef.name,
          type: nodeDef.type,
          position: index + 1,
          x: nodeDef.x,
          y: nodeDef.y,
          isParent: false,
          config: {
            instruction: nodeDef.instruction,
            purpose: `Verantwortlich für ${nodeDef.type} in der Content-Pipeline.`,
            inputContract: 'Erhält task objective, runInput, workingMemory und letzte Ergebnisse als Kontext.',
            outputContract: 'Liefert strukturiertes JSON mit Ergebnis, Annahmen, offenen Fragen und nextHints.',
            provider: 'openrouter' as const,
            model: 'openai/gpt-4o-mini',
            timeoutMs: 45000,
            retries: 1,
            enabled: true,
          },
          tenantId: input.tenantId,
          workflowVersionId: draftVersion.id,
          createdAt: timestamp,
          updatedAt: timestamp,
        }));

      const chain = [parentNode, ...defaultNodes];
      const edges = chain.slice(0, -1).map((node, index) => ({
        id: crypto.randomUUID(),
        sourceNodeId: node.id,
        targetNodeId: chain[index + 1].id,
        channel: `${node.type}.output`,
        targetInputKey: `${chain[index + 1].type}Input`,
      }));

      return this.workflows.update(input.tenantId, created.id, {
        nodes: chain,
        edges,
      });
    }

    return this.workflows.update(input.tenantId, created.id, {
      nodes: [parentNode],
      edges: [],
    });
  }

  async update(tenantId: string, workflowId: string, input: Parameters<WorkflowRepositoryV2['update']>[2]) {
    if (!input.nodes) {
      return this.workflows.update(tenantId, workflowId, input);
    }

    const existing = await this.workflows.getById(tenantId, workflowId);
    const versionId = existing?.draftVersion?.id || existing?.activeVersion?.id || crypto.randomUUID();
    const normalizedNodes = this.ensureParentNode(tenantId, versionId, input.nodes as any);

    return this.workflows.update(tenantId, workflowId, {
      ...input,
      nodes: normalizedNodes,
    });
  }

  async publish(tenantId: string, workflowId: string) {
    return this.workflows.publish(tenantId, workflowId);
  }

  private getExecutableVersion(workflow: WorkflowWithVersionsV2, runFrom: 'draft' | 'published' = 'published'): WorkflowVersionV2 {
    if (runFrom === 'draft') {
      if (workflow.draftVersion) return workflow.draftVersion;
      throw new Error('Draft-Version nicht verfügbar. Bitte zuerst speichern.');
    }

    if (workflow.activeVersion) return workflow.activeVersion;
    if (workflow.draftVersion) return workflow.draftVersion;
    throw new Error('Workflow hat keine ausführbare Version.');
  }

  private async executeNodeWithRetry(
    run: WorkflowRunV2,
    node: WorkflowNodeV2,
    inputPayload: Record<string, unknown>,
    meta?: { round?: number; phase?: 'orchestrator_decision' | 'subagent_execution'; correlationId?: string }
  ): Promise<WorkflowRunStepV2> {
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
      round: meta?.round,
      phase: meta?.phase,
      correlationId: meta?.correlationId,
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

    const runFrom = input.runFrom === 'published' ? 'published' : 'draft';
    const version = this.getExecutableVersion(workflow, runFrom);
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
    const orchestrator = nodes.find((node) => node.isParent || node.type === 'orchestrator');
    if (!orchestrator) {
      throw new Error(
        `Kein Parent Agent (Orchestrator) in der ${runFrom === 'draft' ? 'Draft' : 'Published'}-Version gefunden.`
      );
    }

    const subAgents = nodes.filter((node) => node.id !== orchestrator.id);
    const subAgentById = new Map(subAgents.map((node) => [node.id, node]));
    const agentCatalog = buildAgentCatalog(nodes);

    const messages: WorkflowMessageV2[] = [];
    let hasFailed = false;
    let round = 1;
    let finalized = false;
    let lastTaskResult: Record<string, unknown> | null = null;
    let capturedFinalHtml: string | undefined;
    const completedTasks: Array<Record<string, unknown>> = [];
    const workingMemory: Record<string, unknown> = {
      runInput: input.input || {},
      notes: [],
      decisions: [],
    };

    while (!finalized && round <= MAX_ORCHESTRATOR_ROUNDS) {
      const decisionPayload: Record<string, unknown> = {
        runInput: input.input || {},
        round,
        orchestratorContract: {
          requiredFormat:
            '{"finalize": boolean, "summary"?: string, "next"?: {"targetNodeId": string, "objective": string, "expectedOutput"?: string}, "memoryPatch"?: object}',
          rules: [
            'Wähle exakt einen nächsten Subagenten pro Runde oder finalize=true.',
            'Nutze nur targetNodeId aus dem agentCatalog.',
            'Schreibe ausschließlich valides JSON ohne Markdown.',
          ],
        },
        agentCatalog,
        workingMemory,
        completedTasks,
        lastTaskResult,
      };

      const orchestratorStep = await this.executeNodeWithRetry(run, orchestrator, decisionPayload, {
        round,
        phase: 'orchestrator_decision',
      });

      if (orchestratorStep.status === 'failed') {
        hasFailed = true;
        break;
      }

      const decision = extractDecisionFromOutput(orchestratorStep.output);
      if (!decision) {
        hasFailed = true;
        await this.runs.createMessage({
          id: crypto.randomUUID(),
          tenantId,
          runId: run.id,
          fromNodeId: orchestrator.id,
          fromNodeName: orchestrator.name,
          toNodeId: orchestrator.id,
          toNodeName: orchestrator.name,
          channel: 'control.invalid_orchestrator_decision',
          messageType: 'control',
          round,
          targetInputKey: 'decision',
          payload: {
            error: 'Orchestrator lieferte kein valides Entscheidungs-JSON.',
            raw: orchestratorStep.output || {},
          },
          createdAt: nowIso(),
        });
        break;
      }

      if (decision.memoryPatch) {
        Object.assign(workingMemory, decision.memoryPatch);
      }

      if (decision.summary) {
        const notes = Array.isArray(workingMemory.notes) ? workingMemory.notes : [];
        notes.push({ round, summary: decision.summary });
        workingMemory.notes = notes;
      }

      if (decision.finalize) {
        finalized = true;
        if (decision.finalHtml) capturedFinalHtml = decision.finalHtml;
        break;
      }

      const targetNodeId = decision.next?.targetNodeId || '';
      const targetNode = subAgentById.get(targetNodeId);
      if (!targetNode) {
        hasFailed = true;
        await this.runs.createMessage({
          id: crypto.randomUUID(),
          tenantId,
          runId: run.id,
          fromNodeId: orchestrator.id,
          fromNodeName: orchestrator.name,
          toNodeId: orchestrator.id,
          toNodeName: orchestrator.name,
          channel: 'control.unknown_target',
          messageType: 'control',
          round,
          targetInputKey: 'decision.next.targetNodeId',
          payload: {
            error: `Unbekannter targetNodeId: ${targetNodeId}`,
            decision,
          },
          createdAt: nowIso(),
        });
        break;
      }

      const correlationId = crypto.randomUUID();
      const requestMessage: WorkflowMessageV2 = {
        id: crypto.randomUUID(),
        tenantId,
        runId: run.id,
        fromNodeId: orchestrator.id,
        fromNodeName: orchestrator.name,
        toNodeId: targetNode.id,
        toNodeName: targetNode.name,
        channel: 'task.request',
        messageType: 'task_request',
        round,
        correlationId,
        targetInputKey: 'task',
        payload: {
          objective: decision.next?.objective || '',
          expectedOutput: decision.next?.expectedOutput || String((targetNode.config as any).outputContract || ''),
          context: {
            runInput: input.input || {},
            workingMemory,
            completedTasks,
            lastTaskResult,
          },
        },
        createdAt: nowIso(),
      };
      await this.runs.createMessage(requestMessage);
      messages.push(requestMessage);

      const subagentPayload: Record<string, unknown> = {
        runInput: input.input || {},
        round,
        nodeContext: {
          nodeId: targetNode.id,
          nodeName: targetNode.name,
          nodeType: targetNode.type,
          purpose: (targetNode.config as any).purpose || '',
          inputContract: (targetNode.config as any).inputContract || '',
          outputContract: (targetNode.config as any).outputContract || '',
        },
        task: requestMessage.payload,
      };

      const subagentStep = await this.executeNodeWithRetry(run, targetNode, subagentPayload, {
        round,
        phase: 'subagent_execution',
        correlationId,
      });

      if (subagentStep.status === 'failed') {
        hasFailed = true;
        break;
      }

      const resultMessage: WorkflowMessageV2 = {
        id: crypto.randomUUID(),
        tenantId,
        runId: run.id,
        fromNodeId: targetNode.id,
        fromNodeName: targetNode.name,
        toNodeId: orchestrator.id,
        toNodeName: orchestrator.name,
        channel: 'task.result',
        messageType: 'task_result',
        round,
        correlationId,
        targetInputKey: 'lastTaskResult',
        payload: {
          taskObjective: decision.next?.objective || '',
          output: subagentStep.output || {},
          nodeId: targetNode.id,
          nodeName: targetNode.name,
          nodeType: targetNode.type,
        },
        createdAt: nowIso(),
      };
      await this.runs.createMessage(resultMessage);
      messages.push(resultMessage);

      lastTaskResult = {
        round,
        correlationId,
        nodeId: targetNode.id,
        nodeName: targetNode.name,
        output: subagentStep.output || {},
      };
      completedTasks.push(lastTaskResult);

      const decisions = Array.isArray(workingMemory.decisions) ? workingMemory.decisions : [];
      decisions.push({
        round,
        targetNodeId: targetNode.id,
        objective: decision.next?.objective || '',
        correlationId,
      });
      workingMemory.decisions = decisions;

      round += 1;
    }

    if (!hasFailed && !finalized && round > MAX_ORCHESTRATOR_ROUNDS) {
      hasFailed = true;
      await this.runs.createMessage({
        id: crypto.randomUUID(),
        tenantId,
        runId: run.id,
        fromNodeId: orchestrator.id,
        fromNodeName: orchestrator.name,
        toNodeId: orchestrator.id,
        toNodeName: orchestrator.name,
        channel: 'control.max_rounds_reached',
        messageType: 'control',
        round: MAX_ORCHESTRATOR_ROUNDS,
        targetInputKey: 'runControl',
        payload: {
          maxRounds: MAX_ORCHESTRATOR_ROUNDS,
        },
        createdAt: nowIso(),
      });
    }

    const finishedAt = nowIso();
    const finalStatus: WorkflowRunWithDetailsV2['status'] = hasFailed ? 'failed' : 'success';
    const finalDurationMs = Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime());
    const finalOutput: Record<string, unknown> | undefined = capturedFinalHtml
      ? { finalHtml: capturedFinalHtml }
      : undefined;

    // Persist final run status. If this fails (e.g. Airtable rate-limit), log
    // and continue — the orchestration loop completed and we must not surface a
    // persistence error as a commissioning failure to the user.
    try {
      await this.runs.updateRun(run.id, {
        status: finalStatus,
        finishedAt,
        durationMs: finalDurationMs,
        output: finalOutput,
      });
    } catch (persistErr) {
      console.error('[AgentService] Failed to persist run status (non-fatal):', persistErr);
    }

    // Best-effort read-back for full details (steps + messages).
    try {
      const finalRun = await this.runs.getRunWithDetails(tenantId, run.id);
      if (finalRun) return finalRun;
    } catch (err) {
      console.error('[AgentService] getRunWithDetails failed after run completion:', err);
    }

    return {
      ...run,
      status: finalStatus,
      finishedAt,
      durationMs: finalDurationMs,
      output: finalOutput,
      steps: [],
      messages: [],
    };
  }

  async listRuns(tenantId: string, limit?: number, includeDeleted?: boolean) {
    return this.runs.listRuns(tenantId, limit, includeDeleted);
  }

  async getRun(tenantId: string, runId: string) {
    return this.runs.getRunWithDetails(tenantId, runId);
  }

  async getRunMessages(tenantId: string, runId: string) {
    return this.runs.getRunMessages(tenantId, runId);
  }

  async cancelRun(tenantId: string, runId: string) {
    return this.runs.cancelRun(tenantId, runId);
  }

  async softDeleteRun(tenantId: string, runId: string) {
    return this.runs.softDeleteRun(tenantId, runId);
  }

  async restoreRun(tenantId: string, runId: string) {
    return this.runs.restoreRun(tenantId, runId);
  }
}

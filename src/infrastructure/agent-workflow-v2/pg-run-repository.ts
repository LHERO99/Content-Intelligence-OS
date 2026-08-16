/**
 * pg-run-repository.ts
 * --------------------
 * PostgreSQL-backed implementation of WorkflowRunRepositoryV2.
 * Replaces the JSON-blob config-table storage that was limited to 20 runs,
 * 30 steps, and truncated 1.5 k payloads.
 *
 * All data is stored in proper relational tables:
 *   agent_workflow_runs   — run records
 *   agent_run_steps       — individual LLM call steps
 *   agent_run_messages    — inter-agent task_request / task_result messages
 */
import 'server-only';
import { eq, and, desc, asc, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  agentWorkflowRuns,
  agentRunSteps,
  agentRunMessages,
} from '@/lib/db/schema';
import type {
  WorkflowRunRepositoryV2,
} from '@/application/agent-workflow-v2/ports';
import type {
  WorkflowRunV2,
  WorkflowRunStepV2,
  WorkflowMessageV2,
  WorkflowRunWithDetailsV2,
} from '@/domain/agent-workflow-v2/models';

// ---------------------------------------------------------------------------
// Helpers: DB row ↔ domain model conversion
// ---------------------------------------------------------------------------

function rowToRun(row: typeof agentWorkflowRuns.$inferSelect): WorkflowRunV2 {
  return {
    id:               row.id,
    tenantId:         row.tenantId,
    workflowId:       row.workflowId,
    workflowVersionId: row.workflowVersionId,
    trigger:          (row.trigger as 'manual') ?? 'manual',
    status:           row.status as WorkflowRunV2['status'],
    idempotencyKey:   row.idempotencyKey,
    input:            (row.input as Record<string, unknown>) ?? {},
    output:           (row.output as Record<string, unknown>) ?? undefined,
    finalHtml:        row.finalHtml ?? undefined,
    cancelRequested:  row.cancelRequested,
    startedAt:        row.startedAt?.toISOString() ?? new Date().toISOString(),
    finishedAt:       row.finishedAt?.toISOString() ?? undefined,
    durationMs:       row.durationMs ?? undefined,
    deletedAt:        row.deletedAt?.toISOString() ?? undefined,
    createdAt:        row.createdAt.toISOString(),
    updatedAt:        row.updatedAt.toISOString(),
  };
}

function rowToStep(row: typeof agentRunSteps.$inferSelect): WorkflowRunStepV2 {
  return {
    id:            row.id,
    tenantId:      row.tenantId,
    runId:         row.runId,
    nodeId:        row.nodeId,
    nodeName:      row.nodeName,
    nodeType:      row.nodeType as WorkflowRunStepV2['nodeType'],
    provider:      row.provider as WorkflowRunStepV2['provider'],
    model:         row.model,
    attempt:       row.attempt,
    status:        row.status as WorkflowRunStepV2['status'],
    round:         row.round ?? undefined,
    phase:         row.phase as WorkflowRunStepV2['phase'] ?? undefined,
    correlationId: row.correlationId ?? undefined,
    input:         (row.input as Record<string, unknown>) ?? {},
    output:        (row.output as Record<string, unknown>) ?? undefined,
    error:         row.error ?? undefined,
    startedAt:     row.startedAt?.toISOString() ?? undefined,
    finishedAt:    row.finishedAt?.toISOString() ?? undefined,
    durationMs:    row.durationMs ?? undefined,
    createdAt:     row.createdAt.toISOString(),
    updatedAt:     row.updatedAt.toISOString(),
  };
}

function rowToMessage(row: typeof agentRunMessages.$inferSelect): WorkflowMessageV2 {
  return {
    id:             row.id,
    tenantId:       row.tenantId,
    runId:          row.runId,
    fromNodeId:     row.fromNodeId,
    fromNodeName:   row.fromNodeName,
    toNodeId:       row.toNodeId,
    toNodeName:     row.toNodeName,
    channel:        row.channel,
    messageType:    row.messageType as WorkflowMessageV2['messageType'] ?? undefined,
    correlationId:  row.correlationId ?? undefined,
    round:          row.round ?? undefined,
    targetInputKey: row.targetInputKey,
    payload:        (row.payload as Record<string, unknown>) ?? {},
    createdAt:      row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// PgWorkflowRunRepositoryV2
// ---------------------------------------------------------------------------

export class PgWorkflowRunRepositoryV2 implements WorkflowRunRepositoryV2 {

  // ── Runs ────────────────────────────────────────────────────────────────

  async createRun(run: WorkflowRunV2): Promise<WorkflowRunV2> {
    const [row] = await db
      .insert(agentWorkflowRuns)
      .values({
        id:               run.id,
        tenantId:         run.tenantId,
        workflowId:       run.workflowId,
        workflowVersionId: run.workflowVersionId,
        trigger:          run.trigger,
        status:           run.status,
        idempotencyKey:   run.idempotencyKey,
        input:            run.input,
        output:           run.output ?? null,
        finalHtml:        run.finalHtml ?? null,
        cancelRequested:  run.cancelRequested ?? false,
        startedAt:        run.startedAt ? new Date(run.startedAt) : new Date(),
        finishedAt:       run.finishedAt ? new Date(run.finishedAt) : null,
        durationMs:       run.durationMs ?? null,
        deletedAt:        run.deletedAt ? new Date(run.deletedAt) : null,
        createdAt:        new Date(run.createdAt),
        updatedAt:        new Date(run.updatedAt),
      })
      .returning();
    return rowToRun(row);
  }

  async updateRun(runId: string, updates: Partial<WorkflowRunV2>): Promise<void> {
    const patch: Partial<typeof agentWorkflowRuns.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (updates.status !== undefined)      patch.status          = updates.status;
    if (updates.output !== undefined)      patch.output          = updates.output;
    if (updates.finalHtml !== undefined)   patch.finalHtml       = updates.finalHtml;
    if (updates.cancelRequested !== undefined) patch.cancelRequested = updates.cancelRequested;
    if (updates.finishedAt !== undefined)  patch.finishedAt      = new Date(updates.finishedAt);
    if (updates.durationMs !== undefined)  patch.durationMs      = updates.durationMs;
    if (updates.deletedAt !== undefined)   patch.deletedAt       = updates.deletedAt ? new Date(updates.deletedAt) : null;

    await db.update(agentWorkflowRuns).set(patch).where(eq(agentWorkflowRuns.id, runId));
  }

  // ── Steps ───────────────────────────────────────────────────────────────

  async createRunStep(step: WorkflowRunStepV2): Promise<WorkflowRunStepV2> {
    const [row] = await db
      .insert(agentRunSteps)
      .values({
        id:            step.id,
        tenantId:      step.tenantId,
        runId:         step.runId,
        nodeId:        step.nodeId,
        nodeName:      step.nodeName,
        nodeType:      step.nodeType,
        provider:      step.provider,
        model:         step.model,
        attempt:       step.attempt,
        status:        step.status,
        round:         step.round ?? null,
        phase:         step.phase ?? null,
        correlationId: step.correlationId ?? null,
        input:         step.input,
        output:        step.output ?? null,
        error:         step.error ?? null,
        startedAt:     step.startedAt  ? new Date(step.startedAt)  : null,
        finishedAt:    step.finishedAt ? new Date(step.finishedAt) : null,
        durationMs:    step.durationMs ?? null,
        createdAt:     new Date(step.createdAt),
        updatedAt:     new Date(step.updatedAt),
      })
      .returning();
    return rowToStep(row);
  }

  async updateRunStep(stepId: string, updates: Partial<WorkflowRunStepV2>): Promise<void> {
    const patch: Partial<typeof agentRunSteps.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (updates.status !== undefined)    patch.status    = updates.status;
    if (updates.output !== undefined)    patch.output    = updates.output;
    if (updates.error !== undefined)     patch.error     = updates.error;
    if (updates.finishedAt !== undefined) patch.finishedAt = new Date(updates.finishedAt);
    if (updates.durationMs !== undefined) patch.durationMs = updates.durationMs;

    await db.update(agentRunSteps).set(patch).where(eq(agentRunSteps.id, stepId));
  }

  // ── Messages ────────────────────────────────────────────────────────────

  async createMessage(message: WorkflowMessageV2): Promise<WorkflowMessageV2> {
    const [row] = await db
      .insert(agentRunMessages)
      .values({
        id:             message.id,
        tenantId:       message.tenantId,
        runId:          message.runId,
        fromNodeId:     message.fromNodeId,
        fromNodeName:   message.fromNodeName,
        toNodeId:       message.toNodeId,
        toNodeName:     message.toNodeName,
        channel:        message.channel,
        messageType:    message.messageType ?? null,
        correlationId:  message.correlationId ?? null,
        round:          message.round ?? null,
        targetInputKey: message.targetInputKey,
        payload:        message.payload,
        createdAt:      new Date(message.createdAt),
      })
      .returning();
    return rowToMessage(row);
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  async listRuns(
    tenantId: string,
    limit: number = 50,
    includeDeleted = false,
  ): Promise<WorkflowRunV2[]> {
    const conditions = includeDeleted
      ? [eq(agentWorkflowRuns.tenantId, tenantId)]
      : [eq(agentWorkflowRuns.tenantId, tenantId), isNull(agentWorkflowRuns.deletedAt)];

    const rows = await db
      .select()
      .from(agentWorkflowRuns)
      .where(and(...conditions))
      .orderBy(desc(agentWorkflowRuns.createdAt))
      .limit(limit);

    return rows.map(rowToRun);
  }

  async getRunWithDetails(
    tenantId: string,
    runId: string,
  ): Promise<WorkflowRunWithDetailsV2 | null> {
    const [runRow] = await db
      .select()
      .from(agentWorkflowRuns)
      .where(and(eq(agentWorkflowRuns.id, runId), eq(agentWorkflowRuns.tenantId, tenantId)))
      .limit(1);

    if (!runRow) return null;

    const [stepRows, messageRows] = await Promise.all([
      db
        .select()
        .from(agentRunSteps)
        .where(eq(agentRunSteps.runId, runId))
        .orderBy(asc(agentRunSteps.createdAt)),
      db
        .select()
        .from(agentRunMessages)
        .where(eq(agentRunMessages.runId, runId))
        .orderBy(asc(agentRunMessages.createdAt)),
    ]);

    return {
      ...rowToRun(runRow),
      steps:    stepRows.map(rowToStep),
      messages: messageRows.map(rowToMessage),
    };
  }

  async getRunMessages(tenantId: string, runId: string): Promise<WorkflowMessageV2[]> {
    const rows = await db
      .select()
      .from(agentRunMessages)
      .where(and(eq(agentRunMessages.runId, runId), eq(agentRunMessages.tenantId, tenantId)))
      .orderBy(asc(agentRunMessages.createdAt));
    return rows.map(rowToMessage);
  }

  async findByIdempotencyKey(
    tenantId: string,
    workflowVersionId: string,
    idempotencyKey: string,
  ): Promise<WorkflowRunV2 | null> {
    const [row] = await db
      .select()
      .from(agentWorkflowRuns)
      .where(
        and(
          eq(agentWorkflowRuns.tenantId, tenantId),
          eq(agentWorkflowRuns.workflowVersionId, workflowVersionId),
          eq(agentWorkflowRuns.idempotencyKey, idempotencyKey),
          isNull(agentWorkflowRuns.deletedAt),
        ),
      )
      .limit(1);

    return row ? rowToRun(row) : null;
  }

  // ── Cancellation ────────────────────────────────────────────────────────

  async isCancelRequested(tenantId: string, runId: string): Promise<boolean> {
    const [row] = await db
      .select({ cancelRequested: agentWorkflowRuns.cancelRequested })
      .from(agentWorkflowRuns)
      .where(and(eq(agentWorkflowRuns.id, runId), eq(agentWorkflowRuns.tenantId, tenantId)))
      .limit(1);
    return row?.cancelRequested ?? false;
  }

  async requestCancel(tenantId: string, runId: string): Promise<void> {
    await db
      .update(agentWorkflowRuns)
      .set({ cancelRequested: true, updatedAt: new Date() })
      .where(and(eq(agentWorkflowRuns.id, runId), eq(agentWorkflowRuns.tenantId, tenantId)));
  }

  async cancelRun(tenantId: string, runId: string): Promise<WorkflowRunV2 | null> {
    const now = new Date();
    const [row] = await db
      .select()
      .from(agentWorkflowRuns)
      .where(and(eq(agentWorkflowRuns.id, runId), eq(agentWorkflowRuns.tenantId, tenantId), isNull(agentWorkflowRuns.deletedAt)))
      .limit(1);

    if (!row) return null;

    const durationMs = row.startedAt
      ? Math.max(0, now.getTime() - row.startedAt.getTime())
      : undefined;

    const [updated] = await db
      .update(agentWorkflowRuns)
      .set({
        status:          'cancelled',
        cancelRequested: true,
        finishedAt:      row.finishedAt ?? now,
        durationMs:      row.durationMs ?? durationMs,
        updatedAt:       now,
      })
      .where(eq(agentWorkflowRuns.id, runId))
      .returning();

    return updated ? rowToRun(updated) : null;
  }

  // ── Soft delete / restore ────────────────────────────────────────────────

  async softDeleteRun(tenantId: string, runId: string): Promise<WorkflowRunV2 | null> {
    const now = new Date();
    const [updated] = await db
      .update(agentWorkflowRuns)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(agentWorkflowRuns.id, runId), eq(agentWorkflowRuns.tenantId, tenantId)))
      .returning();
    return updated ? rowToRun(updated) : null;
  }

  async restoreRun(tenantId: string, runId: string): Promise<WorkflowRunV2 | null> {
    const now = new Date();
    const [updated] = await db
      .update(agentWorkflowRuns)
      .set({ deletedAt: null, updatedAt: now })
      .where(and(eq(agentWorkflowRuns.id, runId), eq(agentWorkflowRuns.tenantId, tenantId)))
      .returning();
    return updated ? rowToRun(updated) : null;
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentWorkflowServiceV2 } from '@/app/api/agent-workflows-v2/_service';
import {
  createContentLog,
  getConfig,
  getKeywordsByUrl,
  recomputeUrlCostSummary,
  createExecutionVersion,
} from '@/lib/postgres';
import { db } from '@/lib/db';
import { executionCycles, urlKeywords, urls } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * POST /api/agent-webhook/runs/restart
 *
 * Restarts a failed or cancelled agent run on an existing execution cycle.
 * Does NOT create a new cycle — reuses the existing one with an incremented run.
 *
 * Body: { cycleId: number }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user?.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: 'No tenant found' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { cycleId } = body as { cycleId?: number };

    if (!cycleId) {
      return NextResponse.json({ message: 'cycleId required' }, { status: 400 });
    }

    // Load the cycle
    const [cycle] = await db
      .select()
      .from(executionCycles)
      .where(and(eq(executionCycles.id, cycleId), eq(executionCycles.tenantId, tenantId)))
      .limit(1);

    if (!cycle) {
      return NextResponse.json({ message: 'Execution cycle not found' }, { status: 404 });
    }

    if (!['failed', 'cancelled'].includes(cycle.status)) {
      return NextResponse.json({
        message: `Restart only allowed for failed or cancelled cycles (current: ${cycle.status})`,
      }, { status: 409 });
    }

    // Reset cycle to 'commissioned'
    await db
      .update(executionCycles)
      .set({
        status:        'commissioned',
        agentRunId:    null,
        failedAt:      null,
        failureReason: null,
        updatedAt:     new Date(),
      })
      .where(eq(executionCycles.id, cycleId));

    // Find the URL and its main keyword for the enriched payload
    const [urlRecord] = await db
      .select({ url: urls.url })
      .from(urls)
      .where(and(eq(urls.id, cycle.urlId), eq(urls.tenantId, tenantId)))
      .limit(1);

    const keywordRows = await db
      .select()
      .from(urlKeywords)
      .where(and(eq(urlKeywords.urlId, cycle.urlId), eq(urlKeywords.tenantId, tenantId)));

    const mainKeyword = keywordRows.find((k) => k.isMainKeyword) ?? keywordRows[0];
    const secondaryKeywords = keywordRows.filter((k) => !k.isMainKeyword).map((k) => k.keyword);

    // Load workflow config
    const config = await getConfig(tenantId);
    const customFlowEnabled = config.CUSTOM_FLOW_ENABLED === 'true';

    const agentService = createAgentWorkflowServiceV2();
    const workflows = await agentService.list(tenantId);

    const targetWorkflow = customFlowEnabled
      ? (workflows.find((w) => w.mode === 'custom') ?? workflows.find((w) => w.mode === 'default'))
      : workflows.find((w) => w.mode === 'default');

    if (!targetWorkflow) {
      return NextResponse.json({ message: 'Kein Agent-Flow konfiguriert.' }, { status: 500 });
    }

    const appBaseUrl = process.env.NEXTAUTH_URL ?? process.env.APP_BASE_URL ?? '';
    const enrichedPayload = {
      action:            cycle.actionType === 'optimization' ? 'COMMISSION_OPTIMIZATION' : 'COMMISSION_CONTENT',
      keywordId:         mainKeyword?.id ?? null,
      targetUrl:         urlRecord?.url ?? null,
      mainKeyword:       mainKeyword?.keyword ?? null,
      secondaryKeywords,
      pageType:          null,
      actionType:        cycle.actionType === 'optimization' ? 'Optimierung' : 'Erstellung',
      tenantId,
      callbackUrl:       `${appBaseUrl}/api/agent-webhook/callback`,
      userId:            session.user?.email ?? 'unknown',
      timestamp:         new Date().toISOString(),
      commissionLogId:   null,
      isRestart:         true,
    };

    // Respond immediately with the new run ID
    const immediateResponse = NextResponse.json({
      message: 'Run restarted',
      cycleId,
    }, { status: 202 });

    // Fire-and-forget background execution
    void executeRestartInBackground({
      agentService,
      tenantId,
      workflowId: targetWorkflow.id,
      enrichedPayload,
      cycleId,
      keywordId:  mainKeyword?.id,
      targetUrl:  urlRecord?.url,
      userId:     session.user?.id,
      actionType: cycle.actionType,
    });

    return immediateResponse;

  } catch (error: any) {
    console.error('[RestartRun] Error:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// ─── Background worker ────────────────────────────────────────────────────────

interface RestartOptions {
  agentService: ReturnType<typeof createAgentWorkflowServiceV2>;
  tenantId: string;
  workflowId: string;
  enrichedPayload: Record<string, unknown>;
  cycleId: number;
  keywordId: string | undefined;
  targetUrl: string | undefined;
  userId: string | undefined;
  actionType: string;
}

async function executeRestartInBackground(opts: RestartOptions): Promise<void> {
  const { agentService, tenantId, workflowId, enrichedPayload, cycleId, keywordId, targetUrl, userId, actionType } = opts;

  try {
    const run = await agentService.run(tenantId, workflowId, {
      input:   enrichedPayload,
      runFrom: 'published',
    });

    // Link the new run to the cycle
    if (run?.id) {
      await db.update(executionCycles)
        .set({ agentRunId: run.id, updatedAt: new Date() })
        .where(eq(executionCycles.id, cycleId));
    }

    if (run?.status === 'cancelled') {
      await db.update(executionCycles)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(executionCycles.id, cycleId));
      return;
    }

    if (run?.status === 'failed') {
      const failedStep = run.steps?.find((s) => s.status === 'failed' && s.error);
      const failureReason = failedStep ? `${failedStep.nodeName}: ${failedStep.error}` : 'Unbekannter Fehler';
      await db.update(executionCycles)
        .set({ status: 'failed', failedAt: new Date(), failureReason, updatedAt: new Date() })
        .where(eq(executionCycles.id, cycleId));
      return;
    }

    if (run?.status === 'success') {
      const finalHtml =
        typeof run.output?.finalHtml === 'string' ? run.output.finalHtml : run.finalHtml ?? undefined;

      await db.update(executionCycles)
        .set({ status: 'delivered', deliveredAt: new Date(), updatedAt: new Date() })
        .where(eq(executionCycles.id, cycleId));

      if (finalHtml && keywordId) {
        const versionId = await createExecutionVersion(
          cycleId, finalHtml,
          { createdByUserId: userId, createdByAi: true },
          tenantId
        );

        await createContentLog({
          Keyword_ID:  [keywordId],
          Target_URL:  targetUrl,
          Action_Type: actionType === 'optimization' ? 'Optimierung' : 'Erstellung',
          Event_Label: 'Content angeliefert',
          Cycle_Id:    cycleId,
          Version_Id:  versionId,
          Editor:      userId ? [userId] : undefined,
        }, tenantId);

        if (keywordId) {
          const { getUrlIdForKeyword } = await import('@/lib/postgres');
          const urlIdForSummary = await getUrlIdForKeyword(keywordId, tenantId);
          if (urlIdForSummary) {
            recomputeUrlCostSummary(urlIdForSummary, tenantId).catch(() => {});
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[RestartBg] Error:', err);
    await db.update(executionCycles)
      .set({ status: 'failed', failedAt: new Date(), failureReason: err?.message ?? 'Fehler beim Neustart', updatedAt: new Date() })
      .where(eq(executionCycles.id, cycleId));
  }
}

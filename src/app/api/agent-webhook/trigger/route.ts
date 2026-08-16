import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { triggerN8nWorkflow, N8nActionType } from '@/lib/n8n';
import {
  createContentLog,
  getConfig,
  getKeywordsByUrl,
  getUrlIdForKeyword,
  createExecutionCycle,
  createExecutionVersion,
  recomputeUrlCostSummary,
} from '@/lib/postgres';
import { createAgentWorkflowServiceV2 } from '@/app/api/agent-workflows-v2/_service';
import { db } from '@/lib/db';
import { executionCycles } from '@/lib/db/schema';
import { and, eq, ne } from 'drizzle-orm';

/**
 * API Route to trigger agent workflows or an external agent webhook.
 *
 * For COMMISSION_CONTENT / COMMISSION_OPTIMIZATION with the internal agent:
 *  - Returns 202 immediately with { cycleId, runId }
 *  - Runs the agent asynchronously (fire-and-forget on the persistent Node.js process)
 *  - On success: updates execution_cycle to 'delivered', creates execution_version
 *  - On failure: sets execution_cycle to 'failed' (no longer deletes it)
 *  - On cancel:  sets execution_cycle to 'cancelled'
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId;

    const body = await req.json();
    const { action, data } = body as { action: N8nActionType; data: Record<string, any> };

    if (!action || !data) {
      return NextResponse.json({ message: 'Missing action or data' }, { status: 400 });
    }

    // ── Step 1: Create execution cycle for commissioning actions ──────────────
    let commissionLogId: number | null = null;
    let executionCycleId: number | null = null;

    if ((action === 'COMMISSION_CONTENT' || action === 'COMMISSION_OPTIMIZATION') && data.keywordId) {
      const commissioningActionType = action === 'COMMISSION_OPTIMIZATION' ? 'Optimierung' : 'Erstellung';

      const urlId = await getUrlIdForKeyword(data.keywordId, tenantId);
      if (!urlId) {
        return NextResponse.json({ message: 'URL not found for keyword' }, { status: 404 });
      }

      try {
        executionCycleId = await createExecutionCycle(
          urlId,
          commissioningActionType,
          session.user?.id,
          tenantId
        );
      } catch (cycleErr) {
        console.error('[Trigger] Error creating execution cycle:', cycleErr);
        return NextResponse.json({ message: 'Failed to create execution cycle' }, { status: 500 });
      }

      try {
        const commissionLog = await createContentLog({
          Keyword_ID:  [data.keywordId],
          Target_URL:  data.targetUrl,
          Action_Type: commissioningActionType,
          Event_Label: 'Content wurde beauftragt',
          Cycle_Id:    executionCycleId,
          Editor:      session.user?.id ? [session.user.id] : undefined,
        }, tenantId);
        commissionLogId = commissionLog?.ID ?? null;
      } catch (logErr) {
        console.error('[Trigger] Error creating commissioning log:', logErr);
      }
    }

    // ── Step 2: Route commissioning actions ───────────────────────────────────
    if (action === 'COMMISSION_CONTENT' || action === 'COMMISSION_OPTIMIZATION') {
      const config = await getConfig(tenantId);
      const externalEnabled = config.EXTERNAL_AGENT_ENABLED === 'true';
      const externalUrl = config.EXTERNAL_AGENT_WEBHOOK_URL?.trim();

      // Build enriched payload
      let secondaryKeywords: string[] = [];
      if (data.targetUrl) {
        try {
          const allKeywords = await getKeywordsByUrl(data.targetUrl, tenantId);
          secondaryKeywords = allKeywords.filter((kw) => kw.Main_Keyword === 'N').map((kw) => kw.Keyword);
        } catch (kwErr) {
          console.error('[Trigger] Error fetching secondary keywords:', kwErr);
        }
      }

      const appBaseUrl = process.env.NEXTAUTH_URL ?? process.env.APP_BASE_URL ?? '';
      const enrichedPayload = {
        action,
        keywordId:          data.keywordId ?? null,
        targetUrl:          data.targetUrl ?? null,
        mainKeyword:        data.keyword ?? null,
        secondaryKeywords,
        pageType:           data.pageType ?? null,
        actionType:         action === 'COMMISSION_OPTIMIZATION' ? 'Optimierung' : 'Erstellung',
        tenantId,
        callbackUrl:        `${appBaseUrl}/api/agent-webhook/callback`,
        userId:             session.user?.email ?? 'unknown',
        timestamp:          new Date().toISOString(),
        commissionLogId,
      };

      // ── Path A: External Agent (fire-and-forget) ───────────────────────────
      if (externalEnabled && externalUrl) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const secret = config.EXTERNAL_AGENT_WEBHOOK_SECRET?.trim();
        if (secret) headers['Authorization'] = `Bearer ${secret}`;

        fetch(externalUrl, { method: 'POST', headers, body: JSON.stringify(enrichedPayload) })
          .catch((err) => console.error('[ExternalAgent] Webhook call failed:', err));

        return NextResponse.json({
          message: 'Action forwarded to external agent webhook',
          mode: 'external',
        }, { status: 200 });
      }

      // ── Path B: Internal Agent — async fire-and-forget ────────────────────
      const agentService = createAgentWorkflowServiceV2();
      const workflows = await agentService.list(tenantId);

      const customFlowEnabled = config.CUSTOM_FLOW_ENABLED === 'true';
      const targetWorkflow = customFlowEnabled
        ? (workflows.find((w) => w.mode === 'custom') ?? workflows.find((w) => w.mode === 'default'))
        : workflows.find((w) => w.mode === 'default');

      if (!targetWorkflow) {
        console.error('[InternalAgent] No workflow found for tenant:', tenantId);
        return NextResponse.json(
          { message: 'Kein Agent-Flow konfiguriert. Bitte einen Default Flow anlegen.' },
          { status: 500 }
        );
      }

      // Generate run ID so we can return it immediately
      const runIdPlaceholder = crypto.randomUUID();

      // Return 202 immediately — the run will be created asynchronously below
      const immediateResponse = NextResponse.json({
        message:      'Agent run started',
        mode:         'internal',
        workflowId:   targetWorkflow.id,
        workflowMode: targetWorkflow.mode,
        cycleId:      executionCycleId,
        runId:        runIdPlaceholder,
      }, { status: 202 });

      // ── Background execution (non-awaited) ────────────────────────────────
      void executeAgentInBackground({
        agentService,
        tenantId,
        workflowId: targetWorkflow.id,
        enrichedPayload,
        executionCycleId,
        commissionLogId,
        keywordId: data.keywordId,
        targetUrl: data.targetUrl,
        userId: session.user?.id,
        actionType: action,
        suggestedRunId: runIdPlaceholder,
      });

      return immediateResponse;
    }

    // ── Step 3: Fallback — Legacy n8n Workflow ────────────────────────────────
    const result = await triggerN8nWorkflow({
      action,
      data,
      userId: session.user?.email || 'unknown',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ message: 'Action triggered successfully', result }, { status: 200 });

  } catch (error: any) {
    console.error('[Trigger] Error:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// ─── Background worker ────────────────────────────────────────────────────────

interface BackgroundRunOptions {
  agentService: ReturnType<typeof createAgentWorkflowServiceV2>;
  tenantId: string;
  workflowId: string;
  enrichedPayload: Record<string, unknown>;
  executionCycleId: number | null;
  commissionLogId: number | null;
  keywordId: string | undefined;
  targetUrl: string | undefined;
  userId: string | undefined;
  actionType: string;
  suggestedRunId: string;
}

async function executeAgentInBackground(opts: BackgroundRunOptions): Promise<void> {
  const {
    agentService, tenantId, workflowId, enrichedPayload,
    executionCycleId, commissionLogId, keywordId, targetUrl, userId, actionType,
    suggestedRunId,
  } = opts;

  let run: Awaited<ReturnType<typeof agentService.run>> | null = null;

  try {
    // Pre-link execution_cycle ↔ agent_run BEFORE starting the run so that
    // the cancel endpoint can resolve the runId from the cycle immediately.
    if (executionCycleId && suggestedRunId) {
      try {
        // Only update to 'in_progress' if the cycle is NOT already 'cancelled'
        // (the user may have clicked "Abbrechen" before this background task started).
        await db.update(executionCycles)
          .set({ agentRunId: suggestedRunId, status: 'in_progress', updatedAt: new Date() })
          .where(and(
            eq(executionCycles.id, executionCycleId),
            ne(executionCycles.status, 'cancelled'),
          ));
      } catch (linkErr) {
        console.error('[BgAgent] Failed to pre-link agentRunId:', linkErr);
      }

      // Abort-check: if the cycle was already cancelled, stop here immediately.
      try {
        const [cycleState] = await db
          .select({ status: executionCycles.status })
          .from(executionCycles)
          .where(eq(executionCycles.id, executionCycleId))
          .limit(1);
        if (cycleState?.status === 'cancelled') {
          console.log('[BgAgent] Cycle already cancelled before run start, aborting');
          return;
        }
      } catch (readErr) {
        console.error('[BgAgent] Failed to read cycle status for abort-check:', readErr);
      }
    }

    run = await agentService.run(tenantId, workflowId, {
      input:    enrichedPayload,
      runFrom:  'published',
      runId:    suggestedRunId,
    });

    if (run?.status === 'cancelled') {
      // Reflect cancellation in execution_cycle
      if (executionCycleId) {
        try {
          await db.update(executionCycles)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(executionCycles.id, executionCycleId));
        } catch (err) {
          console.error('[BgAgent] Failed to update cycle to cancelled:', err);
        }
      }
      return;
    }

    if (run?.status === 'failed') {
      // Set cycle to failed (no longer deletes it — keeps history intact)
      if (executionCycleId) {
        const failedStep = run.steps?.find((s) => s.status === 'failed' && s.error);
        const failureReason = failedStep
          ? `${failedStep.nodeName}: ${failedStep.error}`
          : 'Unbekannter Fehler im Agent-Run';

        try {
          await db.update(executionCycles)
            .set({ status: 'failed', failedAt: new Date(), failureReason, updatedAt: new Date() })
            .where(eq(executionCycles.id, executionCycleId));
        } catch (err) {
          console.error('[BgAgent] Failed to update cycle to failed:', err);
        }
      }
      return;
    }

    if (run?.status === 'success' && keywordId) {
      const finalHtml =
        typeof run.output?.finalHtml === 'string' && run.output.finalHtml
          ? run.output.finalHtml
          : run.finalHtml ?? undefined;

      // Update cycle to delivered
      if (executionCycleId) {
        try {
          // Bug 3 guard: if a cancel arrived after the run finished but before
          // this write, don't silently overwrite the cancellation.
          const [cycleRow] = await db
            .select({ status: executionCycles.status })
            .from(executionCycles)
            .where(eq(executionCycles.id, executionCycleId))
            .limit(1);
          if (cycleRow?.status === 'cancelled') return;

          await db.update(executionCycles)
            .set({ status: 'delivered', deliveredAt: new Date(), updatedAt: new Date() })
            .where(eq(executionCycles.id, executionCycleId));
        } catch (err) {
          console.error('[BgAgent] Failed to update cycle to delivered:', err);
        }
      }

      // Create execution_version if HTML was produced
      if (finalHtml && executionCycleId) {
        try {
          const versionId = await createExecutionVersion(
            executionCycleId,
            finalHtml,
            {
              createdByUserId: userId,
              createdByAi:     true,
              aiProvider:      typeof run.output?.aiProvider === 'string' ? run.output.aiProvider : undefined,
              aiModel:         typeof run.output?.aiModel === 'string' ? run.output.aiModel : undefined,
            },
            tenantId
          );

          await createContentLog({
            Keyword_ID:       [keywordId],
            Target_URL:       targetUrl,
            Action_Type:      actionType === 'COMMISSION_OPTIMIZATION' ? 'Optimierung' : 'Erstellung',
            Event_Label:      'Content angeliefert',
            Cycle_Id:         executionCycleId,
            Commission_Log_Id: commissionLogId ?? undefined,
            Version_Id:       versionId,
            Editor:           userId ? [userId] : undefined,
          }, tenantId);

          // Update materialized cost summary (fire-and-forget)
          const urlIdForSummary = await getUrlIdForKeyword(keywordId, tenantId);
          if (urlIdForSummary) {
            recomputeUrlCostSummary(urlIdForSummary, tenantId).catch((err) =>
              console.error('[BgAgent] Failed to recompute cost summary:', err)
            );
          }
        } catch (logErr) {
          console.error('[BgAgent] Failed to create content version/log:', logErr);
        }
      }
    }
  } catch (err: any) {
    console.error('[BgAgent] Unhandled error in background execution:', err);

    // Mark cycle as failed so the UI doesn't show it as "in progress" forever
    if (executionCycleId) {
      try {
        await db.update(executionCycles)
          .set({ status: 'failed', failedAt: new Date(), failureReason: err?.message ?? 'Unbekannter Fehler', updatedAt: new Date() })
          .where(eq(executionCycles.id, executionCycleId));
      } catch {}
    }
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { triggerN8nWorkflow, N8nActionType } from '@/lib/n8n';
import { createContentLog, getConfig, getKeywordsByUrl, getUrlIdForKeyword, createExecutionCycle, createExecutionVersion, recomputeUrlCostSummary } from '@/lib/postgres';
import { createAgentWorkflowServiceV2 } from '@/app/api/agent-workflows-v2/_service';
import { db } from '@/lib/db';
import { executionCycles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * API Route to trigger agent workflows or an external agent webhook.
 * Acts as a proxy to include the X-API-KEY and handle authentication.
 *
 * Routing logic for COMMISSION_CONTENT / COMMISSION_OPTIMIZATION:
 *   - EXTERNAL_AGENT_ENABLED = true  →  external webhook (fire & forget)
 *   - EXTERNAL_AGENT_ENABLED = false →  internal agent: Custom Flow if present, else Default Flow
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Check Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId;

    // 2. Parse Request Body
    const body = await req.json();
    const { action, data } = body as { action: N8nActionType; data: Record<string, any> };

    if (!action || !data) {
      return NextResponse.json({ message: 'Missing action or data' }, { status: 400 });
    }

    // 3. Status update and Logging for Commissioning
    // Hoisted to function scope so the enrichedPayload block below can reference it.
    let commissionLogId: number | null = null;
    let executionCycleId: number | null = null;
    if ((action === "COMMISSION_CONTENT" || action === "COMMISSION_OPTIMIZATION") && data.keywordId) {
      // Prioritize the requested action type for the log entry
      const commissioningActionType = action === "COMMISSION_OPTIMIZATION" ? "Optimierung" : "Erstellung";
      
      // Get urlId for keyword to create execution cycle
      const urlId = await getUrlIdForKeyword(data.keywordId, tenantId);
      if (!urlId) {
        return NextResponse.json({ message: 'URL not found for keyword' }, { status: 404 });
      }
      
      // Create execution cycle — this atomically:
      //   1. Inserts the new cycle (status='commissioned')
      //   2. Resets planning.status from 'planned' → 'backlog'
      //   3. Sets plannedActionType to the correct action type
      //   4. Clears optimizationRequestedAt (prevents stale suggestions escape-hatch)
      try {
        executionCycleId = await createExecutionCycle(
          urlId,
          commissioningActionType,
          session.user?.id,
          tenantId
        );
      } catch (cycleErr) {
        console.error('Error creating execution cycle:', cycleErr);
        return NextResponse.json({ 
          message: 'Failed to create execution cycle' 
        }, { status: 500 });
      }
      
      // Log event to database — capture ID so delivery/callback can reference it
      try {
        const commissionLog = await createContentLog({
          Keyword_ID: [data.keywordId],
          Target_URL: data.targetUrl,
          Action_Type: commissioningActionType,
          Event_Label: "Content wurde beauftragt",
          Cycle_Id: executionCycleId,
          Editor: session.user?.id ? [session.user.id] : undefined
        }, tenantId);
        commissionLogId = commissionLog?.ID ?? null;
      } catch (logErr) {
        console.error('Error creating commissioning log:', logErr);
      }
    }

    // 4. Route commissioning actions to the correct agent
    if (action === "COMMISSION_CONTENT" || action === "COMMISSION_OPTIMIZATION") {
      const config = await getConfig(tenantId);
      const externalEnabled = config.EXTERNAL_AGENT_ENABLED === "true";
      const externalUrl = config.EXTERNAL_AGENT_WEBHOOK_URL?.trim();

      // --- Build enriched payload ---
      let secondaryKeywords: string[] = [];

      if (data.targetUrl) {
        try {
          const allKeywords = await getKeywordsByUrl(data.targetUrl, tenantId);
          secondaryKeywords = allKeywords
            .filter((kw) => kw.Main_Keyword === 'N')
            .map((kw) => kw.Keyword);
        } catch (kwErr) {
          console.error('[Agent] Error fetching secondary keywords:', kwErr);
        }
      }

      const appBaseUrl = process.env.NEXTAUTH_URL ?? process.env.APP_BASE_URL ?? '';
      const enrichedPayload = {
        action,
        keywordId: data.keywordId ?? null,
        targetUrl: data.targetUrl ?? null,
        mainKeyword: data.keyword ?? null,
        secondaryKeywords,
        pageType: data.pageType ?? null,
        actionType: action === "COMMISSION_OPTIMIZATION" ? "Optimierung" : "Erstellung",
        tenantId,
        callbackUrl: `${appBaseUrl}/api/agent-webhook/callback`,
        userId: session.user?.email ?? 'unknown',
        timestamp: new Date().toISOString(),
        commissionLogId,  // FK for delivery/callback log entries
      };

      // --- Path A: External Agent Webhook ---
      if (externalEnabled && externalUrl) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const secret = config.EXTERNAL_AGENT_WEBHOOK_SECRET?.trim();
        console.log('[ExternalAgent] Secret present:', !!secret, '| URL:', externalUrl);
        if (secret) {
          headers['Authorization'] = `Bearer ${secret}`;
        }

        fetch(externalUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(enrichedPayload),
        }).catch((err) => {
          console.error('[ExternalAgent] Webhook call failed:', err);
        });

        return NextResponse.json({
          message: 'Action forwarded to external agent webhook',
          mode: 'external',
        }, { status: 200 });
      }

      // --- Path B: Internal Agent ---
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

      const run = await agentService.run(tenantId, targetWorkflow.id, {
        input: enrichedPayload,
        runFrom: 'published',
      });

      // On failure: delete the execution cycle to reset to "Planned" status
      if (run.status === 'failed' && data.keywordId) {
        if (executionCycleId) {
          try {
            await db
              .delete(executionCycles)
              .where(eq(executionCycles.id, executionCycleId));
          } catch (resetErr) {
            console.error('[InternalAgent] Failed to delete failed cycle:', resetErr);
          }
        }

        const failedStep = run.steps?.find((s) => s.status === 'failed' && s.error);
        const errorDetail = failedStep
          ? `${failedStep.nodeName}: ${failedStep.error}`
          : 'Unbekannter Fehler im Agent-Run';

        return NextResponse.json({
          message: `Agent-Run fehlgeschlagen: ${errorDetail}`,
          mode: 'internal',
          workflowId: targetWorkflow.id,
          workflowMode: targetWorkflow.mode,
          runId: run.id,
          runStatus: 'failed',
        }, { status: 500 });
      }

      if (run.status === 'success' && data.keywordId) {
        const finalHtml =
          typeof run.output?.finalHtml === 'string' && run.output.finalHtml
            ? run.output.finalHtml
            : undefined;
        
        // Update execution cycle status to 'delivered'
        if (executionCycleId) {
          try {
            await db
              .update(executionCycles)
              .set({ 
                status: 'delivered',
                deliveredAt: new Date()
              })
              .where(eq(executionCycles.id, executionCycleId));
          } catch (statusErr) {
            console.error('[InternalAgent] Failed to update cycle status to delivered:', statusErr);
          }
        }
        
        // Create version and log entry if content was generated
        if (finalHtml && executionCycleId) {
          try {
            // First create the execution version
            const versionId = await createExecutionVersion(
              executionCycleId,
              finalHtml,
              {
                createdByUserId: session.user?.id,
                createdByAi: true,
                aiProvider: typeof run.output?.aiProvider === 'string' ? run.output.aiProvider : undefined,
                aiModel: typeof run.output?.aiModel === 'string' ? run.output.aiModel : undefined,
              },
              tenantId
            );
            
            // Then create the delivery event log with version reference
            await createContentLog({
              Keyword_ID: [data.keywordId],
              Target_URL: data.targetUrl,
              Action_Type: action === 'COMMISSION_OPTIMIZATION' ? 'Optimierung' : 'Erstellung',
              Event_Label: 'Content angeliefert',
              Cycle_Id: executionCycleId,
              Commission_Log_Id: commissionLogId ?? undefined,
              Version_Id: versionId,
              Editor: session.user?.id ? [session.user.id] : undefined,
            }, tenantId);

            // Update materialized cost summary (fire-and-forget)
            const urlIdForSummary = await getUrlIdForKeyword(data.keywordId, tenantId);
            if (urlIdForSummary) {
              recomputeUrlCostSummary(urlIdForSummary, tenantId).catch(err =>
                console.error('[InternalAgent] Failed to recompute cost summary:', err)
              );
            }
          } catch (logErr) {
            console.error('[InternalAgent] Failed to create content version/log:', logErr);
          }
        }
      }

      return NextResponse.json({
        message: 'Action forwarded to internal agent workflow',
        mode: 'internal',
        workflowId: targetWorkflow.id,
        workflowMode: targetWorkflow.mode,
        runId: run.id,
        runStatus: run.status,
      }, { status: 200 });
    }

    // 5. Fallback for non-commissioning actions: Legacy n8n Workflow
    const result = await triggerN8nWorkflow({
      action,
      data,
      userId: session.user?.email || 'unknown',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ 
      message: 'Action triggered successfully', 
      result 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error triggering agent webhook:', error);
    return NextResponse.json({ 
      message: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}

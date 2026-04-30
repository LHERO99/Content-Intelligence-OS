import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { triggerN8nWorkflow, N8nActionType } from '@/lib/n8n';
import { createContentLog, updateKeyword, getConfig, getKeywordsByUrl } from '@/lib/airtable';
import { createAgentWorkflowServiceV2 } from '@/app/api/agent-workflows-v2/_service';

// Multi-tenant stub – replace with real tenant resolution once multi-tenancy is implemented
const DEFAULT_TENANT_ID = 'default';

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

    // 2. Parse Request Body
    const body = await req.json();
    const { action, data } = body as { action: N8nActionType; data: Record<string, any> };

    if (!action || !data) {
      return NextResponse.json({ message: 'Missing action or data' }, { status: 400 });
    }

    // 3. Status update and Logging for Commissioning
    if ((action === "COMMISSION_CONTENT" || action === "COMMISSION_OPTIMIZATION") && data.keywordId) {
      await updateKeyword(data.keywordId, { Status: "Beauftragt" });
      
      // Log event to database
      try {
        await createContentLog({
          Keyword_ID: [data.keywordId],
          Target_URL: data.targetUrl,
          Action_Type: action === "COMMISSION_OPTIMIZATION" ? "Optimierung" : "Erstellung",
          Diff_Summary: "Content wurde beauftragt",
          Editor: session.user?.email ? [session.user.email] : undefined
        });
      } catch (logErr) {
        console.error('Error creating commissioning log:', logErr);
      }
    }

    // 4. Route commissioning actions to the correct agent
    if (action === "COMMISSION_CONTENT" || action === "COMMISSION_OPTIMIZATION") {
      const config = await getConfig();
      const externalEnabled = config.EXTERNAL_AGENT_ENABLED === "true";
      const externalUrl = config.EXTERNAL_AGENT_WEBHOOK_URL?.trim();

      // --- Build enriched payload (shared between external and internal paths) ---
      let secondaryKeywords: Array<{
        id: string;
        keyword: string;
        searchVolume: number | null;
        difficulty: number | null;
        ranking: number | null;
      }> = [];

      if (data.targetUrl) {
        try {
          const allKeywords = await getKeywordsByUrl(data.targetUrl);
          secondaryKeywords = allKeywords
            .filter((kw) => kw.Main_Keyword === 'N')
            .map((kw) => ({
              id: kw.id,
              keyword: kw.Keyword,
              searchVolume: kw.Search_Volume ?? null,
              difficulty: kw.Difficulty ?? null,
              ranking: kw.Ranking ?? null,
            }));
        } catch (kwErr) {
          console.error('[Agent] Error fetching secondary keywords:', kwErr);
        }
      }

      const appBaseUrl = process.env.NEXTAUTH_URL ?? '';
      const enrichedPayload = {
        action,
        keywordId: data.keywordId ?? null,
        targetUrl: data.targetUrl ?? null,
        mainKeyword: data.keyword ?? null,
        secondaryKeywords,
        pageType: data.pageType ?? null,
        actionType: action === "COMMISSION_OPTIMIZATION" ? "Optimierung" : "Erstellung",
        tenantId: DEFAULT_TENANT_ID,
        callbackUrl: `${appBaseUrl}/api/n8n/callback`,
        userId: session.user?.email ?? 'unknown',
        timestamp: new Date().toISOString(),
      };

      // --- Path A: External Agent Webhook ---
      if (externalEnabled && externalUrl) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const secret = config.EXTERNAL_AGENT_WEBHOOK_SECRET?.trim();
        if (secret) {
          headers['Authorization'] = `Bearer ${secret}`;
        }

        // Fire & forget — do not block the UI response
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

      // --- Path B: Internal Agent (Custom Flow → Default Flow) ---
      const agentService = createAgentWorkflowServiceV2();
      const workflows = await agentService.list(DEFAULT_TENANT_ID);

      // Prefer Custom Flow; fall back to Default Flow (always exists)
      const targetWorkflow =
        workflows.find((w) => w.mode === 'custom') ??
        workflows.find((w) => w.mode === 'default');

      if (!targetWorkflow) {
        console.error('[InternalAgent] No workflow found for tenant:', DEFAULT_TENANT_ID);
        return NextResponse.json(
          { message: 'Kein Agent-Flow konfiguriert. Bitte einen Default Flow anlegen.' },
          { status: 500 }
        );
      }

      const run = await agentService.run(DEFAULT_TENANT_ID, targetWorkflow.id, {
        input: enrichedPayload,
        runFrom: 'published',
      });

      // On failure: reset keyword status to "Planned" so it can be re-commissioned
      if (run.status === 'failed' && data.keywordId) {
        try {
          await updateKeyword(data.keywordId, { Status: 'Planned' });
        } catch (resetErr) {
          console.error('[InternalAgent] Failed to reset keyword status:', resetErr);
        }

        // Extract the first failed step error for a meaningful error message
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
    console.error('Error triggering n8n workflow:', error);
    return NextResponse.json({ 
      message: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}

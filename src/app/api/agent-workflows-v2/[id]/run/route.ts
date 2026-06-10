import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentWorkflowServiceV2 } from '../../_service';

/**
 * POST /api/agent-workflows-v2/[id]/run
 *
 * Starts an agent workflow run and returns immediately (202) with the run ID.
 * The run executes asynchronously in the background (fire-and-forget on the
 * persistent Node.js process — safe on Hetzner / self-hosted deployments).
 *
 * The client can poll GET /api/agent-workflows-v2/runs/[runId] for progress.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId ?? '';
    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const workflowId = params.id;

    const service = createAgentWorkflowServiceV2();

    // Create a stub run record immediately so the client gets a runId to poll
    // The actual execution happens asynchronously below.
    const runId = crypto.randomUUID();

    // Return 202 immediately
    const response = NextResponse.json({ runId, status: 'running' }, { status: 202 });

    // Fire-and-forget — persists result to DB when complete
    void service.run(tenantId, workflowId, {
      input:          body?.input || {},
      idempotencyKey: runId,           // use same UUID so poll finds it
      runFrom:        body?.runFrom === 'published' ? 'published' : 'draft',
    }).catch((err: any) => {
      console.error('[API Agent Run] Background run error:', err?.message ?? err);
    });

    return response;
  } catch (error: any) {
    console.error('[API Agent Workflows V2 Run] POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

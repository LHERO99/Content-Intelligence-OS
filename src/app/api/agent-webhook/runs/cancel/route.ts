import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentWorkflowServiceV2 } from '@/app/api/agent-workflows-v2/_service';
import { db } from '@/lib/db';
import { executionCycles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/agent-webhook/runs/cancel
 *
 * Signals a running agent to stop after its current LLM call completes.
 * Sets cancelRequested=true on the agent_workflow_run and updates the
 * execution_cycle status to 'cancelled'.
 *
 * Body: { urlId?: string, cycleId?: number, runId?: string }
 * At least one of urlId/cycleId or runId must be provided.
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
    const { urlId, cycleId, runId } = body as {
      urlId?: string;
      cycleId?: number;
      runId?: string;
    };

    let resolvedRunId: string | null = runId ?? null;
    let resolvedCycleId: number | null = cycleId ?? null;

    // Resolve runId from cycleId / urlId if not provided directly
    if (!resolvedRunId) {
      let cycle: typeof executionCycles.$inferSelect | null = null;

      if (resolvedCycleId) {
        const [row] = await db
          .select()
          .from(executionCycles)
          .where(and(eq(executionCycles.id, resolvedCycleId), eq(executionCycles.tenantId, tenantId)))
          .limit(1);
        cycle = row ?? null;
      } else if (urlId) {
        // Find the most recent active cycle for this URL
        const rows = await db
          .select()
          .from(executionCycles)
          .where(
            and(
              eq(executionCycles.urlId, urlId),
              eq(executionCycles.tenantId, tenantId),
            )
          )
          .orderBy(executionCycles.cycleNumber)
          .limit(1);
        // Take the highest cycleNumber row
        const allRows = await db
          .select()
          .from(executionCycles)
          .where(and(eq(executionCycles.urlId, urlId), eq(executionCycles.tenantId, tenantId)));
        const latest = allRows.sort((a, b) => b.cycleNumber - a.cycleNumber)[0] ?? null;
        cycle = latest;
        resolvedCycleId = latest?.id ?? null;
      }

      resolvedRunId = cycle?.agentRunId ?? null;
      resolvedCycleId = cycle?.id ?? resolvedCycleId;
    }

    // Signal the agent run to cancel
    if (resolvedRunId) {
      const service = createAgentWorkflowServiceV2();
      await service.requestCancel(tenantId, resolvedRunId);
    }

    // Immediately mark the execution cycle as cancelled so the UI updates fast
    if (resolvedCycleId) {
      await db
        .update(executionCycles)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(executionCycles.id, resolvedCycleId), eq(executionCycles.tenantId, tenantId)));
    }

    return NextResponse.json({
      message: 'Cancel requested',
      runId:   resolvedRunId,
      cycleId: resolvedCycleId,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[CancelRun] Error:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

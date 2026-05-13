import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentWorkflowServiceV2 } from '../_service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId ?? '';
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || '50');
    const includeDeleted = searchParams.get('includeDeleted') === '1';

    const service = createAgentWorkflowServiceV2();
    const runs = await service.listRuns(
      tenantId,
      Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 50,
      includeDeleted
    );

    return NextResponse.json({ runs });
  } catch (error: any) {
    console.error('[API Agent Workflows V2 Runs] GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId ?? '';
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    if (action !== 'cleanup_stale_running') {
      return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
    }

    const service = createAgentWorkflowServiceV2();
    const runs = await service.listRuns(tenantId, 200);
    const staleRuns = runs.filter((run) => run.status === 'running');

    const updated: string[] = [];
    for (const run of staleRuns) {
      const cancelled = await service.cancelRun(tenantId, run.id);
      if (cancelled) updated.push(run.id);
    }

    return NextResponse.json({ ok: true, updatedRunIds: updated });
  } catch (error: any) {
    console.error('[API Agent Workflows V2 Runs] PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

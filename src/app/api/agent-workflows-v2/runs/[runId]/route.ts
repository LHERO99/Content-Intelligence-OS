import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentWorkflowServiceV2 } from '../../_service';

export async function GET(_: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId ?? '';
    const params = await context.params;
    const service = createAgentWorkflowServiceV2();
    const run = await service.getRun(tenantId, params.runId);

    if (!run) {
      return NextResponse.json({ error: 'Run nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (error: any) {
    console.error('[API Agent Workflows V2 Run Detail] GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId ?? '';
    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    const service = createAgentWorkflowServiceV2();
    if (action === 'cancel') {
      const run = await service.cancelRun(tenantId, params.runId);
      if (!run) return NextResponse.json({ error: 'Run nicht gefunden' }, { status: 404 });
      return NextResponse.json({ run });
    }

    if (action === 'restore') {
      const run = await service.restoreRun(tenantId, params.runId);
      if (!run) return NextResponse.json({ error: 'Run nicht gefunden' }, { status: 404 });
      return NextResponse.json({ run });
    }

    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
  } catch (error: any) {
    console.error('[API Agent Workflows V2 Run Detail] PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId ?? '';
    const params = await context.params;
    const service = createAgentWorkflowServiceV2();
    const run = await service.softDeleteRun(tenantId, params.runId);
    if (!run) {
      return NextResponse.json({ error: 'Run nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, run });
  } catch (error: any) {
    console.error('[API Agent Workflows V2 Run Detail] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

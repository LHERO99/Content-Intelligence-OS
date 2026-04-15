import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentWorkflowService, DEFAULT_TENANT_ID } from '../../_service';

export async function GET(_: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const service = createAgentWorkflowService();
    const run = await service.getRun(DEFAULT_TENANT_ID, params.runId);

    if (!run) {
      return NextResponse.json({ error: 'Run nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (error: any) {
    console.error('[API Agent Workflows Run Detail] GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

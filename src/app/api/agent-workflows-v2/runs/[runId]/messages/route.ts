import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentWorkflowServiceV2, DEFAULT_TENANT_ID } from '../../../_service';

export async function GET(_: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const service = createAgentWorkflowServiceV2();
    const messages = await service.getRunMessages(DEFAULT_TENANT_ID, params.runId);
    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('[API Agent Workflows V2 Messages] GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

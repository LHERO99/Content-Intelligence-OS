import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentWorkflowServiceV2, DEFAULT_TENANT_ID } from '../_service';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json();

    const service = createAgentWorkflowServiceV2();
    const workflow = await service.update(DEFAULT_TENANT_ID, params.id, {
      name: body?.name,
      description: body?.description,
      nodes: body?.nodes,
      edges: body?.edges,
    });

    return NextResponse.json({ workflow });
  } catch (error: any) {
    console.error('[API Agent Workflows V2] PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentWorkflowServiceV2, DEFAULT_TENANT_ID } from './_service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = createAgentWorkflowServiceV2();
    const workflows = await service.list(DEFAULT_TENANT_ID);
    return NextResponse.json({ workflows });
  } catch (error: any) {
    console.error('[API Agent Workflows V2] GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const service = createAgentWorkflowServiceV2();
    const workflow = await service.create({
      tenantId: DEFAULT_TENANT_ID,
      name: String(body?.name || 'Neuer Workflow V2'),
      description: body?.description ? String(body.description) : undefined,
      mode: body?.mode === 'default' ? 'default' : 'custom',
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error: any) {
    console.error('[API Agent Workflows V2] POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

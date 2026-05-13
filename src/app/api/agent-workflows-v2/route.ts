import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getConfig } from '@/lib/postgres';
import { createAgentWorkflowServiceV2 } from './_service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId;

    const service = createAgentWorkflowServiceV2();
    const [workflows, config] = await Promise.all([
      service.list(tenantId),
      getConfig(tenantId),
    ]);
    const customFlowEnabled = config.CUSTOM_FLOW_ENABLED === 'true';
    return NextResponse.json({ workflows, customFlowEnabled });
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
    const tenantId = session.user?.tenantId;

    const body = await request.json();
    const service = createAgentWorkflowServiceV2();
    const workflow = await service.create({
      tenantId,
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

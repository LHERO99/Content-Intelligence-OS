import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { updateConfig } from '@/lib/postgres';
import { createAgentWorkflowServiceV2 } from '../_service';

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId;

    const body = await request.json();
    const { customFlowEnabled } = body as { customFlowEnabled: boolean };

    if (typeof customFlowEnabled !== 'boolean') {
      return NextResponse.json({ error: 'customFlowEnabled must be a boolean' }, { status: 400 });
    }

    await updateConfig('CUSTOM_FLOW_ENABLED', customFlowEnabled ? 'true' : 'false', undefined, tenantId);

    try {
      const service = createAgentWorkflowServiceV2();
      const workflows = await service.list(tenantId);
      const customWorkflow = workflows.find((w) => w.mode === 'custom');
      if (customWorkflow) {
        await service.update(tenantId, customWorkflow.id, {
          state: customFlowEnabled ? 'draft' : 'archived',
        });
      }
    } catch (workflowErr) {
      console.error('[settings] Failed to update workflow state (non-fatal):', workflowErr);
    }

    return NextResponse.json({ customFlowEnabled });
  } catch (error: any) {
    console.error('[API settings] PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

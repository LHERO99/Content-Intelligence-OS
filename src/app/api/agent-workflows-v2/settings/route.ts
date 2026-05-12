import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { updateConfig } from '@/lib/postgres';
import { createAgentWorkflowServiceV2, DEFAULT_TENANT_ID } from '../_service';

/**
 * PATCH /api/agent-workflows-v2/settings
 * Body: { customFlowEnabled: boolean }
 *
 * Writes the CUSTOM_FLOW_ENABLED config key atomically to Airtable.
 * Also updates the Custom Flow workflow's state to 'archived' (disabled)
 * or 'draft' (enabled) so the canvas UI reflects the correct state.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { customFlowEnabled } = body as { customFlowEnabled: boolean };

    if (typeof customFlowEnabled !== 'boolean') {
      return NextResponse.json({ error: 'customFlowEnabled must be a boolean' }, { status: 400 });
    }

    // 1. Write the routing flag atomically (single Airtable row, no blob race condition).
    await updateConfig('CUSTOM_FLOW_ENABLED', customFlowEnabled ? 'true' : 'false');

    // 2. Mirror the state on the Custom Flow workflow record so the canvas UI
    //    shows the correct view (Reaktivieren vs active canvas).
    try {
      const service = createAgentWorkflowServiceV2();
      const workflows = await service.list(DEFAULT_TENANT_ID);
      const customWorkflow = workflows.find((w) => w.mode === 'custom');
      if (customWorkflow) {
        await service.update(DEFAULT_TENANT_ID, customWorkflow.id, {
          state: customFlowEnabled ? 'draft' : 'archived',
        });
      }
    } catch (workflowErr) {
      // Non-fatal: the config key is already written — routing will work correctly
      // even if the workflow state update fails.
      console.error('[settings] Failed to update workflow state (non-fatal):', workflowErr);
    }

    return NextResponse.json({ customFlowEnabled });
  } catch (error: any) {
    console.error('[API settings] PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

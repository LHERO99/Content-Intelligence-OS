import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentWorkflowServiceV2, DEFAULT_TENANT_ID } from '../../_service';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));

    const service = createAgentWorkflowServiceV2();
    const run = await service.run(DEFAULT_TENANT_ID, params.id, {
      input: body?.input || {},
      idempotencyKey: body?.idempotencyKey,
      runFrom: body?.runFrom === 'published' ? 'published' : 'draft',
    });

    return NextResponse.json({ run });
  } catch (error: any) {
    console.error('[API Agent Workflows V2 Run] POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

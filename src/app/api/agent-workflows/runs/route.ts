import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentWorkflowService, DEFAULT_TENANT_ID } from '../_service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || '50');
    const service = createAgentWorkflowService();
    const runs = await service.listRuns(DEFAULT_TENANT_ID, Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 50);

    return NextResponse.json({ runs });
  } catch (error: any) {
    console.error('[API Agent Workflows Runs] GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

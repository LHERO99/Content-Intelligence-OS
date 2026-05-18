import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getActiveSyncJob } from '@/lib/sync-jobs';

/**
 * GET /api/admin/sync/active
 *
 * Returns the most recent pending/running job for the current tenant.
 * Called on mount of the Sync tab to resume tracking a job that was started
 * in a previous browser session.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId as string;

    const job = await getActiveSyncJob(tenantId);

    // null → no active job, UI shows idle state
    return NextResponse.json({ job });
  } catch (error: any) {
    console.error('[API] sync/active error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

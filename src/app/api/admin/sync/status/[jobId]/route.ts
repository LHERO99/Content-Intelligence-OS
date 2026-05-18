import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSyncJob, fireSyncJob } from '@/lib/sync-jobs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId as string;

    const { jobId: jobIdParam } = await params;
    const jobId = parseInt(jobIdParam, 10);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Ungültige Job-ID' }, { status: 400 });
    }

    const job = await getSyncJob(jobId, tenantId);
    if (!job) {
      return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    }

    // Auto-retry: if a previous attempt failed and reset to pending, re-fire here
    // so the client only needs to keep polling — no manual action required
    if (job.status === 'pending' && job.retryCount > 0) {
      fireSyncJob(job.id, tenantId);
    }

    return NextResponse.json(job);
  } catch (error: any) {
    console.error('[API] sync/status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

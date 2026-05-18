import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSyncJob, fireSyncJob } from '@/lib/sync-jobs';

export interface ManualSyncRequest {
  urls: string[];
  mode: 'week' | '6months';
  sources: Array<'gsc' | 'dataforseo' | 'sistrix'>;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId as string;

    const body = (await req.json()) as ManualSyncRequest;
    const { urls, mode, sources } = body;

    if (!urls?.length) {
      return NextResponse.json({ error: 'Bitte mindestens eine URL auswählen.' }, { status: 400 });
    }
    if (!sources?.length) {
      return NextResponse.json({ error: 'Bitte mindestens eine Datenquelle auswählen.' }, { status: 400 });
    }

    // Create job (or return existing active job for this tenant)
    const job = await createSyncJob(tenantId, { urls, mode, sources });

    // Fire-and-forget: runs async in the Node.js process, survives HTTP response
    if (job.status === 'pending') {
      fireSyncJob(job.id, tenantId);
    }

    return NextResponse.json({ jobId: job.id });
  } catch (error: any) {
    console.error('[API] sync/manual error:', error);
    return NextResponse.json({ error: error.message || 'Sync fehlgeschlagen' }, { status: 500 });
  }
}

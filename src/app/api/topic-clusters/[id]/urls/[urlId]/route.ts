import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { urlTopicClusters, topicClusters } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; urlId: string }> };

// DELETE /api/topic-clusters/[id]/urls/[urlId] — Remove URL from cluster
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id, urlId } = await params;

    // Verify cluster belongs to tenant
    const [cluster] = await db.select({ id: topicClusters.id })
      .from(topicClusters)
      .where(and(eq(topicClusters.id, id), eq(topicClusters.tenantId, tenantId)));
    if (!cluster) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.delete(urlTopicClusters)
      .where(and(
        eq(urlTopicClusters.topicClusterId, id),
        eq(urlTopicClusters.urlId, urlId),
        eq(urlTopicClusters.tenantId, tenantId),
      ));

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

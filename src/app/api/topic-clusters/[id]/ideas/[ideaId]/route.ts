import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { topicIdeas, topicClusters } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; ideaId: string }> };

// DELETE /api/topic-clusters/[id]/ideas/[ideaId]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id, ideaId } = await params;

    // Verify cluster belongs to tenant
    const [cluster] = await db.select({ id: topicClusters.id })
      .from(topicClusters)
      .where(and(eq(topicClusters.id, id), eq(topicClusters.tenantId, tenantId)));
    if (!cluster) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.delete(topicIdeas)
      .where(and(
        eq(topicIdeas.id, ideaId),
        eq(topicIdeas.topicClusterId, id),
        eq(topicIdeas.tenantId, tenantId),
      ));

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

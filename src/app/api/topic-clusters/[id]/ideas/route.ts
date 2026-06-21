import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { topicIdeas, topicClusters } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// GET /api/topic-clusters/[id]/ideas
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    const ideas = await db.select()
      .from(topicIdeas)
      .where(and(eq(topicIdeas.topicClusterId, id), eq(topicIdeas.tenantId, tenantId)));

    return NextResponse.json(ideas);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/topic-clusters/[id]/ideas — Add idea to cluster
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    const body = await request.json();
    const { keyword, searchVolume, keywordDifficulty, source = 'manual' } = body;

    if (!keyword?.trim()) {
      return NextResponse.json({ error: 'Keyword ist erforderlich' }, { status: 400 });
    }

    // Verify cluster belongs to tenant
    const [cluster] = await db.select({ id: topicClusters.id })
      .from(topicClusters)
      .where(and(eq(topicClusters.id, id), eq(topicClusters.tenantId, tenantId)));
    if (!cluster) return NextResponse.json({ error: 'Cluster nicht gefunden' }, { status: 404 });

    // Duplicate check (case-insensitive)
    const existing = await db.select({ id: topicIdeas.id })
      .from(topicIdeas)
      .where(and(
        eq(topicIdeas.topicClusterId, id),
        eq(topicIdeas.tenantId, tenantId),
        sql`lower(${topicIdeas.keyword}) = lower(${keyword.trim()})`,
      ));

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Dieses Keyword existiert bereits in diesem Cluster' }, { status: 409 });
    }

    const [idea] = await db.insert(topicIdeas)
      .values({
        tenantId,
        topicClusterId: id,
        keyword:        keyword.trim(),
        searchVolume:   searchVolume ?? null,
        keywordDifficulty: keywordDifficulty ?? null,
        source,
      })
      .returning();

    return NextResponse.json(idea, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

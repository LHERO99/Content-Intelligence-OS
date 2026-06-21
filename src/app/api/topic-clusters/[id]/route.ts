import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { topicClusters, urlTopicClusters, topicIdeas, urlKeywords, urls, planningStatus } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// GET /api/topic-clusters/[id] — Cluster detail with URLs and ideas
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    const [cluster] = await db
      .select()
      .from(topicClusters)
      .where(and(eq(topicClusters.id, id), eq(topicClusters.tenantId, tenantId)));

    if (!cluster) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // URLs in cluster with main keyword + status
    const clusterUrls = await db
      .select({
        id:            urls.id,
        url:           urls.url,
        pageType:      urls.pageType,
        mainKeyword:   urlKeywords.keyword,
        searchVolume:  urlKeywords.searchVolume,
        ranking:       urlKeywords.ranking,
        planningStatus: planningStatus.status,
      })
      .from(urlTopicClusters)
      .innerJoin(urls, eq(urls.id, urlTopicClusters.urlId))
      .leftJoin(urlKeywords, and(
        eq(urlKeywords.urlId, urls.id),
        eq(urlKeywords.isMainKeyword, true),
      ))
      .leftJoin(planningStatus, and(
        eq(planningStatus.urlId, urls.id),
        eq(planningStatus.tenantId, tenantId),
      ))
      .where(and(
        eq(urlTopicClusters.topicClusterId, id),
        eq(urlTopicClusters.tenantId, tenantId),
      ));

    const ideas = await db
      .select()
      .from(topicIdeas)
      .where(and(eq(topicIdeas.topicClusterId, id), eq(topicIdeas.tenantId, tenantId)));

    return NextResponse.json({ cluster, urls: clusterUrls, ideas });
  } catch (error: any) {
    console.error('[topic-clusters/id] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/topic-clusters/[id]
export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined)        updates.name        = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.color !== undefined)       updates.color       = body.color;
    if (body.parentId !== undefined)    updates.parentId    = body.parentId ?? null;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(topicClusters)
      .set(updates)
      .where(and(eq(topicClusters.id, id), eq(topicClusters.tenantId, tenantId)))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('[topic-clusters/id] PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/topic-clusters/[id]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    await db
      .delete(topicClusters)
      .where(and(eq(topicClusters.id, id), eq(topicClusters.tenantId, tenantId)));

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[topic-clusters/id] DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

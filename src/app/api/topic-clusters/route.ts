import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { topicClusters, urlTopicClusters, topicIdeas, urlKeywords } from '@/lib/db/schema';
import { eq, and, sql, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/topic-clusters — List all clusters with stats
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;

    const clusters = await db
      .select({
        id:               topicClusters.id,
        tenantId:         topicClusters.tenantId,
        parentId:         topicClusters.parentId,
        name:             topicClusters.name,
        description:      topicClusters.description,
        color:            topicClusters.color,
        createdAt:        topicClusters.createdAt,
        updatedAt:        topicClusters.updatedAt,
        urlCount:         sql<number>`count(distinct ${urlTopicClusters.urlId})::int`,
        ideaCount:        sql<number>`count(distinct ${topicIdeas.id})::int`,
        totalSearchVolume: sql<number>`coalesce(sum(${urlKeywords.searchVolume}) filter (where ${urlKeywords.isMainKeyword} = true), 0)::int`,
        avgRanking:       sql<number | null>`avg(${urlKeywords.ranking}) filter (where ${urlKeywords.isMainKeyword} = true)`,
      })
      .from(topicClusters)
      .leftJoin(urlTopicClusters, eq(urlTopicClusters.topicClusterId, topicClusters.id))
      .leftJoin(urlKeywords, and(
        eq(urlKeywords.urlId, urlTopicClusters.urlId),
        eq(urlKeywords.isMainKeyword, true),
      ))
      .leftJoin(topicIdeas, eq(topicIdeas.topicClusterId, topicClusters.id))
      .where(eq(topicClusters.tenantId, tenantId))
      .groupBy(topicClusters.id)
      .orderBy(sql`coalesce(sum(${urlKeywords.searchVolume}) filter (where ${urlKeywords.isMainKeyword} = true), 0) desc`);

    return NextResponse.json(clusters);
  } catch (error: any) {
    console.error('[topic-clusters] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/topic-clusters — Create a new cluster
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;

    const body = await request.json();
    const { name, description, color, parentId } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
    }

    const [cluster] = await db
      .insert(topicClusters)
      .values({ tenantId, name: name.trim(), description: description ?? null, color: color ?? '#6366f1', parentId: parentId ?? null })
      .returning();

    return NextResponse.json(cluster, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('topic_clusters_name_tenant_idx')) {
      return NextResponse.json({ error: 'Ein Cluster mit diesem Namen existiert bereits' }, { status: 409 });
    }
    console.error('[topic-clusters] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

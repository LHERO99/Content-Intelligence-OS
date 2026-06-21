import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { topicIdeas, topicClusters, urls, urlKeywords, planningStatus, urlTopicClusters } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; ideaId: string }> };

// POST /api/topic-clusters/[id]/ideas/[ideaId]/promote
// Promotes a topic idea into the planning backlog
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id: clusterId, ideaId } = await params;

    const body = await request.json();
    const { keyword, isMainKeyword = true, urlMode, urlId: existingUrlId, newUrl, pageType, priority } = body;

    if (!keyword?.trim()) return NextResponse.json({ error: 'Keyword erforderlich' }, { status: 400 });
    if (urlMode === 'new' && !newUrl?.trim()) return NextResponse.json({ error: 'URL erforderlich' }, { status: 400 });
    if (urlMode === 'existing' && !existingUrlId) return NextResponse.json({ error: 'URL-ID erforderlich' }, { status: 400 });

    // Verify cluster belongs to tenant
    const [cluster] = await db.select({ id: topicClusters.id })
      .from(topicClusters)
      .where(and(eq(topicClusters.id, clusterId), eq(topicClusters.tenantId, tenantId)));
    if (!cluster) return NextResponse.json({ error: 'Cluster nicht gefunden' }, { status: 404 });

    // Verify idea belongs to cluster
    const [idea] = await db.select()
      .from(topicIdeas)
      .where(and(
        eq(topicIdeas.id, ideaId),
        eq(topicIdeas.topicClusterId, clusterId),
        eq(topicIdeas.tenantId, tenantId),
      ));
    if (!idea) return NextResponse.json({ error: 'Idee nicht gefunden' }, { status: 404 });

    const priorityScore = priority === 'high' ? 80 : priority === 'medium' ? 50 : 20;

    let targetUrlId: string;

    await db.transaction(async (tx) => {
      // 1. Create or use existing URL
      if (urlMode === 'new') {
        const existingUrl = await tx.select({ id: urls.id })
          .from(urls)
          .where(and(eq(urls.url, newUrl.trim()), eq(urls.tenantId, tenantId)));

        if (existingUrl.length > 0) {
          targetUrlId = existingUrl[0].id;
        } else {
          const [createdUrl] = await tx.insert(urls)
            .values({ tenantId, url: newUrl.trim(), pageType: pageType ?? 'Ratgeber' })
            .returning();
          targetUrlId = createdUrl.id;
        }
      } else {
        targetUrlId = existingUrlId;
      }

      // 2. Add keyword to URL
      await tx.insert(urlKeywords)
        .values({
          tenantId,
          urlId:         targetUrlId,
          keyword:       keyword.trim(),
          isMainKeyword,
          searchVolume:  idea.searchVolume ?? undefined,
          difficulty:    idea.keywordDifficulty ?? undefined,
          priorityScore: String(priorityScore),
        })
        .onConflictDoNothing();

      // 3. Create planning_status entry (backlog)
      await tx.insert(planningStatus)
        .values({ tenantId, urlId: targetUrlId, status: 'backlog', priorityScore: String(priorityScore) })
        .onConflictDoNothing();

      // 4. Assign URL to cluster
      await tx.insert(urlTopicClusters)
        .values({ urlId: targetUrlId, topicClusterId: clusterId, tenantId })
        .onConflictDoNothing();

      // 5. Delete the idea
      await tx.delete(topicIdeas)
        .where(eq(topicIdeas.id, ideaId));
    });

    return NextResponse.json({ urlId: targetUrlId! });
  } catch (error: any) {
    console.error('[promote] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

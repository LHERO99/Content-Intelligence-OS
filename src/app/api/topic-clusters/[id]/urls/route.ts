import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { urlTopicClusters, urls, topicClusters, urlKeywords, planningStatus } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// GET /api/topic-clusters/[id]/urls
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    const result = await db
      .select({
        id:             urls.id,
        url:            urls.url,
        pageType:       urls.pageType,
        mainKeyword:    urlKeywords.keyword,
        searchVolume:   urlKeywords.searchVolume,
        ranking:        urlKeywords.ranking,
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

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/topic-clusters/[id]/urls — Add URL to cluster
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    const { urlId } = await request.json();
    if (!urlId) return NextResponse.json({ error: 'urlId erforderlich' }, { status: 400 });

    // Verify cluster + URL belong to tenant
    const [cluster] = await db.select({ id: topicClusters.id })
      .from(topicClusters)
      .where(and(eq(topicClusters.id, id), eq(topicClusters.tenantId, tenantId)));
    if (!cluster) return NextResponse.json({ error: 'Cluster nicht gefunden' }, { status: 404 });

    const [url] = await db.select({ id: urls.id })
      .from(urls)
      .where(and(eq(urls.id, urlId), eq(urls.tenantId, tenantId)));
    if (!url) return NextResponse.json({ error: 'URL nicht gefunden' }, { status: 404 });

    await db.insert(urlTopicClusters)
      .values({ urlId, topicClusterId: id, tenantId })
      .onConflictDoNothing();

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

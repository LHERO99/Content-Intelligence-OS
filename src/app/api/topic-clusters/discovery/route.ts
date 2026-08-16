import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { topicClusters, urlKeywords, topicIdeas } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { fetchKeywordIdeas } from '@/lib/dataforseo';
import { getConfig } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;

    const body = await request.json().catch(() => ({}));
    const { clusterIds, limit = 50 } = body;

    // Load DataForSEO credentials from config
    const cfg = await getConfig(tenantId);
    const username = cfg['DATAFORSEO_USERNAME'];
    const password = cfg['DATAFORSEO_PASSWORD'];
    const languageCode = cfg['DATAFORSEO_LANGUAGE'] || 'de';
    const locationCode = cfg['DATAFORSEO_LOCATION'] ? parseInt(cfg['DATAFORSEO_LOCATION'], 10) : 2276;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'DataForSEO ist nicht konfiguriert. Bitte hinterlege deine Zugangsdaten unter Admin → Integrationen.' },
        { status: 400 }
      );
    }

    // Load cluster names as seed keywords
    const clusterQuery = db.select({ id: topicClusters.id, name: topicClusters.name })
      .from(topicClusters)
      .where(
        clusterIds?.length
          ? and(eq(topicClusters.tenantId, tenantId), inArray(topicClusters.id, clusterIds))
          : eq(topicClusters.tenantId, tenantId)
      );

    const clusters = await clusterQuery;

    if (clusters.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const seedKeywords = clusters.map((c) => c.name);
    const suggestions = await fetchKeywordIdeas(seedKeywords, username, password, languageCode, locationCode, limit);

    // Load existing keywords and ideas to mark as "already covered"
    const existingKws = await db.select({ keyword: urlKeywords.keyword })
      .from(urlKeywords)
      .where(eq(urlKeywords.tenantId, tenantId));

    const existingIdeas = await db.select({ keyword: topicIdeas.keyword })
      .from(topicIdeas)
      .where(eq(topicIdeas.tenantId, tenantId));

    const coveredSet = new Set([
      ...existingKws.map((k) => k.keyword.toLowerCase()),
      ...existingIdeas.map((i) => i.keyword.toLowerCase()),
    ]);

    const result = suggestions.map((s) => ({
      ...s,
      alreadyCovered: coveredSet.has(s.keyword.toLowerCase()),
    }));

    return NextResponse.json({ suggestions: result });
  } catch (error: any) {
    console.error('[discovery] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

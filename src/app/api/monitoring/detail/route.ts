import { NextRequest, NextResponse } from 'next/server';
import { 
  getPerformanceDataByUrl, 
  getContentHistoryByUrlOrKeywords, 
  getURLPerformanceHistory, 
  getKeywordRankingHistory,
  getKeywordMap,
  getUrlCostSummary,
  getUrlIdForUrl,
} from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = session.user?.tenantId;

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL required' }, { status: 400 });
  }

  try {
    // 1. Fetch Keyword Map to identify associated keywords for this URL
    const allKeywords = await getKeywordMap(tenantId);
    const relatedKeywords = allKeywords.filter(kw => kw.Target_URL === targetUrl);
    const keywordIds = relatedKeywords.map(kw => kw.id);

    // 2. Fetch all data in parallel
    const [
      legacyPerformance, 
      history, 
      urlPerformance, 
      keywordRankingHistory,
      urlId,
    ] = await Promise.all([
      getPerformanceDataByUrl(targetUrl, tenantId).catch(() => []),
      getContentHistoryByUrlOrKeywords(targetUrl, keywordIds, tenantId),
      getURLPerformanceHistory(targetUrl, tenantId).catch(() => []),
      getKeywordRankingHistory(keywordIds, tenantId),
      getUrlIdForUrl(targetUrl, tenantId).catch(() => null),
    ]);

    // 3. Read precomputed savings from materialized summary
    const costSummary = urlId
      ? await getUrlCostSummary(urlId, tenantId)
      : null;

    return NextResponse.json({
      performance: legacyPerformance, // Backward compatibility
      urlPerformance,
      keywordRankings: keywordRankingHistory,
      keywords: relatedKeywords,
      history,
      savings: {
        agency: costSummary?.totalAgencyCost ?? 0,
        overhead: costSummary?.totalOverheadCost ?? 0,
      },
    });
  } catch (error: any) {
    console.error('[API Monitoring Detail] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { 
  getPerformanceDataByUrl, 
  getContentHistoryByUrl, 
  getCostConfigs, 
  getURLPerformanceHistory, 
  getKeywordRankingHistory,
  getKeywordMap 
} from '@/lib/airtable';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL required' }, { status: 400 });
  }

  try {
    // 1. Fetch Keyword Map to identify associated keywords for this URL
    const allKeywords = await getKeywordMap();
    const relatedKeywords = allKeywords.filter(kw => kw.Target_URL === targetUrl);
    const keywordIds = relatedKeywords.map(kw => kw.id);

    // 2. Fetch Performance Data from all tables
    const [
      legacyPerformance, 
      history, 
      costs, 
      urlPerformance, 
      keywordRankingHistory
    ] = await Promise.all([
      getPerformanceDataByUrl(targetUrl),
      getContentHistoryByUrl(targetUrl),
      getCostConfigs(),
      getURLPerformanceHistory(targetUrl),
      getKeywordRankingHistory(keywordIds)
    ]);

    // Calculate individual savings
    let totalAgency = 0;
    let totalOverhead = 0;
    
    history.forEach(log => {
      const cost = costs.find(c => c.Page_Type === log.Page_Type && c.Action_Type === log.Action_Type);
      if (cost) {
        totalAgency += cost.Agency_Cost;
        totalOverhead += cost.Overhead_Cost;
      }
    });

    return NextResponse.json({
      performance: legacyPerformance, // Backward compatibility
      urlPerformance,
      keywordRankings: keywordRankingHistory,
      keywords: relatedKeywords,
      history,
      savings: {
        agency: totalAgency,
        overhead: totalOverhead
      }
    });
  } catch (error: any) {
    console.error('[API Monitoring Detail] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

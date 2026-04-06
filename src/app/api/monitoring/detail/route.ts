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
    
    // Rule: Only display savings if content was actually delivered/published
    const deliveryLogs = history.filter(l => {
      const summary = l.Diff_Summary?.toLowerCase() || '';
      return (summary.includes('content angeliefert') || summary.includes('content veröffentlicht')) &&
             !summary.includes('url wurde dem tool hinzugefügt') &&
             !summary.includes('url wurde dem tab \'vorschläge\' hinzugefügt') &&
             !summary.includes('url wurde der redaktionsplanung hinzugefügt');
    }).sort((a, b) => new Date(a.Created_At).getTime() - new Date(b.Created_At).getTime());
    
    if (deliveryLogs.length > 0) {
      // Deduplicate: Group logs by day
      const dailyLogs: typeof deliveryLogs = [];
      const seenDays = new Set<string>();

      deliveryLogs.forEach(log => {
        const day = new Date(log.Created_At).toISOString().split('T')[0];
        if (!seenDays.has(day)) {
          dailyLogs.push(log);
          seenDays.add(day);
        }
      });

      dailyLogs.forEach((log, index) => {
        const summary = log.Diff_Summary?.toLowerCase() || '';
        const keywordId = log.Keyword_ID?.[0];
        const keyword = allKeywords.find(k => k.id === keywordId);

        // Infer Page_Type from URL structure if missing from log and keyword
        let pageType = log.Page_Type || keyword?.Page_Type;
        if (!pageType) {
          if (targetUrl.toLowerCase().includes('/ratgeber/')) pageType = 'Ratgeber';
          else if (targetUrl.toLowerCase().includes('/kategorie/')) pageType = 'Kategorie';
          else pageType = 'Ratgeber'; // Default fallback
        }

        // Action_Type: First delivery is Erstellung, subsequent ones are Optimierung
        const actionType = index === 0 ? 'Erstellung' : 'Optimierung';

        console.log(`[API Monitoring Detail] URL: ${targetUrl}, Day: ${new Date(log.Created_At).toISOString().split('T')[0]}, Page_Type: ${pageType}, Action_Type: ${actionType}`);

        const cost = costs.find(c => 
          c.Page_Type?.toLowerCase() === pageType.toLowerCase() && 
          c.Action_Type?.toLowerCase() === actionType.toLowerCase()
        );

        if (cost) {
          totalAgency += cost.Agency_Cost;
          totalOverhead += cost.Overhead_Cost;
          console.log(`[API Monitoring Detail] Match found: Agency=${cost.Agency_Cost}, Overhead=${cost.Overhead_Cost}`);
        } else {
          console.warn(`[API Monitoring Detail] No cost config found for Page_Type=${pageType}, Action_Type=${actionType}. Available:`, costs.map(c => `${c.Page_Type}/${c.Action_Type}`).join(', '));
        }
      });
    } else {
      console.log(`[API Monitoring Detail] No delivery log found for ${targetUrl}. Savings remain 0.`);
    }

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

import { NextRequest, NextResponse } from 'next/server';
import { 
  getPerformanceDataByUrl, 
  getContentHistoryByUrlOrKeywords, 
  getCostConfigs, 
  getURLPerformanceHistory, 
  getKeywordRankingHistory,
  getKeywordMap 
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
    const inferPageTypeFromUrl = (value?: string) => {
      const normalized = String(value || '').toLowerCase();
      if (normalized.includes('/ratgeber/')) return 'Ratgeber';
      if (normalized.includes('/kategorie/')) return 'Kategorie';
      if (normalized.includes('/marke/')) return 'Marke';
      if (normalized.includes('/produkt/')) return 'Produkt';
      return 'Kategorie';
    };

    // 1. Fetch Keyword Map to identify associated keywords for this URL
    const allKeywords = await getKeywordMap(tenantId);
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
      getPerformanceDataByUrl(targetUrl, tenantId),
      getContentHistoryByUrlOrKeywords(targetUrl, keywordIds, tenantId),
      getCostConfigs(tenantId),
      getURLPerformanceHistory(targetUrl, tenantId),
      getKeywordRankingHistory(keywordIds, tenantId)
    ]);

    // Calculate individual savings
    let totalAgency = 0;
    let totalOverhead = 0;
    
    // Rule: Only display savings if content was actually delivered/published
    const deliveryLogs = history.filter(l => {
      const summary = l.Event_Label?.toLowerCase() || '';
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
        const keywordId = log.Keyword_ID?.[0];
        const keyword = allKeywords.find(k => k.id === keywordId);

        // Infer Page_Type from URL structure if missing from log and keyword
        let pageType: string = String(log.Page_Type || keyword?.Page_Type || '');
        if (!pageType) {
          pageType = inferPageTypeFromUrl(targetUrl);
        }

        // Action_Type: Use Action_Type from keyword if available, or infer from log/index
        let actionType: string = String(index === 0 ? (keyword?.Action_Type || 'Erstellung') : 'Optimierung');

        console.log(`[API Monitoring Detail] URL: ${targetUrl}, Day: ${new Date(log.Created_At).toISOString().split('T')[0]}, Page_Type: ${pageType}, Action_Type: ${actionType}`);

        const cost = costs.find(c => {
          const cPageType = String(c.Page_Type || '').toLowerCase();
          const cActionType = String(c.Action_Type || '').toLowerCase();
          return cPageType === pageType.toLowerCase() && 
                 cActionType === actionType.toLowerCase();
        });

        if (cost) {
          totalAgency += Number(cost.Agency_Cost || 0);
          totalOverhead += Number(cost.Overhead_Cost || 0);
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

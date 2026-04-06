import { NextResponse } from 'next/server';
import { getKeywordMap, getPerformanceData, getContentLogs, getCostConfigs } from '@/lib/airtable';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [keywords, performance, logs, costs] = await Promise.all([
      getKeywordMap().catch(err => { 
        console.error('[API Monitoring] Critical error fetching keywords:', err); 
        return []; 
      }),
      getPerformanceData().catch(err => { 
        console.error('[API Monitoring] Error fetching performance (continuing with empty data):', err); 
        return []; 
      }),
      getContentLogs().catch(err => { 
        console.error('[API Monitoring] Error fetching logs (continuing with empty data):', err); 
        return []; 
      }),
      getCostConfigs().catch(err => { 
        console.error('[API Monitoring] Error fetching costs (continuing with empty data):', err); 
        return []; 
      })
    ]);

    // Safety check: if keywords is empty, the entire dashboard is mostly useless
    if (keywords.length === 0) {
      console.warn('[API Monitoring] No keywords found. Dashboard will be empty.');
    }

    // Aggregate Global Metrics
    const publishedLogs = logs.filter(l => 
      l.Action_Type === 'Erstellung' || 
      l.Action_Type === 'Optimierung' ||
      l.Diff_Summary?.toLowerCase().includes('content angeliefert') ||
      l.Diff_Summary?.toLowerCase().includes('content veröffentlicht')
    );
    
    // Group logs by Target_URL to ensure we only count savings if at least one "Erstellung" exists
    const urlLogMap = new Map<string, typeof publishedLogs>();
    publishedLogs.forEach(log => {
      if (!log.Target_URL) return;
      const existing = urlLogMap.get(log.Target_URL) || [];
      urlLogMap.set(log.Target_URL, [...existing, log]);
    });
    
    // Time-to-Rank calculation
    let totalTTR = 0;
    let ttrCount = 0;
    
    publishedLogs.forEach(log => {
      if (!log.Target_URL) return;
      const urlPerf = performance
        .filter(p => p.Target_URL === log.Target_URL)
        .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
      
      const publishDate = new Date(log.Created_At);
      const top10Entry = urlPerf.find(p => new Date(p.Date) >= publishDate && p.Position && p.Position <= 10);
      
      if (top10Entry) {
        const diffDays = Math.ceil((new Date(top10Entry.Date).getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          totalTTR += diffDays;
          ttrCount++;
        }
      }
    });

    const avgTTR = ttrCount > 0 ? Math.round(totalTTR / ttrCount) : 0;

    // Savings calculation
    let totalAgencySavings = 0;
    let totalOverheadSavings = 0;
    const counts = {
      neuerstellung_ratgeber: 0,
      optimierung_ratgeber: 0,
      neuerstellung_kategorie: 0,
      optimierung_kategorie: 0,
    };

    urlLogMap.forEach((urlLogs, url) => {
      // Rule: Only count savings if content was actually delivered/published
      const deliveryLogs = urlLogs.filter(l => {
        const summary = l.Diff_Summary?.toLowerCase() || '';
        return (summary.includes('content angeliefert') || summary.includes('content veröffentlicht')) &&
               !summary.includes('url wurde dem tool hinzugefügt') &&
               !summary.includes('url wurde dem tab \'vorschläge\' hinzugefügt') &&
               !summary.includes('url wurde der redaktionsplanung hinzugefügt');
      }).sort((a, b) => new Date(a.Created_At).getTime() - new Date(b.Created_At).getTime());
      
      if (deliveryLogs.length === 0) return;

      // Deduplicate: Group logs by day to avoid double billing for multiple saves on the same day
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
        const keyword = keywords.find(k => k.id === keywordId);
        
        // Infer Page_Type from URL structure if missing from log and keyword
        let pageType = log.Page_Type || keyword?.Page_Type;
        if (!pageType) {
          if (url.toLowerCase().includes('/ratgeber/')) pageType = 'Ratgeber';
          else if (url.toLowerCase().includes('/kategorie/')) pageType = 'Kategorie';
          else pageType = 'Ratgeber'; // Default fallback
        }

        // Action_Type: First delivery is Erstellung, subsequent ones are Optimierung
        const actionType = index === 0 ? 'Erstellung' : 'Optimierung';

        console.log(`[API Monitoring] URL: ${url}, Day: ${new Date(log.Created_At).toISOString().split('T')[0]}, Page_Type: ${pageType}, Action_Type: ${actionType}`);

        const cost = costs.find(c => 
          c.Page_Type?.toLowerCase() === pageType.toLowerCase() && 
          c.Action_Type?.toLowerCase() === actionType.toLowerCase()
        );

        if (cost) {
          totalAgencySavings += cost.Agency_Cost;
          totalOverheadSavings += cost.Overhead_Cost;
          console.log(`[API Monitoring] Found cost match: Agency=${cost.Agency_Cost}, Overhead=${cost.Overhead_Cost}`);
        } else {
          console.warn(`[API Monitoring] No cost config found for Page_Type=${pageType}, Action_Type=${actionType}. Available configs:`, costs.map(c => `${c.Page_Type}/${c.Action_Type}`).join(', '));
        }
        
        const pageTypeKey = pageType.toLowerCase();
        const actionTypeKey = actionType.toLowerCase();
        const key = `${actionTypeKey === 'optimierung' ? 'optimierung' : 'neuerstellung'}_${pageTypeKey === 'ratgeber' ? 'ratgeber' : 'kategorie'}` as keyof typeof counts;
        if (key in counts) counts[key]++;
      });
    });

    // Unique URLs with latest stats
    const uniqueUrls = Array.from(new Set(performance.map(p => p.Target_URL))).filter(Boolean);
    const urlList = uniqueUrls.map(url => {
      const urlPerf = performance.filter(p => p.Target_URL === url).sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
      const latest = urlPerf[0];
      const previous = urlPerf[1];
      const urlLogs = logs.filter(l => l.Target_URL === url).sort((a, b) => new Date(b.Created_At).getTime() - new Date(a.Created_At).getTime());
      
      return {
        url,
        clicks: latest?.GSC_Clicks || 0,
        clicksTrend: previous ? (latest?.GSC_Clicks || 0) - (previous?.GSC_Clicks || 0) : 0,
        vi: latest?.Sistrix_VI || 0,
        viTrend: previous ? (latest?.Sistrix_VI || 0) - (previous?.Sistrix_VI || 0) : 0,
        lastAction: urlLogs[0]?.Action_Type || 'N/A',
        lastActionDate: urlLogs[0]?.Created_At || null,
      };
    }).filter(item => item.url);

    return NextResponse.json({
      metrics: {
        avgTTR,
        totalAgencySavings,
        totalOverheadSavings,
        counts
      },
      urls: urlList
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

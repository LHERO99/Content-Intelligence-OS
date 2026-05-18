import { NextResponse } from 'next/server';
import { getKeywordMap, getPerformanceData, getContentLogs, getCostConfigs } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = session.user?.tenantId;

  try {
    const [keywords, performance, logs, costs] = await Promise.all([
      getKeywordMap(tenantId).catch(err => { 
        console.error('[API Monitoring] Critical error fetching keywords:', err); 
        return []; 
      }),
      getPerformanceData(tenantId).catch(err => { 
        console.error('[API Monitoring] Error fetching performance (continuing with empty data):', err); 
        return []; 
      }),
      getContentLogs(tenantId).catch(err => { 
        console.error('[API Monitoring] Error fetching logs (continuing with empty data):', err); 
        return []; 
      }),
      getCostConfigs(tenantId).catch(err => { 
        console.error('[API Monitoring] Error fetching costs (continuing with empty data):', err); 
        return []; 
      })
    ]);

    // Safety check: if keywords is empty, the entire dashboard is mostly useless
    if (keywords.length === 0) {
      console.warn('[API Monitoring] No keywords found. Dashboard will be empty.');
    }

    // Build a lookup map: keywordId → Target_URL so that logs stored without
    // loggedUrl (only keywordId) can still be resolved to their URL.
    const keywordUrlMap = new Map(keywords.map(k => [k.id, k.Target_URL]));

    // Enrich every log: if Target_URL is missing, resolve it via keywordId.
    const resolvedLogs = logs.map(l => {
      if (l.Target_URL) return l;
      const resolvedUrl = l.Keyword_ID?.[0] ? keywordUrlMap.get(l.Keyword_ID[0]) : undefined;
      return resolvedUrl ? { ...l, Target_URL: resolvedUrl } : l;
    });

    // Aggregate Global Metrics
    const publishedLogs = resolvedLogs.filter(l => {
      const type = l.Action_Type;
      const summary = l.Event_Label?.toLowerCase() || '';
      return type === 'Erstellung' || 
             type === 'Optimierung' ||
             summary.includes('content angeliefert') ||
             summary.includes('content veröffentlicht');
    });
    
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
        .filter(p => p.Target_URL === log.Target_URL && p.Date)
        .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
      
      const publishDate = new Date(log.Created_At);
      const top10Entry = urlPerf.find(p => p.Date && new Date(p.Date) >= publishDate && p.Position && p.Position <= 10);
      
      if (top10Entry && top10Entry.Date) {
        const diffDays = Math.ceil((new Date(top10Entry.Date).getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          totalTTR += diffDays;
          ttrCount++;
        }
      }
    });

    const avgTTR = ttrCount > 0 ? Math.round(totalTTR / ttrCount) : 0;

    const inferPageTypeFromUrl = (value?: string) => {
      const normalized = String(value || '').toLowerCase();
      if (normalized.includes('/ratgeber/')) return 'Ratgeber';
      if (normalized.includes('/kategorie/')) return 'Kategorie';
      if (normalized.includes('/marke/')) return 'Marke';
      if (normalized.includes('/produkt/')) return 'Produkt';
      return 'Kategorie';
    };

    // Savings calculation
    let totalAgencySavings = 0;
    let totalOverheadSavings = 0;
    const counts = {
      neuerstellung_ratgeber: 0,
      optimierung_ratgeber: 0,
      neuerstellung_kategorie: 0,
      optimierung_kategorie: 0,
      neuerstellung_marke: 0,
      optimierung_marke: 0,
      neuerstellung_produkt: 0,
      optimierung_produkt: 0,
    };

    urlLogMap.forEach((urlLogs, url) => {
      // Rule: Only count savings if content was actually delivered/published
      const deliveryLogs = urlLogs.filter(l => {
        const summary = String(l.Event_Label || '').toLowerCase();
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
        const keywordId = log.Keyword_ID?.[0];
        // Try to find the keyword by ID or Target_URL to get the Page_Type
        const keyword = keywords.find(k => k.id === keywordId) || keywords.find(k => k.Target_URL === url);
        
        // Infer Page_Type from URL structure if missing from log and keyword
        let pageType: string = String(log.Page_Type || keyword?.Page_Type || '');
        if (!pageType) {
          pageType = inferPageTypeFromUrl(url);
        }

        // Action_Type: use what the cycle recorded directly; fall back to positional
        // order (first delivery = Erstellung, all subsequent = Optimierung).
        // keyword.Action_Type is intentionally NOT used here — it reflects the current
        // planned type, not the historical type of this specific log entry.
        const actionType: string = log.Action_Type || (index === 0 ? 'Erstellung' : 'Optimierung');

        console.log(`[API Monitoring] URL: ${url}, Day: ${new Date(log.Created_At).toISOString().split('T')[0]}, Page_Type: ${pageType}, Action_Type: ${actionType}`);

        const cost = costs.find(c => {
          const cPageType = String(c.Page_Type || '').toLowerCase();
          const cActionType = String(c.Action_Type || '').toLowerCase();
          return cPageType === pageType.toLowerCase() && 
                 cActionType === actionType.toLowerCase();
        });

        if (cost) {
          totalAgencySavings += Number(cost.Agency_Cost || 0);
          totalOverheadSavings += Number(cost.Overhead_Cost || 0);
        }
        
        // Robust key generation for counts object
        const normalizedPageType = pageType.toLowerCase();
        let pageTypeKey: 'ratgeber' | 'kategorie' | 'marke' | 'produkt' = 'kategorie';
        if (normalizedPageType === 'ratgeber') pageTypeKey = 'ratgeber';
        else if (normalizedPageType === 'marke') pageTypeKey = 'marke';
        else if (normalizedPageType === 'produkt') pageTypeKey = 'produkt';
        const actionTypeKey = actionType.toLowerCase() === 'optimierung' ? 'optimierung' : 'neuerstellung';
        const key = `${actionTypeKey}_${pageTypeKey}` as keyof typeof counts;
        
        if (key in counts) {
          counts[key]++;
        }
      });
    });

    // Unified list of URLs that should appear in monitoring:
    // Every URL that has data in URL_Performance OR has content logs
    const perfUrls = new Set(performance.map(p => p.Target_URL).filter(Boolean));
    const allLogUrls = new Set(resolvedLogs.map(l => l.Target_URL).filter(Boolean));
    const allUniqueUrls = Array.from(new Set([...perfUrls, ...allLogUrls]));

    const urlList = allUniqueUrls.map(url => {
      const urlPerf = performance
        .filter(p => p.Target_URL === url && p.Date)
        .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
      
      const latest = urlPerf[0];
      const previous = urlPerf[1];
      const urlLogs = resolvedLogs.filter(l => l.Target_URL === url).sort((a, b) => new Date(b.Created_At).getTime() - new Date(a.Created_At).getTime());

      const hasOpenOptimizationRequest = keywords.some((keyword) =>
        keyword.Target_URL === url && !!keyword.optimizationRequestedAt
      );

      // Calculate individual URL savings
      let urlSavings = 0;
      const deliveryLogs = urlLogs.filter(l => {
        const summary = String(l.Event_Label || '').toLowerCase();
        return (summary.includes('content angeliefert') || summary.includes('content veröffentlicht')) &&
               !summary.includes('url wurde dem tool hinzugefügt') &&
               !summary.includes('url wurde dem tab \'vorschläge\' hinzugefügt') &&
               !summary.includes('url wurde der redaktionsplanung hinzugefügt');
      });

      // Deduplicate by day for individual URL
      const seenDays = new Set<string>();
      deliveryLogs.reverse().forEach((log) => {
        const day = new Date(log.Created_At).toISOString().split('T')[0];
        if (!seenDays.has(day)) {
          seenDays.add(day);
          const keywordId = log.Keyword_ID?.[0];
          const keyword = keywords.find(k => k.id === keywordId) || keywords.find(k => k.Target_URL === url);
          
          let pageType: string = String(log.Page_Type || keyword?.Page_Type || '');
          if (!pageType && url) {
            pageType = inferPageTypeFromUrl(url);
          }

          const actionType: string = log.Action_Type || (seenDays.size === 1 ? 'Erstellung' : 'Optimierung');
          
          const cost = costs.find(c => {
            const cPageType = String(c.Page_Type || '').toLowerCase();
            const cActionType = String(c.Action_Type || '').toLowerCase();
            return cPageType === pageType.toLowerCase() && 
                   cActionType === actionType.toLowerCase();
          });

          if (cost) {
            urlSavings += (Number(cost.Agency_Cost || 0) + Number(cost.Overhead_Cost || 0));
          }
        }
      });
      
      const isPublished = urlLogs.some(l => {
        const summary = String(l.Event_Label || '').toLowerCase();
        return summary.includes('content angeliefert') || summary.includes('content veröffentlicht');
      });

      const optimizationEligibility = !isPublished
        ? 'NO_PUBLISHED_CONTENT'
        : hasOpenOptimizationRequest
          ? 'ALREADY_IN_WORKFLOW'
          : 'ELIGIBLE';

      return {
        url,
        clicks: latest?.GSC_Clicks || 0,
        clicksTrend: previous ? (latest?.GSC_Clicks || 0) - (previous?.GSC_Clicks || 0) : 0,
        vi: latest?.Sistrix_VI || 0,
        viTrend: previous ? (latest?.Sistrix_VI || 0) - (previous?.Sistrix_VI || 0) : 0,
        lastAction: urlLogs[0]?.Action_Type || 'N/A',
        lastActionDate: urlLogs[0]?.Created_At || null,
        isPublished,
        hasOpenOptimizationRequest,
        optimizationEligibility,
        savings: urlSavings
      };
    });

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
    console.error('[API Monitoring] Unhandled error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

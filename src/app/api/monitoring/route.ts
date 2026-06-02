import { NextResponse } from 'next/server';
import { getKeywordMap, getPerformanceData, getContentLogs, getAllUrlCostSummaries } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = session.user?.tenantId;

  try {
    const [keywords, performance, logs, costSummaries] = await Promise.all([
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
      getAllUrlCostSummaries(tenantId).catch(err => {
        console.error('[API Monitoring] Error fetching cost summaries (continuing with empty data):', err);
        return new Map<string, { totalAgencyCost: number; totalOverheadCost: number; erstellungCount: number; optimierungCount: number; pageType: string }>();
      }),
    ]);

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

    // publishedLogs used for Time-to-Rank calculation
    const publishedLogs = resolvedLogs.filter(l => {
      const type = l.Action_Type;
      const summary = l.Event_Label?.toLowerCase() || '';
      return type === 'Erstellung' ||
             type === 'Optimierung' ||
             summary.includes('content angeliefert') ||
             summary.includes('content veröffentlicht');
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
      const top10Entry = urlPerf.find(
        p => p.Date && new Date(p.Date) >= publishDate && p.Position && p.Position <= 10
      );

      if (top10Entry && top10Entry.Date) {
        const diffDays = Math.ceil(
          (new Date(top10Entry.Date).getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24)
        );
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

    // ---------------------------------------------------------------------------
    // Savings — read from materialized url_cost_summary (no live event scan)
    // ---------------------------------------------------------------------------
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

    costSummaries.forEach((summary, url) => {
      totalAgencySavings += summary.totalAgencyCost;
      totalOverheadSavings += summary.totalOverheadCost;

      const pageType = (summary.pageType || inferPageTypeFromUrl(url)).toLowerCase();
      let ptKey: 'ratgeber' | 'kategorie' | 'marke' | 'produkt' = 'kategorie';
      if (pageType === 'ratgeber') ptKey = 'ratgeber';
      else if (pageType === 'marke') ptKey = 'marke';
      else if (pageType === 'produkt') ptKey = 'produkt';

      counts[`neuerstellung_${ptKey}`] += summary.erstellungCount;
      counts[`optimierung_${ptKey}`] += summary.optimierungCount;
    });

    // Unified list of URLs that should appear in monitoring:
    // Every URL that has data in URL_Performance OR has content logs
    const perfUrls = new Set(performance.map(p => p.Target_URL).filter(Boolean));
    const allLogUrls = new Set(resolvedLogs.map(l => l.Target_URL).filter(Boolean));
    const allUniqueUrls = Array.from(new Set([...perfUrls, ...allLogUrls])).filter((u): u is string => Boolean(u));

    const urlList = allUniqueUrls.map(url => {
      const urlPerf = performance
        .filter(p => p.Target_URL === url && p.Date)
        .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());

      const latest = urlPerf[0];
      const previous = urlPerf[1];
      const urlLogs = resolvedLogs
        .filter(l => l.Target_URL === url)
        .sort((a, b) => new Date(b.Created_At).getTime() - new Date(a.Created_At).getTime());

      const hasOpenOptimizationRequest = keywords.some(
        keyword => keyword.Target_URL === url && !!keyword.optimizationRequestedAt
      );

      // Robust check: at least one keyword for this URL must have Status === 'Published'
      // (i.e., the last execution cycle was explicitly marked as published).
      // "Angeliefert" alone is not sufficient.
      const urlKeywords = keywords.filter(k => k.Target_URL === url);
      const isPublished = urlKeywords.length > 0 && urlKeywords.some(k => k.Status === 'Published');

      const optimizationEligibility = !isPublished
        ? 'NO_PUBLISHED_CONTENT'
        : hasOpenOptimizationRequest
          ? 'ALREADY_IN_WORKFLOW'
          : 'ELIGIBLE';

      // Per-URL savings from precomputed summary (agency + overhead combined)
      const summary = costSummaries.get(url);
      const urlSavings = summary
        ? summary.totalAgencyCost + summary.totalOverheadCost
        : 0;

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
        savings: urlSavings,
      };
    });

    return NextResponse.json({
      metrics: {
        avgTTR,
        totalAgencySavings,
        totalOverheadSavings,
        counts,
      },
      urls: urlList,
    });
  } catch (error: any) {
    console.error('[API Monitoring] Unhandled error:', error);
    return NextResponse.json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}

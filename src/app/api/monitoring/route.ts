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
      getKeywordMap(),
      getPerformanceData(),
      getContentLogs(),
      getCostConfigs()
    ]);

    // Aggregate Global Metrics
    const publishedLogs = logs.filter(l => l.Action_Type === 'Erstellung' || l.Action_Type === 'Optimierung');
    
    // Time-to-Rank calculation
    let totalTTR = 0;
    let ttrCount = 0;
    
    publishedLogs.forEach(log => {
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

    publishedLogs.forEach(log => {
      const cost = costs.find(c => c.Page_Type === log.Page_Type && c.Action_Type === log.Action_Type);
      if (cost) {
        totalAgencySavings += cost.Agency_Cost;
        totalOverheadSavings += cost.Overhead_Cost;
      }
      
      const key = `${log.Action_Type.toLowerCase()}_${(log.Page_Type || 'Andere').toLowerCase()}` as keyof typeof counts;
      if (key in counts) counts[key]++;
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

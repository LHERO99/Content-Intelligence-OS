import { NextRequest, NextResponse } from 'next/server';
import { upsertPerformanceData, upsertURLPerformance, upsertKeywordRankingHistory } from '@/lib/airtable';

/**
 * API Route for n8n to import performance data and keyword rankings.
 * 
 * Data is split into:
 * 1. URL_Performance (Aggregated metrics per URL/Date)
 * 2. Keyword_Ranking_History (Rankings per Keyword/Date)
 * 3. Performance_Data (Legacy table for backward compatibility)
 */
export async function POST(req: NextRequest) {
  try {
    // Basic authentication
    const authHeader = req.headers.get('x-api-key');
    if (process.env.N8N_API_KEY && authHeader !== process.env.N8N_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { targetUrl, performanceData, rankings, keywordId } = body;

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing targetUrl' }, { status: 400 });
    }

    if (!performanceData || !Array.isArray(performanceData)) {
      return NextResponse.json({ error: 'Missing performanceData array' }, { status: 400 });
    }

    const results: any = {
      keywordEntries: 0,
      upsertResults: { created: 0, updated: 0, errorCount: 0 },
      urlPerformanceResults: { created: 0, updated: 0, errorCount: 0 },
      keywordRankingResults: { created: 0, updated: 0, errorCount: 0 }
    };

    // 1. Prepare URL Performance Records (Aggregate metrics per URL/Date)
    const urlPerformanceRecords = performanceData.map(perf => ({
      Target_URL: targetUrl,
      Date: perf.date,
      GSC_Clicks: perf.clicks,
      GSC_Impressions: perf.impressions,
      Position: perf.position,
      Sistrix_VI: perf.sistrixVi || perf.vi
    }));

    // 2. Identify all keywords to process (Main + Secondaries)
    const keywordsToProcess = rankings && Array.isArray(rankings) ? rankings : [];
    if (keywordId && !keywordsToProcess.find((k: any) => k.keywordId === keywordId)) {
      keywordsToProcess.push({ keywordId, rank: body.rank || undefined });
    }

    if (keywordsToProcess.length === 0) {
      return NextResponse.json({ error: 'No keywordId or rankings provided' }, { status: 400 });
    }

    // 3. Prepare Keyword Ranking Records (Ranking per Keyword/Date)
    const keywordRankingRecords: any[] = [];
    for (const kw of keywordsToProcess) {
      for (const perf of performanceData) {
        keywordRankingRecords.push({
          Keyword_ID: [kw.keywordId],
          Date: perf.date,
          Ranking: kw.rank
        });
      }
    }

    // 4. Prepare Legacy Performance Records (Flat list)
    const allKeywordPerformanceRecords: any[] = [];
    for (const kw of keywordsToProcess) {
      for (const perf of performanceData) {
        allKeywordPerformanceRecords.push({
          Keyword_ID: [kw.keywordId],
          Target_URL: targetUrl,
          Date: perf.date,
          Ranking: kw.rank,
          GSC_Clicks: perf.clicks,
          GSC_Impressions: perf.impressions,
          Position: perf.position,
          Sistrix_VI: perf.sistrixVi || perf.vi
        });
      }
    }

    // 5. Execute Upserts
    const [legacyResult, urlResult, rankingResult] = await Promise.all([
      upsertPerformanceData(allKeywordPerformanceRecords),
      upsertURLPerformance(urlPerformanceRecords),
      upsertKeywordRankingHistory(keywordRankingRecords)
    ]);
    
    results.keywordEntries = keywordsToProcess.length;
    results.upsertResults = {
      created: legacyResult.created,
      updated: legacyResult.updated,
      errorCount: legacyResult.errors.length
    };
    results.urlPerformanceResults = {
      created: urlResult.created,
      updated: urlResult.updated,
      errorCount: urlResult.errors.length
    };
    results.keywordRankingResults = {
      created: rankingResult.created,
      updated: rankingResult.updated,
      errorCount: rankingResult.errors.length
    };

    return NextResponse.json({
      message: 'Historical performance import completed',
      results
    });

  } catch (error: any) {
    console.error('[API Monitoring Import] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}

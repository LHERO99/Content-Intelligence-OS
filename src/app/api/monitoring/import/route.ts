import { NextRequest, NextResponse } from 'next/server';
import { upsertPerformanceData } from '@/lib/airtable';

/**
 * API Route for n8n to import performance data and keyword rankings.
 * 
 * Each ranking entry (Main or Secondary) results in a unique entry in Performance_Data
 * for that specific Keyword_ID and Date. URL metrics (clicks, impressions) are 
 * duplicated across these keyword-specific entries for easier per-keyword analysis.
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
      upsertResults: { created: 0, updated: 0, errorCount: 0 }
    };

    // Prepare a flat list of all performance records to upsert
    // We create one record per (Keyword_ID + Date) combination.
    const allKeywordPerformanceRecords: any[] = [];

    // 1. Identify all keywords to process (Main + Secondaries)
    // n8n sends rankings: [{ keywordId: "...", rank: 12 }, ...]
    const keywordsToProcess = rankings && Array.isArray(rankings) ? rankings : [];
    
    // If n8n sent a top-level keywordId but it's not in rankings, add it (fallback)
    if (keywordId && !keywordsToProcess.find((k: any) => k.keywordId === keywordId)) {
      keywordsToProcess.push({ keywordId, rank: body.rank || undefined });
    }

    if (keywordsToProcess.length === 0) {
      return NextResponse.json({ error: 'No keywordId or rankings provided' }, { status: 400 });
    }

    // 2. Map performanceData to each keyword
    for (const kw of keywordsToProcess) {
      for (const perf of performanceData) {
        allKeywordPerformanceRecords.push({
          Keyword_ID: [kw.keywordId],
          Target_URL: targetUrl,
          Date: perf.date,
          Ranking: kw.rank, // Use the rank provided for this keyword
          GSC_Clicks: perf.clicks,
          GSC_Impressions: perf.impressions,
          Position: perf.position, // URL level average position
          Sistrix_VI: perf.sistrixVi || perf.vi
        });
      }
    }

    // 3. Execute Upsert
    const upsertResult = await upsertPerformanceData(allKeywordPerformanceRecords);
    
    results.keywordEntries = keywordsToProcess.length;
    results.upsertResults = {
      created: upsertResult.created,
      updated: upsertResult.updated,
      errorCount: upsertResult.errors.length,
      errors: upsertResult.errors.length > 0 ? upsertResult.errors : undefined
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

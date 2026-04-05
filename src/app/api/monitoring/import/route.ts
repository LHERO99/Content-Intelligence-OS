import { NextRequest, NextResponse } from 'next/server';
import { upsertPerformanceData, bulkUpdateKeywordRankings } from '@/lib/airtable';

/**
 * API Route for n8n to import performance data and keyword rankings.
 * Expects a POST request with:
 * {
 *   "targetUrl": "...",
 *   "performanceData": [{ "date": "...", "clicks": 0, "impressions": 0, "position": 0, "source": "GSC" }],
 *   "rankings": [{ "keywordId": "...", "rank": 0 }]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Basic authentication (optional but recommended)
    const authHeader = req.headers.get('x-api-key');
    if (process.env.N8N_API_KEY && authHeader !== process.env.N8N_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { targetUrl, performanceData, rankings } = body;

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing targetUrl' }, { status: 400 });
    }

    const results: any = {
      performance: { status: 'skipped' },
      rankings: { status: 'skipped' }
    };

    // 1. Process Performance Data (Keyword level)
    if (performanceData && Array.isArray(performanceData)) {
      // Find the main keyword ID from rankings or use the one provided by n8n
      const mainKeywordId = rankings?.[0]?.keywordId || body.keywordId;

      if (!mainKeywordId) {
        return NextResponse.json({ error: 'Missing main keywordId for performance mapping' }, { status: 400 });
      }

      const formattedData = performanceData.map(p => ({
        Keyword_ID: [mainKeywordId],
        Date: p.date,
        GSC_Clicks: p.clicks,
        GSC_Impressions: p.impressions,
        Position: p.position,
        Sistrix_VI: p.sistrixVi || p.vi
      }));

      console.log(`[API Monitoring Import] Upserting ${formattedData.length} records for Keyword ${mainKeywordId}`);
      const perfResult = await upsertPerformanceData(formattedData);
      results.performance = { status: 'success', ...perfResult };
    }

    // 2. Process Keyword Rankings
    if (rankings && Array.isArray(rankings)) {
      await bulkUpdateKeywordRankings(rankings);
      results.rankings = { status: 'success', count: rankings.length };
    }

    return NextResponse.json({
      message: 'Import completed successfully',
      results
    });

  } catch (error: any) {
    console.error('[API Monitoring Import] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}

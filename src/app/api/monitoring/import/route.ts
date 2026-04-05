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

    // 1. Process Performance Data (URL level)
    if (performanceData && Array.isArray(performanceData)) {
      const formattedData = performanceData.map(p => ({
        Target_URL: targetUrl,
        Date: p.date,
        GSC_Clicks: p.clicks,
        GSC_Impressions: p.impressions,
        Position: p.position,
        Source: p.source || 'GSC'
      }));

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

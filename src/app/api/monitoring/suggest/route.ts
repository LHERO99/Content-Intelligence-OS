import { NextRequest, NextResponse } from 'next/server';
import { createTrend, createContentLog } from '@/lib/airtable';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { urls, reason } = await request.json();

  if (!urls || !Array.isArray(urls)) {
    return NextResponse.json({ error: 'URLs array required' }, { status: 400 });
  }

  try {
    const results = await Promise.all(
      urls.map(async (url) => {
        const trend = await createTrend({
          Trend_Topic: `Optimierung: ${url}`,
          Source: 'GSC', // Originating from monitoring
          Gap_Score: 0,
          Status: 'New'
        });

        if (trend) {
          // Log "URL wurde dem Tab Vorschläge hinzugefügt"
          try {
            // Trend doesn't have a Keyword_ID yet, so we log by Target_URL only
            // But createContentLog REQUIRES Keyword_ID for the Link field in Airtable
            // If it's a new trend without a keyword record, we might need a different logging strategy 
            // or accept that it only logs when associated with a keyword.
            console.log(`[API Suggest] Trend created for ${url}. Skipping Content-Log as no Keyword_ID exists yet.`);
          } catch (err) {
            console.error('[API Suggest] Error in suggestion logic:', err);
          }
        }
        return trend;
      })
    );

    return NextResponse.json({ success: true, count: results.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
            // Trend doesn't have a Keyword_ID yet, but once it's created as a trend, 
            // it doesn't automatically show in the "Suggestions" tab (which is Keyword-Map based).
            // However, the user wants to log when something is added to the Suggestions tab.
            // If this API creates a Keyword-Map entry, we should log it.
            // Currently, this creates a Trend (Potential_Trends).
            console.log(`[API Suggest] Trend created for ${url}.`);
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

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
      urls.map(url => createTrend({
        Trend_Topic: `Optimierung: ${url}`,
        Source: 'GSC', // Originating from monitoring
        Gap_Score: 0,
        Status: 'New'
      }))
    );

    // Log the suggestion events
    try {
      await Promise.all(
        urls.map(url => createContentLog({
          Keyword_ID: [], // No keyword yet
          Target_URL: url,
          Action_Type: 'Optimierung',
          Diff_Summary: 'URL der Vorschlagsliste hinzugefügt',
        }))
      );
    } catch (logError) {
      console.error('[API Suggest] Error creating content logs:', logError);
    }

    return NextResponse.json({ success: true, count: results.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

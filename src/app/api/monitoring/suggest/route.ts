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
            await createContentLog({
              Target_URL: url,
              Action_Type: 'Optimierung',
              Diff_Summary: "URL wurde dem Tab 'Vorschläge' hinzugefügt",
              Reasoning_Chain: reason || "Automatischer Vorschlag aus dem Monitoring",
              Editor: session.user?.email ? [session.user.email] : undefined
            });
          } catch (err) {
            console.error('[API Suggest] Error creating history log:', err);
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

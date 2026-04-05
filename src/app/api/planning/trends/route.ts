import { NextResponse } from 'next/server';
import { createTrend, getPotentialTrends, createContentLog } from '@/lib/airtable';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const trends = await getPotentialTrends();
    return NextResponse.json(trends);
  } catch (error: any) {
    console.error('[API] Error fetching trends:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Trends', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { Trend_Topic, Source, Gap_Score, Status } = body;

    if (!Trend_Topic || !Source) {
      return NextResponse.json(
        { error: 'Trend_Topic und Source sind Pflichtfelder.' },
        { status: 400 }
      );
    }

    const result = await createTrend({
      Trend_Topic,
      Source,
      Gap_Score: Gap_Score ? Number(Gap_Score) : 0,
      Status: Status || 'New',
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Fehler beim Erstellen des Trends in Airtable.' },
        { status: 500 }
      );
    }

    // --- Add Logging for Creation ---
    try {
      const session = await getServerSession(authOptions);
      const editor = session?.user?.email ? [session.user.email] : undefined;
      
      // If Trend_Topic is a URL, use it as Logged_URL. 
      // Otherwise, we log it without a URL link but with the topic in reasoning.
      const isUrl = Trend_Topic.startsWith('http');
      
      await createContentLog({
        Logged_URL: isUrl ? Trend_Topic : undefined,
        Action_Type: 'Erstellung',
        Diff_Summary: "URL wurde dem Tab 'Vorschläge' hinzugefügt",
        Editor: editor,
        Reasoning_Chain: `Manueller Trend-Vorschlag: ${Trend_Topic}`
      });
    } catch (logErr) {
      console.error('[API Trends POST] Error creating creation log:', logErr);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Error creating trend:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error.message },
      { status: 500 }
    );
  }
}

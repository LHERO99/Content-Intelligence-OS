import { NextResponse } from 'next/server';
import { createTrend, getPotentialTrends, createContentLog } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId;
    const trends = await getPotentialTrends(tenantId);
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
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId;

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
    }, tenantId);

    if (!result) {
      return NextResponse.json(
        { error: 'Fehler beim Erstellen des Trends in Airtable.' },
        { status: 500 }
      );
    }

    try {
      const editor = session?.user?.email ? [session.user.email] : undefined;
      const isUrl = Trend_Topic.startsWith('http');
      
      await createContentLog({
        Logged_URL: isUrl ? Trend_Topic : undefined,
        Action_Type: 'Erstellung',
        Event_Label: `Manueller Trend-Vorschlag: ${Trend_Topic}`,
        Editor: editor,
      }, tenantId);
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

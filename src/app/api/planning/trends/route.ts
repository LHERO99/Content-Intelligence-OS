import { NextResponse } from 'next/server';
import { createTrend, getPotentialTrends } from '@/lib/airtable';

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

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Error creating trend:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error.message },
      { status: 500 }
    );
  }
}

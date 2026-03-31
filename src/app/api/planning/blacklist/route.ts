import { NextResponse } from 'next/server';
import { getBlacklist, addToBlacklist } from '@/lib/airtable';

export async function GET() {
  try {
    const blacklist = await getBlacklist();
    return NextResponse.json(blacklist);
  } catch (error: any) {
    console.error('[API] Error fetching blacklist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blacklist', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { Keyword, Reason } = body;

    if (!Keyword || !Reason) {
      return NextResponse.json(
        { error: 'Keyword und Reason sind Pflichtfelder.' },
        { status: 400 }
      );
    }

    const result = await addToBlacklist({
      Keyword,
      Reason,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Fehler beim Hinzufügen zur Blacklist in Airtable.' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Error adding to blacklist:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error.message },
      { status: 500 }
    );
  }
}

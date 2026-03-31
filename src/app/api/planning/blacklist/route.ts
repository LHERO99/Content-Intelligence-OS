import { NextResponse } from 'next/server';
import { getBlacklist, addToBlacklist, updateBlacklist, deleteFromBlacklist, bulkDeleteFromBlacklist } from '@/lib/airtable';

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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID ist erforderlich.' },
        { status: 400 }
      );
    }

    const result = await updateBlacklist(id, updates);

    if (!result) {
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren der Blacklist in Airtable.' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Error updating blacklist:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const idsParam = searchParams.get('ids');

    if (idsParam) {
      const ids = idsParam.split(',');
      await bulkDeleteFromBlacklist(ids);
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json(
        { error: 'ID oder IDs sind erforderlich.' },
        { status: 400 }
      );
    }

    await deleteFromBlacklist(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error deleting from blacklist:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error.message },
      { status: 500 }
    );
  }
}

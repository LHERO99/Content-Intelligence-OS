import { NextResponse } from 'next/server';
import { 
  getBlacklist, 
  addToBlacklist, 
  updateBlacklist, 
  deleteFromBlacklist, 
  bulkDeleteFromBlacklist,
  deleteKeyword,
  bulkDeleteKeywords,
  createContentLog
} from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId;
    const blacklist = await getBlacklist(tenantId);
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
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId;

    const body = await request.json();
    const { Keyword, Reason, Type, keywordId, keywordIds } = body;

    // Case 1: Bulk move from Keyword-Map to Blacklist
    if (keywordIds && Array.isArray(keywordIds) && Reason) {
      const { keywords } = body; 
      if (!keywords || !Array.isArray(keywords)) {
        return NextResponse.json(
          { error: 'Keywords (Array von {id, Keyword, Target_URL}) sind für Bulk-Aktionen erforderlich.' },
          { status: 400 }
        );
      }

      for (const kw of keywords) {
        const blacklistEntry = await addToBlacklist({
          Keyword: Type === 'URL' ? kw.Target_URL : kw.Keyword,
          Target_URL: Type === 'URL' ? kw.Target_URL : undefined,
          Type: Type || 'Keyword',
          Reason,
        }, tenantId);

        if (blacklistEntry && kw.Target_URL) {
          try {
            await createContentLog({
              Keyword_ID: [kw.id],
              Logged_URL: kw.Target_URL,
              Action_Type: kw.Action_Type || 'Optimierung',
              Diff_Summary: `${Type === 'URL' ? 'URL' : 'Keyword'} der Blacklist hinzugefügt. Grund: ${Reason}`,
              Editor: session?.user?.email ? [session.user.email] : undefined
            }, tenantId);
          } catch (logErr) {
            console.error('[API Blacklist] Error creating bulk log:', logErr);
          }
        }
      }

      const idsToDelete = keywords.map((k: any) => k.id);
      await bulkDeleteKeywords(idsToDelete, tenantId);

      return NextResponse.json({ success: true, movedCount: keywords.length });
    }

    // Case 2: Single move from Keyword-Map to Blacklist
    if (keywordId && Keyword && Reason) {
      const targetUrl = body.Target_URL;
      const result = await addToBlacklist({
        Keyword: Type === 'URL' ? targetUrl : Keyword,
        Target_URL: Type === 'URL' ? targetUrl : undefined,
        Type: Type || 'Keyword',
        Reason,
      }, tenantId);

      if (!result) {
        return NextResponse.json(
          { error: 'Fehler beim Hinzufügen zur Blacklist in Airtable.' },
          { status: 500 }
        );
      }

      if (targetUrl) {
        try {
          await createContentLog({
            Keyword_ID: [keywordId],
            Logged_URL: targetUrl,
            Action_Type: body.Action_Type || 'Optimierung',
            Diff_Summary: `${Type === 'URL' ? 'URL' : 'Keyword'} der Blacklist hinzugefügt. Grund: ${Reason}`,
            Editor: session?.user?.email ? [session.user.email] : undefined
          }, tenantId);
        } catch (logErr) {
          console.error('[API Blacklist] Error creating single log:', logErr);
        }
      }

      await deleteKeyword(keywordId, tenantId);
      return NextResponse.json(result);
    }

    // Case 3: Direct add to Blacklist
    if (!Keyword || !Reason) {
      return NextResponse.json(
        { error: 'Keyword und Reason sind Pflichtfelder.' },
        { status: 400 }
      );
    }

    const result = await addToBlacklist({
      Keyword,
      Type: Type || 'Keyword',
      Reason,
    }, tenantId);

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
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId;

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID ist erforderlich.' },
        { status: 400 }
      );
    }

    const result = await updateBlacklist(id, updates, tenantId);

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
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const idsParam = searchParams.get('ids');

    if (idsParam) {
      const ids = idsParam.split(',');
      await bulkDeleteFromBlacklist(ids, tenantId);
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json(
        { error: 'ID oder IDs sind erforderlich.' },
        { status: 400 }
      );
    }

    await deleteFromBlacklist(id, tenantId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error deleting from blacklist:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error.message },
      { status: 500 }
    );
  }
}

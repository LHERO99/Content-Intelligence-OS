import { NextResponse } from 'next/server';
import { createKeyword, getKeywordMap, updateKeyword, deleteKeyword, bulkDeleteKeywords, AirtableValidationError, createContentLog } from '@/lib/airtable';

export async function GET() {
  try {
    const keywords = await getKeywordMap();
    return NextResponse.json(keywords);
  } catch (error: any) {
    console.error('[API] Error fetching keywords:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Keywords', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      Keyword, 
      Target_URL, 
      Search_Volume, 
      Difficulty, 
      Status, 
      Editorial_Deadline, 
      Assigned_Editor,
      Main_Keyword,
      Article_Count,
      Avg_Product_Value
    } = body;

    const result = await createKeyword({
      Keyword,
      Target_URL,
      Search_Volume: Search_Volume ? Number(Search_Volume) : undefined,
      Difficulty: Difficulty ? Number(Difficulty) : undefined,
      Status: Status || 'Backlog',
      Editorial_Deadline,
      Assigned_Editor,
      Main_Keyword: Main_Keyword || 'N',
      Article_Count: Article_Count ? Number(Article_Count) : undefined,
      Avg_Product_Value: Avg_Product_Value ? Number(Avg_Product_Value) : undefined,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Fehler beim Erstellen des Keywords in Airtable.' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[API] Error creating keyword:', error);
    
    if (error instanceof AirtableValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    let { id, ...updates } = body;

    // Support both flat structure and Airtable-style nested fields
    if (updates.fields) {
      updates = { ...updates, ...updates.fields };
      delete updates.fields;
    }

    if (!id && updates.id) id = updates.id as string;

    if (!id) {
      return NextResponse.json(
        { error: "ID ist erforderlich für Updates." },
        { status: 400 }
      );
    }

    // 1. Fetch current record to check for status transitions
    const currentKeywords = await getKeywordMap();
    const currentKeyword = currentKeywords.find(k => k.id === id);

    if (!currentKeyword) {
      console.error(`[API] Keyword not found for ID: ${id}`);
      return NextResponse.json(
        { error: 'Keyword nicht gefunden.' },
        { status: 404 }
      );
    }

    // 2. Convert numeric fields if they exist in updates
    if (updates.Search_Volume !== undefined) updates.Search_Volume = Number(updates.Search_Volume);
    if (updates.Difficulty !== undefined) updates.Difficulty = Number(updates.Difficulty);
    if (updates.Article_Count !== undefined) updates.Article_Count = Number(updates.Article_Count);
    if (updates.Avg_Product_Value !== undefined) updates.Avg_Product_Value = Number(updates.Avg_Product_Value);

    console.log(`[API] Updating keyword ${id} with:`, updates);

    const result = await updateKeyword(id, updates);

    // 3. Status Transition Logging
    if (result && updates.Status && updates.Status !== currentKeyword.Status) {
      try {
        if (updates.Status === 'Planned') {
          await createContentLog({
            Keyword_ID: [id],
            Target_URL: result.Target_URL,
            Action_Type: result.Action_Type,
            Diff_Summary: 'URL wurde der Redaktionsplanung hinzugefügt'
          });
        } else if (updates.Status === 'Published') {
          await createContentLog({
            Keyword_ID: [id],
            Target_URL: result.Target_URL,
            Action_Type: result.Action_Type,
            Diff_Summary: 'Content veröffentlicht'
          });
        }
      } catch (logErr) {
        console.error('[API] Error creating transition log:', logErr);
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren des Keywords in Airtable.' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Error updating keyword:', error);

    if (error instanceof AirtableValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

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
    const softDelete = searchParams.get('soft') === 'true';

    if (idsParam) {
      const ids = idsParam.split(',');
      if (softDelete) {
        // Soft delete: Reset planning fields instead of deleting the record
        try {
          for (const recordId of ids) {
            await updateKeyword(recordId, {
              Status: 'Backlog',
              Editorial_Deadline: undefined,
              // Use undefined instead of empty array for link fields if empty
              Assigned_Editor: undefined,
            });
          }
          return NextResponse.json({ success: true });
        } catch (error: any) {
          console.error('[API] Error bulk soft-deleting keywords:', error);
          return NextResponse.json(
            { error: 'Fehler beim Entfernen der Einträge aus der Planung', details: error.message },
            { status: 500 }
          );
        }
      } else {
        await bulkDeleteKeywords(ids);
      }
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json(
        { error: 'ID oder IDs sind erforderlich für Deletion.' },
        { status: 400 }
      );
    }

    if (softDelete) {
      // Soft delete: Reset planning fields
      try {
        await updateKeyword(id, {
          Status: 'Backlog',
          Editorial_Deadline: undefined,
          Assigned_Editor: undefined,
        });
        return NextResponse.json({ success: true });
      } catch (error: any) {
        console.error('[API] Error soft-deleting keyword:', error);
        return NextResponse.json(
          { error: 'Fehler beim Entfernen aus der Planung', details: error.message },
          { status: 500 }
        );
      }
    } else {
      await deleteKeyword(id);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error deleting keyword:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Keywords', details: error.message },
      { status: 500 }
    );
  }
}

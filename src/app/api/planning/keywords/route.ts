import { NextResponse } from 'next/server';
import { createKeyword, getKeywordMap, updateKeyword, AirtableValidationError } from '@/lib/airtable';

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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID ist erforderlich für Updates.' },
        { status: 400 }
      );
    }

    // Convert numeric fields if they exist in updates
    if (updates.Search_Volume !== undefined) updates.Search_Volume = Number(updates.Search_Volume);
    if (updates.Difficulty !== undefined) updates.Difficulty = Number(updates.Difficulty);
    if (updates.Article_Count !== undefined) updates.Article_Count = Number(updates.Article_Count);
    if (updates.Avg_Product_Value !== undefined) updates.Avg_Product_Value = Number(updates.Avg_Product_Value);

    const result = await updateKeyword(id, updates);

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

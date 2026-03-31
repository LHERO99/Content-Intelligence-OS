import { NextResponse } from 'next/server';
import { createKeyword, getKeywordMap } from '@/lib/airtable';

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

    if (!Keyword || !Target_URL) {
      return NextResponse.json(
        { error: 'Keyword und Target_URL sind Pflichtfelder.' },
        { status: 400 }
      );
    }

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
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error.message },
      { status: 500 }
    );
  }
}

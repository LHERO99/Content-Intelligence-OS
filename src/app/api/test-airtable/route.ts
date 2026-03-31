import { getKeywordMap } from '@/lib/airtable';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const data = await getKeywordMap();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Airtable Fetch Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        hint: 'Ensure AIRTABLE_API_KEY and AIRTABLE_BASE_ID are set in your .env file.'
      }, 
      { status: 500 }
    );
  }
}

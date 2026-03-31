import { getKeywordMap } from '@/lib/airtable';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const data = await getKeywordMap();
    const statuses = Array.from(new Set(data.map((item: any) => item.Status)));
    return NextResponse.json({ 
      success: true, 
      uniqueStatuses: statuses,
      sampleRecords: data.slice(0, 5)
    });
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

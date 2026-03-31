import { NextResponse, NextRequest } from 'next/server';
import { base } from '@/lib/airtable';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tableName = searchParams.get('table') || 'Users';

  try {
    console.log(`[Debug] Testing Airtable connection to "${tableName}" table...`);
    
    const records = await base(tableName).select({
      maxRecords: 100,
    }).firstPage();

    console.log(`[Debug] Airtable connection successful. Found ${records.length} records in "${tableName}" table.`);

    return NextResponse.json({
      status: 'success',
      message: `Airtable connection verified for ${tableName}`,
      recordCount: records.length,
      records: records.map(r => ({
        id: r.id,
        ...r.fields
      }))
    });
  } catch (error: any) {
    console.error(`[Debug] Airtable connection failed for ${tableName}:`, error);
    return NextResponse.json({
      status: 'error',
      message: `Airtable connection failed for ${tableName}`,
      error: error.message,
    }, { status: 500 });
  }
}

import { NextResponse, NextRequest } from 'next/server';
import { base, TABLES } from '@/lib/airtable';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedTable = searchParams.get('table');
  
  // Map requested table name to centralized TABLES constant if possible
  let tableName = requestedTable || TABLES.USERS;
  
  // Check if the requested table matches any of our defined tables (case-insensitive)
  const tableEntries = Object.entries(TABLES);
  const matchingEntry = tableEntries.find(([key, value]) => 
    key.toLowerCase() === requestedTable?.toLowerCase() || 
    value.toLowerCase() === requestedTable?.toLowerCase()
  );

  if (matchingEntry) {
    tableName = matchingEntry[1];
  }

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

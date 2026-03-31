import { NextResponse } from 'next/server';
import { base } from '@/lib/airtable';

export async function GET() {
  try {
    console.log('[Debug] Testing Airtable connection to "Users" table...');
    
    // Attempt to list records from the Users table
    const records = await base('Users').select({
      maxRecords: 10,
      view: 'Grid view' // Assuming a default view exists, or omit if unsure
    }).firstPage();

    console.log(`[Debug] Airtable connection successful. Found ${records.length} records in "Users" table.`);

    return NextResponse.json({
      status: 'success',
      message: 'Airtable connection verified',
      recordCount: records.length,
      records: records.map(r => ({
        id: r.id,
        email: r.get('Email'),
        role: r.get('Role')
      }))
    });
  } catch (error: any) {
    console.error('[Debug] Airtable connection failed:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Airtable connection failed',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

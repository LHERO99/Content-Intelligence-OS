import { NextRequest, NextResponse } from 'next/server';
import { upsertPerformanceData } from '@/lib/airtable';

export async function POST(req: NextRequest) {
  try {
    // 1. API-Key Validation
    const apiKey = req.headers.get('x-api-key');
    const validApiKey = process.env.SYNC_API_KEY;

    if (!validApiKey) {
      console.error('[API Sync] SYNC_API_KEY is not defined in environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (apiKey !== validApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Body Parsing
    const body = await req.json();
    const { data, mode } = body;

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format. Expected an array in "data" field.' }, { status: 400 });
    }

    console.log(`[API Sync] Received ${data.length} records for mode: ${mode || 'update'}`);

    // 3. Process Data (Upsert)
    const result = await upsertPerformanceData(data);

    // 4. Response
    return NextResponse.json({
      success: true,
      mode: mode || 'update',
      created: result.created,
      updated: result.updated,
      errorCount: result.errors.length,
      errors: result.errors.length > 0 ? result.errors : undefined
    });

  } catch (error: any) {
    console.error('[API Sync] Error during performance sync:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to sync performance data' 
    }, { status: 500 });
  }
}

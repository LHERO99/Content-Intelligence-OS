import { NextResponse } from 'next/server';
import { getPotentialTrends, base, TABLES } from '@/lib/airtable';

export async function GET() {
  const results: any = {
    step1_simple_fetch: null,
    step2_full_fetch: null,
    diagnostics: {
      baseId: process.env.AIRTABLE_BASE_ID ? 'Set' : 'Missing',
      apiKey: process.env.AIRTABLE_API_KEY ? 'Set' : 'Missing',
    }
  };

  try {
    console.log(`[Debug-Trends] Step 1: Attempting simple fetch from "${TABLES.POTENTIAL_TRENDS}"`);
    // Try a very simple fetch first
    const simpleRecords = await base(TABLES.POTENTIAL_TRENDS).select({
      maxRecords: 1,
      fields: [] // Fetch no fields, just to check table access
    }).firstPage();
    
    results.step1_simple_fetch = {
      success: true,
      count: simpleRecords.length,
      message: `Table "${TABLES.POTENTIAL_TRENDS}" is accessible`
    };
  } catch (error: any) {
    console.error('[Debug-Trends] Step 1 Failed:', error.message);
    results.step1_simple_fetch = {
      success: false,
      error: error.message,
      statusCode: error.statusCode,
      hint: `If 403, the table name "${TABLES.POTENTIAL_TRENDS}" might be wrong or the token lacks "data.records:read" scope for this base.`
    };
  }

  try {
    console.log('[Debug-Trends] Step 2: Attempting full fetch via getPotentialTrends()');
    const data = await getPotentialTrends();
    results.step2_full_fetch = {
      success: true,
      count: data.length,
      sample: data.slice(0, 2)
    };
  } catch (error: any) {
    console.error('[Debug-Trends] Step 2 Failed:', error.message);
    results.step2_full_fetch = {
      success: false,
      error: error.message,
      statusCode: error.statusCode
    };
  }

  return NextResponse.json(results);
}

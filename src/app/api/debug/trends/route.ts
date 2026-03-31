import { NextResponse } from 'next/server';
import { getPotentialTrends, base } from '@/lib/airtable';

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
    console.log('[Debug-Trends] Step 1: Attempting simple fetch from "Potential-Trends"');
    // Try a very simple fetch first
    const simpleRecords = await base('Potential-Trends').select({
      maxRecords: 1,
      fields: [] // Fetch no fields, just to check table access
    }).firstPage();
    
    results.step1_simple_fetch = {
      success: true,
      count: simpleRecords.length,
      message: 'Table "Potential-Trends" is accessible'
    };
  } catch (error: any) {
    console.error('[Debug-Trends] Step 1 Failed:', error.message);
    results.step1_simple_fetch = {
      success: false,
      error: error.message,
      statusCode: error.statusCode,
      hint: 'If 403, the table name "Potential-Trends" might be wrong or the token lacks "data.records:read" scope for this base.'
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

  // Final check: Try with space instead of hyphen if hyphen failed
  if (!results.step1_simple_fetch.success && results.step1_simple_fetch.statusCode === 403) {
    try {
      console.log('[Debug-Trends] Step 3: Attempting fetch from "Potential Trends" (with space)');
      const spaceRecords = await base('Potential Trends').select({ maxRecords: 1 }).firstPage();
      results.step3_space_check = {
        success: true,
        message: 'Table "Potential Trends" (with space) IS accessible! The hyphen was the issue.'
      };
    } catch (e: any) {
      results.step3_space_check = {
        success: false,
        error: e.message
      };
    }
  }

  return NextResponse.json(results);
}

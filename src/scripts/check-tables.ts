
import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function listTables() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in .env.local');
    return;
  }
  
  console.log('Using Base ID:', baseId);
  
  const airtable = new Airtable({ apiKey });
  const base = airtable.base(baseId);

  try {
    // Try a different table name or just list what we can
    const tables = ['Keyword-Map', 'Keyword_Map', 'Keywords', 'Content-Log', 'Content_Log'];
    for (const table of tables) {
      try {
        const records = await base(table).select({ maxRecords: 1 }).all();
        console.log(`Table "${table}" exists and has ${records.length} records sample.`);
        if (records.length > 0) {
           console.log(`Sample ID from ${table}: ${records[0].id}`);
        }
      } catch (e: any) {
        console.log(`Table "${table}" check failed: ${e.message}`);
      }
    }
  } catch (error: any) {
    console.error('General Error:', error.message);
  }
}

listTables();

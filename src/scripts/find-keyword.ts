
import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function findKeyword() {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.error('Missing Airtable credentials in .env.local');
    process.exit(1);
  }

  const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
  const base = airtable.base(process.env.AIRTABLE_BASE_ID);

  try {
    const records = await base('Keyword-Map').select({ maxRecords: 1 }).all();
    if (records.length > 0) {
      console.log('FOUND_KEYWORD_ID=' + records[0].id);
      console.log('FOUND_KEYWORD_NAME=' + records[0].get('Keyword'));
    } else {
      console.log('No keywords found in Airtable');
    }
  } catch (error) {
    console.error('Error fetching from Airtable:', error);
  }
}

findKeyword();

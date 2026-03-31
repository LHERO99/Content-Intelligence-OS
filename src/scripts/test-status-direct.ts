import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = 'o5vnCBS44t0oWT';

if (!apiKey) {
  console.error('Error: AIRTABLE_API_KEY is not defined in .env.local');
  process.exit(1);
}

const airtable = new Airtable({ apiKey });
const base = airtable.base(baseId);

async function test() {
  try {
    console.log('Fetching Keyword-Map records directly...');
    const records = await base('Keyword-Map').select({ maxRecords: 100 }).all();
    const statuses = Array.from(new Set(records.map((r) => r.get('Status') as string)));
    console.log('Unique Statuses found in Airtable:', statuses);
    
    if (records.length > 0) {
        console.log('Sample Record:', JSON.stringify({
            id: records[0].id,
            fields: records[0].fields
        }, null, 2));
    } else {
        console.log('No records found in Keyword-Map table.');
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

test();

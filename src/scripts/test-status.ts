import { getKeywordMap } from '@/lib/airtable';

async function test() {
  try {
    console.log('Fetching Keyword-Map records...');
    const data = await getKeywordMap();
    const statuses = Array.from(new Set(data.map((item: any) => item.Status)));
    console.log('Unique Statuses found:', statuses);
    console.log('Sample Records:', JSON.stringify(data.slice(0, 2), null, 2));
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

test();

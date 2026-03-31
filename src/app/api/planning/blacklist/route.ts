import { NextResponse } from 'next/server';
import { getBlacklist } from '@/lib/airtable';

export async function GET() {
  try {
    const blacklist = await getBlacklist();
    return NextResponse.json(blacklist);
  } catch (error: any) {
    console.error('[API] Error fetching blacklist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blacklist', details: error.message },
      { status: 500 }
    );
  }
}

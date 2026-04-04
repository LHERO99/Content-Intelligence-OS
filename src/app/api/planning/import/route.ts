import { NextRequest, NextResponse } from 'next/server';
import { bulkCreateKeywords, createContentLog } from '@/lib/airtable';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { keywords } = body;

    if (!keywords || !Array.isArray(keywords)) {
      return NextResponse.json({ error: 'Invalid keywords data' }, { status: 400 });
    }

    const result = await bulkCreateKeywords(keywords);

    return NextResponse.json({
      success: true,
      count: result.created.length,
      skippedCount: result.skipped.length,
      records: result.created,
      skipped: result.skipped
    });
  } catch (error: any) {
    console.error('[API Import] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to import keywords' 
    }, { status: 500 });
  }
}

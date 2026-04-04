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

    // Add logging for each successfully created keyword
    for (const record of result.created) {
      try {
        // 1. Log initial creation - Keyword-Map
        await createContentLog({
          Keyword_ID: [record.id],
          Target_URL: record.Target_URL,
          Action_Type: 'Planung',
          Diff_Summary: 'URL der Keyword-Map hinzugefügt',
        });

        // 2. Log addition to proposal list if Status is Backlog
        if (record.Status === 'Backlog') {
          await createContentLog({
            Keyword_ID: [record.id],
            Target_URL: record.Target_URL,
            Action_Type: 'Planung',
            Diff_Summary: 'URL der Vorschlagsliste hinzugefügt',
          });
        }

        // 3. Log addition to editorial planning if Status is Planned
        if (record.Status === 'Planned') {
          await createContentLog({
            Keyword_ID: [record.id],
            Target_URL: record.Target_URL,
            Action_Type: 'Planung',
            Diff_Summary: 'URL der Redaktionsplanung hinzugefügt',
          });
        }
      } catch (logError) {
        console.error(`[API Import] Error creating log for keyword ${record.id}:`, logError);
        // Continue with other keywords even if logging fails for one
      }
    }

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

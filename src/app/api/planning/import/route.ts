import { NextRequest, NextResponse } from 'next/server';
import { bulkCreateKeywords, createContentLog } from '@/lib/airtable';
import { triggerN8nWorkflow } from '@/lib/n8n';
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

    // Trigger n8n for successfully created keywords
    // NOTE: The initial log "URL wurde dem Tool hinzugefügt" is now only triggered via n8n 
    // to avoid duplicates when both the app and n8n log the same event.
    if (result.created.length > 0) {
      try {
        await Promise.all(
          result.created.map(async (kw) => {
            // Trigger n8n Import Webhook
            // n8n should handle the initial "URL wurde dem Tool hinzugefügt" log entry
            await triggerN8nWorkflow({
              action: 'IMPORT_DATA',
              data: {
                keywordId: kw.id,
                keyword: kw.Keyword,
                targetUrl: kw.Target_URL
              },
              userId: session.user?.email || 'unknown',
              timestamp: new Date().toISOString()
            });
          })
        );
      } catch (logError) {
        console.error('[API Import] Error triggering n8n import webhook:', logError);
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

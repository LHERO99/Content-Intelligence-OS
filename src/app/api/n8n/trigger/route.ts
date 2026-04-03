import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { triggerN8nWorkflow, N8nActionType } from '@/lib/n8n';
import { createContentLog, updateKeyword } from '@/lib/airtable';

/**
 * API Route to trigger n8n workflows.
 * Acts as a proxy to include the X-API-KEY and handle authentication.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Check Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Request Body
    const body = await req.json();
    const { action, data } = body as { action: N8nActionType; data: Record<string, any> };

    if (!action || !data) {
      return NextResponse.json({ message: 'Missing action or data' }, { status: 400 });
    }

    // 3. Special handling for COMMISSION_CONTENT: Update status and log history
    if (action === 'COMMISSION_CONTENT' && data.keywordId) {
      try {
        const commissionTime = new Date().toISOString();
        
        // Update status to "Beauftragt"
        await updateKeyword(data.keywordId, { 
          Status: 'Beauftragt'
        });
        
        // Create initial history entry
        await createContentLog({
          Keyword_ID: [data.keywordId],
          Target_URL: data.targetUrl, // Include Target_URL for history grouping
          Action_Type: 'Erstellung',
          Content_Body: '',
          Diff_Summary: 'Content beauftragt',
          Created_At: commissionTime,
          Editor: session.user?.email ? [session.user.email] : undefined
        });
      } catch (logError) {
        console.error('Failed to update status or log history during commissioning:', logError);
      }
    }

    // 4. Trigger n8n Workflow
    const result = await triggerN8nWorkflow({
      action,
      data,
      userId: session.user?.email || 'unknown',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ 
      message: 'Action triggered successfully', 
      result 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error triggering n8n workflow:', error);
    return NextResponse.json({ 
      message: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}

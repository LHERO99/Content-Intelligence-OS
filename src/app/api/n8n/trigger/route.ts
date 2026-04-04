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

    // 3. Status update and Logging for Commissioning
    if ((action === "COMMISSION_CONTENT" || action === "COMMISSION_OPTIMIZATION") && data.keywordId) {
      await updateKeyword(data.keywordId, { Status: "Beauftragt" });
      
      // Log event to database
      try {
        await createContentLog({
          Keyword_ID: [data.keywordId],
          Target_URL: data.targetUrl,
          Action_Type: action === "COMMISSION_OPTIMIZATION" ? "Optimierung" : "Erstellung",
          Diff_Summary: "Content wurde beauftragt",
          Editor: session.user?.email ? [session.user.email] : undefined
        });
      } catch (logErr) {
        console.error('Error creating commissioning log:', logErr);
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

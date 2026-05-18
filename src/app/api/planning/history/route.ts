import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getContentHistoryByKeyword, getAllContentHistory, createContentLog, getContentHistoryByUrl, createExecutionVersion } from '@/lib/postgres';
import { db, withTenant, getDefaultTenantId } from '@/lib/db';
import { processEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId;

    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get('keywordId');
    const url = searchParams.get('url');

    if (url) {
      const history = await getContentHistoryByUrl(url, tenantId);
      return NextResponse.json(history);
    }

    if (keywordId) {
      const history = await getContentHistoryByKeyword(keywordId, tenantId);
      return NextResponse.json(history);
    }

    const allLogs = await getAllContentHistory(tenantId);
    return NextResponse.json(allLogs);
  } catch (error: any) {
    console.error('[API] Error fetching content history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Check for API Key or Session
    const apiKey = request.headers.get('X-API-KEY');
    const isInternal = apiKey && process.env.N8N_API_KEY && apiKey === process.env.N8N_API_KEY;
    
    let session = null;
    if (!isInternal) {
      session = await getServerSession(authOptions);
    }

    if (!isInternal && !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session?.user?.tenantId;
    const tenant = tenantId ?? getDefaultTenantId();
    const body = await request.json();

    let { 
      keywordId, 
      Keyword_ID, 
      url, 
      Target_URL, 
      Logged_URL,
      actionType, 
      Action_Type, 
      status,
      contentBody, 
      Content_Body, 
      content,
      eventLabel, 
      Event_Label, 
      editor, 
      Editor,
      commissionLogId,
      Commission_Log_Id,
    } = body;

    const finalKeywordId = keywordId || Keyword_ID;
    const finalUrl = url || Target_URL || Logged_URL;
    const finalActionType = actionType || Action_Type || status;
    const finalContentBody = contentBody || Content_Body || content;
    const finalEventLabel = eventLabel || Event_Label;
    const finalEditor = editor || Editor;
    const finalCommissionLogId: number | undefined = commissionLogId ?? Commission_Log_Id ?? undefined;

    if (!finalKeywordId || !finalContentBody) {
      return NextResponse.json({ 
        error: 'Missing keywordId or content' 
      }, { status: 400 });
    }

    const keywordIds = Array.isArray(finalKeywordId) ? finalKeywordId : [finalKeywordId];

    // Execute in transaction
    return await withTenant(tenant, async (tx) => {
      // Look up cycleId from commissionLogId
      let cycleId: number | undefined;
      if (finalCommissionLogId) {
        const [commissionEvent] = await tx
          .select({ cycleId: processEvents.cycleId })
          .from(processEvents)
          .where(
            and(
              eq(processEvents.id, finalCommissionLogId),
              eq(processEvents.tenantId, tenant)
            )
          )
          .limit(1);
        
        cycleId = commissionEvent?.cycleId ?? undefined;
      }

      if (!cycleId) {
        console.error('[API] No cycleId found for commissionLogId:', finalCommissionLogId);
        return NextResponse.json({ 
          error: 'Commission log not found or has no cycle' 
        }, { status: 400 });
      }

      // Create new execution version with edited content
      const versionId = await createExecutionVersion(
        cycleId,
        finalContentBody,
        {
          createdByUserId: session?.user?.id,
          createdByAi: false,
        },
        tenantId
      );

      // Create content log with version reference
      const newLog = await createContentLog({
        Keyword_ID: keywordIds,
        Target_URL: finalUrl,
        Action_Type: finalActionType,
        Event_Label: finalEventLabel,
        Editor: finalEditor || (session?.user?.id ? [session.user.id] : undefined),
        Cycle_Id: cycleId,
        Commission_Log_Id: finalCommissionLogId,
        Version_Id: versionId,
      }, tenantId);

      if (!newLog) {
        return NextResponse.json({ 
          error: 'Failed to create content log' 
        }, { status: 500 });
      }

      return NextResponse.json(newLog);
    });
  } catch (error: any) {
    console.error('[API] Error saving content:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

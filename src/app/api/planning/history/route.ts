import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getContentHistoryByKeyword, getAllContentHistory, createContentLog, getContentHistoryByUrl } from '@/lib/airtable';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get('keywordId');
    const url = searchParams.get('url');

    if (url) {
      const history = await getContentHistoryByUrl(url);
      return NextResponse.json(history);
    }

    if (keywordId) {
      const history = await getContentHistoryByKeyword(keywordId);
      return NextResponse.json(history);
    }

    const allLogs = await getAllContentHistory();
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
      console.warn('[API] Unauthorized POST request to /api/planning/history');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Detailed logging for debugging
    console.log('[API] POST /api/planning/history - Request Body:', JSON.stringify(body, null, 2));
    console.log('[API] POST /api/planning/history - Auth Type:', isInternal ? 'API Key' : 'Session');
    if (isInternal) {
      console.log('[API] POST /api/planning/history - API Key used (last 4 chars):', apiKey?.slice(-4));
    }

    let { 
      keywordId, 
      Keyword_ID, 
      url, 
      Target_URL, 
      actionType, 
      Action_Type, 
      contentBody, 
      Content_Body, 
      diffSummary, 
      Diff_Summary, 
      reasoningChain, 
      Reasoning_Chain, 
      editor, 
      Editor 
    } = body;

    // Standardize field names
    const finalKeywordId = keywordId || Keyword_ID;
    const finalUrl = url || Target_URL;
    const finalActionType = actionType || Action_Type;
    const finalContentBody = contentBody || Content_Body;
    const finalDiffSummary = diffSummary || Diff_Summary;
    const finalReasoningChain = reasoningChain || Reasoning_Chain;
    const finalEditor = editor || Editor;

    if (!finalKeywordId || !finalActionType) {
      console.error('[API] Missing required fields:', { finalKeywordId, finalActionType });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Ensure keywordId is an array for Airtable Link field
    const keywordIds = Array.isArray(finalKeywordId) ? finalKeywordId : [finalKeywordId];

    const newLog = await createContentLog({
      Keyword_ID: keywordIds,
      Target_URL: finalUrl,
      Action_Type: finalActionType,
      Content_Body: finalContentBody,
      Diff_Summary: finalDiffSummary,
      Reasoning_Chain: finalReasoningChain,
      Editor: finalEditor || (session?.user?.email ? [session.user.email] : undefined),
    });

    return NextResponse.json(newLog);
  } catch (error: any) {
    console.error('[API] Error creating content log:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

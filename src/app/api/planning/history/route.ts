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

    const { keywordId, url, actionType, contentBody, diffSummary, reasoningChain, editor } = body;

    if (!keywordId || !actionType) {
      console.error('[API] Missing required fields:', { keywordId, actionType });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Ensure keywordId is an array for Airtable Link field
    const keywordIds = Array.isArray(keywordId) ? keywordId : [keywordId];

    const newLog = await createContentLog({
      Keyword_ID: keywordIds,
      Target_URL: url,
      Action_Type: actionType,
      Content_Body: contentBody,
      Diff_Summary: diffSummary,
      Reasoning_Chain: reasoningChain,
      Editor: editor || (session?.user?.email ? [session.user.email] : undefined),
    });

    return NextResponse.json(newLog);
  } catch (error: any) {
    console.error('[API] Error creating content log:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

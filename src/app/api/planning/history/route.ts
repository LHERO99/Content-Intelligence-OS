import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getContentHistoryByKeyword, getAllContentHistory, createContentLog } from '@/lib/airtable';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get('keywordId');

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
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { keywordId, actionType, contentBody, diffSummary, reasoningChain, version } = body;

    if (!keywordId || !actionType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newLog = await createContentLog({
      Keyword_ID: [keywordId],
      Action_Type: actionType,
      Content_Body: contentBody,
      Diff_Summary: diffSummary,
      Reasoning_Chain: reasoningChain,
      Version: version || 'v2',
      Editor: session.user?.email ? [session.user.email] : undefined,
    });

    return NextResponse.json(newLog);
  } catch (error: any) {
    console.error('[API] Error creating content log:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

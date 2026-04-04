import { NextResponse } from 'next/server';
import { createContentLog, updateKeyword } from '@/lib/airtable';

/**
 * Endpoint for n8n callbacks to return generated content.
 * Expected body: {
 *   keywordId: string,
 *   content: string,
 *   reasoning?: string,
 *   status?: string
 * }
 */
export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get('X-API-KEY');
    const isInternal = apiKey && process.env.N8N_API_KEY && apiKey === process.env.N8N_API_KEY;

    if (!isInternal) {
      console.warn('[API] Unauthorized callback request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[API] n8n callback received body:', JSON.stringify(body));
    const { keywordId, content, reasoning, status } = body;

    if (!keywordId || !content) {
      console.error('[API] n8n callback missing fields:', { keywordId, content: !!content });
      return NextResponse.json({ error: 'Missing keywordId or content' }, { status: 400 });
    }

    console.log(`[API] Received content from n8n for Keyword ID: ${keywordId}`);

    // 1. Update Keyword Status to "Angeliefert" once content is received
    // Explicitly transition from "Beauftragt" to "Angeliefert"
    try {
      await updateKeyword(keywordId, { Status: 'Angeliefert' });
    } catch (err) {
      console.error('[API] Error updating keyword status to Angeliefert:', err);
    }

    // 2. Create Content-Log entry
    const isOptimization = status === 'Optimierung' || (body.diffSummary && body.diffSummary.toLowerCase().includes('optimiert'));
    
    const newLog = await createContentLog({
      Keyword_ID: [keywordId],
      Target_URL: body.url || body.targetUrl, // Support passing URL from n8n for better grouping
      Action_Type: isOptimization ? 'Optimierung' : 'Erstellung',
      Content_Body: content,
      Reasoning_Chain: reasoning || '',
      Diff_Summary: body.diffSummary || (isOptimization ? 'Content-Optimierung angeliefert' : 'Content-Erstellung angeliefert'),
    });

    return NextResponse.json({
      success: true,
      logId: newLog?.id
    });

  } catch (error: any) {
    console.error('[API] Error in n8n callback:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

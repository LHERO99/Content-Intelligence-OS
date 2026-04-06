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

    const rawBody = await request.text();
    console.log('[API] n8n callback received raw body:', rawBody);
    
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error('[API] Failed to parse n8n callback body as JSON:', e);
      return NextResponse.json({ error: 'Invalid JSON body', raw: rawBody.slice(0, 100) }, { status: 400 });
    }
    
    // Extract with fallbacks to handle different naming conventions
    const keywordId = body.keywordId || body.Keyword_ID;
    const content = body.content || body.contentBody || body.Content_Body;
    const reasoning = body.reasoning || body.reasoningChain || body.Reasoning_Chain;
    const status = body.status || body.Status;

    if (!keywordId || !content) {
      console.error('[API] n8n callback missing fields:', { 
        keywordId: !!keywordId, 
        content: !!content,
        receivedFields: Object.keys(body),
        bodyPreview: JSON.stringify(body).slice(0, 100)
      });
      return NextResponse.json({ 
        error: 'Missing keywordId or content',
        details: { keywordId: !!keywordId, content: !!content },
        receivedKeys: Object.keys(body)
      }, { status: 400 });
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
      // We don't pass Target_URL anymore as it's a computed field in Airtable
      Action_Type: isOptimization ? 'Optimierung' : 'Erstellung',
      Content_Body: content,
      Reasoning_Chain: reasoning || '',
      Diff_Summary: 'Content angeliefert',
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

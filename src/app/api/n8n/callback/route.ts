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

    // 1. Update Keyword Status to "Erstellt" once content is received
    // This provides immediate feedback in the UI that the generation is done
    try {
      await updateKeyword(keywordId, { Status: (status || 'Erstellt') as any });
    } catch (err) {
      console.error('[API] Error updating keyword status:', err);
      // We continue even if status update fails, to save the content
    }

    // 2. Create Content-Log entry (v2 for AI suggestions)
    const newLog = await createContentLog({
      Keyword_ID: [keywordId],
      Target_URL: body.url || body.targetUrl, // Support passing URL from n8n for better grouping
      Action_Type: 'Erstellung',
      Content_Body: content,
      Reasoning_Chain: reasoning || '',
      Diff_Summary: 'KI-Generierung abgeschlossen (n8n callback)',
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

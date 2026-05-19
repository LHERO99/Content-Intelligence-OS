import { NextResponse } from 'next/server';
import { createContentLog, updateKeyword, getConfig, getUrlIdForKeyword, recomputeUrlCostSummary } from '@/lib/postgres';

/**
 * Endpoint for n8n or external agent callbacks to return generated content.
 * Auth: X-API-KEY header must match either N8N_API_KEY env var (internal n8n)
 *       or EXTERNAL_AGENT_WEBHOOK_SECRET config key (external agent webhook).
 * Expected body: {
 *   keywordId: string,
 *   content: string,
 *   reasoning?: string,
 *   status?: string,
 *   tenantId?: string   ← included in the enriched payload from the trigger route
 * }
 */
export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get('X-API-KEY');

    const rawBody = await request.text();
    console.log('[API] n8n callback received raw body:', rawBody);
    
    let body: any;
    try {
      body = JSON.parse(rawBody);
      if (typeof body === 'string') {
        console.log('[API] n8n callback body was double-encoded, parsing again...');
        body = JSON.parse(body);
      }
    } catch (e) {
      console.error('[API] Failed to parse n8n callback body as JSON:', e);
      return NextResponse.json({ error: 'Invalid JSON body', raw: rawBody.slice(0, 100) }, { status: 400 });
    }

    // tenantId is included in the enriched payload sent by the trigger route
    const tenantId: string | undefined = body?.tenantId || undefined;

    // Auth check: accept either the n8n API key or the external agent shared secret
    const isN8n = apiKey && process.env.N8N_API_KEY && apiKey === process.env.N8N_API_KEY;

    let isExternalAgent = false;
    if (!isN8n && apiKey) {
      try {
        const config = await getConfig(tenantId);
        const externalSecret = config.EXTERNAL_AGENT_WEBHOOK_SECRET?.trim();
        isExternalAgent = !!(externalSecret && apiKey === externalSecret);
      } catch {
        console.error('[API] Failed to load config for callback auth');
      }
    }

    if (!isN8n && !isExternalAgent) {
      console.warn('[API] Unauthorized callback request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract with fallbacks to handle different naming conventions
    const keywordId = body.keywordId || body.Keyword_ID;
    const content = body.content || body.contentBody || body.Content_Body;
    const status = body.status || body.Status;
    const targetUrl = body.Target_URL || body.targetUrl || body.Logged_URL;

    if (!keywordId || !content) {
      console.error('[API] n8n callback missing fields:', { 
        keywordId: !!keywordId, 
        content: !!content,
        receivedFields: body && typeof body === 'object' ? Object.keys(body) : typeof body,
        bodyPreview: JSON.stringify(body).slice(0, 100)
      });
      return NextResponse.json({ 
        error: 'Missing keywordId or content',
        details: { keywordId: !!keywordId, content: !!content },
        receivedKeys: body && typeof body === 'object' ? Object.keys(body) : []
      }, { status: 400 });
    }

    console.log(`[API] Received content from n8n for Keyword ID: ${keywordId}`);

    // 1. Update Keyword Status to "Angeliefert"
    try {
      await updateKeyword(keywordId, { Status: 'Angeliefert' }, tenantId);
    } catch (err) {
      console.error('[API] Error updating keyword status to Angeliefert:', err);
    }

    // 2. Create Content-Log entry
    const isOptimization = status === 'Optimierung' || 
                          status === 'Optimization' ||
                          (body.diffSummary && body.diffSummary.toLowerCase().includes('optimiert')) ||
                          (body.actionType && body.actionType === 'Optimierung');
    
    const newLog = await createContentLog({
      Keyword_ID: [keywordId],
      Target_URL: targetUrl,
      Action_Type: isOptimization ? 'Optimierung' : 'Erstellung',
      Content_Body: content,
    }, tenantId);

    // Recompute materialized cost summary (fire-and-forget)
    const urlIdForSummary = await getUrlIdForKeyword(keywordId, tenantId);
    if (urlIdForSummary) {
      recomputeUrlCostSummary(urlIdForSummary, tenantId).catch(err =>
        console.error('[n8n Callback] Failed to recompute cost summary:', err)
      );
    }

    return NextResponse.json({
      success: true,
      logId: newLog?.id
    });

  } catch (error: any) {
    console.error('[API] Error in n8n callback:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

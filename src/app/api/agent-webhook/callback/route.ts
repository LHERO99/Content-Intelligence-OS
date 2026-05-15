import { NextResponse } from 'next/server';
import { createContentLog, updateKeyword, getConfig, createAuditLog, getAllTenants } from '@/lib/postgres';
import { sanitizeHtml } from '@/lib/sanitize';

/**
 * Endpoint for external agent callbacks to return generated content.
 * Auth: X-API-KEY header must match either N8N_API_KEY env var (legacy)
 *       or EXTERNAL_AGENT_WEBHOOK_SECRET config key for some tenant.
 *
 * Security: tenantId is NEVER trusted from the request body.
 * It is derived authoritatively from the API key by scanning all tenants.
 *
 * Expected body: {
 *   keywordId: string,
 *   content: string,
 *   reasoning?: string,
 *   status?: string,
 * }
 */

/**
 * Resolve which tenant owns the given API key.
 * For the legacy N8N_API_KEY (env-var), returns undefined (default tenant).
 * For external agent secrets, scans all tenants and returns the matching one.
 */
async function resolveTenantFromApiKey(
  apiKey: string
): Promise<{ tenantId: string | undefined; isLegacy: boolean } | null> {
  // Legacy n8n key is a global env var — not tenant-scoped
  if (process.env.N8N_API_KEY && apiKey === process.env.N8N_API_KEY) {
    return { tenantId: undefined, isLegacy: true };
  }

  // Scan all tenants for a matching EXTERNAL_AGENT_WEBHOOK_SECRET
  let tenants: { id: string; name: string }[] = [];
  try {
    tenants = await getAllTenants();
  } catch {
    console.error('[API] Failed to load tenants for callback auth');
    return null;
  }

  for (const tenant of tenants) {
    try {
      const config = await getConfig(tenant.id);
      const externalSecret = config.EXTERNAL_AGENT_WEBHOOK_SECRET?.trim();
      if (externalSecret && apiKey === externalSecret) {
        return { tenantId: tenant.id, isLegacy: false };
      }
    } catch {
      // Skip tenants where config cannot be loaded
    }
  }

  return null; // No matching tenant found
}

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get('X-API-KEY');

    const rawBody = await request.text();
    console.log('[API] Agent callback received raw body:', rawBody);
    
    let body: any;
    try {
      body = JSON.parse(rawBody);
      if (typeof body === 'string') {
        console.log('[API] Agent callback body was double-encoded, parsing again...');
        body = JSON.parse(body);
      }
    } catch (e) {
      console.error('[API] Failed to parse agent callback body as JSON:', e);
      return NextResponse.json({ error: 'Invalid JSON body', raw: rawBody.slice(0, 100) }, { status: 400 });
    }

    // Auth check: resolve tenant authoritatively from the API key — never trust body.tenantId
    if (!apiKey) {
      console.warn('[API] Unauthorized callback request — missing_secret');
      try {
        await createAuditLog('agent_webhook:callback:unauthorized', { reason: 'missing_secret' }, 'unknown');
      } catch { /* never block */ }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolved = await resolveTenantFromApiKey(apiKey);

    if (!resolved) {
      console.warn('[API] Unauthorized callback request — invalid_secret');
      try {
        await createAuditLog('agent_webhook:callback:unauthorized', { reason: 'invalid_secret', hasApiKey: true }, 'unknown');
      } catch { /* never block */ }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = resolved;

    // Extract with fallbacks to handle different naming conventions
    const keywordId = body.keywordId || body.Keyword_ID;
    const content = body.content || body.contentBody || body.Content_Body;
    const status = body.status || body.Status;
    const targetUrl = body.Target_URL || body.targetUrl || body.Logged_URL;

    if (!keywordId || !content) {
      console.error('[API] Agent callback missing fields:', { 
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

    console.log(`[API] Received content from agent for Keyword ID: ${keywordId}`);

    // Sanitize HTML content before persisting — removes script, iframe, form etc.
    const sanitizedContent = sanitizeHtml(content);

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
      Logged_URL: targetUrl,
      Action_Type: isOptimization ? 'Optimierung' : 'Erstellung',
      Content_Body: sanitizedContent,
      Event_Label: 'Content angeliefert',
    }, tenantId);

    return NextResponse.json({
      success: true,
      logId: newLog?.id
    });

  } catch (error: any) {
    console.error('[API] Error in agent callback:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

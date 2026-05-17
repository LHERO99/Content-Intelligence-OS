import { NextResponse } from 'next/server';
import { createContentLog, updateKeyword, getConfig, createAuditLog, getAllTenants, getUrlIdForKeyword, createExecutionVersion } from '@/lib/postgres';
import { sanitizeHtml } from '@/lib/sanitize';
import { db } from '@/lib/db';
import { executionCycles, processEvents } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

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
    const commissionLogId: number | null = body.commissionLogId ?? null;

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

    // 1. Update execution cycle status to "delivered" and create version
    let cycleId: number | null = null;
    let versionId: number | null = null;
    let resolvedCommissionLogId: number | null = commissionLogId;

    try {
      // Get urlId for keyword
      const urlId = await getUrlIdForKeyword(keywordId, tenantId);
      console.log(`[API] Callback: urlId=${urlId}, tenantId=${tenantId}, keywordId=${keywordId}`);
      
      if (urlId) {
        // Use getDefaultTenantId() if tenantId is undefined (legacy mode)
        const { getDefaultTenantId } = await import('@/lib/db');
        const effectiveTenantId = tenantId ?? getDefaultTenantId();
        
        console.log(`[API] Callback: effectiveTenantId=${effectiveTenantId}`);
        
        // Debug: Check all cycles for this URL
        const allCycles = await db
          .select({ id: executionCycles.id, status: executionCycles.status, cycleNumber: executionCycles.cycleNumber })
          .from(executionCycles)
          .where(
            and(
              eq(executionCycles.urlId, urlId),
              eq(executionCycles.tenantId, effectiveTenantId)
            )
          )
          .orderBy(desc(executionCycles.cycleNumber));
        
        console.log(`[API] Callback: all cycles for URL=${JSON.stringify(allCycles)}`);
        
        // Find the most recent commissioned cycle
        const [activeCycle] = await db
          .select({ id: executionCycles.id })
          .from(executionCycles)
          .where(
            and(
              eq(executionCycles.urlId, urlId),
              eq(executionCycles.tenantId, effectiveTenantId),
              eq(executionCycles.status, 'commissioned')
            )
          )
          .orderBy(desc(executionCycles.cycleNumber))
          .limit(1);
        
        console.log(`[API] Callback: found activeCycle=${activeCycle?.id}`);
        
        if (activeCycle) {
          cycleId = activeCycle.id;
          
          // If commissionLogId was not provided in callback, look it up from process_events
          if (!resolvedCommissionLogId) {
            const [commissionEvent] = await db
              .select({ id: processEvents.id })
              .from(processEvents)
              .where(
                and(
                  eq(processEvents.cycleId, activeCycle.id),
                  eq(processEvents.eventType, 'cycle_commissioned')
                )
              )
              .limit(1);
            
            if (commissionEvent) {
              resolvedCommissionLogId = commissionEvent.id;
              console.log(`[API] Callback: resolved commissionLogId=${resolvedCommissionLogId} from cycle ${activeCycle.id}`);
            }
          }
          
          // Update cycle status to delivered
          await db
            .update(executionCycles)
            .set({ 
              status: 'delivered',
              deliveredAt: new Date()
            })
            .where(eq(executionCycles.id, activeCycle.id));
          
          console.log(`[API] Callback: cycle ${activeCycle.id} updated to delivered`);
          
          // Create execution version with the content
          versionId = await createExecutionVersion(
            activeCycle.id,
            sanitizedContent,
            {
              createdByAi: true,
              // Could extract AI provider/model from callback body if available
            },
            tenantId
          );
          
          console.log(`[API] Callback: created version ${versionId}`);
        } else {
          console.warn(`[API] Callback: No commissioned cycle found for urlId=${urlId}, tenantId=${effectiveTenantId}`);
        }
      } else {
        console.error(`[API] Callback: Could not find urlId for keywordId=${keywordId}`);
      }
    } catch (err) {
      console.error('[API] Error updating cycle status to delivered:', err);
    }

    // 2. Create Content-Log entry with version reference
    const isOptimization = status === 'Optimierung' || 
                          status === 'Optimization' ||
                          (body.diffSummary && body.diffSummary.toLowerCase().includes('optimiert')) ||
                          (body.actionType && body.actionType === 'Optimierung');
    
    console.log(`[API] Callback: Creating content log with versionId=${versionId}, cycleId=${cycleId}, commissionLogId=${resolvedCommissionLogId}`);
    
    const newLog = await createContentLog({
      Keyword_ID: [keywordId],
      Target_URL: targetUrl,
      Action_Type: isOptimization ? 'Optimierung' : 'Erstellung',
      Event_Label: 'Content angeliefert',
      Cycle_Id: cycleId ?? undefined,
      Commission_Log_Id: resolvedCommissionLogId ?? undefined,
      Version_Id: versionId ?? undefined,
    }, tenantId);

    console.log(`[API] Callback: Created content log with ID=${newLog?.ID}, version_id=${versionId}, commission_log_id=${resolvedCommissionLogId}`);

    return NextResponse.json({
      success: true,
      logId: newLog?.id,
      versionId: versionId,
      cycleId: cycleId
    });

  } catch (error: any) {
    console.error('[API] Error in agent callback:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

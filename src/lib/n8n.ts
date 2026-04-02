/**
 * n8n Webhook Utility
 * Handles outgoing requests to n8n workflows.
 */

export type N8nActionType = 
  | 'CLAIM_TREND' 
  | 'GENERATE_DRAFT' 
  | 'APPROVE_PROPOSAL' 
  | 'BLACKLIST_TREND'
  | 'COMMISSION_CONTENT';

export interface N8nPayload {
  action: N8nActionType;
  data: Record<string, any>;
  userId?: string;
  timestamp: string;
}

/**
 * Triggers an n8n workflow via a webhook.
 * This is intended to be called from the server-side (API routes).
 */
export async function triggerN8nWorkflow(payload: N8nPayload) {
  let n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  const n8nApiKey = process.env.N8N_API_KEY;

  // Use specific multi-agent webhook for commissioning
  if (payload.action === 'COMMISSION_CONTENT') {
    const baseUrl = 'https://n8n.heromarketing.de/webhook-test/23daa68a-287a-41b6-8d82-d6a61bea537c';
    const params = new URLSearchParams({
      keywordId: payload.data.keywordId || '',
      keyword: payload.data.keyword || '',
      targetUrl: payload.data.targetUrl || '',
      userId: payload.userId || 'unknown'
    });
    
    const urlWithParams = `${baseUrl}?${params.toString()}`;
    
    const response = await fetch(urlWithParams, {
      method: 'GET',
      headers: {
        'X-API-KEY': n8nApiKey || '',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`n8n GET webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Try to parse JSON, but handle empty/text responses
    try {
      return await response.json();
    } catch (e) {
      return { status: 'ok', message: 'GET request successful' };
    }
  }
}

/**
 * Client-side wrapper to call our internal Next.js API proxy.
 */
export async function triggerN8nAction(action: N8nActionType, data: Record<string, any>) {
  const response = await fetch('/api/n8n/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, data }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to trigger n8n action');
  }

  return await response.json();
}

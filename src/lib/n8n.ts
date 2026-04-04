/**
 * n8n Webhook Utility
 * Handles outgoing requests to n8n workflows.
 */

export type N8nActionType = 
  | 'CLAIM_TREND' 
  | 'GENERATE_DRAFT' 
  | 'APPROVE_PROPOSAL' 
  | 'BLACKLIST_TREND'
  | 'COMMISSION_CONTENT'
  | 'COMMISSION_OPTIMIZATION'
  | 'IMPORT_DATA';

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
  const n8nApiKey = process.env.N8N_API_KEY;

  let baseUrl = '';
  let method = 'GET';

  // Specific webhooks for different actions
  if (payload.action === 'IMPORT_DATA') {
    baseUrl = 'https://n8n.heromarketing.de/webhook-test/6706e957-0aae-4f5d-9439-1eb5f6e2c327';
  } else if (payload.action === 'COMMISSION_CONTENT' || payload.action === 'COMMISSION_OPTIMIZATION') {
    baseUrl = 'https://n8n.heromarketing.de/webhook-test/23daa68a-287a-41b6-8d82-d6a61bea537c';
  }

  if (baseUrl) {
    const params = new URLSearchParams({
      ...payload.data,
      userId: payload.userId || 'unknown',
      timestamp: payload.timestamp
    });
    
    const urlWithParams = `${baseUrl}?${params.toString()}`;
    
    const response = await fetch(urlWithParams, {
      method: method,
      headers: {
        'X-API-KEY': n8nApiKey || '',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`n8n ${method} webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    try {
      return await response.json();
    } catch (e) {
      return { status: 'ok', message: `${method} request successful` };
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

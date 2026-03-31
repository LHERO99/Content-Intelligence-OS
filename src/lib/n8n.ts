/**
 * n8n Webhook Utility
 * Handles outgoing requests to n8n workflows.
 */

export type N8nActionType = 
  | 'CLAIM_TREND' 
  | 'GENERATE_DRAFT' 
  | 'APPROVE_PROPOSAL' 
  | 'BLACKLIST_TREND';

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
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  const n8nApiKey = process.env.N8N_API_KEY;

  if (!n8nWebhookUrl) {
    throw new Error('N8N_WEBHOOK_URL is not defined in environment variables.');
  }

  const response = await fetch(n8nWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': n8nApiKey || '',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`n8n webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
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

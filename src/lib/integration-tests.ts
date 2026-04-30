/**
 * Shared integration connectivity test functions.
 * Used by both the admin integration settings UI (manual test)
 * and the daily check-integrations cron job.
 */
import 'server-only';
import { IntegrationProvider } from '@/lib/admin-integrations';
import { getConfig } from '@/lib/airtable';

export async function testSistrix(apiKey: string): Promise<void> {
  const sanitizedKey = String(apiKey || '').trim();
  if (!sanitizedKey) {
    throw new Error('Sistrix API-Key ist leer oder ungültig.');
  }

  const response = await fetch(
    `https://api.sistrix.com/credits?api_key=${encodeURIComponent(sanitizedKey)}&format=json`,
    { method: 'GET' }
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Sistrix Test fehlgeschlagen (${response.status}). Bitte API-Key und API-Rechte prüfen.`);
  }
  if (!text.includes('<answer') && !text.includes('{')) {
    throw new Error('Sistrix Antwort konnte nicht validiert werden.');
  }
  const lower = text.toLowerCase();
  if (lower.includes('error') || lower.includes('denied') || lower.includes('invalid')) {
    throw new Error('Sistrix Antwort enthält einen Fehler. Bitte API-Key und Kontostatus prüfen.');
  }
}

export async function testOpenAI(apiKey: string): Promise<void> {
  const sanitizedKey = String(apiKey || '').trim();
  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${sanitizedKey}` },
  });
  if (!response.ok) {
    throw new Error(`OpenAI Test fehlgeschlagen (${response.status})`);
  }
}

export async function testOpenRouter(apiKey: string): Promise<void> {
  const sanitizedKey = String(apiKey || '').trim();
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${sanitizedKey}` },
  });
  if (!response.ok) {
    throw new Error(`OpenRouter Test fehlgeschlagen (${response.status})`);
  }
}

export async function testGemini(apiKey: string): Promise<void> {
  const sanitizedKey = String(apiKey || '').trim();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(sanitizedKey)}`,
    { method: 'GET' }
  );
  if (!response.ok) {
    throw new Error(`Gemini Test fehlgeschlagen (${response.status})`);
  }
}

export async function testCopilot(apiKey: string): Promise<void> {
  const sanitizedKey = String(apiKey || '').trim();
  const response = await fetch('https://models.github.ai/catalog/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sanitizedKey}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
  });
  if (!response.ok) {
    throw new Error(`Copilot (GitHub Models) Test fehlgeschlagen (${response.status})`);
  }
}

export async function testPerplexity(apiKey: string): Promise<void> {
  const sanitizedKey = String(apiKey || '').trim();
  const response = await fetch('https://api.perplexity.ai/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${sanitizedKey}` },
  });
  if (!response.ok) {
    throw new Error(`Perplexity Test fehlgeschlagen (${response.status})`);
  }
}

export async function testDataforseo(username: string, password: string): Promise<void> {
  const sanitizedUser = String(username || '').trim();
  const sanitizedPass = String(password || '').trim();
  const token = Buffer.from(`${sanitizedUser}:${sanitizedPass}`).toString('base64');
  const response = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
    method: 'GET',
    headers: { Authorization: `Basic ${token}` },
  });
  if (!response.ok) {
    throw new Error(`DataForSEO Test fehlgeschlagen (${response.status})`);
  }
}

export async function testVertexLegal(
  projectId: string,
  location: string,
  endpointId: string,
  accessToken: string
): Promise<void> {
  const sanitizedProject = String(projectId || '').trim();
  const sanitizedLocation = String(location || '').trim();
  const sanitizedEndpoint = String(endpointId || '').trim();
  const sanitizedToken = String(accessToken || '').trim();

  if (!sanitizedProject || !sanitizedLocation || !sanitizedEndpoint || !sanitizedToken) {
    throw new Error(
      'Vertex Legal Test fehlgeschlagen: Project, Location, Endpoint und Access Token sind erforderlich.'
    );
  }

  const url = `https://${sanitizedLocation}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(sanitizedProject)}/locations/${encodeURIComponent(sanitizedLocation)}/endpoints/${encodeURIComponent(sanitizedEndpoint)}:predict`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sanitizedToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ instances: [{ ping: true, source: 'content-agent-builder-healthcheck' }] }),
  });
  if (!response.ok) {
    throw new Error(`Vertex Legal Test fehlgeschlagen (${response.status})`);
  }
}

export async function testGoogleSearchConsole(): Promise<void> {
  const config = await getConfig();
  const refreshToken = config.GSC_REFRESH_TOKEN?.trim();
  if (!refreshToken) {
    throw new Error(
      'Google Search Console ist noch nicht verbunden. Bitte über "Mit Google verbinden" autorisieren.'
    );
  }

  const { getAccessToken, listGscSites } = await import('@/lib/google-search-console');
  const accessToken = await getAccessToken(refreshToken);
  const sites = await listGscSites(accessToken);

  if (!sites.length) {
    throw new Error('Verbindung erfolgreich, aber keine verifizierten GSC-Properties gefunden.');
  }
}

/**
 * Tests the agent webhook by sending a ping. Returns null on success, error message on failure.
 * Only called when a webhook URL is configured.
 */
export async function testAgentWebhook(webhookUrl: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping' }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Webhook antwortete mit Status ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Runs the connectivity test for a given provider using its stored config values.
 */
export async function testProviderConnection(
  provider: IntegrationProvider,
  values: Record<string, string>
): Promise<void> {
  switch (provider) {
    case 'sistrix':
      return testSistrix(values.SISTRIX_API_KEY || '');
    case 'openai':
      return testOpenAI(values.OPENAI_API_KEY || '');
    case 'openrouter':
      return testOpenRouter(values.OPENROUTER_API_KEY || '');
    case 'gemini':
      return testGemini(values.GEMINI_API_KEY || '');
    case 'copilot':
      return testCopilot(values.GITHUB_MODELS_API_KEY || '');
    case 'perplexity':
      return testPerplexity(values.PERPLEXITY_API_KEY || '');
    case 'dataforseo':
      return testDataforseo(values.DATAFORSEO_USERNAME || '', values.DATAFORSEO_PASSWORD || '');
    case 'vertex_legal':
      return testVertexLegal(
        values.VERTEX_AI_PROJECT_ID || '',
        values.VERTEX_AI_LOCATION || '',
        values.VERTEX_AI_ENDPOINT_ID || '',
        values.VERTEX_AI_ACCESS_TOKEN || ''
      );
    case 'google_search_console':
      return testGoogleSearchConsole();
    default:
      throw new Error('Kein Test für diesen Provider definiert.');
  }
}

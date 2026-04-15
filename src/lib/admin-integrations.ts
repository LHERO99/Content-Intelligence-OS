import { getConfig, updateConfig } from '@/lib/airtable';

export type IntegrationProvider =
  | 'sistrix'
  | 'openai'
  | 'openrouter'
  | 'gemini'
  | 'copilot'
  | 'perplexity'
  | 'dataforseo'
  | 'vertex_legal';

export type ProviderFieldType = 'password' | 'text';

export interface ProviderFieldDef {
  key: string;
  label: string;
  type: ProviderFieldType;
  placeholder: string;
}

export interface ProviderDefinition {
  id: IntegrationProvider;
  name: string;
  description: string;
  fields: ProviderFieldDef[];
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'sistrix',
    name: 'Sistrix',
    description: 'Sichtbarkeitsindex und SEO-Daten.',
    fields: [
      {
        key: 'SISTRIX_API_KEY',
        label: 'API-Key',
        type: 'password',
        placeholder: 'Sistrix API-Key',
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'LLM-Modelle und Textgenerierung.',
    fields: [
      {
        key: 'OPENAI_API_KEY',
        label: 'API-Key',
        type: 'password',
        placeholder: 'sk-...',
      },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Modell-Routing über mehrere Provider.',
    fields: [
      {
        key: 'OPENROUTER_API_KEY',
        label: 'API-Key',
        type: 'password',
        placeholder: 'sk-or-...',
      },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'Google Gemini API Zugriff.',
    fields: [
      {
        key: 'GEMINI_API_KEY',
        label: 'API-Key',
        type: 'password',
        placeholder: 'AIza...',
      },
    ],
  },
  {
    id: 'copilot',
    name: 'Copilot (GitHub Models)',
    description: 'GitHub Models Katalog und Inference über models.github.ai.',
    fields: [
      {
        key: 'GITHUB_MODELS_API_KEY',
        label: 'API-Key (PAT)',
        type: 'password',
        placeholder: 'github_pat_... (models:read)',
      },
    ],
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    description: 'Perplexity Agent/Sonar API für webgestützte Antworten.',
    fields: [
      {
        key: 'PERPLEXITY_API_KEY',
        label: 'API-Key',
        type: 'password',
        placeholder: 'pplx-...',
      },
    ],
  },
  {
    id: 'dataforseo',
    name: 'DataForSEO',
    description: 'Performance- und SEO-Datenquellen.',
    fields: [
      {
        key: 'DATAFORSEO_USERNAME',
        label: 'Username',
        type: 'text',
        placeholder: 'DataForSEO Username',
      },
      {
        key: 'DATAFORSEO_PASSWORD',
        label: 'Password',
        type: 'password',
        placeholder: 'DataForSEO Password',
      },
    ],
  },
  {
    id: 'vertex_legal',
    name: 'Vertex Legal Agent',
    description: 'Externer Legal Agent via Vertex AI Endpoint.',
    fields: [
      {
        key: 'VERTEX_AI_PROJECT_ID',
        label: 'Project ID',
        type: 'text',
        placeholder: 'my-gcp-project',
      },
      {
        key: 'VERTEX_AI_LOCATION',
        label: 'Location',
        type: 'text',
        placeholder: 'europe-west4',
      },
      {
        key: 'VERTEX_AI_ENDPOINT_ID',
        label: 'Endpoint ID',
        type: 'text',
        placeholder: '1234567890123456789',
      },
      {
        key: 'VERTEX_AI_ACCESS_TOKEN',
        label: 'Access Token',
        type: 'password',
        placeholder: 'ya29....',
      },
    ],
  },
];

export type IntegrationState = {
  provider: IntegrationProvider;
  configured: boolean;
  maskedValues: Record<string, string>;
};

export type DiscoverableModelProvider = 'openai' | 'openrouter' | 'gemini' | 'copilot' | 'perplexity';

export type DiscoveredModel = {
  id: string;
  label: string;
  contextWindow?: number;
};

function maskValue(raw: string | undefined): string {
  const value = (raw || '').trim();
  if (!value) return '';
  if (value.length <= 6) return '*'.repeat(value.length);
  return `${value.slice(0, 3)}${'*'.repeat(Math.max(4, value.length - 7))}${value.slice(-4)}`;
}

export async function getIntegrationsState(): Promise<IntegrationState[]> {
  const config = await getConfig();

  return PROVIDERS.map((provider) => {
    const maskedValues: Record<string, string> = {};
    const configured = provider.fields.every((field) => {
      const value = config[field.key];
      maskedValues[field.key] = maskValue(value);
      return Boolean(value && String(value).trim());
    });

    return {
      provider: provider.id,
      configured,
      maskedValues,
    };
  });
}

export async function saveIntegrationValues(
  providerId: IntegrationProvider,
  values: Record<string, string>
): Promise<void> {
  const provider = PROVIDERS.find((entry) => entry.id === providerId);
  if (!provider) throw new Error('Unbekannter Provider');

  const allowedKeys = new Set(provider.fields.map((field) => field.key));
  const entries = Object.entries(values).filter(([key, value]) => allowedKeys.has(key) && String(value || '').trim());

  if (!entries.length) {
    throw new Error('Keine neuen Werte zum Speichern übergeben.');
  }

  for (const [key, value] of entries) {
    await updateConfig(key, String(value));
  }
}

export async function getProviderConfigValues(providerId: IntegrationProvider): Promise<Record<string, string>> {
  const provider = PROVIDERS.find((entry) => entry.id === providerId);
  if (!provider) throw new Error('Unbekannter Provider');

  const config = await getConfig();
  const values: Record<string, string> = {};

  for (const field of provider.fields) {
    values[field.key] = config[field.key] || '';
  }

  return values;
}

const DISCOVERY_CACHE_TTL_MS = 10 * 60 * 1000;

const modelDiscoveryCache = new Map<string, { expiresAt: number; models: DiscoveredModel[] }>();

function isDiscoverableProvider(providerId: IntegrationProvider): providerId is DiscoverableModelProvider {
  return (
    providerId === 'openai' ||
    providerId === 'openrouter' ||
    providerId === 'gemini' ||
    providerId === 'copilot' ||
    providerId === 'perplexity'
  );
}

function cacheFingerprint(value: string): string {
  const sanitized = String(value || '').trim();
  if (!sanitized) return 'empty';
  return `${sanitized.length}:${sanitized.slice(-4)}`;
}

function sortAndDedupeModels(models: DiscoveredModel[]): DiscoveredModel[] {
  const byId = new Map<string, DiscoveredModel>();
  models.forEach((model) => {
    const id = String(model.id || '').trim();
    if (!id) return;
    byId.set(id, {
      id,
      label: String(model.label || id),
      contextWindow: model.contextWindow,
    });
  });

  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

async function discoverOpenAIModels(apiKey: string): Promise<DiscoveredModel[]> {
  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAI Modelle konnten nicht geladen werden (${response.status})`);
  }

  const payload = await response.json();
  const models = Array.isArray(payload?.data) ? payload.data : [];
  return sortAndDedupeModels(
    models.map((model: any) => ({
      id: String(model?.id || ''),
      label: String(model?.id || ''),
    }))
  );
}

async function discoverOpenRouterModels(apiKey: string): Promise<DiscoveredModel[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter Modelle konnten nicht geladen werden (${response.status})`);
  }

  const payload = await response.json();
  const models = Array.isArray(payload?.data) ? payload.data : [];

  return sortAndDedupeModels(
    models.map((model: any) => ({
      id: String(model?.id || ''),
      label: String(model?.name || model?.id || ''),
      contextWindow: Number.isFinite(model?.context_length) ? Number(model.context_length) : undefined,
    }))
  );
}

async function discoverGeminiModels(apiKey: string): Promise<DiscoveredModel[]> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Gemini Modelle konnten nicht geladen werden (${response.status})`);
  }

  const payload = await response.json();
  const models = Array.isArray(payload?.models) ? payload.models : [];

  const generationCapable = models.filter((model: any) => {
    const methods = Array.isArray(model?.supportedGenerationMethods) ? model.supportedGenerationMethods : [];
    return methods.includes('generateContent') || methods.includes('generateText');
  });

  return sortAndDedupeModels(
    generationCapable.map((model: any) => {
      const rawName = String(model?.name || '');
      const modelId = rawName.startsWith('models/') ? rawName.slice('models/'.length) : rawName;
      return {
        id: modelId,
        label: String(model?.displayName || modelId),
        contextWindow: Number.isFinite(model?.inputTokenLimit) ? Number(model.inputTokenLimit) : undefined,
      };
    })
  );
}

async function discoverCopilotModels(apiKey: string): Promise<DiscoveredModel[]> {
  const response = await fetch('https://models.github.ai/catalog/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
  });

  if (!response.ok) {
    throw new Error(`Copilot Modelle konnten nicht geladen werden (${response.status})`);
  }

  const payload = await response.json();
  const models = Array.isArray(payload) ? payload : [];

  return sortAndDedupeModels(
    models.map((model: any) => ({
      id: String(model?.id || ''),
      label: String(model?.name || model?.id || ''),
      contextWindow: Number.isFinite(model?.limits?.max_input_tokens)
        ? Number(model.limits.max_input_tokens)
        : undefined,
    }))
  );
}

async function discoverPerplexityModels(apiKey: string): Promise<DiscoveredModel[]> {
  const response = await fetch('https://api.perplexity.ai/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Perplexity Modelle konnten nicht geladen werden (${response.status})`);
  }

  const payload = await response.json();
  const models = Array.isArray(payload?.data) ? payload.data : [];

  return sortAndDedupeModels(
    models.map((model: any) => ({
      id: String(model?.id || ''),
      label: String(model?.id || ''),
    }))
  );
}

export async function discoverProviderModels(providerId: IntegrationProvider, forceRefresh = false): Promise<DiscoveredModel[]> {
  if (!isDiscoverableProvider(providerId)) {
    throw new Error('Für diesen Provider ist keine Modellabfrage verfügbar.');
  }

  const config = await getProviderConfigValues(providerId);

  let cacheKey: string = providerId;
  let models: DiscoveredModel[] = [];

  if (providerId === 'openai') {
    const apiKey = String(config.OPENAI_API_KEY || '').trim();
    if (!apiKey) throw new Error('OpenAI API-Key fehlt.');
    cacheKey = `${providerId}:${cacheFingerprint(apiKey)}`;

    if (!forceRefresh) {
      const cached = modelDiscoveryCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.models;
    }

    models = await discoverOpenAIModels(apiKey);
  }

  if (providerId === 'openrouter') {
    const apiKey = String(config.OPENROUTER_API_KEY || '').trim();
    if (!apiKey) throw new Error('OpenRouter API-Key fehlt.');
    cacheKey = `${providerId}:${cacheFingerprint(apiKey)}`;

    if (!forceRefresh) {
      const cached = modelDiscoveryCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.models;
    }

    models = await discoverOpenRouterModels(apiKey);
  }

  if (providerId === 'gemini') {
    const apiKey = String(config.GEMINI_API_KEY || '').trim();
    if (!apiKey) throw new Error('Gemini API-Key fehlt.');
    cacheKey = `${providerId}:${cacheFingerprint(apiKey)}`;

    if (!forceRefresh) {
      const cached = modelDiscoveryCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.models;
    }

    models = await discoverGeminiModels(apiKey);
  }

  if (providerId === 'copilot') {
    const apiKey = String(config.GITHUB_MODELS_API_KEY || '').trim();
    if (!apiKey) throw new Error('Copilot API-Key fehlt.');
    cacheKey = `${providerId}:${cacheFingerprint(apiKey)}`;

    if (!forceRefresh) {
      const cached = modelDiscoveryCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.models;
    }

    models = await discoverCopilotModels(apiKey);
  }

  if (providerId === 'perplexity') {
    const apiKey = String(config.PERPLEXITY_API_KEY || '').trim();
    if (!apiKey) throw new Error('Perplexity API-Key fehlt.');
    cacheKey = `${providerId}:${cacheFingerprint(apiKey)}`;

    if (!forceRefresh) {
      const cached = modelDiscoveryCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.models;
    }

    models = await discoverPerplexityModels(apiKey);
  }

  const sanitizedModels = sortAndDedupeModels(models);
  modelDiscoveryCache.set(cacheKey, {
    expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS,
    models: sanitizedModels,
  });

  return sanitizedModels;
}

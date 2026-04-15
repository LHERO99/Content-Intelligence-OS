import { getConfig, updateConfig } from '@/lib/airtable';

export type IntegrationProvider = 'sistrix' | 'openai' | 'openrouter' | 'gemini' | 'dataforseo';

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
];

export type IntegrationState = {
  provider: IntegrationProvider;
  configured: boolean;
  maskedValues: Record<string, string>;
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

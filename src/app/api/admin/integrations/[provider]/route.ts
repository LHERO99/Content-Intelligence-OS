import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  getProviderConfigValues,
  IntegrationProvider,
  PROVIDERS,
  saveIntegrationValues,
} from '@/lib/admin-integrations';

function isProvider(value: string): value is IntegrationProvider {
  return PROVIDERS.some((provider) => provider.id === value);
}

async function testSistrix(apiKey: string): Promise<void> {
  const sanitizedKey = String(apiKey || '').trim();
  if (!sanitizedKey) {
    throw new Error('Sistrix API-Key ist leer oder ungultig.');
  }

  const response = await fetch(`https://api.sistrix.com/credits?api_key=${encodeURIComponent(sanitizedKey)}&format=json`, {
    method: 'GET',
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Sistrix Test fehlgeschlagen (${response.status}). Bitte API-Key und API-Rechte prufen.`);
  }

  if (!text.includes('<answer') && !text.includes('{')) {
    throw new Error('Sistrix Antwort konnte nicht validiert werden.');
  }

  const lower = text.toLowerCase();
  if (lower.includes('error') || lower.includes('denied') || lower.includes('invalid')) {
    throw new Error('Sistrix Antwort enthalt einen Fehler. Bitte API-Key und Kontostatus prufen.');
  }
}

async function testOpenAI(apiKey: string): Promise<void> {
  const sanitizedKey = String(apiKey || '').trim();
  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sanitizedKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAI Test fehlgeschlagen (${response.status})`);
  }
}

async function testOpenRouter(apiKey: string): Promise<void> {
  const sanitizedKey = String(apiKey || '').trim();
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sanitizedKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter Test fehlgeschlagen (${response.status})`);
  }
}

async function testGemini(apiKey: string): Promise<void> {
  const sanitizedKey = String(apiKey || '').trim();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(sanitizedKey)}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Gemini Test fehlgeschlagen (${response.status})`);
  }
}

async function testDataforseo(username: string, password: string): Promise<void> {
  const sanitizedUser = String(username || '').trim();
  const sanitizedPass = String(password || '').trim();
  const token = Buffer.from(`${sanitizedUser}:${sanitizedPass}`).toString('base64');
  const response = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
    method: 'GET',
    headers: {
      Authorization: `Basic ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`DataForSEO Test fehlgeschlagen (${response.status})`);
  }
}

async function testProviderConnection(provider: IntegrationProvider, values: Record<string, string>): Promise<void> {
  if (provider === 'sistrix') {
    await testSistrix(values.SISTRIX_API_KEY || '');
    return;
  }

  if (provider === 'openai') {
    await testOpenAI(values.OPENAI_API_KEY || '');
    return;
  }

  if (provider === 'openrouter') {
    await testOpenRouter(values.OPENROUTER_API_KEY || '');
    return;
  }

  if (provider === 'gemini') {
    await testGemini(values.GEMINI_API_KEY || '');
    return;
  }

  if (provider === 'dataforseo') {
    await testDataforseo(values.DATAFORSEO_USERNAME || '', values.DATAFORSEO_PASSWORD || '');
    return;
  }

  throw new Error('Kein Test für Provider definiert.');
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ provider: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    if (!isProvider(params.provider)) {
      return NextResponse.json({ error: 'Provider not supported' }, { status: 400 });
    }

    const body = await req.json();
    const values = (body?.values || {}) as Record<string, string>;
    await saveIntegrationValues(params.provider, values);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error saving integration credentials:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ provider: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    if (!isProvider(params.provider)) {
      return NextResponse.json({ error: 'Provider not supported' }, { status: 400 });
    }

    const storedValues = await getProviderConfigValues(params.provider);
    await testProviderConnection(params.provider, storedValues);

    return NextResponse.json({ success: true, message: 'Verbindung erfolgreich getestet.' });
  } catch (error: any) {
    console.error('[API] Error testing integration:', error);
    return NextResponse.json({ error: error.message || 'Integrationstest fehlgeschlagen' }, { status: 500 });
  }
}

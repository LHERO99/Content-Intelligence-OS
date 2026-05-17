import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getProviderConfigValues } from '@/lib/admin-integrations';
import { createContentLog } from '@/lib/postgres';

const SYSTEM_PROMPT = `You are an expert SEO content editor. Your task is to refine the provided HTML article content based on the user's instruction.

Rules:
- Return ONLY the refined HTML content, nothing else. No explanations, no markdown code blocks, no preamble.
- Preserve the existing HTML structure and tags.
- Keep the language of the original content (do not translate unless explicitly asked).
- Maintain SEO-relevant headings, keyword placement, and internal formatting.`;

type SupportedProvider = 'openai' | 'openrouter' | 'gemini' | 'copilot' | 'perplexity';

async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  extraHeaders?: Record<string, string>
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Provider error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const json = await response.json();
    return json?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${userMessage}` }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Gemini error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const json = await response.json();
    return (
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('\n') || ''
    );
  } finally {
    clearTimeout(timeout);
  }
}

function stripMarkdownCodeFences(content: string): string {
  // Some LLMs wrap their response in ```html ... ``` despite being told not to.
  // Strip the opening fence (```html, ```xml, ``` etc.) and the closing fence.
  return content
    .replace(/^```[\w]*\r?\n?/m, '')
    .replace(/\r?\n?```\s*$/m, '')
    .trim();
}

async function runRefine(
  providerId: SupportedProvider,
  model: string,
  currentContent: string,
  instructions: string,
  tenantId?: string
): Promise<string> {
  const config = await getProviderConfigValues(providerId, tenantId);
  const userMessage = `INSTRUCTION: ${instructions}\n\nCURRENT CONTENT (HTML):\n${currentContent}`;

  switch (providerId) {
    case 'openai': {
      const key = config.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY ist nicht hinterlegt.');
      return callOpenAICompatible(
        'https://api.openai.com/v1/chat/completions',
        key, model, SYSTEM_PROMPT, userMessage
      );
    }
    case 'openrouter': {
      const key = config.OPENROUTER_API_KEY;
      if (!key) throw new Error('OPENROUTER_API_KEY ist nicht hinterlegt.');
      return callOpenAICompatible(
        'https://openrouter.ai/api/v1/chat/completions',
        key, model, SYSTEM_PROMPT, userMessage,
        { 'HTTP-Referer': 'https://seo-content-tool', 'X-Title': 'SEO Content Tool' }
      );
    }
    case 'copilot': {
      const key = config.GITHUB_MODELS_API_KEY;
      if (!key) throw new Error('GITHUB_MODELS_API_KEY ist nicht hinterlegt.');
      return callOpenAICompatible(
        'https://models.inference.ai.azure.com/chat/completions',
        key, model, SYSTEM_PROMPT, userMessage
      );
    }
    case 'perplexity': {
      const key = config.PERPLEXITY_API_KEY;
      if (!key) throw new Error('PERPLEXITY_API_KEY ist nicht hinterlegt.');
      return callOpenAICompatible(
        'https://api.perplexity.ai/chat/completions',
        key, model, SYSTEM_PROMPT, userMessage
      );
    }
    case 'gemini': {
      const key = config.GEMINI_API_KEY;
      if (!key) throw new Error('GEMINI_API_KEY ist nicht hinterlegt.');
      return callGemini(key, model, SYSTEM_PROMPT, userMessage);
    }
    default:
      throw new Error(`Nicht unterstützter Provider: ${providerId}`);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId;

    const body = await request.json();
    const {
      keywordId,
      keyword,
      currentContent,
      instructions,
      modelId,
      providerId,
    } = body as {
      keywordId: string;
      keyword: string;
      currentContent: string;
      instructions: string;
      modelId: string;
      providerId: SupportedProvider;
    };

    if (!keywordId || !instructions || !modelId || !providerId) {
      return NextResponse.json({ error: 'Missing required fields: keywordId, instructions, modelId, providerId' }, { status: 400 });
    }

    if (!currentContent) {
      return NextResponse.json({ error: 'currentContent darf nicht leer sein.' }, { status: 400 });
    }

    console.log(`[/api/creation/refine] provider=${providerId} model=${modelId} keyword=${keyword} user=${session.user?.email} tenant=${tenantId}`);

    const refinedContent = stripMarkdownCodeFences(await runRefine(providerId, modelId, currentContent, instructions, tenantId));

    if (!refinedContent) {
      return NextResponse.json({ error: 'Das Modell hat keinen Inhalt zurückgegeben.' }, { status: 502 });
    }

    // Write ContentLog (fire-and-forget)
    createContentLog({
      Keyword_ID: [keywordId],
      Action_Type: 'KI-Chat',
      Content_Body: refinedContent,
      Event_Label: `KI-Chat (${providerId}/${modelId}): ${instructions.slice(0, 200)}`,
      Editor: session.user?.id ? [session.user.id] : undefined,
    }, tenantId).catch((err) => {
      console.error('[/api/creation/refine] ContentLog write failed:', err);
    });

    return NextResponse.json({ refinedContent });
  } catch (error: any) {
    console.error('[/api/creation/refine] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

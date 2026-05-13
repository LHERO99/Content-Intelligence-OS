import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getIntegrationsState, discoverProviderModels, PROVIDERS, DiscoveredModel, DiscoverableModelProvider } from '@/lib/admin-integrations';

// Only AI providers that support chat completions
const AI_PROVIDERS: DiscoverableModelProvider[] = ['openai', 'openrouter', 'gemini', 'copilot', 'perplexity'];

export interface ProviderWithModels {
  id: DiscoverableModelProvider;
  name: string;
  models: DiscoveredModel[];
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user?.tenantId;

    const integrations = await getIntegrationsState(tenantId);

    const configuredAiProviders = integrations.filter(
      (i) => i.configured && (AI_PROVIDERS as string[]).includes(i.provider)
    );

    const results: ProviderWithModels[] = [];

    await Promise.all(
      configuredAiProviders.map(async (integration) => {
        const providerId = integration.provider as DiscoverableModelProvider;
        try {
          const models = await discoverProviderModels(providerId, false, tenantId);
          const providerDef = PROVIDERS.find((p) => p.id === providerId);
          if (models.length > 0) {
            results.push({
              id: providerId,
              name: providerDef?.name ?? providerId,
              models,
            });
          }
        } catch (err: any) {
          // Don't fail the whole request if one provider's model discovery fails
          console.warn(`[/api/creation/models] Model discovery failed for ${providerId}:`, err.message);
        }
      })
    );

    // Sort by provider name for stable UI
    results.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ providers: results });
  } catch (error: any) {
    console.error('[/api/creation/models] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

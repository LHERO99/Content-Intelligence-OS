import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { discoverProviderModels, IntegrationProvider, PROVIDERS } from '@/lib/admin-integrations';

function isProvider(value: string): value is IntegrationProvider {
  return PROVIDERS.some((provider) => provider.id === value);
}

export async function GET(req: NextRequest, context: { params: Promise<{ provider: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    if (!isProvider(params.provider)) {
      return NextResponse.json({ error: 'Provider not supported' }, { status: 400 });
    }

    const searchParams = req.nextUrl.searchParams;
    const refresh = searchParams.get('refresh') === '1';
    const models = await discoverProviderModels(params.provider, refresh);
    return NextResponse.json({ models });
  } catch (error: any) {
    console.error('[API] Error discovering provider models:', error);
    return NextResponse.json({ error: error.message || 'Modelle konnten nicht geladen werden' }, { status: 500 });
  }
}

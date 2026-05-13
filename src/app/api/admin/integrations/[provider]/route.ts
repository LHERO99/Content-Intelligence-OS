import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  getProviderConfigValues,
  IntegrationProvider,
  PROVIDERS,
  saveIntegrationValues,
} from '@/lib/admin-integrations';
import { testProviderConnection } from '@/lib/integration-tests';

function isProvider(value: string): value is IntegrationProvider {
  return PROVIDERS.some((provider) => provider.id === value);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ provider: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId;

    const params = await context.params;
    if (!isProvider(params.provider)) {
      return NextResponse.json({ error: 'Provider not supported' }, { status: 400 });
    }

    const body = await req.json();
    const values = (body?.values || {}) as Record<string, string>;
    await saveIntegrationValues(params.provider, values, tenantId);

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
    const tenantId = session.user?.tenantId;

    const params = await context.params;
    if (!isProvider(params.provider)) {
      return NextResponse.json({ error: 'Provider not supported' }, { status: 400 });
    }

    const storedValues = await getProviderConfigValues(params.provider, tenantId);
    await testProviderConnection(params.provider, storedValues);

    return NextResponse.json({ success: true, message: 'Verbindung erfolgreich getestet.' });
  } catch (error: any) {
    console.error('[API] Error testing integration:', error);
    return NextResponse.json({ error: error.message || 'Integrationstest fehlgeschlagen' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getIntegrationsState, PROVIDERS } from '@/lib/admin-integrations';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integrations = await getIntegrationsState();
    return NextResponse.json({ providers: PROVIDERS, integrations });
  } catch (error: any) {
    console.error('[API] Error fetching integrations:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

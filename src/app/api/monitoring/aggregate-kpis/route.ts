import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAggregateKpis } from '@/lib/postgres';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tenantId = session.user?.tenantId;
    const kpis = await getAggregateKpis(tenantId);
    return NextResponse.json(kpis);
  } catch (err) {
    console.error('[API aggregate-kpis] Error:', err);
    return NextResponse.json({ avgTTR: 0, stabilityIndex: 0, avgTTP: 0 }, { status: 200 });
  }
}

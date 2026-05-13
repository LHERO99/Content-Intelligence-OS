import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getKeywordMap } from '@/lib/postgres';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId;

    const keywords = await getKeywordMap(tenantId);
    const urls = [
      ...new Set(
        keywords
          .map(kw => kw.Target_URL)
          .filter((u): u is string => Boolean(u))
      ),
    ].sort();

    return NextResponse.json({ urls });
  } catch (error: any) {
    console.error('[API] sync/urls error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load URLs' }, { status: 500 });
  }
}

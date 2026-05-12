import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getKeywordMap } from '@/lib/postgres';

/**
 * GET /api/admin/sync/urls
 *
 * Returns all unique Target_URLs known to the system (from the Keyword-Map table).
 * Used to populate the URL-selection list in the manual sync UI.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keywords = await getKeywordMap();
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

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getConfig } from '@/lib/postgres';

/**
 * Returns the list of verified GSC properties available for the authenticated Google account.
 * Requires an active OAuth connection (GSC_REFRESH_TOKEN in config).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getConfig();
    const refreshToken = config.GSC_REFRESH_TOKEN?.trim();

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Google Search Console ist noch nicht verbunden. Bitte zuerst ein Google-Konto verknüpfen.' },
        { status: 400 }
      );
    }

    const { getAccessToken, listGscSites } = await import('@/lib/google-search-console');
    const accessToken = await getAccessToken(refreshToken);
    const sites = await listGscSites(accessToken);

    return NextResponse.json({ properties: sites });
  } catch (error: any) {
    console.error('[GSC Properties] Error fetching properties:', error);
    return NextResponse.json(
      { error: error.message || 'GSC-Properties konnten nicht geladen werden.' },
      { status: 500 }
    );
  }
}

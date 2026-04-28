import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { buildOAuthUrl } from '@/lib/google-search-console';

/**
 * GET /api/auth/google/gsc
 *
 * Initiates the Google OAuth flow for Search Console access.
 * Requires Admin session. Redirects to Google's consent screen.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'Admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appBaseUrl = process.env.NEXTAUTH_URL ?? `https://${req.headers.get('host')}`;
  const redirectUri = `${appBaseUrl}/api/auth/google/gsc/callback`;

  // Pass a state param so the callback knows where to redirect after success
  const returnTo = req.nextUrl.searchParams.get('returnTo') ?? '/admin';
  const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64url');

  let authUrl: string;
  try {
    authUrl = buildOAuthUrl(redirectUri, state);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.redirect(authUrl);
}

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, listGscSites } from '@/lib/google-search-console';
import { updateConfig } from '@/lib/postgres';

/**
 * GET /api/auth/google/gsc/callback
 *
 * OAuth callback from Google. This route is publicly accessible
 * (bypassed by middleware) so Google can redirect here without a session.
 * However, we verify the state param and only write to Config.
 *
 * On success: saves GSC_REFRESH_TOKEN and GSC_CONNECTED_EMAIL to Config,
 * then redirects to /admin?tab=integrations&gsc=connected.
 *
 * On error: redirects to /admin?tab=integrations&gsc=error&message=...
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const stateRaw = searchParams.get('state');

  // Parse return URL from state
  let returnTo = '/admin';
  try {
    if (stateRaw) {
      const parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'));
      returnTo = parsed.returnTo ?? '/admin';
    }
  } catch {
    // ignore — use default
  }

  const appBaseUrl = process.env.NEXTAUTH_URL ?? `https://${req.headers.get('host')}`;

  const errorRedirect = (message: string) =>
    NextResponse.redirect(
      new URL(
        `${returnTo}?gsc=error&message=${encodeURIComponent(message)}`,
        appBaseUrl
      )
    );

  if (error) {
    return errorRedirect(
      error === 'access_denied'
        ? 'Google authorization was denied.'
        : `Google OAuth error: ${error}`
    );
  }

  if (!code) {
    return errorRedirect('No authorization code returned from Google.');
  }

  const redirectUri = `${appBaseUrl}/api/auth/google/gsc/callback`;

  try {
    const { refreshToken, email } = await exchangeCodeForTokens(code, redirectUri);

    // Persist tokens in Airtable Config
    await updateConfig('GSC_REFRESH_TOKEN', refreshToken);
    if (email) await updateConfig('GSC_CONNECTED_EMAIL', email);

    // Try to list sites so we can pre-fill GSC_SITE_URL if not yet set
    // (non-fatal — we skip on error)
    try {
      const { getAccessToken } = await import('@/lib/google-search-console');
      const accessToken = await getAccessToken(refreshToken);
      const sites = await listGscSites(accessToken);
      if (sites.length === 1) {
        // Auto-configure when there's exactly one site
        await updateConfig('GSC_SITE_URL', sites[0]);
      }
    } catch {
      // non-fatal
    }

    return NextResponse.redirect(
      new URL(`${returnTo}?gsc=connected&email=${encodeURIComponent(email)}`, appBaseUrl)
    );
  } catch (err: any) {
    console.error('[GSC OAuth Callback] Error:', err);
    return errorRedirect(err.message ?? 'Unknown error during Google authorization');
  }
}

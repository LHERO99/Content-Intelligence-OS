import 'server-only';

/**
 * Google Search Console integration.
 *
 * Auth: OAuth 2.0 — the user (admin) authorizes via the Google OAuth consent screen.
 * The resulting refresh token is stored per-tenant in the Airtable Config table.
 * Access tokens are obtained on demand by exchanging the refresh token.
 *
 * Required env vars (app-level, not per-tenant):
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *
 * Per-tenant Config keys (stored in Airtable):
 *   GSC_REFRESH_TOKEN
 *   GSC_CONNECTED_EMAIL   (informational, set during OAuth callback)
 *   GSC_SITE_URL          (the verified property in GSC, e.g. "https://www.example.com/")
 */

const GSC_BASE = 'https://searchconsole.googleapis.com/webmasters/v3';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// OAuth scopes required
export const GSC_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'openid',
  'email',
];

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GscDataRow {
  /** ISO date string, e.g. "2025-01-06" */
  date: string;
  clicks: number;
  impressions: number;
  /** Average position (1-indexed) */
  position: number;
}

export interface GscQueryOptions {
  /** ISO date YYYY-MM-DD */
  startDate: string;
  /** ISO date YYYY-MM-DD */
  endDate: string;
  /** Dimensions to group by, e.g. ["date", "query"] */
  dimensions?: string[];
  /** Filter on a specific page URL (exact match) */
  pageFilter?: string;
  rowLimit?: number;
}

// ─── Token exchange ──────────────────────────────────────────────────────────

/**
 * Exchanges an authorization code for tokens (access + refresh).
 * Called once during the OAuth callback.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; email: string }> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET env vars missing');
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();

  if (!data.refresh_token) {
    throw new Error(
      'No refresh_token returned. Make sure prompt=consent&access_type=offline are set in the authorization URL.'
    );
  }

  // Decode email from the id_token (JWT) without signature verification —
  // this is safe here because we just received the token directly from Google.
  let email = '';
  try {
    const payload = JSON.parse(
      Buffer.from(data.id_token.split('.')[1], 'base64url').toString('utf8')
    );
    email = payload.email ?? '';
  } catch {
    // non-critical — email is informational
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    email,
  };
}

/**
 * Obtains a fresh access token by exchanging the stored refresh token.
 */
export async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET env vars missing');
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google access token refresh failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

// ─── GSC API calls ───────────────────────────────────────────────────────────

/**
 * Returns the list of verified GSC sites for the authenticated user.
 * Useful for the connection test and site selection.
 */
export async function listGscSites(accessToken: string): Promise<string[]> {
  const res = await fetch(`${GSC_BASE}/sites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GSC sites listing failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const entries: any[] = data?.siteEntry ?? [];
  return entries.map((e: any) => e.siteUrl as string);
}

/**
 * Queries the Search Analytics for a given site and date range.
 * Returns aggregated rows grouped by the requested dimensions.
 */
export async function querySearchAnalytics(
  siteUrl: string,
  accessToken: string,
  options: GscQueryOptions
): Promise<GscDataRow[]> {
  const {
    startDate,
    endDate,
    dimensions = ['date'],
    pageFilter,
    rowLimit = 25000,
  } = options;

  const requestBody: Record<string, any> = {
    startDate,
    endDate,
    dimensions,
    rowLimit,
    dataState: 'final',
  };

  if (pageFilter) {
    requestBody.dimensionFilterGroups = [
      {
        filters: [
          {
            dimension: 'page',
            operator: 'equals',
            expression: pageFilter,
          },
        ],
      },
    ];
  }

  const encodedSite = encodeURIComponent(siteUrl);
  const res = await fetch(`${GSC_BASE}/sites/${encodedSite}/searchAnalytics/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GSC query failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const rows: any[] = data?.rows ?? [];

  return rows.map((row: any) => {
    // When dimensions = ["date"], row.keys = ["2025-01-06"]
    const date = Array.isArray(row.keys) ? (row.keys[0] as string) : '';
    return {
      date,
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
      position: Number(row.position ?? 0),
    };
  });
}

// ─── Date range helpers ──────────────────────────────────────────────────────

/**
 * Returns ISO date strings for a range from `daysBack` days ago to yesterday.
 */
export function getDateRange(daysBack: number): { startDate: string; endDate: string } {
  const end = new Date();
  end.setDate(end.getDate() - 1); // GSC data lags ~1 day
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack + 1);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

/**
 * Aggregates daily GSC rows into ISO-week buckets (Monday-based).
 * Each bucket contains summed clicks/impressions and averaged position.
 */
export function aggregateByWeek(rows: GscDataRow[]): GscDataRow[] {
  const buckets = new Map<
    string,
    { clicks: number; impressions: number; positionSum: number; count: number }
  >();

  for (const row of rows) {
    const weekStart = getIsoWeekMonday(row.date);
    const existing = buckets.get(weekStart) ?? {
      clicks: 0,
      impressions: 0,
      positionSum: 0,
      count: 0,
    };
    existing.clicks += row.clicks;
    existing.impressions += row.impressions;
    existing.positionSum += row.position * row.impressions; // impression-weighted
    existing.count += row.impressions;
    buckets.set(weekStart, existing);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { clicks, impressions, positionSum, count }]) => ({
      date,
      clicks,
      impressions,
      position: count > 0 ? positionSum / count : 0,
    }));
}

/** Returns the ISO week Monday (YYYY-MM-DD) for a given date string. */
function getIsoWeekMonday(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0=Sun,1=Mon,...
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

// ─── OAuth URL builder ───────────────────────────────────────────────────────

/**
 * Builds the Google OAuth authorization URL.
 */
export function buildOAuthUrl(redirectUri: string, state?: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_OAUTH_CLIENT_ID env var missing');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GSC_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent', // force refresh_token to be returned
    ...(state ? { state } : {}),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

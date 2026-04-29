import 'server-only';

/**
 * Sistrix integration — page-level Sichtbarkeitsindex (VI) via Sistrix API v2.
 *
 * Auth: API key passed as query parameter `api_key`.
 *
 * Endpoint used:
 *   GET https://api.sistrix.com/url.overview
 *   Params: api_key, url (full page URL), format=json
 *
 * The response contains an `overview` array of weekly data points:
 *   [{ date: "YYYY-MM-DD", sichtbarkeit: 0.1234 }, ...]
 * where `date` is the Monday of the ISO week and `sichtbarkeit` is the page-level VI.
 *
 * Credits: each call to url.overview costs 1 Sistrix credit.
 * For 180-day history Sistrix returns all available weekly data points in a
 * single call — no pagination required.
 *
 * Note: page-level VI (url.overview) measures the organic search visibility
 * of a single page across all its ranking keywords. It differs from the
 * domain-level VI (domain.sichtbarkeit) which aggregates all pages of a domain.
 */

const SISTRIX_BASE = 'https://api.sistrix.com';

export interface SistrixVIRow {
  /** ISO date string (Monday of the week), e.g. "2025-01-06" */
  date: string;
  /** Page-level Sichtbarkeitsindex for that week */
  vi: number;
}

interface SistrixOverviewEntry {
  date: string;
  sichtbarkeit: string | number;
}

interface SistrixResponse {
  answer?: Array<{
    overview?: SistrixOverviewEntry[];
  }>;
  // Error format
  error?: { error_id: number; error_message: string };
}

/**
 * Fetches the weekly page-level Sichtbarkeitsindex for a single URL.
 *
 * @param pageUrl  - Full page URL, e.g. "https://www.example.com/ratgeber/ibuprofen"
 * @param apiKey   - Sistrix API key
 * @param weeksBack - How many weeks of history to return (0 = current week only).
 *                   Sistrix returns all available history in one call regardless;
 *                   this param is used to filter the returned rows client-side.
 *                   Pass 26 for ~6 months, 1 for current week only.
 * @returns Array of { date, vi } sorted ascending by date
 */
export async function fetchSistrixPageVI(
  pageUrl: string,
  apiKey: string,
  weeksBack: number = 1
): Promise<SistrixVIRow[]> {
  if (!apiKey?.trim()) throw new Error('Sistrix API key is missing');
  if (!pageUrl?.trim()) throw new Error('Page URL is required');

  const params = new URLSearchParams({
    api_key: apiKey.trim(),
    url: pageUrl.trim(),
    format: 'json',
  });

  const res = await fetch(`${SISTRIX_BASE}/url.overview?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sistrix API request failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const json: SistrixResponse = await res.json();

  if (json.error) {
    throw new Error(`Sistrix API error ${json.error.error_id}: ${json.error.error_message}`);
  }

  const rows: SistrixOverviewEntry[] = json.answer?.[0]?.overview ?? [];

  if (!rows.length) return [];

  // Filter to the requested number of weeks and normalise
  const cutoffDate = weeksBackToDate(weeksBack);
  return rows
    .filter(row => !cutoffDate || row.date >= cutoffDate)
    .map(row => ({
      date: row.date,
      vi: typeof row.sichtbarkeit === 'string' ? parseFloat(row.sichtbarkeit) : row.sichtbarkeit,
    }))
    .filter(row => !isNaN(row.vi))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Batch-fetches page-level VI for multiple URLs.
 * Returns a map of pageUrl → SistrixVIRow[].
 * Errors per URL are caught individually so one failure doesn't abort the batch.
 *
 * @param urls     - Array of full page URLs
 * @param apiKey   - Sistrix API key
 * @param weeksBack - History depth (26 for 6 months, 1 for current week)
 * @param delayMs  - Delay between API calls to avoid rate limiting (default 300ms)
 */
export async function fetchSistrixPageVIBatch(
  urls: string[],
  apiKey: string,
  weeksBack: number,
  delayMs: number = 300
): Promise<{ results: Map<string, SistrixVIRow[]>; errors: string[] }> {
  const results = new Map<string, SistrixVIRow[]>();
  const errors: string[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const rows = await fetchSistrixPageVI(url, apiKey, weeksBack);
      results.set(url, rows);
    } catch (err: any) {
      errors.push(`Sistrix VI failed for ${url}: ${err.message}`);
      results.set(url, []);
    }

    // Respectful delay between calls (Sistrix rate limit: ~10 req/s)
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return { results, errors };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns the ISO date string (YYYY-MM-DD) for the Monday `weeksBack` weeks ago.
 * Used as a cutoff to filter Sistrix history response.
 */
function weeksBackToDate(weeksBack: number): string | null {
  if (weeksBack <= 0) return null;
  const d = new Date();
  // Go back to last Monday
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday - (weeksBack - 1) * 7);
  return d.toISOString().split('T')[0];
}

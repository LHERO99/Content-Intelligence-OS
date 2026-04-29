import 'server-only';

/**
 * DataForSEO integration — keyword ranking lookups via SERP live endpoint.
 * Auth: HTTP Basic (username:password, base64-encoded).
 *
 * We batch keywords in groups of 100 (DataForSEO limit per request) and extract
 * the target domain's organic ranking position from the SERP results.
 */

const DATAFORSEO_BASE = 'https://api.dataforseo.com/v3';
const BATCH_SIZE = 100;

export interface KeywordRankResult {
  keywordId: string;
  keyword: string;
  rank: number | null; // null = not in top 100
}

function buildAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username.trim()}:${password.trim()}`).toString('base64');
  return `Basic ${token}`;
}

/**
 * Extracts the root domain from a full URL for domain matching.
 * e.g. "https://www.docmorris.de/ratgeber/ibuprofen" → "docmorris.de"
 */
function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}

interface SerpTask {
  keywordId: string;
  keyword: string;
  domain: string;
  languageCode: string;
  locationCode: number;
}

async function fetchSerpBatch(
  tasks: SerpTask[],
  auth: string
): Promise<KeywordRankResult[]> {
  const body = tasks.map((t) => ({
    keyword: t.keyword,
    language_code: t.languageCode,
    location_code: t.locationCode,
    depth: 100, // check top 100 results
    calculate_rectangles: false,
  }));

  const response = await fetch(
    `${DATAFORSEO_BASE}/serp/google/organic/live/advanced`,
    {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`DataForSEO SERP request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const json = await response.json();
  const taskResults: any[] = json?.tasks ?? [];

  return tasks.map((task, index) => {
    const taskResult = taskResults[index];
    const items: any[] = taskResult?.result?.[0]?.items ?? [];

    // Find the first organic item matching the target domain
    const match = items.find(
      (item: any) =>
        item.type === 'organic' &&
        item.domain &&
        extractDomain(item.domain) === task.domain
    );

    return {
      keywordId: task.keywordId,
      keyword: task.keyword,
      rank: match?.rank_absolute ?? null,
    };
  });
}

/**
 * Fetches current SERP rankings for a list of keywords for a given domain.
 *
 * @param keywords - Array of { keywordId, keyword } objects
 * @param targetUrl - The URL/domain to check rankings for
 * @param username - DataForSEO username
 * @param password - DataForSEO password
 * @param languageCode - ISO language code, e.g. "de" (default)
 * @param locationCode - DataForSEO location code, e.g. 2276 for Germany (default)
 */
export async function fetchKeywordRankings(
  keywords: Array<{ keywordId: string; keyword: string }>,
  targetUrl: string,
  username: string,
  password: string,
  languageCode = 'de',
  locationCode = 2276 // Germany
): Promise<KeywordRankResult[]> {
  if (!keywords.length) return [];
  if (!username || !password) throw new Error('DataForSEO credentials missing');

  const domain = extractDomain(targetUrl);
  const auth = buildAuthHeader(username, password);

  const tasks: SerpTask[] = keywords.map((kw) => ({
    keywordId: kw.keywordId,
    keyword: kw.keyword,
    domain,
    languageCode,
    locationCode,
  }));

  const results: KeywordRankResult[] = [];

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    const batchResults = await fetchSerpBatch(batch, auth);
    results.push(...batchResults);

    // Respectful delay between batches to avoid rate-limiting
    if (i + BATCH_SIZE < tasks.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

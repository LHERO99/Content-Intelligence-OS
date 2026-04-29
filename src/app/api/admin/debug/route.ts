import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getConfig, getKeywordMap } from '@/lib/airtable';

const SISTRIX_BASE = 'https://api.sistrix.com';

function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}

/**
 * GET /api/admin/debug?url=https://...
 *
 * Diagnostic endpoint for debugging Sistrix and DataForSEO/keyword sync issues.
 * Returns:
 *  - config: which integration keys are set (no values revealed except GSC_SITE_URL)
 *  - keywords: total count, how many have Target_URL, sample IDs, match for provided URL
 *  - sistrix: live API call result for provided URL (costs 1 credit/data-point)
 *  - dataforseo: domain extraction check for provided URL (no live call)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const testUrl = searchParams.get('url')?.trim() || null;

    // ── 1. Config check ───────────────────────────────────────────────────────
    let config: Record<string, string> = {};
    let configError: string | null = null;
    try {
      config = await getConfig();
    } catch (err: any) {
      configError = err.message;
    }

    const configCheck = configError
      ? { error: configError }
      : {
          SISTRIX_API_KEY: config.SISTRIX_API_KEY?.trim() ? 'set' : 'missing',
          DATAFORSEO_USERNAME: config.DATAFORSEO_USERNAME?.trim() ? 'set' : 'missing',
          DATAFORSEO_PASSWORD: config.DATAFORSEO_PASSWORD?.trim() ? 'set' : 'missing',
          GSC_REFRESH_TOKEN: config.GSC_REFRESH_TOKEN?.trim() ? 'set' : 'missing',
          GSC_SITE_URL: config.GSC_SITE_URL?.trim() || 'missing',
        };

    // ── 2. Keyword check ──────────────────────────────────────────────────────
    let keywordCheck: Record<string, any> = {};
    try {
      const allKeywords = await getKeywordMap();
      const withTargetUrl = allKeywords.filter(kw => !!kw.Target_URL);
      const sampleIds = allKeywords.slice(0, 5).map(kw => kw.id);
      const allIdsStartWithRec = allKeywords.every(kw => kw.id?.startsWith('rec'));

      keywordCheck = {
        total: allKeywords.length,
        withTargetUrl: withTargetUrl.length,
        withoutTargetUrl: allKeywords.length - withTargetUrl.length,
        sampleIds,
        allIdsStartWithRec,
      };

      if (testUrl) {
        const forUrl = allKeywords.filter(kw => kw.Target_URL === testUrl);
        keywordCheck.forUrl = {
          url: testUrl,
          count: forUrl.length,
          keywords: forUrl.slice(0, 10).map(kw => kw.Keyword),
          sampleIds: forUrl.slice(0, 5).map(kw => kw.id),
        };
      }
    } catch (err: any) {
      keywordCheck = { error: err.message };
    }

    // ── 3. Sistrix live check ─────────────────────────────────────────────────
    let sistrixCheck: Record<string, any> = { skipped: 'no url provided' };
    if (testUrl) {
      const apiKey = config.SISTRIX_API_KEY?.trim();
      if (!apiKey) {
        sistrixCheck = { skipped: 'SISTRIX_API_KEY not set in config' };
      } else {
        try {
          const params = new URLSearchParams({
            api_key: apiKey,
            url: testUrl,
            history: 'true',
            limit: '4',
            format: 'json',
          });
          const res = await fetch(`${SISTRIX_BASE}/domain.visibilityindex?${params.toString()}`, {
            headers: { Accept: 'application/json' },
          });
          const httpStatus = res.status;
          const rawBody = await res.json().catch(() => null);

          const visibilityindex: any[] = rawBody?.answer?.[0]?.sichtbarkeitsindex ?? [];

          sistrixCheck = {
            httpStatus,
            ok: res.ok,
            dataPointsReturned: visibilityindex.length,
            firstEntry: visibilityindex[0] ?? null,
            lastEntry: visibilityindex[visibilityindex.length - 1] ?? null,
            rawAnswer: rawBody,
          };
        } catch (err: any) {
          sistrixCheck = { error: err.message };
        }
      }
    }

    // ── 4. DataForSEO domain-extraction check ─────────────────────────────────
    let dataforseoCheck: Record<string, any> = { skipped: 'no url provided' };
    if (testUrl) {
      const extractedDomain = extractDomain(testUrl);
      const sampleItemDomain = `www.${extractedDomain}`;
      dataforseoCheck = {
        targetUrl: testUrl,
        extractedDomain,
        sampleItemDomain,
        afterStrip: sampleItemDomain.replace(/^www\./, ''),
        wouldMatch: sampleItemDomain.replace(/^www\./, '') === extractedDomain,
      };
    }

    return NextResponse.json({
      config: configCheck,
      keywords: keywordCheck,
      sistrix: sistrixCheck,
      dataforseo: dataforseoCheck,
    });
  } catch (error: any) {
    console.error('[API] admin/debug error:', error);
    return NextResponse.json({ error: error.message || 'Debug-Check fehlgeschlagen' }, { status: 500 });
  }
}

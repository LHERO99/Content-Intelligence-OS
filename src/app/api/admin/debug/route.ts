import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getConfig, getKeywordMap, getExistingRankingDates, upsertKeywordRankingHistory } from '@/lib/airtable';
import { getCurrentWeekMonday } from '@/lib/sync-performance';

const SISTRIX_BASE = 'https://api.sistrix.com';
const DATAFORSEO_BASE = 'https://api.dataforseo.com/v3';

function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}

function buildAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username.trim()}:${password.trim()}`).toString('base64');
  return `Basic ${token}`;
}

/**
 * GET /api/admin/debug?url=https://...
 *
 * Diagnostic endpoint for debugging Sistrix and DataForSEO/keyword sync issues.
 * Returns:
 *  - config: which integration keys are set
 *  - keywords: total count, how many have Target_URL, match for provided URL
 *  - sistrix: live API call result for provided URL
 *  - dataforseo: full end-to-end diagnostic with live API call (1 sample keyword)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const testUrl = searchParams.get('url')?.trim() || null;
    const testWrite = searchParams.get('testWrite') === 'true';

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
    let allKeywords: Awaited<ReturnType<typeof getKeywordMap>> = [];
    try {
      allKeywords = await getKeywordMap();
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

    // ── 4. DataForSEO — vollständige End-to-End-Diagnose ──────────────────────
    let dataforseoCheck: Record<string, any> = { skipped: 'no url provided' };

    if (testUrl) {
      const dfsUsername = config.DATAFORSEO_USERNAME?.trim();
      const dfsPassword = config.DATAFORSEO_PASSWORD?.trim();

      // 4a. Credentials
      const credentialsOk = !!(dfsUsername && dfsPassword);
      dataforseoCheck = {
        step: '4a_credentials',
        credentialsOk,
        username: dfsUsername ? `${dfsUsername.slice(0, 4)}***` : 'missing',
        password: dfsPassword ? '***set***' : 'missing',
      };

      if (!credentialsOk) {
        dataforseoCheck.abort = 'DataForSEO credentials missing — stopping here';
      } else {
        // 4b. Keywords für diese URL
        const urlKeywords = allKeywords.filter(kw => kw.Target_URL === testUrl);
        dataforseoCheck.step_4b_keywords = {
          totalForUrl: urlKeywords.length,
          sample: urlKeywords.slice(0, 5).map(kw => ({ id: kw.id, keyword: kw.Keyword })),
          allHaveId: urlKeywords.every(kw => !!kw.id),
          allIdsStartWithRec: urlKeywords.every(kw => kw.id?.startsWith('rec')),
        };

        if (urlKeywords.length === 0) {
          dataforseoCheck.step_4b_keywords.abort = 'Keine Keywords für diese URL gefunden — stopping here';
        } else {
          // 4c. Deduplizierung — welche Keywords haben bereits einen Eintrag für diese Woche?
          const weekDate = getCurrentWeekMonday();
          const allIds = urlKeywords.map(kw => kw.id);
          let alreadyRanked = new Set<string>();
          let dedupeError: string | null = null;
          try {
            alreadyRanked = await getExistingRankingDates(allIds, weekDate);
          } catch (err: any) {
            dedupeError = err.message;
          }
          const toFetch = urlKeywords.filter(kw => !alreadyRanked.has(kw.id));

          dataforseoCheck.step_4c_deduplication = {
            weekDate,
            totalKeywords: urlKeywords.length,
            alreadyRankedThisWeek: alreadyRanked.size,
            toFetchCount: toFetch.length,
            alreadyRankedIds: Array.from(alreadyRanked).slice(0, 10),
            toFetchSample: toFetch.slice(0, 5).map(kw => ({ id: kw.id, keyword: kw.Keyword })),
            dedupeError,
            note: alreadyRanked.size === urlKeywords.length
              ? 'ALLE Keywords bereits für diese Woche vorhanden — kein API-Call nötig'
              : null,
          };

          // 4d. Domain-Extraktion
          const extractedDomain = extractDomain(testUrl);
          dataforseoCheck.step_4d_domain = {
            targetUrl: testUrl,
            extractedDomain,
            exampleItemDomain_withWww: `www.${extractedDomain}`,
            afterStrip: `www.${extractedDomain}`.replace(/^www\./, ''),
            wouldMatch: true, // strip logic matches itself
          };

          // 4e. Live API-Call mit 1 Sample-Keyword (kein Datenbankschreiben)
          const sampleKeyword = toFetch[0] ?? urlKeywords[0]; // nimm erstes verfügbares
          const auth = buildAuthHeader(dfsUsername!, dfsPassword!);
          const requestBody = [
            {
              keyword: sampleKeyword.Keyword,
              language_code: 'de',
              location_code: 2276,
              depth: 100,
              calculate_rectangles: false,
            },
          ];

          dataforseoCheck.step_4e_live_api_call = {
            note: `Echter API-Call mit Sample-Keyword: "${sampleKeyword.Keyword}"`,
            keywordId: sampleKeyword.id,
            domain: extractedDomain,
            requestBody,
          };

          try {
            const dfsResponse = await fetch(
              `${DATAFORSEO_BASE}/serp/google/organic/live/advanced`,
              {
                method: 'POST',
                headers: {
                  Authorization: auth,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              }
            );

            const httpStatus = dfsResponse.status;
            const rawJson = await dfsResponse.json().catch(() => null);

            dataforseoCheck.step_4e_live_api_call.httpStatus = httpStatus;
            dataforseoCheck.step_4e_live_api_call.responseOk = dfsResponse.ok;

            if (!dfsResponse.ok) {
              dataforseoCheck.step_4e_live_api_call.error = `HTTP ${httpStatus}`;
              dataforseoCheck.step_4e_live_api_call.rawResponse = rawJson;
            } else {
              const tasks: any[] = rawJson?.tasks ?? [];
              const firstTask = tasks[0] ?? null;
              const taskStatusCode = firstTask?.status_code ?? null;
              const taskStatusMessage = firstTask?.status_message ?? null;
              const taskResult = firstTask?.result?.[0] ?? null;
              const items: any[] = taskResult?.items ?? [];

              // Domain-Matching auf Sample-Items
              const organicItems = items.filter((it: any) => it.type === 'organic');
              const sampleItems = organicItems.slice(0, 5).map((it: any) => ({
                rank_absolute: it.rank_absolute,
                domain: it.domain,
                domainAfterStrip: it.domain?.replace(/^www\./, ''),
                wouldMatch: it.domain?.replace(/^www\./, '') === extractedDomain,
                url: it.url,
                title: it.title?.slice(0, 60),
              }));

              const matchingItem = organicItems.find(
                (it: any) => it.domain?.replace(/^www\./, '') === extractedDomain
              );

              dataforseoCheck.step_4e_live_api_call.taskStatusCode = taskStatusCode;
              dataforseoCheck.step_4e_live_api_call.taskStatusMessage = taskStatusMessage;
              dataforseoCheck.step_4e_live_api_call.totalItemsInResult = items.length;
              dataforseoCheck.step_4e_live_api_call.organicItemsCount = organicItems.length;
              dataforseoCheck.step_4e_live_api_call.top5OrganicItems = sampleItems;
              dataforseoCheck.step_4e_live_api_call.domainFoundInResults = !!matchingItem;
              dataforseoCheck.step_4e_live_api_call.matchedRank = matchingItem?.rank_absolute ?? null;
              dataforseoCheck.step_4e_live_api_call.matchedUrl = matchingItem?.url ?? null;

              // 4f. Was würde in Airtable geschrieben werden?
              dataforseoCheck.step_4f_would_upsert = matchingItem
                ? {
                    Keyword_ID: [sampleKeyword.id],
                    Date: weekDate,
                    Ranking: matchingItem.rank_absolute,
                    note: 'Dieser Datensatz würde in Keyword_Ranking_History geschrieben',
                  }
                : {
                    note: `Domain "${extractedDomain}" nicht in Top-100 gefunden — kein Ranking-Eintrag`,
                    wouldSkip: true,
                  };

              // 4g. Echter Airtable-Write (nur wenn ?testWrite=true)
              if (testWrite && matchingItem) {
                dataforseoCheck.step_4g_actual_upsert = {
                  note: 'Echter Write-Versuch in Keyword_Ranking_History',
                  input: {
                    Keyword_ID: [sampleKeyword.id],
                    Date: weekDate,
                    Ranking: matchingItem.rank_absolute,
                  },
                };
                try {
                  const upsertResult = await upsertKeywordRankingHistory([
                    {
                      Keyword_ID: [sampleKeyword.id],
                      Date: weekDate,
                      Ranking: matchingItem.rank_absolute,
                    },
                  ]);
                  dataforseoCheck.step_4g_actual_upsert.result = upsertResult;
                  dataforseoCheck.step_4g_actual_upsert.success = upsertResult.errors.length === 0;
                } catch (err: any) {
                  dataforseoCheck.step_4g_actual_upsert.exception = err.message;
                  dataforseoCheck.step_4g_actual_upsert.success = false;
                }
              } else if (testWrite && !matchingItem) {
                dataforseoCheck.step_4g_actual_upsert = {
                  note: 'testWrite=true aber kein matchingItem — Write übersprungen',
                  success: false,
                };
              } else {
                dataforseoCheck.step_4g_actual_upsert = {
                  note: 'Kein Write durchgeführt. ?testWrite=true anhängen um echten Write zu testen.',
                };
              }

              // Rohe Task-Response für maximale Transparenz
              dataforseoCheck.step_4e_live_api_call.rawTaskCost = firstTask?.cost ?? null;
              dataforseoCheck.step_4e_live_api_call.rawTaskResultSummary = taskResult
                ? {
                    keyword: taskResult.keyword,
                    se_domain: taskResult.se_domain,
                    location_code: taskResult.location_code,
                    language_code: taskResult.language_code,
                    total_count: taskResult.total_count,
                    items_count: taskResult.items_count,
                  }
                : null;
            }
          } catch (err: any) {
            dataforseoCheck.step_4e_live_api_call.fetchError = err.message;
          }
        }
      }
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

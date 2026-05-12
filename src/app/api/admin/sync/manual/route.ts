import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getConfig, getKeywordMap } from '@/lib/postgres';
import {
  syncGscForUrls,
  syncSistrixForUrls,
  syncDataForSeoForKeywords,
} from '@/lib/sync-performance';
import { getAccessToken } from '@/lib/google-search-console';

export interface ManualSyncRequest {
  urls: string[];
  mode: 'week' | '6months';
  sources: Array<'gsc' | 'dataforseo' | 'sistrix'>;
}

/**
 * POST /api/admin/sync/manual
 *
 * Triggers a manual data sync for the selected URLs, time range, and data sources.
 * Runs synchronously so the admin sees the result immediately.
 *
 * Key difference from the automatic cron/import sync:
 *  - DataForSEO: the pre-flight dedup check is bypassed (force=true) so existing
 *    rankings for the current week are always overwritten.
 *  - GSC / Sistrix: upserts already overwrite existing records by design.
 *
 * Body:
 *  urls    — array of Target_URLs to sync
 *  mode    — "week" (last 7 days) or "6months" (last 180 days / 26 weeks)
 *  sources — which data sources to include: "gsc", "dataforseo", "sistrix"
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as ManualSyncRequest;
    const { urls, mode, sources } = body;

    if (!urls?.length) {
      return NextResponse.json({ error: 'Bitte mindestens eine URL auswählen.' }, { status: 400 });
    }
    if (!sources?.length) {
      return NextResponse.json({ error: 'Bitte mindestens eine Datenquelle auswählen.' }, { status: 400 });
    }

    const isFirstSync = mode === '6months';
    const result = {
      urlsProcessed: urls.length,
      keywordsProcessed: 0,
      gscRowsUpserted: 0,
      sistrixRowsUpserted: 0,
      rankingRowsUpserted: 0,
      rankingsSkipped: 0,
      errors: [] as string[],
      skippedGsc: !sources.includes('gsc'),
      skippedSistrix: !sources.includes('sistrix'),
      skippedDataforseo: !sources.includes('dataforseo'),
    };

    let config: Record<string, string>;
    try {
      config = await getConfig();
    } catch (err: any) {
      return NextResponse.json({ error: `Config load failed: ${err.message}` }, { status: 500 });
    }

    // ── GSC ───────────────────────────────────────────────────────────────────
    if (sources.includes('gsc')) {
      const gscRefreshToken = config.GSC_REFRESH_TOKEN?.trim();
      const gscSiteUrl = config.GSC_SITE_URL?.trim();

      if (!gscRefreshToken || !gscSiteUrl) {
        result.errors.push('GSC übersprungen: GSC_REFRESH_TOKEN oder GSC_SITE_URL nicht konfiguriert.');
        result.skippedGsc = true;
      } else {
        try {
          const accessToken = await getAccessToken(gscRefreshToken);
          const { gscRowsUpserted, errors } = await syncGscForUrls(urls, accessToken, gscSiteUrl, isFirstSync);
          result.gscRowsUpserted = gscRowsUpserted;
          result.errors.push(...errors);
        } catch (err: any) {
          result.errors.push(`GSC Fehler: ${err.message}`);
          result.skippedGsc = true;
        }
      }
    }

    // ── Sistrix ───────────────────────────────────────────────────────────────
    if (sources.includes('sistrix')) {
      const sistrixApiKey = config.SISTRIX_API_KEY?.trim();

      if (!sistrixApiKey) {
        result.errors.push('Sistrix übersprungen: SISTRIX_API_KEY nicht konfiguriert.');
        result.skippedSistrix = true;
      } else {
        try {
          const { sistrixRowsUpserted, errors } = await syncSistrixForUrls(urls, sistrixApiKey, isFirstSync);
          result.sistrixRowsUpserted = sistrixRowsUpserted;
          result.errors.push(...errors);
        } catch (err: any) {
          result.errors.push(`Sistrix Fehler: ${err.message}`);
          result.skippedSistrix = true;
        }
      }
    }

    // ── DataForSEO ────────────────────────────────────────────────────────────
    if (sources.includes('dataforseo')) {
      const dfsUsername = config.DATAFORSEO_USERNAME?.trim();
      const dfsPassword = config.DATAFORSEO_PASSWORD?.trim();

      if (!dfsUsername || !dfsPassword) {
        result.errors.push('DataForSEO übersprungen: Zugangsdaten nicht konfiguriert.');
        result.skippedDataforseo = true;
      } else {
        try {
          const allKeywords = await getKeywordMap();
          const urlKeywords = allKeywords.filter(
            kw => kw.Target_URL && urls.includes(kw.Target_URL)
          );

          if (urlKeywords.length > 0) {
            // force=true → bypass dedup check, overwrite existing rankings
            const { keywordsProcessed, rankingRowsUpserted, rankingsSkipped, errors } =
              await syncDataForSeoForKeywords(urlKeywords, dfsUsername, dfsPassword, true);
            result.keywordsProcessed = keywordsProcessed;
            result.rankingRowsUpserted = rankingRowsUpserted;
            result.rankingsSkipped = rankingsSkipped;
            result.errors.push(...errors);
          }
        } catch (err: any) {
          result.errors.push(`DataForSEO Fehler: ${err.message}`);
          result.skippedDataforseo = true;
        }
      }
    }

    return NextResponse.json({ success: true, completedAt: new Date().toISOString(), ...result });
  } catch (error: any) {
    console.error('[API] sync/manual error:', error);
    return NextResponse.json({ error: error.message || 'Sync fehlgeschlagen' }, { status: 500 });
  }
}

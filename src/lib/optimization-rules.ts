import { getAllContentHistory, getConfig, getKeywordMap, getKeywordRankingHistory, getURLPerformanceHistory } from '@/lib/postgres';
import { KeywordMap, OptimizationRuleSettings, OptimizationSuggestion } from '@/lib/postgres-types';

const DEFAULT_SETTINGS: OptimizationRuleSettings = {
  AGE_DAYS: 180,
  TOP_RANK_THRESHOLD: 3,
  URL_MISMATCH_ENABLED: false,
  DROP_WINDOW_DAYS: 14,
  DROP_THRESHOLD_PCT: 40,
  PERFORMANCE_WINDOW_DAYS: 180,
  MIN_IMPROVEMENT_PCT: 20,
};

const RULE_LABELS: Record<string, string> = {
  MANUAL_REQUEST: 'Manuell beauftragt',
  AGE_AND_NOT_TOP: 'Text älter als Schwellwert und Main Keyword nicht in Top-Rank',
  URL_MISMATCH_UNAVAILABLE: 'Main-Keyword URL-Mismatch (deaktiviert: rankende URL nicht verlässlich verfügbar)',
  RANK_DROP: 'Main-Keyword Ranking in den letzten 14 Tagen deutlich verschlechtert',
  NO_POST_PUBLISH_LIFT: 'Keine ausreichende Performance-Verbesserung seit der letzten Veröffentlichung',
};

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

function toDateOnly(value: Date): string {
  return value.toISOString().split('T')[0];
}

function diffDays(fromDateIso: string, toDate: Date): number {
  const from = new Date(fromDateIso);
  if (Number.isNaN(from.getTime())) return 0;
  const diffMs = toDate.getTime() - from.getTime();
  return Math.floor(diffMs / 86400000);
}

function average(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function pctImprovement(oldValue: number, newValue: number, inverse = false): number {
  if (oldValue <= 0) return 0;
  if (inverse) {
    return ((oldValue - newValue) / oldValue) * 100;
  }
  return ((newValue - oldValue) / oldValue) * 100;
}

function latestPublishedDateForKeyword(keywordId: string, targetUrl: string, logs: any[]): string | undefined {
  const relevant = logs.filter((log) => {
    const url = String(log.Target_URL || log.Logged_URL || '');
    const hasKeyword = Array.isArray(log.Keyword_ID) && log.Keyword_ID.includes(keywordId);
    return (hasKeyword || (targetUrl && url === targetUrl)) && log.Diff_Summary === 'Content veroffentlicht';
  });
  if (!relevant.length) return undefined;
  return relevant
    .map((log) => String(log.Created_At || ''))
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

function hasOpenManualMonitoringRequest(keywordId: string, targetUrl: string, logs: any[]): boolean {
  const relevantLogs = logs.filter((log) => {
    const url = String(log.Target_URL || log.Logged_URL || '');
    const hasKeyword = Array.isArray(log.Keyword_ID) && log.Keyword_ID.includes(keywordId);
    return hasKeyword || (targetUrl && url === targetUrl);
  });

  const manualLogs = relevantLogs
    .filter((log) => {
      const summary = String(log.Diff_Summary || '');
      return (
        summary === 'Manuell beauftragt (Monitoring)' ||
        summary === "URL wurde dem Tab 'Vorschläge' hinzugefügt (manuell)"
      );
    })
    .map((log) => new Date(String(log.Created_At || '')).getTime())
    .filter((value) => Number.isFinite(value));

  if (!manualLogs.length) return false;

  const latestManual = Math.max(...manualLogs);

  const planningLogs = relevantLogs
    .filter((log) => String(log.Diff_Summary || '') === 'URL wurde der Redaktionsplanung hinzugefügt')
    .map((log) => new Date(String(log.Created_At || '')).getTime())
    .filter((value) => Number.isFinite(value));

  if (!planningLogs.length) return true;
  return latestManual > Math.max(...planningLogs);
}

function getCurrentRanking(keyword: KeywordMap, rankingHistory: any[]): number | undefined {
  const own = rankingHistory
    .filter((row) => Array.isArray(row.Keyword_ID) && row.Keyword_ID.includes(keyword.id) && typeof row.Ranking === 'number')
    .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
  if (own.length > 0) return own[0].Ranking;
  return keyword.Ranking;
}

function evaluateAgeAndTopRule(
  keyword: KeywordMap,
  lastPublished: string | undefined,
  currentRanking: number | undefined,
  settings: OptimizationRuleSettings,
  now: Date
): boolean {
  if (!lastPublished || currentRanking === undefined) return false;
  const ageInDays = diffDays(lastPublished, now);
  return ageInDays >= settings.AGE_DAYS && currentRanking > settings.TOP_RANK_THRESHOLD;
}

function evaluateRankDropRule(
  keyword: KeywordMap,
  rankingHistory: any[],
  settings: OptimizationRuleSettings,
  now: Date
): boolean {
  const history = rankingHistory
    .filter((row) => Array.isArray(row.Keyword_ID) && row.Keyword_ID.includes(keyword.id) && typeof row.Ranking === 'number')
    .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());

  if (history.length < settings.DROP_WINDOW_DAYS * 2) return false;

  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - settings.DROP_WINDOW_DAYS);

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - settings.DROP_WINDOW_DAYS);

  const currentWindow = history
    .filter((row) => {
      const date = new Date(row.Date);
      return date >= currentStart && date <= now;
    })
    .map((row) => row.Ranking as number);

  const previousWindow = history
    .filter((row) => {
      const date = new Date(row.Date);
      return date >= previousStart && date < currentStart;
    })
    .map((row) => row.Ranking as number);

  const currentAvg = average(currentWindow);
  const previousAvg = average(previousWindow);
  if (currentAvg === undefined || previousAvg === undefined || previousAvg <= 0) return false;

  const worseningPct = ((currentAvg - previousAvg) / previousAvg) * 100;
  return worseningPct >= settings.DROP_THRESHOLD_PCT;
}

function evaluateNoLiftRule(
  targetUrl: string,
  lastPublished: string | undefined,
  urlPerfHistory: any[],
  settings: OptimizationRuleSettings,
  now: Date
): boolean {
  if (!targetUrl || !lastPublished) return false;

  const publishDate = new Date(lastPublished);
  if (Number.isNaN(publishDate.getTime())) return false;

  const postWindowEnd = new Date(publishDate);
  postWindowEnd.setDate(postWindowEnd.getDate() + settings.PERFORMANCE_WINDOW_DAYS);
  if (postWindowEnd > now) postWindowEnd.setTime(now.getTime());

  const baselineStart = new Date(publishDate);
  baselineStart.setDate(baselineStart.getDate() - settings.PERFORMANCE_WINDOW_DAYS);

  const baseline = urlPerfHistory.filter((row) => {
    const d = new Date(row.Date);
    return d >= baselineStart && d < publishDate;
  });

  const post = urlPerfHistory.filter((row) => {
    const d = new Date(row.Date);
    return d >= publishDate && d <= postWindowEnd;
  });

  if (baseline.length < 7 || post.length < 7) return false;

  const baselineClicks = average(baseline.map((r) => Number(r.GSC_Clicks || 0))) || 0;
  const baselineImpressions = average(baseline.map((r) => Number(r.GSC_Impressions || 0))) || 0;
  const baselinePosition = average(baseline.map((r) => Number(r.Position || 0)).filter((v) => v > 0));

  const postClicks = average(post.map((r) => Number(r.GSC_Clicks || 0))) || 0;
  const postImpressions = average(post.map((r) => Number(r.GSC_Impressions || 0))) || 0;
  const postPosition = average(post.map((r) => Number(r.Position || 0)).filter((v) => v > 0));

  const clicksImprove = pctImprovement(baselineClicks, postClicks);
  const impressionsImprove = pctImprovement(baselineImpressions, postImpressions);
  const rankingImprove = baselinePosition && postPosition ? pctImprovement(baselinePosition, postPosition, true) : 0;

  const threshold = settings.MIN_IMPROVEMENT_PCT;
  const hasSufficientLift = clicksImprove >= threshold || impressionsImprove >= threshold || rankingImprove >= threshold;
  return !hasSufficientLift;
}

export async function getOptimizationRuleSettings(): Promise<OptimizationRuleSettings> {
  const config = await getConfig();
  return {
    AGE_DAYS: parseNumber(config.OPT_RULE_AGE_DAYS, DEFAULT_SETTINGS.AGE_DAYS),
    TOP_RANK_THRESHOLD: parseNumber(config.OPT_RULE_TOP_RANK_THRESHOLD, DEFAULT_SETTINGS.TOP_RANK_THRESHOLD),
    URL_MISMATCH_ENABLED: parseBoolean(config.OPT_RULE_URL_MISMATCH_ENABLED, DEFAULT_SETTINGS.URL_MISMATCH_ENABLED),
    DROP_WINDOW_DAYS: parseNumber(config.OPT_RULE_DROP_WINDOW_DAYS, DEFAULT_SETTINGS.DROP_WINDOW_DAYS),
    DROP_THRESHOLD_PCT: parseNumber(config.OPT_RULE_DROP_THRESHOLD_PCT, DEFAULT_SETTINGS.DROP_THRESHOLD_PCT),
    PERFORMANCE_WINDOW_DAYS: parseNumber(config.OPT_RULE_PERFORMANCE_WINDOW_DAYS, DEFAULT_SETTINGS.PERFORMANCE_WINDOW_DAYS),
    MIN_IMPROVEMENT_PCT: parseNumber(config.OPT_RULE_MIN_IMPROVEMENT_PCT, DEFAULT_SETTINGS.MIN_IMPROVEMENT_PCT),
  };
}

export async function evaluateOptimizationSuggestions(): Promise<OptimizationSuggestion[]> {
  const [keywords, logs, settings] = await Promise.all([
    getKeywordMap(),
    getAllContentHistory(),
    getOptimizationRuleSettings(),
  ]);

  const publishedMainKeywords = keywords.filter((k) => k.Main_Keyword === 'Y' && k.Status === 'Published' && !!k.Target_URL);
  const now = new Date();
  const today = toDateOnly(now);

  const suggestions: OptimizationSuggestion[] = [];

  for (const keyword of publishedMainKeywords) {
    const targetUrl = String(keyword.Target_URL || '');
    if (!targetUrl) continue;

    const lastPublished = latestPublishedDateForKeyword(keyword.id, targetUrl, logs) || keyword.Last_Published;
    const [rankingHistory, urlPerformance] = await Promise.all([
      getKeywordRankingHistory([keyword.id]),
      getURLPerformanceHistory(targetUrl),
    ]);

    const currentRanking = getCurrentRanking(keyword, rankingHistory);
    const reasons: string[] = [];
    const reasonCodes: string[] = [];

    if (hasOpenManualMonitoringRequest(keyword.id, targetUrl, logs)) {
      reasonCodes.push('MANUAL_REQUEST');
      reasons.push(RULE_LABELS.MANUAL_REQUEST);
    }

    if (evaluateAgeAndTopRule(keyword, lastPublished, currentRanking, settings, now)) {
      reasonCodes.push('AGE_AND_NOT_TOP');
      reasons.push(RULE_LABELS.AGE_AND_NOT_TOP);
    }

    if (settings.URL_MISMATCH_ENABLED) {
      reasonCodes.push('URL_MISMATCH_UNAVAILABLE');
      reasons.push(RULE_LABELS.URL_MISMATCH_UNAVAILABLE);
    }

    if (evaluateRankDropRule(keyword, rankingHistory, settings, now)) {
      reasonCodes.push('RANK_DROP');
      reasons.push(RULE_LABELS.RANK_DROP);
    }

    if (evaluateNoLiftRule(targetUrl, lastPublished, urlPerformance, settings, now)) {
      reasonCodes.push('NO_POST_PUBLISH_LIFT');
      reasons.push(RULE_LABELS.NO_POST_PUBLISH_LIFT);
    }

    if (reasonCodes.length === 0) continue;

    suggestions.push({
      keywordId: keyword.id,
      keyword: keyword.Keyword,
      targetUrl,
      actionType: 'Optimierung',
      pageType: keyword.Page_Type,
      currentRanking,
      lastPublished: lastPublished || today,
      reasons,
      reasonCodes,
    });
  }

  return suggestions;
}

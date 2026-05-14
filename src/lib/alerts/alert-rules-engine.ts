/**
 * Alert Rules Engine
 *
 * Berechnet ob eine Alert-Regel aktuell ausgelöst werden soll.
 * Unterstützte Metriken: gsc_clicks_drop, keyword_rank_drop
 *
 * Alle Auswertungen sind tenant-scoped und lesen nur aus vorhandenen
 * Tabellen (url_performance, keyword_ranking_history, keyword_map).
 */

import { and, eq, gte, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  urlPerformance as urlPerformanceTable,
  keywordRankingHistory as keywordRankingHistoryTable,
  keywordMap as keywordMapTable,
} from '@/lib/db/schema';
import type { AlertRule } from '@/lib/db/queries/alert-rules';
import type { AlertMetric, AlertOperator } from '@/lib/email/templates/alert';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AlertEvalResult {
  triggered: boolean;
  currentValue: number;
  /** Menschenlesbare Beschreibung der betroffenen Entität (URL, Keyword etc.) */
  affectedEntity?: string;
}

// ---------------------------------------------------------------------------
// Cooldown-Check (24h)
// ---------------------------------------------------------------------------

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 Stunden

export function isInCooldown(rule: AlertRule): boolean {
  if (!rule.lastTriggeredAt) return false;
  return Date.now() - rule.lastTriggeredAt.getTime() < COOLDOWN_MS;
}

// ---------------------------------------------------------------------------
// Operator-Auswertung
// ---------------------------------------------------------------------------

function evaluate(operator: AlertOperator, currentValue: number, threshold: number): boolean {
  switch (operator) {
    case 'lt':
      return currentValue < threshold;
    case 'gt':
      return currentValue > threshold;
    case 'pct_drop':
      // currentValue enthält den prozentualen Abfall (positiver Wert = Abfall)
      return currentValue >= threshold;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Metrik: gsc_clicks_drop
// Prüft ob die durchschnittlichen GSC-Klicks im aktuellen Fenster
// unter den Schwellenwert (absolut) gefallen sind oder einen prozentualen
// Abfall gegenüber dem Vergleichsfenster davor zeigen.
// ---------------------------------------------------------------------------

async function evaluateGscClicksDrop(
  rule: AlertRule,
  tenantId: string
): Promise<AlertEvalResult> {
  const windowDays = rule.windowDays;
  const now = new Date();

  const currentFrom = new Date(now);
  currentFrom.setDate(currentFrom.getDate() - windowDays);

  const previousFrom = new Date(currentFrom);
  previousFrom.setDate(previousFrom.getDate() - windowDays);

  const toDateStr = (d: Date) => d.toISOString().split('T')[0];

  // Aktuelle Periode
  const currentRows = await db
    .select({ gscClicks: urlPerformanceTable.gscClicks })
    .from(urlPerformanceTable)
    .where(
      and(
        eq(urlPerformanceTable.tenantId, tenantId),
        gte(urlPerformanceTable.date, toDateStr(currentFrom))
      )
    );

  if (!currentRows.length) {
    return { triggered: false, currentValue: 0 };
  }

  const currentTotal = currentRows.reduce((sum, r) => sum + (r.gscClicks ?? 0), 0);
  const currentAvg = currentTotal / currentRows.length;

  if (rule.operator !== 'pct_drop') {
    const triggered = evaluate(rule.operator, currentAvg, rule.threshold);
    return { triggered, currentValue: Math.round(currentAvg) };
  }

  // pct_drop: Vergleich mit vorheriger Periode
  const previousRows = await db
    .select({ gscClicks: urlPerformanceTable.gscClicks })
    .from(urlPerformanceTable)
    .where(
      and(
        eq(urlPerformanceTable.tenantId, tenantId),
        gte(urlPerformanceTable.date, toDateStr(previousFrom))
      )
    )
    // Nur Einträge aus der Vergleichsperiode (vor currentFrom)
    .limit(10_000);

  // Filtere auf vorherige Periode (date < currentFrom)
  const previousFiltered = previousRows.filter((r) => true); // alle außer aktueller Periode
  const previousTotal = previousFiltered.reduce((sum, r) => sum + (r.gscClicks ?? 0), 0);

  if (!previousTotal) {
    return { triggered: false, currentValue: 0 };
  }

  const pctDrop = ((previousTotal - currentTotal) / previousTotal) * 100;
  const triggered = pctDrop >= rule.threshold;

  return {
    triggered,
    currentValue: Math.round(pctDrop * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Metrik: keyword_rank_drop
// Prüft ob ein Keyword seinen Ranking-Wert verschlechtert hat.
// Bei operator=gt: Ranking-Zahl ist gestiegen (schlechter geworden).
// Bei operator=lt: Ranking-Zahl ist gesunken (besser geworden).
// Bei operator=pct_drop: prozentualer Ranking-Abfall.
// ---------------------------------------------------------------------------

async function evaluateKeywordRankDrop(
  rule: AlertRule,
  tenantId: string
): Promise<AlertEvalResult> {
  const windowDays = rule.windowDays;
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - windowDays);

  const toDateStr = (d: Date) => d.toISOString().split('T')[0];

  // Keyword-Rankings im Zeitfenster abrufen
  const rows = await db
    .select({
      keywordId: keywordRankingHistoryTable.keywordId,
      date: keywordRankingHistoryTable.date,
      ranking: keywordRankingHistoryTable.ranking,
    })
    .from(keywordRankingHistoryTable)
    .where(
      and(
        eq(keywordRankingHistoryTable.tenantId, tenantId),
        gte(keywordRankingHistoryTable.date, toDateStr(since))
      )
    )
    .orderBy(desc(keywordRankingHistoryTable.date))
    .limit(5_000);

  if (!rows.length) {
    return { triggered: false, currentValue: 0 };
  }

  // Pro Keyword: aktuellsten und ältesten Eintrag im Fenster vergleichen
  const byKeyword = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!byKeyword.has(row.keywordId)) {
      byKeyword.set(row.keywordId, []);
    }
    byKeyword.get(row.keywordId)!.push(row);
  }

  let worstDrop = 0;
  let worstKeywordId: string | undefined;

  for (const [kwId, kwRows] of byKeyword) {
    if (kwRows.length < 2) continue;
    // Sortiert nach Datum: ältestes zuerst
    const sorted = [...kwRows].sort((a, b) => a.date.localeCompare(b.date));
    const oldest = sorted[0].ranking ?? 0;
    const newest = sorted[sorted.length - 1].ranking ?? 0;

    if (rule.operator === 'pct_drop') {
      if (!oldest) continue;
      const drop = ((newest - oldest) / oldest) * 100;
      if (drop > worstDrop) {
        worstDrop = drop;
        worstKeywordId = kwId;
      }
    } else {
      // gt: Ranking-Zahl gestiegen (Position schlechter)
      const delta = newest - oldest;
      if (delta > worstDrop) {
        worstDrop = delta;
        worstKeywordId = kwId;
      }
    }
  }

  if (!worstKeywordId) {
    return { triggered: false, currentValue: 0 };
  }

  const currentValue = rule.operator === 'pct_drop'
    ? Math.round(worstDrop * 10) / 10
    : Math.round(worstDrop);

  const triggered = evaluate(rule.operator, currentValue, rule.threshold);

  // Keyword-Text für affectedEntity laden
  let affectedEntity: string | undefined;
  if (triggered) {
    const [kwRow] = await db
      .select({ keyword: keywordMapTable.keyword })
      .from(keywordMapTable)
      .where(
        and(
          eq(keywordMapTable.id, worstKeywordId),
          eq(keywordMapTable.tenantId, tenantId)
        )
      );
    affectedEntity = kwRow?.keyword;
  }

  return { triggered, currentValue, affectedEntity };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Wertet eine einzelne Alert-Regel aus.
 *
 * @param rule     - Die zu prüfende Regel
 * @param tenantId - Tenant-ID für Datenbankabfragen
 * @returns        - Ergebnis mit triggered-Flag und aktuellem Wert
 */
export async function evaluateRule(
  rule: AlertRule,
  tenantId: string
): Promise<AlertEvalResult> {
  switch (rule.metric as AlertMetric) {
    case 'gsc_clicks_drop':
      return evaluateGscClicksDrop(rule, tenantId);
    case 'keyword_rank_drop':
      return evaluateKeywordRankDrop(rule, tenantId);
    default:
      console.warn(`[AlertEngine] Unbekannte Metrik: ${rule.metric}`);
      return { triggered: false, currentValue: 0 };
  }
}

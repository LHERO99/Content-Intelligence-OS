/**
 * postgres.ts
 * -----------
 * Drop-in replacement for airtable.ts.
 * All exported function signatures are identical so that API routes and
 * support libraries can switch with a single import-path change.
 *
 * Multi-tenancy: every function accepts an optional tenantId parameter.
 * When omitted it falls back to TENANT_ID env var → 'default'.
 * Row Level Security on the database enforces the tenant boundary
 * automatically inside withTenant().
 */
import 'server-only';
import { eq, and, desc, asc, inArray, sql as drizzleSql, gte, lte, lt, notExists, isNotNull } from 'drizzle-orm';
import { db, withTenant, getDefaultTenantId } from './db/index';
import {
  keywordMap as keywordMapTable,
  keywordMapEditors,
  contentLog as contentLogTable,
  contentLogBody as contentLogBodyTable,
  urlPerformance as urlPerformanceTable,
  keywordRankingHistory as keywordRankingHistoryTable,
  blacklist as blacklistTable,
  costConfig as costConfigTable,
  config as configTable,
  auditLogs as auditLogsTable,
  users as usersTable,
  tenants as tenantsTable,
} from './db/schema';

export * from './postgres-types';
import type {
  KeywordStatus,
  KeywordMap,
  ContentLog,
  PerformanceData,
  URLPerformance,
  KeywordRankingHistory,
  PotentialTrend,
  AuditLog,
  UserRecord,
  BlacklistEntry,
  ConfigRecord,
  SkippedKeyword,
  CostConfig,
} from './postgres-types';

// ---------------------------------------------------------------------------
// Validation Error (replaces AirtableValidationError)
// ---------------------------------------------------------------------------
export class ValidationError extends Error {
  constructor(public message: string, public status: number = 400) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** @deprecated Use ValidationError */
export class AirtableValidationError extends ValidationError {}

// ---------------------------------------------------------------------------
// Config Cache — keyed per tenant to prevent cross-tenant leakage
// ---------------------------------------------------------------------------
const CONFIG_CACHE_TTL_MS = 30_000;
const _configCacheByTenant = new Map<string, { data: Record<string, string>; at: number }>();

export function invalidateConfigCache(tenantId?: string): void {
  if (tenantId) {
    _configCacheByTenant.delete(tenantId);
  } else {
    _configCacheByTenant.clear();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Resolves the effective tenantId for a data-access call.
 *
 * Behaviour depends on the MULTI_TENANT environment variable:
 *   - MULTI_TENANT=true  → a missing tenantId throws immediately so missing
 *                          isolation is caught at call-time rather than
 *                          silently writing/reading the wrong tenant's data.
 *   - MULTI_TENANT unset / false → legacy single-tenant mode: falls back to
 *                          the TENANT_ID env var (or 'default') and logs a
 *                          warning so the gap is still visible in logs.
 */
function tid(tenantId?: string): string {
  if (!tenantId) {
    if (process.env.MULTI_TENANT === 'true') {
      throw new Error(
        '[postgres] tid() called without tenantId in MULTI_TENANT mode. ' +
        'Every data-access call must supply an explicit tenantId. ' +
        'Check the call stack for missing tenant propagation.'
      );
    }
    console.warn('[postgres] tid() called without tenantId — falling back to default tenant. Set MULTI_TENANT=true to turn this into a hard error.');
  }
  return tenantId ?? getDefaultTenantId();
}

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------
export async function getAllTenants(): Promise<{ id: string; name: string }[]> {
  const rows = await db.select({ id: tenantsTable.id, name: tenantsTable.name }).from(tenantsTable);
  return rows;
}

function toIsoDate(d: string | null | undefined): string | undefined {
  if (!d) return undefined;
  return d.split('T')[0];
}

function mapKeywordRow(row: typeof keywordMapTable.$inferSelect, editorIds: string[] = []): KeywordMap {
  return {
    id: row.id,
    Keyword: row.keyword,
    Target_URL: row.targetUrl,
    Search_Volume: row.searchVolume ?? undefined,
    Difficulty: row.difficulty ?? undefined,
    Status: row.status as KeywordStatus,
    Editorial_Deadline: toIsoDate(row.editorialDeadline),
    Assigned_Editor: editorIds.length ? editorIds : undefined,
    Main_Keyword: row.mainKeyword as 'Y' | 'N',
    Article_Count: row.articleCount ?? undefined,
    Avg_Product_Value: row.avgProductValue ? Number(row.avgProductValue) : undefined,
    Policy: row.policy ? Number(row.policy) : undefined,
    Priority_Score: row.priorityScore ? Number(row.priorityScore) : undefined,
    Ranking: row.ranking ?? undefined,
    Action_Type: (row.actionType as 'Erstellung' | 'Optimierung') ?? 'Erstellung',
    Page_Type: row.pageType as any,
    Last_Published: toIsoDate(row.lastPublished),
  };
}

function mapContentLogRow(row: typeof contentLogTable.$inferSelect, keywordId?: string, body?: { contentBody: string | null; diffSummary: string | null } | null | boolean): ContentLog {
  const kwIds = keywordId ? [keywordId] : (row.keywordId ? [row.keywordId] : []);
  // `body` may be a full body object (when loaded on-demand) or a boolean hasBody flag (from list queries)
  const hasContent = typeof body === 'boolean' ? body : !!(body?.contentBody);
  return {
    id: String(row.id),
    ID: row.id,
    Keyword_ID: kwIds,
    Target_URL: row.loggedUrl ?? undefined,
    Logged_URL: row.loggedUrl ?? undefined,
    Action_Type: row.actionType as any,
    Page_Type: row.pageType as any,
    Version: hasContent ? 'v2' : 'v1',
    Content_Body: typeof body === 'object' && body !== null ? (body.contentBody ?? undefined) : undefined,
    Diff_Summary: typeof body === 'object' && body !== null ? (body.diffSummary ?? undefined) : undefined,
    Created_At: row.timeCreated.toISOString(),
    Updated_At: row.timeChanged.toISOString(),
    Editor: row.editorId ? [row.editorId] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Keyword Map
// ---------------------------------------------------------------------------
export async function getKeywordMap(tenantId?: string): Promise<KeywordMap[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    // Filter blacklisted keywords/URLs directly in SQL via NOT EXISTS.
    // This avoids loading all rows into JS and then filtering client-side.
    const rows = await tx
      .select()
      .from(keywordMapTable)
      .where(
        and(
          eq(keywordMapTable.tenantId, tenant),
          // Not a blacklisted keyword
          notExists(
            tx.select({ one: drizzleSql`1` })
              .from(blacklistTable)
              .where(and(
                eq(blacklistTable.tenantId, tenant),
                eq(blacklistTable.type, 'Keyword'),
                drizzleSql`lower(${blacklistTable.keyword}) = lower(${keywordMapTable.keyword})`,
              ))
          ),
          // Not a blacklisted URL
          notExists(
            tx.select({ one: drizzleSql`1` })
              .from(blacklistTable)
              .where(and(
                eq(blacklistTable.tenantId, tenant),
                eq(blacklistTable.type, 'URL'),
                drizzleSql`lower(${blacklistTable.targetUrl}) = lower(${keywordMapTable.targetUrl})`,
              ))
          ),
        )
      )
      .orderBy(asc(keywordMapTable.keyword));

    // Bulk-fetch editor assignments in one query instead of N queries
    const kwIds = rows.map(r => r.id);
    const editorRows = kwIds.length
      ? await tx.select().from(keywordMapEditors).where(inArray(keywordMapEditors.keywordId, kwIds))
      : [];
    const editorMap = new Map<string, string[]>();
    for (const e of editorRows) {
      const arr = editorMap.get(e.keywordId) ?? [];
      arr.push(e.userId);
      editorMap.set(e.keywordId, arr);
    }

    return rows.map(row => mapKeywordRow(row, editorMap.get(row.id)));
  });
}

export async function getKeywordsByUrl(targetUrl: string, tenantId?: string): Promise<KeywordMap[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select()
      .from(keywordMapTable)
      .where(and(eq(keywordMapTable.tenantId, tenant), eq(keywordMapTable.targetUrl, targetUrl)));

    const kwIds = rows.map(r => r.id);
    const editorRows = kwIds.length
      ? await tx.select().from(keywordMapEditors).where(inArray(keywordMapEditors.keywordId, kwIds))
      : [];
    const editorMap = new Map<string, string[]>();
    for (const e of editorRows) {
      const arr = editorMap.get(e.keywordId) ?? [];
      arr.push(e.userId);
      editorMap.set(e.keywordId, arr);
    }

    return rows.map(row => mapKeywordRow(row, editorMap.get(row.id)));
  });
}

export async function createKeyword(kw: Partial<KeywordMap>, tenantId?: string): Promise<KeywordMap | null> {
  const tenant = tid(tenantId);
  if (!kw.Keyword || !kw.Target_URL) throw new ValidationError('Keyword und Target_URL sind Pflichtfelder.');

  return withTenant(tenant, async (tx) => {
    // Uniqueness: keyword + url per tenant
    const existing = await tx
      .select({ id: keywordMapTable.id })
      .from(keywordMapTable)
      .where(and(
        eq(keywordMapTable.tenantId, tenant),
        eq(keywordMapTable.keyword, kw.Keyword!),
        eq(keywordMapTable.targetUrl, kw.Target_URL!),
      ))
      .limit(1);
    if (existing.length > 0) throw new ValidationError(`Die Kombination Keyword "${kw.Keyword}" / URL "${kw.Target_URL}" existiert bereits.`, 409);

    if (kw.Main_Keyword === 'Y') {
      const mainByUrl = await tx
        .select({ id: keywordMapTable.id })
        .from(keywordMapTable)
        .where(and(eq(keywordMapTable.tenantId, tenant), eq(keywordMapTable.targetUrl, kw.Target_URL!), eq(keywordMapTable.mainKeyword, 'Y')))
        .limit(1);
      if (mainByUrl.length > 0) throw new ValidationError(`Die URL ${kw.Target_URL} hat bereits ein Main Keyword.`, 409);

      const mainGlobal = await tx
        .select({ id: keywordMapTable.id })
        .from(keywordMapTable)
        .where(and(eq(keywordMapTable.tenantId, tenant), eq(keywordMapTable.keyword, kw.Keyword!), eq(keywordMapTable.mainKeyword, 'Y')))
        .limit(1);
      if (mainGlobal.length > 0) throw new ValidationError(`Das Keyword "${kw.Keyword}" ist bereits als Main Keyword für eine andere URL registriert.`, 409);
    }

    const id = crypto.randomUUID();
    const [row] = await tx.insert(keywordMapTable).values({
      id,
      tenantId: tenant,
      keyword: kw.Keyword!,
      targetUrl: kw.Target_URL!,
      searchVolume: kw.Search_Volume,
      difficulty: kw.Difficulty,
      status: kw.Status ?? 'Backlog',
      editorialDeadline: kw.Editorial_Deadline ?? null,
      mainKeyword: kw.Main_Keyword ?? 'N',
      articleCount: kw.Article_Count,
      avgProductValue: kw.Avg_Product_Value?.toString(),
      policy: kw.Policy?.toString(),
      priorityScore: kw.Priority_Score?.toString(),
      actionType: kw.Action_Type ?? 'Erstellung',
      pageType: kw.Page_Type,
      lastPublished: kw.Last_Published ?? null,
    }).returning();

    // Handle editor assignments
    if (kw.Assigned_Editor?.length) {
      await tx.insert(keywordMapEditors).values(
        kw.Assigned_Editor.map(userId => ({ keywordId: id, userId }))
      );
    }

    return mapKeywordRow(row, kw.Assigned_Editor ?? []);
  });
}

export async function updateKeyword(id: string, kw: Partial<KeywordMap>, tenantId?: string): Promise<KeywordMap | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const [current] = await tx
      .select()
      .from(keywordMapTable)
      .where(and(eq(keywordMapTable.id, id), eq(keywordMapTable.tenantId, tenant)))
      .limit(1);
    if (!current) return null;

    const nextKeyword = kw.Keyword ?? current.keyword;
    const nextUrl = kw.Target_URL ?? current.targetUrl;
    const nextMain = kw.Main_Keyword ?? current.mainKeyword;

    // Uniqueness check if keyword or url changed
    if (kw.Keyword !== undefined || kw.Target_URL !== undefined) {
      const dupe = await tx
        .select({ id: keywordMapTable.id })
        .from(keywordMapTable)
        .where(and(
          eq(keywordMapTable.tenantId, tenant),
          eq(keywordMapTable.keyword, nextKeyword),
          eq(keywordMapTable.targetUrl, nextUrl),
          drizzleSql`${keywordMapTable.id} != ${id}`,
        ))
        .limit(1);
      if (dupe.length > 0) throw new ValidationError(`Die Kombination Keyword "${nextKeyword}" / URL "${nextUrl}" existiert bereits.`, 409);
    }

    if (nextMain === 'Y' && (kw.Main_Keyword === 'Y' || kw.Target_URL !== undefined)) {
      const mainByUrl = await tx
        .select({ id: keywordMapTable.id })
        .from(keywordMapTable)
        .where(and(
          eq(keywordMapTable.tenantId, tenant),
          eq(keywordMapTable.targetUrl, nextUrl),
          eq(keywordMapTable.mainKeyword, 'Y'),
          drizzleSql`${keywordMapTable.id} != ${id}`,
        ))
        .limit(1);
      if (mainByUrl.length > 0) throw new ValidationError(`Die URL ${nextUrl} hat bereits ein Main Keyword.`, 409);
    }

    const updates: Partial<typeof keywordMapTable.$inferInsert> = {};
    if (kw.Keyword !== undefined) updates.keyword = kw.Keyword;
    if (kw.Target_URL !== undefined) updates.targetUrl = kw.Target_URL;
    if (kw.Search_Volume !== undefined) updates.searchVolume = kw.Search_Volume;
    if (kw.Difficulty !== undefined) updates.difficulty = kw.Difficulty;
    if (kw.Status !== undefined) updates.status = kw.Status;
    if (kw.Editorial_Deadline !== undefined) updates.editorialDeadline = kw.Editorial_Deadline;
    if (kw.Main_Keyword !== undefined) updates.mainKeyword = kw.Main_Keyword;
    if (kw.Article_Count !== undefined) updates.articleCount = kw.Article_Count;
    if (kw.Avg_Product_Value !== undefined) updates.avgProductValue = String(kw.Avg_Product_Value);
    if (kw.Policy !== undefined) updates.policy = String(kw.Policy);
    if (kw.Priority_Score !== undefined) updates.priorityScore = String(kw.Priority_Score);
    if (kw.Action_Type !== undefined) updates.actionType = kw.Action_Type;
    if (kw.Page_Type !== undefined) updates.pageType = kw.Page_Type;
    if (kw.Last_Published !== undefined) updates.lastPublished = kw.Last_Published;

    const [updated] = await tx
      .update(keywordMapTable)
      .set(updates)
      .where(and(eq(keywordMapTable.id, id), eq(keywordMapTable.tenantId, tenant)))
      .returning();

    // Update editor assignments if provided
    if (kw.Assigned_Editor !== undefined) {
      await tx.delete(keywordMapEditors).where(eq(keywordMapEditors.keywordId, id));
      if (kw.Assigned_Editor.length) {
        await tx.insert(keywordMapEditors).values(kw.Assigned_Editor.map(userId => ({ keywordId: id, userId })));
      }
    }

    const editorRows = await tx.select().from(keywordMapEditors).where(eq(keywordMapEditors.keywordId, id));
    return mapKeywordRow(updated, editorRows.map(e => e.userId));
  });
}

export async function deleteKeyword(id: string, tenantId?: string): Promise<boolean> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    await tx.delete(keywordMapTable).where(and(eq(keywordMapTable.id, id), eq(keywordMapTable.tenantId, tenant)));
    return true;
  });
}

export async function bulkDeleteKeywords(ids: string[], tenantId?: string): Promise<boolean> {
  if (!ids.length) return true;
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    await tx.delete(keywordMapTable).where(and(inArray(keywordMapTable.id, ids), eq(keywordMapTable.tenantId, tenant)));
    return true;
  });
}

export async function bulkCreateKeywords(
  keywords: Partial<KeywordMap>[],
  tenantId?: string
): Promise<{ created: KeywordMap[]; skipped: SkippedKeyword[] }> {
  const tenant = tid(tenantId);
  const created: KeywordMap[] = [];
  const skipped: SkippedKeyword[] = [];

  if (!keywords.length) return { created, skipped };

  return withTenant(tenant, async (tx) => {
    // Batch-read all existing keyword+url combos for relevant URLs
    const uniqueUrls = Array.from(new Set(keywords.map(k => k.Target_URL).filter(Boolean))) as string[];

    const existingRows = uniqueUrls.length
      ? await tx
          .select({ keyword: keywordMapTable.keyword, targetUrl: keywordMapTable.targetUrl, mainKeyword: keywordMapTable.mainKeyword })
          .from(keywordMapTable)
          .where(and(eq(keywordMapTable.tenantId, tenant), inArray(keywordMapTable.targetUrl, uniqueUrls)))
      : [];

    const existingSet = new Set<string>();
    const mainKeywordByUrl = new Set<string>();
    const mainKeywordGlobal = new Set<string>();
    for (const r of existingRows) {
      existingSet.add(`${r.keyword.toLowerCase()}|${r.targetUrl.toLowerCase()}`);
      if (r.mainKeyword === 'Y') {
        mainKeywordByUrl.add(r.targetUrl.toLowerCase());
        mainKeywordGlobal.add(r.keyword.toLowerCase());
      }
    }

    const validKeywords: Partial<KeywordMap>[] = [];
    for (const kw of keywords) {
      if (!kw.Keyword || !kw.Target_URL) {
        skipped.push({ ...kw, reason: 'Keyword und Target_URL sind Pflichtfelder.' });
        continue;
      }
      const kwLower = kw.Keyword.toLowerCase();
      const urlLower = kw.Target_URL.toLowerCase();
      if (existingSet.has(`${kwLower}|${urlLower}`)) {
        skipped.push({ ...kw, reason: `Die Kombination "${kw.Keyword}" / "${kw.Target_URL}" existiert bereits.` });
        continue;
      }
      if (kw.Main_Keyword === 'Y') {
        if (mainKeywordByUrl.has(urlLower)) {
          skipped.push({ ...kw, reason: `Die URL ${kw.Target_URL} hat bereits ein Main Keyword.` });
          continue;
        }
        if (mainKeywordGlobal.has(kwLower)) {
          skipped.push({ ...kw, reason: `Das Keyword "${kw.Keyword}" ist bereits als Main Keyword für eine andere URL registriert.` });
          continue;
        }
        mainKeywordByUrl.add(urlLower);
        mainKeywordGlobal.add(kwLower);
      }
      existingSet.add(`${kwLower}|${urlLower}`);
      validKeywords.push(kw);
    }

    // Batch insert
    for (let i = 0; i < validKeywords.length; i += 50) {
      const chunk = validKeywords.slice(i, i + 50);
      try {
        const rows = await tx
          .insert(keywordMapTable)
          .values(chunk.map(kw => ({
            id: crypto.randomUUID(),
            tenantId: tenant,
            keyword: kw.Keyword!,
            targetUrl: kw.Target_URL!,
            searchVolume: kw.Search_Volume,
            difficulty: kw.Difficulty,
            status: kw.Status ?? 'Backlog',
            editorialDeadline: kw.Editorial_Deadline ?? null,
            mainKeyword: kw.Main_Keyword ?? 'N',
            articleCount: kw.Article_Count,
            avgProductValue: kw.Avg_Product_Value?.toString(),
            actionType: kw.Action_Type ?? 'Erstellung',
            pageType: kw.Page_Type,
          })))
          .returning();
        rows.forEach(row => created.push(mapKeywordRow(row)));
      } catch (err: any) {
        chunk.forEach(kw => skipped.push({ ...kw, reason: err.message ?? 'Unbekannter Fehler' }));
      }
    }

    return { created, skipped };
  });
}

export async function bulkUpdateKeywordRankings(
  rankings: { keywordId: string; rank: number }[],
  tenantId?: string
): Promise<void> {
  const tenant = tid(tenantId);
  if (!rankings.length) return;
  await withTenant(tenant, async (tx) => {
    for (const { keywordId, rank } of rankings) {
      await tx
        .update(keywordMapTable)
        .set({ ranking: rank })
        .where(and(eq(keywordMapTable.id, keywordId), eq(keywordMapTable.tenantId, tenant)));
    }
  });
}

// ---------------------------------------------------------------------------
// Content Log
// ---------------------------------------------------------------------------
export async function getContentLogs(tenantId?: string): Promise<ContentLog[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    // LEFT JOIN on content_log_body to determine Version flag (v1 vs v2).
    // We only select the FK (contentLogId) to keep the join cheap — no large text fields.
    const rows = await tx
      .select({
        log: contentLogTable,
        hasBody: drizzleSql<boolean>`(${contentLogBodyTable.contentLogId} IS NOT NULL)`,
      })
      .from(contentLogTable)
      .leftJoin(contentLogBodyTable, eq(contentLogBodyTable.contentLogId, contentLogTable.id))
      .where(eq(contentLogTable.tenantId, tenant))
      .orderBy(desc(contentLogTable.timeCreated))
      .limit(200);
    return rows.map(r => mapContentLogRow(r.log, r.log.keywordId ?? undefined, r.hasBody));
  });
}

export async function getAllContentHistory(tenantId?: string): Promise<ContentLog[]> {
  return getContentLogs(tenantId);
}

export async function getContentHistoryByUrl(targetUrl: string, tenantId?: string): Promise<ContentLog[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select({
        log: contentLogTable,
        hasBody: drizzleSql<boolean>`(${contentLogBodyTable.contentLogId} IS NOT NULL)`,
      })
      .from(contentLogTable)
      .leftJoin(contentLogBodyTable, eq(contentLogBodyTable.contentLogId, contentLogTable.id))
      .where(and(eq(contentLogTable.tenantId, tenant), eq(contentLogTable.loggedUrl, targetUrl)))
      .orderBy(desc(contentLogTable.timeCreated));
    return rows.map(r => mapContentLogRow(r.log, r.log.keywordId ?? undefined, r.hasBody));
  });
}

export async function getContentHistoryByKeyword(keywordId: string, tenantId?: string): Promise<ContentLog[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select({
        log: contentLogTable,
        hasBody: drizzleSql<boolean>`(${contentLogBodyTable.contentLogId} IS NOT NULL)`,
      })
      .from(contentLogTable)
      .leftJoin(contentLogBodyTable, eq(contentLogBodyTable.contentLogId, contentLogTable.id))
      .where(and(eq(contentLogTable.tenantId, tenant), eq(contentLogTable.keywordId, keywordId)))
      .orderBy(desc(contentLogTable.timeCreated));
    return rows.map(r => mapContentLogRow(r.log, keywordId, r.hasBody));
  });
}

/**
 * Loads the full content body for a single content log entry.
 * Use this only when the full text is actually needed (e.g. detail view, export).
 */
export async function getContentLogBody(
  contentLogId: number,
  tenantId?: string
): Promise<{ Content_Body?: string; Diff_Summary?: string } | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    // Verify the log belongs to this tenant first
    const [meta] = await tx
      .select({ id: contentLogTable.id })
      .from(contentLogTable)
      .where(and(eq(contentLogTable.id, contentLogId), eq(contentLogTable.tenantId, tenant)))
      .limit(1);
    if (!meta) return null;

    const [body] = await tx
      .select()
      .from(contentLogBodyTable)
      .where(eq(contentLogBodyTable.contentLogId, contentLogId))
      .limit(1);
    return {
      Content_Body: body?.contentBody ?? undefined,
      Diff_Summary: body?.diffSummary ?? undefined,
    };
  });
}

export async function createContentLog(log: Partial<ContentLog>, tenantId?: string): Promise<ContentLog | null> {
  const tenant = tid(tenantId);

  const keywordId = log.Keyword_ID?.[0] ?? null;
  if (!keywordId) {
    console.error('[postgres createContentLog] Validation failed: Keyword_ID missing');
    return null;
  }

  return withTenant(tenant, async (tx) => {
    // 1. Insert metadata row (lightweight)
    const [row] = await tx
      .insert(contentLogTable)
      .values({
        tenantId: tenant,
        keywordId,
        loggedUrl: log.Logged_URL ?? log.Target_URL,
        actionType: log.Action_Type,
        pageType: log.Page_Type,
        editorId: log.Editor?.[0] ?? null,
      })
      .returning();

    // 2. Insert body separately only when content exists
    let body: { contentBody: string | null; diffSummary: string | null } | null = null;
    if (log.Content_Body || log.Diff_Summary) {
      const [bodyRow] = await tx
        .insert(contentLogBodyTable)
        .values({
          contentLogId: row.id,
          contentBody: log.Content_Body ?? null,
          diffSummary: log.Diff_Summary ?? null,
        })
        .returning();
      body = { contentBody: bodyRow.contentBody, diffSummary: bodyRow.diffSummary };
    }

    return mapContentLogRow(row, keywordId, body);
  });
}

// ---------------------------------------------------------------------------
// URL Performance
// ---------------------------------------------------------------------------

/** ISO date string for N days ago */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function mapPerformanceRow(r: typeof urlPerformanceTable.$inferSelect): PerformanceData {
  return {
    id: String(r.id),
    ID: r.id,
    Keyword_ID: [],
    Target_URL: r.targetUrl,
    Date: r.date,
    Ranking: undefined,
    GSC_Clicks: r.gscClicks ?? undefined,
    GSC_Impressions: r.gscImpressions ?? undefined,
    Sistrix_VI: r.sistrixVi ? Number(r.sistrixVi) : undefined,
    Position: r.position ? Number(r.position) : undefined,
    Source: 'Combined' as const,
  };
}

export async function getPerformanceData(tenantId?: string, dayRange = 90): Promise<PerformanceData[]> {
  const tenant = tid(tenantId);
  try {
    return withTenant(tenant, async (tx) => {
      const since = daysAgo(dayRange);
      const rows = await tx
        .select()
        .from(urlPerformanceTable)
        .where(and(
          eq(urlPerformanceTable.tenantId, tenant),
          gte(urlPerformanceTable.date, since),
        ))
        .orderBy(desc(urlPerformanceTable.date))
        .limit(10_000);
      return rows.map(mapPerformanceRow);
    });
  } catch (err: any) {
    console.warn('[postgres] getPerformanceData error:', err.message);
    return [];
  }
}

export async function getPerformanceDataByUrl(targetUrl: string, tenantId?: string, dayRange = 365): Promise<PerformanceData[]> {
  const tenant = tid(tenantId);
  try {
    return withTenant(tenant, async (tx) => {
      const since = daysAgo(dayRange);
      const rows = await tx
        .select()
        .from(urlPerformanceTable)
        .where(and(
          eq(urlPerformanceTable.tenantId, tenant),
          eq(urlPerformanceTable.targetUrl, targetUrl),
          gte(urlPerformanceTable.date, since),
        ))
        .orderBy(asc(urlPerformanceTable.date));
      return rows.map(mapPerformanceRow);
    });
  } catch (err: any) {
    console.warn('[postgres] getPerformanceDataByUrl error:', err.message);
    return [];
  }
}

export async function getURLPerformanceHistory(targetUrl: string, tenantId?: string, dayRange = 365): Promise<URLPerformance[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const since = daysAgo(dayRange);
    const rows = await tx
      .select()
      .from(urlPerformanceTable)
      .where(and(
        eq(urlPerformanceTable.tenantId, tenant),
        eq(urlPerformanceTable.targetUrl, targetUrl),
        gte(urlPerformanceTable.date, since),
      ))
      .orderBy(asc(urlPerformanceTable.date));
    return rows.map(r => ({
      id: String(r.id),
      Target_URL: r.targetUrl,
      Date: r.date,
      GSC_Clicks: r.gscClicks ?? undefined,
      GSC_Impressions: r.gscImpressions ?? undefined,
      Position: r.position ? Number(r.position) : undefined,
      Sistrix_VI: r.sistrixVi ? Number(r.sistrixVi) : undefined,
    }));
  });
}

export async function upsertURLPerformance(
  data: Partial<URLPerformance>[],
  tenantId?: string
): Promise<{ created: number; updated: number; errors: any[] }> {
  const tenant = tid(tenantId);
  const errors: any[] = [];
  let created = 0;
  let updated = 0;

  const valid = data.filter(d => d.Target_URL && d.Date);
  if (!valid.length) return { created, updated, errors };

  try {
    await withTenant(tenant, async (tx) => {
      for (let i = 0; i < valid.length; i += 50) {
        const chunk = valid.slice(i, i + 50);
        try {
          const result = await tx
            .insert(urlPerformanceTable)
            .values(chunk.map(d => ({
              tenantId: tenant,
              targetUrl: d.Target_URL!,
              date: d.Date!,
              gscClicks: d.GSC_Clicks,
              gscImpressions: d.GSC_Impressions,
              position: d.Position?.toString(),
              sistrixVi: d.Sistrix_VI?.toString(),
            })))
            .onConflictDoUpdate({
              target: [urlPerformanceTable.targetUrl, urlPerformanceTable.date, urlPerformanceTable.tenantId],
              set: {
                gscClicks: drizzleSql`excluded.gsc_clicks`,
                gscImpressions: drizzleSql`excluded.gsc_impressions`,
                position: drizzleSql`excluded.position`,
                sistrixVi: drizzleSql`excluded.sistrix_vi`,
              },
            })
            .returning({ id: urlPerformanceTable.id });
          created += result.length;
        } catch (err: any) {
          errors.push({ chunk: i, error: err.message });
        }
      }
    });
  } catch (err: any) {
    errors.push({ error: err.message });
  }

  return { created, updated, errors };
}

export async function upsertPerformanceData(
  data: Partial<PerformanceData>[],
  tenantId?: string
): Promise<{ created: number; updated: number; errors: any[] }> {
  // Map PerformanceData → URLPerformance shape and delegate
  const mapped: Partial<URLPerformance>[] = data.map(d => ({
    Target_URL: d.Target_URL,
    Date: d.Date,
    GSC_Clicks: d.GSC_Clicks,
    GSC_Impressions: d.GSC_Impressions,
    Position: d.Position,
    Sistrix_VI: d.Sistrix_VI,
  }));
  return upsertURLPerformance(mapped, tenantId);
}

// ---------------------------------------------------------------------------
// Keyword Ranking History
// ---------------------------------------------------------------------------
export async function getKeywordRankingHistory(keywordIds: string[], tenantId?: string): Promise<KeywordRankingHistory[]> {
  if (!keywordIds.length) return [];
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select()
      .from(keywordRankingHistoryTable)
      .where(and(eq(keywordRankingHistoryTable.tenantId, tenant), inArray(keywordRankingHistoryTable.keywordId, keywordIds)))
      .orderBy(asc(keywordRankingHistoryTable.date));
    return rows.map(r => ({
      id: String(r.id),
      Keyword_ID: [r.keywordId],
      Date: r.date,
      Ranking: r.ranking ?? undefined,
    }));
  });
}

export async function getExistingRankingDates(keywordIds: string[], weekDate: string, tenantId?: string): Promise<Set<string>> {
  const found = new Set<string>();
  if (!keywordIds.length) return found;
  const tenant = tid(tenantId);
  try {
    await withTenant(tenant, async (tx) => {
      const rows = await tx
        .select({ keywordId: keywordRankingHistoryTable.keywordId })
        .from(keywordRankingHistoryTable)
        .where(and(
          eq(keywordRankingHistoryTable.tenantId, tenant),
          inArray(keywordRankingHistoryTable.keywordId, keywordIds),
          eq(keywordRankingHistoryTable.date, weekDate),
        ));
      rows.forEach(r => found.add(r.keywordId));
    });
  } catch (err: any) {
    console.error('[postgres] getExistingRankingDates error:', err.message);
  }
  return found;
}

export async function upsertKeywordRankingHistory(
  data: Partial<KeywordRankingHistory>[],
  tenantId?: string
): Promise<{ created: number; updated: number; errors: any[] }> {
  const tenant = tid(tenantId);
  const errors: any[] = [];
  let created = 0;

  const valid = data
    .map(d => ({ kwId: Array.isArray(d.Keyword_ID) ? d.Keyword_ID[0] : (d.Keyword_ID as unknown as string), date: d.Date, ranking: d.Ranking }))
    .filter(d => d.kwId && d.date);

  if (!valid.length) return { created, updated: 0, errors };

  try {
    await withTenant(tenant, async (tx) => {
      for (let i = 0; i < valid.length; i += 50) {
        const chunk = valid.slice(i, i + 50);
        try {
          const result = await tx
            .insert(keywordRankingHistoryTable)
            .values(chunk.map(d => ({ tenantId: tenant, keywordId: d.kwId, date: d.date!, ranking: d.ranking })))
            .onConflictDoUpdate({
              target: [keywordRankingHistoryTable.keywordId, keywordRankingHistoryTable.date, keywordRankingHistoryTable.tenantId],
              set: { ranking: drizzleSql`excluded.ranking` },
            })
            .returning({ id: keywordRankingHistoryTable.id });
          created += result.length;
        } catch (err: any) {
          errors.push({ chunk: i, error: err.message });
        }
      }
    });
  } catch (err: any) {
    errors.push({ error: err.message });
  }

  return { created, updated: 0, errors };
}

// ---------------------------------------------------------------------------
// Blacklist
// ---------------------------------------------------------------------------
export async function getBlacklist(tenantId?: string): Promise<BlacklistEntry[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx.select().from(blacklistTable).where(eq(blacklistTable.tenantId, tenant));
    return rows.map(r => ({
      id: String(r.id),
      Keyword: r.keyword ?? '',
      Target_URL: r.targetUrl ?? undefined,
      Type: r.type as 'Keyword' | 'URL',
      Reason: r.reason ?? undefined,
      Added_At: r.addedAt.toISOString(),
    }));
  });
}

export async function addToBlacklist(entry: Partial<BlacklistEntry>, tenantId?: string): Promise<BlacklistEntry | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const [row] = await tx
      .insert(blacklistTable)
      .values({
        tenantId: tenant,
        keyword: entry.Keyword,
        targetUrl: entry.Target_URL,
        type: entry.Type ?? 'Keyword',
        reason: entry.Reason,
      })
      .returning();
    return {
      id: String(row.id),
      Keyword: row.keyword ?? '',
      Target_URL: row.targetUrl ?? undefined,
      Type: row.type as 'Keyword' | 'URL',
      Reason: row.reason ?? undefined,
      Added_At: row.addedAt.toISOString(),
    };
  });
}

export async function updateBlacklist(id: string, entry: Partial<BlacklistEntry>, tenantId?: string): Promise<BlacklistEntry | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const updates: any = {};
    if (entry.Keyword !== undefined) updates.keyword = entry.Keyword;
    if (entry.Target_URL !== undefined) updates.targetUrl = entry.Target_URL;
    if (entry.Type !== undefined) updates.type = entry.Type;
    if (entry.Reason !== undefined) updates.reason = entry.Reason;
    const [row] = await tx
      .update(blacklistTable)
      .set(updates)
      .where(and(eq(blacklistTable.id, Number(id)), eq(blacklistTable.tenantId, tenant)))
      .returning();
    if (!row) return null;
    return {
      id: String(row.id),
      Keyword: row.keyword ?? '',
      Target_URL: row.targetUrl ?? undefined,
      Type: row.type as 'Keyword' | 'URL',
      Reason: row.reason ?? undefined,
      Added_At: row.addedAt.toISOString(),
    };
  });
}

export async function deleteFromBlacklist(id: string, tenantId?: string): Promise<boolean> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    await tx.delete(blacklistTable).where(and(eq(blacklistTable.id, Number(id)), eq(blacklistTable.tenantId, tenant)));
    return true;
  });
}

export async function bulkDeleteFromBlacklist(ids: string[], tenantId?: string): Promise<boolean> {
  if (!ids.length) return true;
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    await tx.delete(blacklistTable).where(and(inArray(blacklistTable.id, ids.map(Number)), eq(blacklistTable.tenantId, tenant)));
    return true;
  });
}

// ---------------------------------------------------------------------------
// Cost Config
// ---------------------------------------------------------------------------
export async function getCostConfigs(tenantId?: string): Promise<CostConfig[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx.select().from(costConfigTable).where(eq(costConfigTable.tenantId, tenant));
    return rows.map(r => ({
      id: String(r.id),
      Page_Type: r.pageType as any,
      Action_Type: r.actionType as any,
      Agency_Cost: Number(r.agencyCost),
      Overhead_Cost: Number(r.overheadCost),
    }));
  });
}

export async function createCostConfig(config: Partial<CostConfig>, tenantId?: string): Promise<CostConfig | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const [row] = await tx
      .insert(costConfigTable)
      .values({
        tenantId: tenant,
        pageType: config.Page_Type!,
        actionType: config.Action_Type!,
        agencyCost: String(config.Agency_Cost ?? 0),
        overheadCost: String(config.Overhead_Cost ?? 0),
      })
      .returning();
    return {
      id: String(row.id),
      Page_Type: row.pageType as any,
      Action_Type: row.actionType as any,
      Agency_Cost: Number(row.agencyCost),
      Overhead_Cost: Number(row.overheadCost),
    };
  });
}

export async function updateCostConfig(id: string, config: Partial<CostConfig>, tenantId?: string): Promise<CostConfig | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const updates: any = {};
    if (config.Page_Type) updates.pageType = config.Page_Type;
    if (config.Action_Type) updates.actionType = config.Action_Type;
    if (config.Agency_Cost !== undefined) updates.agencyCost = String(config.Agency_Cost);
    if (config.Overhead_Cost !== undefined) updates.overheadCost = String(config.Overhead_Cost);
    const [row] = await tx
      .update(costConfigTable)
      .set(updates)
      .where(and(eq(costConfigTable.id, Number(id)), eq(costConfigTable.tenantId, tenant)))
      .returning();
    if (!row) return null;
    return {
      id: String(row.id),
      Page_Type: row.pageType as any,
      Action_Type: row.actionType as any,
      Agency_Cost: Number(row.agencyCost),
      Overhead_Cost: Number(row.overheadCost),
    };
  });
}

export async function deleteCostConfig(id: string, tenantId?: string): Promise<boolean> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    await tx.delete(costConfigTable).where(and(eq(costConfigTable.id, Number(id)), eq(costConfigTable.tenantId, tenant)));
    return true;
  });
}

// ---------------------------------------------------------------------------
// Config (key-value store)
// ---------------------------------------------------------------------------
export async function getConfig(tenantId?: string): Promise<Record<string, string>> {
  const tenant = tid(tenantId);
  const now = Date.now();
  const cached = _configCacheByTenant.get(tenant);
  if (cached && now - cached.at < CONFIG_CACHE_TTL_MS) {
    return cached.data;
  }
  const result = await withTenant(tenant, async (tx) => {
    const rows = await tx.select().from(configTable).where(eq(configTable.tenantId, tenant));
    const out: Record<string, string> = {};
    for (const r of rows) {
      if (!r.key) continue;
      if ((r.key === 'BRAND_LOGO_URL' || r.key === 'BRAND_FAVICON_URL') && r.fileUrl) {
        out[r.key] = r.fileUrl;
      } else {
        out[r.key] = r.value ?? '';
      }
    }
    return out;
  });
  _configCacheByTenant.set(tenant, { data: result, at: now });
  return result;
}

export async function updateConfig(key: string, value: string, fileUrl?: string, tenantId?: string): Promise<ConfigRecord | null> {
  const tenant = tid(tenantId);
  const isBrandAsset = key === 'BRAND_LOGO_URL' || key === 'BRAND_FAVICON_URL';
  const result = await withTenant(tenant, async (tx) => {
    const [row] = await tx
      .insert(configTable)
      .values({
        tenantId: tenant,
        key,
        value: isBrandAsset && fileUrl ? fileUrl : value,
        fileUrl: isBrandAsset && fileUrl ? fileUrl : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [configTable.tenantId, configTable.key],
        set: {
          value: isBrandAsset && fileUrl ? fileUrl : value,
          fileUrl: isBrandAsset && fileUrl ? fileUrl : null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return {
      id: `${row.tenantId}:${row.key}`,
      Key: row.key,
      Value: row.value ?? '',
      Description: row.description ?? undefined,
      Updated_At: row.updatedAt.toISOString(),
      File: row.fileUrl ? [{ url: row.fileUrl }] : undefined,
    } as ConfigRecord;
  });
  invalidateConfigCache(tenantId);
  return result;
}

export async function getSyncCursor(key: string, tenantId?: string): Promise<number> {
  const config = await getConfig(tenantId);
  const val = parseInt(config[key] ?? '0', 10);
  return isNaN(val) ? 0 : val;
}

export async function setSyncCursor(key: string, value: number, tenantId?: string): Promise<void> {
  await updateConfig(key, String(value), undefined, tenantId);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export async function getUserByEmail(email: string, tenantId?: string): Promise<UserRecord | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const [row] = await tx
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.tenantId, tenant), eq(usersTable.email, email)))
      .limit(1);
    if (!row) return null;
    return {
      id:              row.id,
      Name:            row.name ?? '',
      Email:           row.email,
      Role:            row.role as 'SuperAdmin' | 'Admin' | 'Editor' | 'Viewer',
      TenantId:        row.tenantId,
      Password:        row.password ?? undefined,
      Password_Changed: row.passwordChanged ?? false,
      Is_Active:       row.isActive ?? true,
    };
  });
}

export async function countUsers(tenantId?: string): Promise<number> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.tenantId, tenant));
    return rows.length;
  });
}

export async function getAllUsers(tenantId?: string): Promise<UserRecord[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx.select().from(usersTable).where(eq(usersTable.tenantId, tenant));
    return rows.map(r => ({
      id: r.id,
      Name: r.name ?? '',
      Email: r.email,
      Role: r.role as 'Admin' | 'Editor' | 'Viewer',
      Password: r.password ?? undefined,
      Password_Changed: r.passwordChanged ?? false,
    }));
  });
}

export async function createUser(userData: Partial<UserRecord>, tenantId?: string): Promise<UserRecord | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const [row] = await tx
      .insert(usersTable)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant,
        name: userData.Name,
        email: userData.Email!,
        role: userData.Role ?? 'Editor',
        password: userData.Password,
        passwordChanged: userData.Password_Changed ?? false,
      })
      .returning();
    return {
      id: row.id,
      Name: row.name ?? '',
      Email: row.email,
      Role: row.role as 'Admin' | 'Editor' | 'Viewer',
      Password: row.password ?? undefined,
      Password_Changed: row.passwordChanged ?? false,
    };
  });
}

export async function updateUser(id: string, userData: Partial<UserRecord>, tenantId?: string): Promise<UserRecord | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const updates: any = {};
    if (userData.Name !== undefined) updates.name = userData.Name;
    if (userData.Email !== undefined) updates.email = userData.Email;
    if (userData.Role !== undefined) updates.role = userData.Role;
    if (userData.Password !== undefined) updates.password = userData.Password;
    if (userData.Password_Changed !== undefined) updates.passwordChanged = userData.Password_Changed;
    const [row] = await tx
      .update(usersTable)
      .set(updates)
      .where(and(eq(usersTable.id, id), eq(usersTable.tenantId, tenant)))
      .returning();
    if (!row) return null;
    return {
      id: row.id,
      Name: row.name ?? '',
      Email: row.email,
      Role: row.role as 'Admin' | 'Editor' | 'Viewer',
      Password: row.password ?? undefined,
      Password_Changed: row.passwordChanged ?? false,
    };
  });
}

export async function deleteUser(id: string, tenantId?: string): Promise<boolean> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    await tx.delete(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.tenantId, tenant)));
    return true;
  });
}

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------
export async function createAuditLog(action: string, rawPayload?: Record<string, unknown>, tenantId?: string): Promise<void> {
  const tenant = tid(tenantId);
  try {
    await withTenant(tenant, async (tx) => {
      await tx.insert(auditLogsTable).values({
        tenantId: tenant,
        action,
        rawPayload: rawPayload ?? null,
      });
    });
  } catch (err) {
    // Audit log writes must never block critical paths
    console.error('[postgres] createAuditLog failed:', err);
  }
}

export async function getAuditLogs(tenantId?: string, limit = 500): Promise<AuditLog[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.tenantId, tenant))
      .orderBy(desc(auditLogsTable.timestamp))
      .limit(limit);
    return rows.map(r => ({
      id: String(r.id),
      ID: r.id,
      Action: r.action,
      Timestamp: r.timestamp.toISOString(),
      User_ID: r.userId ? [r.userId] : undefined,
      Raw_Payload: r.rawPayload ? JSON.stringify(r.rawPayload) : undefined,
    }));
  });
}

/**
 * Deletes audit log entries older than `retainDays` days.
 * Safe to call from a cron job — returns the number of deleted rows.
 */
export async function purgeOldAuditLogs(retainDays = 180, tenantId?: string): Promise<number> {
  const tenant = tid(tenantId);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retainDays);
  return withTenant(tenant, async (tx) => {
    const result = await tx
      .delete(auditLogsTable)
      .where(and(
        eq(auditLogsTable.tenantId, tenant),
        lt(auditLogsTable.timestamp, cutoff),
      ))
      .returning({ id: auditLogsTable.id });
    return result.length;
  });
}

/**
 * Deletes url_performance entries older than `retainDays` days.
 * GSC data older than 1 year is typically not needed for dashboards.
 */
export async function purgeOldPerformanceData(retainDays = 400, tenantId?: string): Promise<number> {
  const tenant = tid(tenantId);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retainDays);
  const cutoffDate = cutoff.toISOString().split('T')[0];
  return withTenant(tenant, async (tx) => {
    const result = await tx
      .delete(urlPerformanceTable)
      .where(and(
        eq(urlPerformanceTable.tenantId, tenant),
        lt(urlPerformanceTable.date, cutoffDate),
      ))
      .returning({ id: urlPerformanceTable.id });
    return result.length;
  });
}

// ---------------------------------------------------------------------------
// Stub functions (no-op, kept for interface compatibility)
// ---------------------------------------------------------------------------
export async function getPotentialTrends(_tenantId?: string): Promise<PotentialTrend[]> {
  return [];
}

export async function createTrend(_trend: Partial<PotentialTrend>, _tenantId?: string): Promise<PotentialTrend | null> {
  return null;
}

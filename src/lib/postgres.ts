/**
 * postgres-new.ts
 * ---------------
 * Refactored data access layer using new URL-centric schema.
 * This replaces postgres.ts with clean implementations based on the new structure.
 */
import 'server-only';
import { eq, and, or, desc, asc, inArray, sql, gte, lte, lt, notExists, isNotNull, isNull } from 'drizzle-orm';
import { db, withTenant, getDefaultTenantId } from './db/index';
import {
  urls,
  urlKeywords,
  urlKeywordEditors,
  planningStatus,
  executionCycles,
  executionVersions,
  publishingStatus,
  processEvents,
  keywordRankings,
  blacklistedKeywords,
  blacklistedUrls,
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
// Validation Error
// ---------------------------------------------------------------------------
export class ValidationError extends Error {
  constructor(public message: string, public status: number = 400) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AirtableValidationError extends ValidationError {}

// ---------------------------------------------------------------------------
// Config Cache
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
function tid(tenantId?: string): string {
  if (!tenantId) {
    if (process.env.MULTI_TENANT === 'true') {
      throw new Error(
        '[postgres] tid() called without tenantId in MULTI_TENANT mode. ' +
        'Every data-access call must supply an explicit tenantId.'
      );
    }
    console.warn('[postgres] tid() called without tenantId — falling back to default tenant.');
  }
  return tenantId ?? getDefaultTenantId();
}

function toIsoDate(d: string | Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const str = typeof d === 'string' ? d : d.toISOString();
  return str.split('T')[0];
}

// Map new schema status to old API format
function mapToOldStatus(
  planning: typeof planningStatus.$inferSelect | null,
  execution: typeof executionCycles.$inferSelect | null,
  publishing: typeof publishingStatus.$inferSelect | null
): KeywordStatus {
  if (publishing?.status === 'published') return 'Published';
  if (publishing?.status === 'in_review') return 'Review';
  if (execution?.status === 'delivered') return 'Angeliefert';
  if (execution?.status === 'in_progress') return 'In Arbeit';
  if (execution?.status === 'commissioned') return 'Beauftragt';
  if (planning?.status === 'planned') return 'Planned';
  return 'Backlog';
}

function mapToOldActionType(actionType: 'creation' | 'optimization' | null | undefined): 'Erstellung' | 'Optimierung' {
  return actionType === 'optimization' ? 'Optimierung' : 'Erstellung';
}

function mapFromOldActionType(actionType: 'Erstellung' | 'Optimierung' | undefined): 'creation' | 'optimization' {
  return actionType === 'Optimierung' ? 'optimization' : 'creation';
}

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------
export async function getAllTenants(): Promise<{ id: string; name: string }[]> {
  const rows = await db.select({ id: tenantsTable.id, name: tenantsTable.name }).from(tenantsTable);
  return rows;
}

// ---------------------------------------------------------------------------
// Keyword Map (URL-Keywords with aggregated status)
// ---------------------------------------------------------------------------
export async function getKeywordMap(tenantId?: string): Promise<KeywordMap[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select({
        keyword: urlKeywords,
        url: urls,
        planning: planningStatus,
        cycle: executionCycles,
        publishing: publishingStatus,
      })
      .from(urlKeywords)
      .innerJoin(urls, eq(urls.id, urlKeywords.urlId))
      .leftJoin(planningStatus, eq(planningStatus.urlId, urls.id))
      .leftJoin(
        executionCycles,
        and(
          eq(executionCycles.urlId, urls.id),
          eq(
            executionCycles.cycleNumber,
            tx
              .select({ max: sql<number>`COALESCE(MAX(${executionCycles.cycleNumber}), 0)` })
              .from(executionCycles)
              .where(eq(executionCycles.urlId, urls.id))
          )
        )
      )
      .leftJoin(publishingStatus, eq(publishingStatus.cycleId, executionCycles.id))
      .where(
        and(
          eq(urlKeywords.tenantId, tenant),
          notExists(
            tx
              .select({ one: sql`1` })
              .from(blacklistedKeywords)
              .where(
                and(
                  eq(blacklistedKeywords.tenantId, tenant),
                  sql`lower(${blacklistedKeywords.keyword}) = lower(${urlKeywords.keyword})`
                )
              )
          ),
          notExists(
            tx
              .select({ one: sql`1` })
              .from(blacklistedUrls)
              .where(
                and(
                  eq(blacklistedUrls.tenantId, tenant),
                  eq(blacklistedUrls.urlId, urls.id)
                )
              )
          )
        )
      )
      .orderBy(asc(urlKeywords.keyword));

    // Fetch editor assignments
    const kwIds = rows.map(r => r.keyword.id);
    const editorRows = kwIds.length
      ? await tx.select().from(urlKeywordEditors).where(inArray(urlKeywordEditors.keywordId, kwIds))
      : [];
    const editorMap = new Map<string, string[]>();
    for (const e of editorRows) {
      const arr = editorMap.get(e.keywordId) ?? [];
      arr.push(e.userId);
      editorMap.set(e.keywordId, arr);
    }

    return rows.map(({ keyword: kw, url, planning, cycle, publishing }) => ({
      id: kw.id,
      Keyword: kw.keyword,
      Target_URL: url.url,
      Search_Volume: kw.searchVolume ?? undefined,
      Difficulty: kw.difficulty ?? undefined,
      Status: mapToOldStatus(planning, cycle, publishing),
      Editorial_Deadline: toIsoDate(planning?.editorialDeadline),
      Assigned_Editor: editorMap.get(kw.id),
      Main_Keyword: kw.isMainKeyword ? 'Y' : 'N',
      Article_Count: kw.articleCount ?? undefined,
      Avg_Product_Value: kw.avgProductValue ? Number(kw.avgProductValue) : undefined,
      Policy: kw.policy ? Number(kw.policy) : undefined,
      Priority_Score: kw.priorityScore ? Number(kw.priorityScore) : undefined,
      Ranking: kw.ranking ?? undefined,
      Action_Type: mapToOldActionType(planning?.plannedActionType ?? cycle?.actionType),
      Page_Type: url.pageType as any,
      Last_Published: toIsoDate(publishing?.publishedAt),
    }));
  });
}

export async function getKeywordsByUrl(targetUrl: string, tenantId?: string): Promise<KeywordMap[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const [urlRecord] = await tx
      .select({ id: urls.id })
      .from(urls)
      .where(and(eq(urls.url, targetUrl), eq(urls.tenantId, tenant)))
      .limit(1);

    if (!urlRecord) return [];

    const rows = await tx
      .select({
        keyword: urlKeywords,
        url: urls,
        planning: planningStatus,
        cycle: executionCycles,
        publishing: publishingStatus,
      })
      .from(urlKeywords)
      .innerJoin(urls, eq(urls.id, urlKeywords.urlId))
      .leftJoin(planningStatus, eq(planningStatus.urlId, urls.id))
      .leftJoin(
        executionCycles,
        and(
          eq(executionCycles.urlId, urls.id),
          eq(
            executionCycles.cycleNumber,
            tx
              .select({ max: sql<number>`COALESCE(MAX(${executionCycles.cycleNumber}), 0)` })
              .from(executionCycles)
              .where(eq(executionCycles.urlId, urls.id))
          )
        )
      )
      .leftJoin(publishingStatus, eq(publishingStatus.cycleId, executionCycles.id))
      .where(
        and(
          eq(urlKeywords.urlId, urlRecord.id),
          eq(urlKeywords.tenantId, tenant)
        )
      );

    const kwIds = rows.map(r => r.keyword.id);
    const editorRows = kwIds.length
      ? await tx.select().from(urlKeywordEditors).where(inArray(urlKeywordEditors.keywordId, kwIds))
      : [];
    const editorMap = new Map<string, string[]>();
    for (const e of editorRows) {
      const arr = editorMap.get(e.keywordId) ?? [];
      arr.push(e.userId);
      editorMap.set(e.keywordId, arr);
    }

    return rows.map(({ keyword: kw, url, planning, cycle, publishing }) => ({
      id: kw.id,
      Keyword: kw.keyword,
      Target_URL: url.url,
      Search_Volume: kw.searchVolume ?? undefined,
      Difficulty: kw.difficulty ?? undefined,
      Status: mapToOldStatus(planning, cycle, publishing),
      Editorial_Deadline: toIsoDate(planning?.editorialDeadline),
      Assigned_Editor: editorMap.get(kw.id),
      Main_Keyword: kw.isMainKeyword ? 'Y' : 'N',
      Article_Count: kw.articleCount ?? undefined,
      Avg_Product_Value: kw.avgProductValue ? Number(kw.avgProductValue) : undefined,
      Policy: kw.policy ? Number(kw.policy) : undefined,
      Priority_Score: kw.priorityScore ? Number(kw.priorityScore) : undefined,
      Ranking: kw.ranking ?? undefined,
      Action_Type: mapToOldActionType(planning?.plannedActionType ?? cycle?.actionType),
      Page_Type: url.pageType as any,
      Last_Published: toIsoDate(publishing?.publishedAt),
    }));
  });
}

export async function getKeyword(keywordId: string, tenantId?: string): Promise<KeywordMap | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select({
        keyword: urlKeywords,
        url: urls,
        planning: planningStatus,
        cycle: executionCycles,
        publishing: publishingStatus,
      })
      .from(urlKeywords)
      .innerJoin(urls, eq(urls.id, urlKeywords.urlId))
      .leftJoin(planningStatus, eq(planningStatus.urlId, urls.id))
      .leftJoin(
        executionCycles,
        and(
          eq(executionCycles.urlId, urls.id),
          eq(
            executionCycles.cycleNumber,
            tx
              .select({ max: sql<number>`COALESCE(MAX(${executionCycles.cycleNumber}), 0)` })
              .from(executionCycles)
              .where(eq(executionCycles.urlId, urls.id))
          )
        )
      )
      .leftJoin(publishingStatus, eq(publishingStatus.cycleId, executionCycles.id))
      .where(
        and(
          eq(urlKeywords.id, keywordId),
          eq(urlKeywords.tenantId, tenant)
        )
      )
      .limit(1);

    if (rows.length === 0) return null;

    const { keyword: kw, url, planning, cycle, publishing } = rows[0];

    const editorRows = await tx
      .select()
      .from(urlKeywordEditors)
      .where(eq(urlKeywordEditors.keywordId, keywordId));

    return {
      id: kw.id,
      Keyword: kw.keyword,
      Target_URL: url.url,
      Search_Volume: kw.searchVolume ?? undefined,
      Difficulty: kw.difficulty ?? undefined,
      Status: mapToOldStatus(planning, cycle, publishing),
      Editorial_Deadline: toIsoDate(planning?.editorialDeadline),
      Assigned_Editor: editorRows.length ? editorRows.map(e => e.userId) : undefined,
      Main_Keyword: kw.isMainKeyword ? 'Y' : 'N',
      Article_Count: kw.articleCount ?? undefined,
      Avg_Product_Value: kw.avgProductValue ? Number(kw.avgProductValue) : undefined,
      Policy: kw.policy ? Number(kw.policy) : undefined,
      Priority_Score: kw.priorityScore ? Number(kw.priorityScore) : undefined,
      Ranking: kw.ranking ?? undefined,
      Action_Type: mapToOldActionType(planning?.plannedActionType ?? cycle?.actionType),
      Page_Type: url.pageType as any,
      Last_Published: toIsoDate(publishing?.publishedAt),
    };
  });
}

// ---------------------------------------------------------------------------
// Create/Update/Delete Keywords
// ---------------------------------------------------------------------------
async function ensureUrl(url: string, pageType: string | undefined, tenant: string, tx: any): Promise<string> {
  const existing = await tx
    .select({ id: urls.id })
    .from(urls)
    .where(and(eq(urls.url, url), eq(urls.tenantId, tenant)))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const [newUrl] = await tx
    .insert(urls)
    .values({
      tenantId: tenant,
      url,
      pageType: pageType as any,
    })
    .returning({ id: urls.id });

  // Create default planning status
  await tx.insert(planningStatus).values({
    tenantId: tenant,
    urlId: newUrl.id,
    status: 'backlog',
  });

  return newUrl.id;
}

export async function createKeyword(
  data: {
    keyword: string;
    targetUrl: string;
    searchVolume?: number;
    difficulty?: number;
    mainKeyword?: 'Y' | 'N';
    pageType?: string;
    priorityScore?: number;
    articleCount?: number;
    avgProductValue?: number;
    policy?: number;
    ranking?: number;
    actionType?: 'Erstellung' | 'Optimierung';
  },
  tenantId?: string
): Promise<string> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const urlId = await ensureUrl(data.targetUrl, data.pageType, tenant, tx);

    const [newKeyword] = await tx
      .insert(urlKeywords)
      .values({
        tenantId: tenant,
        urlId,
        keyword: data.keyword,
        isMainKeyword: data.mainKeyword === 'Y',
        searchVolume: data.searchVolume,
        difficulty: data.difficulty,
        priorityScore: data.priorityScore ? String(data.priorityScore) : undefined,
        articleCount: data.articleCount,
        avgProductValue: data.avgProductValue ? String(data.avgProductValue) : undefined,
        policy: data.policy ? String(data.policy) : undefined,
        ranking: data.ranking,
      })
      .returning({ id: urlKeywords.id });

    // Update planning status with action type if main keyword
    if (data.mainKeyword === 'Y' && data.actionType) {
      await tx
        .update(planningStatus)
        .set({
          plannedActionType: mapFromOldActionType(data.actionType),
        })
        .where(and(eq(planningStatus.urlId, urlId), eq(planningStatus.tenantId, tenant)));
    }

    // Log event
    await tx.insert(processEvents).values({
      tenantId: tenant,
      eventType: 'keyword_added',
      urlId,
      keywordId: newKeyword.id,
      eventData: { keyword: data.keyword, url: data.targetUrl },
    });

    return newKeyword.id;
  });
}

export async function updateKeyword(
  keywordId: string,
  updates: {
    Status?: KeywordStatus;
    Editorial_Deadline?: string;
    Priority_Score?: number;
    Assigned_Editor?: string[];
    Action_Type?: 'Erstellung' | 'Optimierung';
    Last_Published?: string;
  },
  tenantId?: string
): Promise<void> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    // Get keyword to find URL
    const [keyword] = await tx
      .select({ urlId: urlKeywords.urlId, isMainKeyword: urlKeywords.isMainKeyword })
      .from(urlKeywords)
      .where(and(eq(urlKeywords.id, keywordId), eq(urlKeywords.tenantId, tenant)))
      .limit(1);

    if (!keyword) throw new Error('Keyword not found');

    // Update planning status if applicable
    if (updates.Status || updates.Editorial_Deadline || updates.Priority_Score !== undefined || updates.Action_Type) {
      const planningUpdates: any = {};
      
      if (updates.Status) {
        if (updates.Status === 'Backlog') planningUpdates.status = 'backlog';
        else if (updates.Status === 'Planned') planningUpdates.status = 'planned';
        else if (updates.Status === 'Published') planningUpdates.status = 'planned'; // Keep planned for re-optimization
      }
      
      if (updates.Editorial_Deadline !== undefined) {
        planningUpdates.editorialDeadline = updates.Editorial_Deadline || null;
      }
      
      if (updates.Priority_Score !== undefined) {
        planningUpdates.priorityScore = String(updates.Priority_Score);
      }
      
      if (updates.Action_Type) {
        planningUpdates.plannedActionType = mapFromOldActionType(updates.Action_Type);
      }

      if (Object.keys(planningUpdates).length > 0) {
        await tx
          .update(planningStatus)
          .set(planningUpdates)
          .where(and(eq(planningStatus.urlId, keyword.urlId), eq(planningStatus.tenantId, tenant)));
      }
    }

    // Update keyword priority score
    if (updates.Priority_Score !== undefined) {
      await tx
        .update(urlKeywords)
        .set({ priorityScore: String(updates.Priority_Score) })
        .where(and(eq(urlKeywords.id, keywordId), eq(urlKeywords.tenantId, tenant)));
    }

    // Handle editor assignments
    if (updates.Assigned_Editor !== undefined) {
      await tx.delete(urlKeywordEditors).where(eq(urlKeywordEditors.keywordId, keywordId));

      if (updates.Assigned_Editor.length > 0) {
        await tx.insert(urlKeywordEditors).values(
          updates.Assigned_Editor.map((userId) => ({
            keywordId,
            userId,
          }))
        );
      }
    }

    // Handle execution status updates
    if (updates.Status === 'Beauftragt' || updates.Status === 'In Arbeit' || updates.Status === 'Angeliefert') {
      // These are handled by execution cycles, not directly updatable
    }

    // Handle publishing
    if (updates.Status === 'Published' && updates.Last_Published) {
      // Find active cycle and mark as published
      const [cycle] = await tx
        .select({ id: executionCycles.id })
        .from(executionCycles)
        .where(
          and(
            eq(executionCycles.urlId, keyword.urlId),
            eq(executionCycles.tenantId, tenant),
            eq(executionCycles.status, 'delivered')
          )
        )
        .orderBy(desc(executionCycles.cycleNumber))
        .limit(1);

      if (cycle) {
        await tx
          .update(publishingStatus)
          .set({
            status: 'published',
            publishedAt: new Date(updates.Last_Published),
          })
          .where(and(eq(publishingStatus.cycleId, cycle.id), eq(publishingStatus.tenantId, tenant)));
      }
    }
  });
}

export async function deleteKeyword(keywordId: string, tenantId?: string): Promise<void> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    await tx.delete(urlKeywords).where(and(eq(urlKeywords.id, keywordId), eq(urlKeywords.tenantId, tenant)));
  });
}

// ---------------------------------------------------------------------------
// Content Log Operations (mapped from execution_versions + process_events)
// ---------------------------------------------------------------------------
export async function getContentLogs(tenantId?: string, limit?: number): Promise<ContentLog[]> {
  const tenant = tid(tenantId);
  const maxRows = limit ?? 200;

  return withTenant(tenant, async (tx) => {
    const events = await tx
      .select({
        event: processEvents,
        url: urls,
        cycle: executionCycles,
        version: executionVersions,
      })
      .from(processEvents)
      .leftJoin(urls, eq(urls.id, processEvents.urlId))
      .leftJoin(executionCycles, eq(executionCycles.id, processEvents.cycleId))
      .leftJoin(executionVersions, eq(executionVersions.id, processEvents.versionId))
      .where(eq(processEvents.tenantId, tenant))
      .orderBy(desc(processEvents.eventTimestamp))
      .limit(maxRows);

    return events.map(({ event, url, cycle, version }) => ({
      id: String(event.id),
      ID: event.id,
      Keyword_ID: event.keywordId ? [event.keywordId] : undefined,
      Target_URL: url?.url,
      Logged_URL: url?.url,
      Action_Type: cycle?.actionType ? mapToOldActionType(cycle.actionType) as any : undefined,
      Page_Type: url?.pageType as any,
      Version: version?.contentHtml ? 'v2' : 'v1',
      Content_Body: undefined, // Not loaded in list view
      Event_Label: (event.eventData as any)?.original_event_label || event.eventType,
      Created_At: event.eventTimestamp.toISOString(),
      Updated_At: event.eventTimestamp.toISOString(),
      Editor: event.userId ? [event.userId] : undefined,
      Commission_Log_Id: cycle?.id,
    }));
  });
}

export async function getContentLogBody(logId: number, tenantId?: string): Promise<{ contentBody: string | null; eventLabel: string | null } | null> {
  const tenant = tid(tenantId);
  
  return withTenant(tenant, async (tx) => {
    const [event] = await tx
      .select({
        version: executionVersions,
        event: processEvents,
      })
      .from(processEvents)
      .leftJoin(executionVersions, eq(executionVersions.id, processEvents.versionId))
      .where(and(eq(processEvents.id, logId), eq(processEvents.tenantId, tenant)))
      .limit(1);

    if (!event) return null;

    return {
      contentBody: event.version?.contentHtml ?? null,
      eventLabel: (event.event.eventData as any)?.original_event_label || event.event.eventType,
    };
  });
}

export async function createContentLog(
  data: {
    Keyword_ID?: string[];
    Target_URL?: string;
    Action_Type?: 'Planung' | 'Erstellung' | 'Optimierung' | 'KI-Chat';
    Page_Type?: string;
    Content_Body?: string;
    Event_Label?: string;
    Editor?: string[];
    Commission_Log_Id?: number;
  },
  tenantId?: string
): Promise<ContentLog | null> {
  const tenant = tid(tenantId);

  return withTenant(tenant, async (tx) => {
    let urlId: string | undefined;
    
    if (data.Target_URL) {
      urlId = await ensureUrl(data.Target_URL, data.Page_Type, tenant, tx);
    }

    const eventType: any = data.Event_Label?.includes('beauftragt')
      ? 'cycle_commissioned'
      : data.Event_Label?.includes('angeliefert')
      ? 'cycle_delivered'
      : data.Event_Label?.includes('veröffentlicht')
      ? 'content_published'
      : 'version_created';

    const [event] = await tx
      .insert(processEvents)
      .values({
        tenantId: tenant,
        eventType,
        urlId,
        keywordId: data.Keyword_ID?.[0],
        cycleId: data.Commission_Log_Id,
        userId: data.Editor?.[0],
        eventData: {
          original_event_label: data.Event_Label,
          action_type: data.Action_Type,
          page_type: data.Page_Type,
        },
      })
      .returning();

    return {
      id: String(event.id),
      ID: event.id,
      Keyword_ID: data.Keyword_ID,
      Target_URL: data.Target_URL,
      Logged_URL: data.Target_URL,
      Action_Type: data.Action_Type,
      Page_Type: data.Page_Type as any,
      Version: data.Content_Body ? 'v2' : 'v1',
      Content_Body: data.Content_Body,
      Event_Label: data.Event_Label,
      Created_At: event.eventTimestamp.toISOString(),
      Updated_At: event.eventTimestamp.toISOString(),
      Editor: data.Editor,
      Commission_Log_Id: data.Commission_Log_Id,
    };
  });
}

// ---------------------------------------------------------------------------
// Blacklist Operations
// ---------------------------------------------------------------------------
export async function getBlacklist(tenantId?: string): Promise<BlacklistEntry[]> {
  const tenant = tid(tenantId);
  
  return withTenant(tenant, async (tx) => {
    const keywords = await tx
      .select()
      .from(blacklistedKeywords)
      .where(eq(blacklistedKeywords.tenantId, tenant));

    const urlBlacklist = await tx
      .select({
        blacklist: blacklistedUrls,
        url: urls,
      })
      .from(blacklistedUrls)
      .innerJoin(urls, eq(urls.id, blacklistedUrls.urlId))
      .where(eq(blacklistedUrls.tenantId, tenant));

    return [
      ...keywords.map(k => ({
        id: k.id,
        Type: 'Keyword' as const,
        Keyword: k.keyword,
        Target_URL: null,
        Reason: k.reason ?? undefined,
        Added_At: k.addedAt.toISOString(),
      })),
      ...urlBlacklist.map(({ blacklist: b, url }) => ({
        id: b.id,
        Type: 'URL' as const,
        Keyword: null,
        Target_URL: url.url,
        Reason: b.reason ?? undefined,
        Added_At: b.addedAt.toISOString(),
      })),
    ];
  });
}

export async function addToBlacklist(
  type: 'Keyword' | 'URL',
  value: string,
  reason: string | undefined,
  tenantId?: string
): Promise<void> {
  const tenant = tid(tenantId);
  
  return withTenant(tenant, async (tx) => {
    if (type === 'Keyword') {
      await tx.insert(blacklistedKeywords).values({
        tenantId: tenant,
        keyword: value,
        reason,
      });
    } else {
      const urlId = await ensureUrl(value, undefined, tenant, tx);
      await tx.insert(blacklistedUrls).values({
        tenantId: tenant,
        urlId,
        reason,
      });
    }

    await tx.insert(processEvents).values({
      tenantId: tenant,
      eventType: 'url_blacklisted',
      eventData: { type, value, reason },
    });
  });
}

export async function removeFromBlacklist(id: number, type: 'Keyword' | 'URL', tenantId?: string): Promise<void> {
  const tenant = tid(tenantId);
  
  return withTenant(tenant, async (tx) => {
    if (type === 'Keyword') {
      await tx.delete(blacklistedKeywords).where(and(eq(blacklistedKeywords.id, id), eq(blacklistedKeywords.tenantId, tenant)));
    } else {
      await tx.delete(blacklistedUrls).where(and(eq(blacklistedUrls.id, id), eq(blacklistedUrls.tenantId, tenant)));
    }

    await tx.insert(processEvents).values({
      tenantId: tenant,
      eventType: 'url_unblacklisted',
      eventData: { id, type },
    });
  });
}

// ---------------------------------------------------------------------------
// Config Operations (unchanged)
// ---------------------------------------------------------------------------
export async function getConfig(key: string, tenantId?: string): Promise<string | null> {
  const tenant = tid(tenantId);
  const cached = _configCacheByTenant.get(tenant);
  const now = Date.now();

  if (cached && now - cached.at < CONFIG_CACHE_TTL_MS) {
    return cached.data[key] ?? null;
  }

  return withTenant(tenant, async (tx) => {
    const rows = await tx.select().from(configTable).where(eq(configTable.tenantId, tenant));
    const data: Record<string, string> = {};
    for (const r of rows) {
      if (r.value) data[r.key] = r.value;
    }
    _configCacheByTenant.set(tenant, { data, at: now });
    return data[key] ?? null;
  });
}

export async function setConfig(key: string, value: string, tenantId?: string): Promise<void> {
  const tenant = tid(tenantId);
  invalidateConfigCache(tenant);

  return withTenant(tenant, async (tx) => {
    await tx
      .insert(configTable)
      .values({ tenantId: tenant, key, value })
      .onConflictDoUpdate({
        target: [configTable.tenantId, configTable.key],
        set: { value, updatedAt: new Date() },
      });
  });
}

// ---------------------------------------------------------------------------
// Audit Logs (unchanged)
// ---------------------------------------------------------------------------
export async function createAuditLog(action: string, userId: string | null, payload: any, tenantId?: string): Promise<void> {
  const tenant = tid(tenantId);
  
  return withTenant(tenant, async (tx) => {
    await tx.insert(auditLogsTable).values({
      tenantId: tenant,
      action,
      userId,
      rawPayload: payload,
    });
  });
}

// ---------------------------------------------------------------------------
// Users (unchanged)
// ---------------------------------------------------------------------------
export async function getUsers(tenantId?: string): Promise<UserRecord[]> {
  const tenant = tid(tenantId);
  
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.tenantId, tenant));

    return rows.map(r => ({
      id: r.id,
      Name: r.name ?? undefined,
      Email: r.email,
      Role: r.role,
      Password: r.password ?? undefined,
      Password_Changed: r.passwordChanged ?? false,
      Is_Active: r.isActive,
    }));
  });
}

// Re-export functions from legacy that are not yet migrated
export {
  bulkDeleteKeywords,
  bulkCreateKeywords,
  bulkUpdateKeywordRankings,
  getAllContentHistory,
  getContentHistoryByUrl,
  getContentHistoryByUrlOrKeywords,
  getContentHistoryByKeyword,
  getPerformanceData,
  getPerformanceDataByUrl,
  getURLPerformanceHistory,
  upsertURLPerformance,
  upsertPerformanceData,
  getKeywordRankingHistory,
  getExistingRankingDates,
  upsertKeywordRankingHistory,
  updateBlacklist,
  deleteFromBlacklist,
  bulkDeleteFromBlacklist,
  getCostConfigs,
  createCostConfig,
  updateCostConfig,
  deleteCostConfig,
  updateConfig,
  getSyncCursor,
  setSyncCursor,
  getUserByEmail,
  countUsers,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getAuditLogs,
  purgeOldAuditLogs,
  purgeOldPerformanceData,
  getPotentialTrends,
  createTrend,
} from './postgres-legacy';

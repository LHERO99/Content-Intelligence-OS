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
  urlPerformance,
  costConfig as costConfigTable,
  config as configTable,
  auditLogs as auditLogsTable,
  users as usersTable,
  tenants as tenantsTable,
  urlCostSummary,
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
  // An active planning intent (user clicked "Hinzufügen") always wins over any
  // stale execution-cycle relict from a previous Erstellung/Optimierung cycle.
  if (planning?.status === 'planned') return 'Planned';
  // Explicit publish (user clicked "Als veröffentlicht markieren") wins over a
  // stale 'delivered' execution cycle — even if publishingStatus row is missing.
  if (planning?.status === 'published') return 'Published';
  // Active production states
  if (execution?.status === 'commissioned') return 'Beauftragt';
  if (execution?.status === 'in_progress') return 'In Arbeit';
  // Only treat 'delivered' as Angeliefert when the publishing step has not yet
  // been completed.  Once publishingStatus = 'published', this cycle is terminal.
  if (execution?.status === 'delivered' && publishing?.status !== 'published') return 'Angeliefert';
  if (publishing?.status === 'in_review') return 'Review';
  if (publishing?.status === 'published') return 'Published';
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
      .leftJoin(planningStatus, and(eq(planningStatus.urlId, urls.id), eq(planningStatus.tenantId, tenant)))
      .leftJoin(
        executionCycles,
        and(
          eq(executionCycles.urlId, urls.id),
          eq(
            executionCycles.cycleNumber,
            tx
              .select({ max: sql<number>`COALESCE(MAX(${executionCycles.cycleNumber}), 0)` })
              .from(executionCycles)
              .where(and(eq(executionCycles.urlId, urls.id), eq(executionCycles.tenantId, tenant)))
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
      optimizationRequestedAt: planning?.optimizationRequestedAt?.toISOString(),
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
      .leftJoin(planningStatus, and(eq(planningStatus.urlId, urls.id), eq(planningStatus.tenantId, tenant)))
      .leftJoin(
        executionCycles,
        and(
          eq(executionCycles.urlId, urls.id),
          eq(
            executionCycles.cycleNumber,
            tx
              .select({ max: sql<number>`COALESCE(MAX(${executionCycles.cycleNumber}), 0)` })
              .from(executionCycles)
              .where(and(eq(executionCycles.urlId, urls.id), eq(executionCycles.tenantId, tenant)))
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
      .leftJoin(planningStatus, and(eq(planningStatus.urlId, urls.id), eq(planningStatus.tenantId, tenant)))
      .leftJoin(
        executionCycles,
        and(
          eq(executionCycles.urlId, urls.id),
          eq(
            executionCycles.cycleNumber,
            tx
              .select({ max: sql<number>`COALESCE(MAX(${executionCycles.cycleNumber}), 0)` })
              .from(executionCycles)
              .where(and(eq(executionCycles.urlId, urls.id), eq(executionCycles.tenantId, tenant)))
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

// ---------------------------------------------------------------------------
// Create/Update/Delete Keywords
// ---------------------------------------------------------------------------
async function ensureUrl(url: string, pageType: string | undefined, tenant: string, tx: any): Promise<string> {
  const normUrl = normalizeUrl(url);
  const existing = await tx
    .select({ id: urls.id, pageType: urls.pageType })
    .from(urls)
    .where(and(eq(urls.url, normUrl), eq(urls.tenantId, tenant)))
    .limit(1);

  if (existing.length > 0) {
    // Backfill pageType if the existing record has none but we now know it
    if (pageType && !existing[0].pageType) {
      await tx
        .update(urls)
        .set({ pageType: pageType as any })
        .where(eq(urls.id, existing[0].id));
    }
    return existing[0].id;
  }

  const [newUrl] = await tx
    .insert(urls)
    .values({
      tenantId: tenant,
      url: normUrl,
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

/**
 * Gets the URL ID for a given keyword ID.
 * Used to find which URL a keyword belongs to for execution cycle operations.
 */
export async function getUrlIdForKeyword(
  keywordId: string, 
  tenantId?: string
): Promise<string | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const [result] = await tx
      .select({ urlId: urlKeywords.urlId })
      .from(urlKeywords)
      .where(
        and(
          eq(urlKeywords.id, keywordId),
          eq(urlKeywords.tenantId, tenant)
        )
      )
      .limit(1);
    
    return result?.urlId ?? null;
  });
}

export async function getUrlIdForUrl(
  targetUrl: string,
  tenantId?: string
): Promise<string | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const normUrl = normalizeUrl(targetUrl);
    const [result] = await tx
      .select({ id: urls.id })
      .from(urls)
      .where(and(eq(urls.url, normUrl), eq(urls.tenantId, tenant)))
      .limit(1);
    return result?.id ?? null;
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
        else if (updates.Status === 'Planned') {
          planningUpdates.status = 'planned';
          // Clear optimization request when explicitly moved to editorial planning
          planningUpdates.optimizationRequestedAt = null;
        }
        else if (updates.Status === 'Published') {
          // Transition to 'published' state and clear workflow flags
          planningUpdates.status = 'published';
          planningUpdates.plannedActionType = null;
          planningUpdates.optimizationRequestedAt = null;
          if (updates.Last_Published) {
            planningUpdates.lastPublishedAt = new Date(updates.Last_Published);
          }
        }
      }
      
      if (updates.Editorial_Deadline !== undefined) {
        planningUpdates.editorialDeadline = updates.Editorial_Deadline || null;
      }
      
      if (updates.Priority_Score !== undefined) {
        planningUpdates.priorityScore = String(updates.Priority_Score);
      }
      
      if (updates.Action_Type) {
        planningUpdates.plannedActionType = mapFromOldActionType(updates.Action_Type);
        // Only set optimizationRequestedAt / status side-effects when no explicit
        // Status transition is being requested at the same time.  When Status is
        // also provided (e.g. "Planned" from AddToEditorialButton), that branch
        // already owns those fields — we must not overwrite them here.
        if (updates.Action_Type === 'Optimierung' && !updates.Status) {
          planningUpdates.optimizationRequestedAt = new Date();
          planningUpdates.status = 'backlog';
        }
      }

      if (Object.keys(planningUpdates).length > 0) {
        await tx
          .insert(planningStatus)
          .values({
            urlId: keyword.urlId,
            tenantId: tenant,
            ...planningUpdates,
          })
          .onConflictDoUpdate({
            target: [planningStatus.urlId, planningStatus.tenantId],
            set: planningUpdates,
          });
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

    // Handle publishing — upsert publishingStatus per-cycle and set lastPublishedCycleId
    if (updates.Status === 'Published' && updates.Last_Published) {
      // Find the latest delivered cycle to mark as published
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
        // Find latest version for this cycle (required FK for publishingStatus).
        // If none exists (e.g. n8n-delivered content without a version row),
        // create a minimal placeholder so publishingStatus can always be written.
        let versionId: number | null = null;
        const [latestVersion] = await tx
          .select({ id: executionVersions.id })
          .from(executionVersions)
          .where(and(eq(executionVersions.cycleId, cycle.id), eq(executionVersions.tenantId, tenant)))
          .orderBy(desc(executionVersions.versionNumber))
          .limit(1);

        if (latestVersion) {
          versionId = latestVersion.id;
        } else {
          // Create a minimal placeholder version so the publishingStatus FK is satisfied
          const [placeholder] = await tx
            .insert(executionVersions)
            .values({
              tenantId: tenant,
              cycleId: cycle.id,
              versionNumber: 1,
              createdByAi: false,
            })
            .returning({ id: executionVersions.id });
          versionId = placeholder?.id ?? null;
        }

        if (versionId) {
          // Upsert: handles both the case where a publishingStatus row already exists
          // and the case where none was ever created (e.g. n8n-delivered content)
          await tx
            .insert(publishingStatus)
            .values({
              tenantId: tenant,
              cycleId: cycle.id,
              versionId,
              status: 'published',
              publishedAt: new Date(updates.Last_Published),
            })
            .onConflictDoUpdate({
              target: [publishingStatus.cycleId, publishingStatus.tenantId],
              set: {
                status: 'published',
                publishedAt: new Date(updates.Last_Published),
              },
            });
        }

        // Record which cycle was last published at URL level
        await tx
          .update(planningStatus)
          .set({ lastPublishedCycleId: cycle.id })
          .where(and(eq(planningStatus.urlId, keyword.urlId), eq(planningStatus.tenantId, tenant)));
      }
    }
  });
}

/**
 * Creates a new execution cycle for a URL when commissioning content.
 * Automatically determines the next cycle number.
 * Returns the ID of the created cycle.
 */
export async function createExecutionCycle(
  urlId: string,
  actionType: 'Erstellung' | 'Optimierung',
  userId?: string,
  tenantId?: string
): Promise<number> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    // Get next cycle number for this URL
    const [result] = await tx
      .select({ 
        maxCycle: sql<number>`COALESCE(MAX(${executionCycles.cycleNumber}), 0)` 
      })
      .from(executionCycles)
      .where(
        and(
          eq(executionCycles.urlId, urlId),
          eq(executionCycles.tenantId, tenant)
        )
      );
    
    const nextCycleNumber = (result?.maxCycle ?? 0) + 1;
    const mappedActionType = mapFromOldActionType(actionType);
    
    // Create new execution cycle
    const [cycle] = await tx
      .insert(executionCycles)
      .values({
        tenantId: tenant,
        urlId,
        cycleNumber: nextCycleNumber,
        actionType: mappedActionType,
        status: 'commissioned',
        commissionedByUserId: userId || null,
        commissionedAt: new Date(),
      })
      .returning({ id: executionCycles.id });

    // Update planningStatus in one atomic write:
    //   - Reset 'planned' → 'backlog' so mapToOldStatus reaches the commissioned branch
    //   - Clear optimizationRequestedAt so the suggestions escape-hatch no longer fires
    //   - Store plannedActionType so the keyword list reflects the correct action type
    await tx
      .update(planningStatus)
      .set({
        status: sql`CASE WHEN ${planningStatus.status} = 'planned' THEN 'backlog'::planning_status_enum ELSE ${planningStatus.status} END`,
        plannedActionType: mappedActionType,
        optimizationRequestedAt: null,
      })
      .where(
        and(
          eq(planningStatus.urlId, urlId),
          eq(planningStatus.tenantId, tenant),
        )
      );
    
    return cycle.id;
  });
}

// ---------------------------------------------------------------------------
// Content Log Operations (mapped from execution_versions + process_events)
// ---------------------------------------------------------------------------

/**
 * Maps new schema event types (process_events.event_type) to old schema German event labels.
 * This ensures backward compatibility with components expecting German event labels.
 * 
 * @param eventType - The event type from the new schema (e.g., 'cycle_commissioned', 'url_planned')
 * @returns The corresponding German event label for the old schema
 */
function mapEventTypeToLabel(eventType: string): string {
  const mapping: Record<string, string> = {
    // Planning phase
    'url_suggested': 'URL wurde dem Tab \'Vorschläge\' hinzugefügt',
    'url_added_to_backlog': 'URL wurde dem Tool hinzugefügt',
    'url_planned': 'URL wurde der Redaktionsplanung hinzugefügt',
    'planning_cancelled': 'Planung abgebrochen',
    
    // Execution phase
    'cycle_commissioned': 'Content wurde beauftragt',
    'cycle_started': 'Content-Erstellung gestartet',
    'cycle_delivered': 'Content angeliefert',
    'cycle_failed': 'Content-Erstellung fehlgeschlagen',
    
    // Content version phase
    'version_created': 'Version erstellt',
    'version_edited': 'Inhalt bearbeitet',
    
    // Publishing phase
    'submitted_for_review': 'Zur Review eingereicht',
    'review_approved': 'Review genehmigt',
    'review_rejected': 'Review abgelehnt',
    'content_published': 'Content veröffentlicht',
    'content_unpublished': 'Content offline genommen',
    
    // Blacklist
    'url_blacklisted': 'URL auf Blacklist gesetzt',
    'url_unblacklisted': 'URL von Blacklist entfernt',
    
    // Keywords
    'keyword_added': 'Keyword hinzugefügt',
    'keyword_removed': 'Keyword entfernt',
  };
  
  return mapping[eventType] || eventType;
}

/**
 * Creates a content version in the execution_versions table.
 * Returns the version ID.
 */
export async function createExecutionVersion(
  cycleId: number,
  contentHtml: string,
  options?: {
    diffSummary?: string;
    createdByUserId?: string;
    createdByAi?: boolean;
    aiProvider?: string;
    aiModel?: string;
    aiInstructions?: string;
  },
  tenantId?: string
): Promise<number> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    // Get next version number for this cycle
    const [result] = await tx
      .select({ 
        maxVersion: sql<number>`COALESCE(MAX(${executionVersions.versionNumber}), 0)` 
      })
      .from(executionVersions)
      .where(
        and(
          eq(executionVersions.cycleId, cycleId),
          eq(executionVersions.tenantId, tenant)
        )
      );
    
    const nextVersionNumber = (result?.maxVersion ?? 0) + 1;
    
    // Create new version
    const [version] = await tx
      .insert(executionVersions)
      .values({
        tenantId: tenant,
        cycleId,
        versionNumber: nextVersionNumber,
        contentHtml,
        diffSummary: options?.diffSummary,
        createdByUserId: options?.createdByUserId || null,
        createdByAi: options?.createdByAi ?? true,
        aiProvider: options?.aiProvider,
        aiModel: options?.aiModel,
        aiInstructions: options?.aiInstructions,
      })
      .returning({ id: executionVersions.id });
    
    return version.id;
  });
}

export async function getContentLogs(tenantId?: string, limit?: number): Promise<ContentLog[]> {
  const tenant = tid(tenantId);
  const maxRows = limit ?? 5000;

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

    return events.map(({ event, url, cycle, version }) => {
      const commissionLogId = (event.eventData as any)?.commission_log_id ?? cycle?.id;
      const eventLabel = (event.eventData as any)?.original_event_label || mapEventTypeToLabel(event.eventType);
      
      return {
        id: String(event.id),
        ID: event.id,
        Keyword_ID: event.keywordId ? [event.keywordId] : undefined,
        Target_URL: url?.url,
        Logged_URL: url?.url,
        Action_Type: cycle?.actionType ? mapToOldActionType(cycle.actionType) as any : undefined,
        Page_Type: url?.pageType as any,
        Version: version?.contentHtml ? 'v2' : 'v1',
        Content_Body: undefined, // Not loaded in list view
        Event_Label: eventLabel,
        Created_At: event.eventTimestamp.toISOString(),
        Updated_At: event.eventTimestamp.toISOString(),
        Editor: event.userId ? [event.userId] : undefined,
        Commission_Log_Id: commissionLogId,
      };
    });
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
      eventLabel: (event.event.eventData as any)?.original_event_label || mapEventTypeToLabel(event.event.eventType),
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
    Commission_Log_Id?: number;  // Legacy: ID of commission event (for display mapping)
    Cycle_Id?: number;            // ID of execution cycle (for FK)
    Version_Id?: number;
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
        cycleId: data.Cycle_Id,  // Use Cycle_Id for FK constraint
        versionId: data.Version_Id,
        userId: data.Editor?.[0],
        eventData: {
          original_event_label: data.Event_Label,
          action_type: data.Action_Type,
          page_type: data.Page_Type,
          commission_log_id: data.Commission_Log_Id,  // Store commission event ID in eventData for mapping
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
// Config Operations
// ---------------------------------------------------------------------------
export async function getConfig(tenantId?: string): Promise<Record<string, string>>;
export async function getConfig(key: string, tenantId?: string): Promise<string | null>;
export async function getConfig(keyOrTenantId?: string, tenantId?: string): Promise<Record<string, string> | string | null> {
  // Overload resolution: if second param is provided, first is key
  const isKeyQuery = tenantId !== undefined;
  const tenant = tid(isKeyQuery ? tenantId : keyOrTenantId);
  const key = isKeyQuery ? keyOrTenantId : undefined;
  
  const cached = _configCacheByTenant.get(tenant);
  const now = Date.now();

  if (cached && now - cached.at < CONFIG_CACHE_TTL_MS) {
    return key ? (cached.data[key] ?? null) : cached.data;
  }

  return withTenant(tenant, async (tx) => {
    const rows = await tx.select().from(configTable).where(eq(configTable.tenantId, tenant));
    const data: Record<string, string> = {};
    for (const r of rows) {
      if (r.value) data[r.key] = r.value;
    }
    _configCacheByTenant.set(tenant, { data, at: now });
    return key ? (data[key] ?? null) : data;
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
// Audit Logs
// ---------------------------------------------------------------------------
export async function createAuditLog(action: string, payload: any, tenantId?: string): Promise<void> {
  const tenant = tid(tenantId);
  
  return withTenant(tenant, async (tx) => {
    await tx.insert(auditLogsTable).values({
      tenantId: tenant,
      action,
      userId: null,
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

// ---------------------------------------------------------------------------
// Stub implementations for functions not yet fully migrated
// ---------------------------------------------------------------------------
export async function deleteKeyword(id: string, tenantId?: string): Promise<boolean> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    await tx.delete(urlKeywords).where(and(eq(urlKeywords.id, id), eq(urlKeywords.tenantId, tenant)));
    return true;
  });
}

export async function bulkDeleteKeywords(ids: string[], tenantId?: string): Promise<boolean> {
  const tenant = tid(tenantId);
  if (!ids.length) return true;
  return withTenant(tenant, async (tx) => {
    await tx.delete(urlKeywords).where(and(inArray(urlKeywords.id, ids), eq(urlKeywords.tenantId, tenant)));
    return true;
  });
}

export async function bulkCreateKeywords(
  keywords: Partial<KeywordMap>[],
  tenantId?: string
): Promise<{ created: KeywordMap[]; skipped: SkippedKeyword[] }> {
  const created: KeywordMap[] = [];
  const skipped: SkippedKeyword[] = [];
  
  for (const kw of keywords) {
    try {
      if (!kw.Keyword || !kw.Target_URL) {
        skipped.push({ ...kw, reason: 'Keyword und Target_URL sind Pflichtfelder.' });
        continue;
      }
      
      const id = await createKeyword({
        keyword: kw.Keyword,
        targetUrl: kw.Target_URL,
        searchVolume: kw.Search_Volume,
        difficulty: kw.Difficulty,
        mainKeyword: kw.Main_Keyword || 'N',
        pageType: kw.Page_Type,
        priorityScore: kw.Priority_Score,
        articleCount: kw.Article_Count,
        avgProductValue: kw.Avg_Product_Value,
        policy: kw.Policy,
        ranking: kw.Ranking,
        actionType: kw.Action_Type,
      }, tenantId);
      
      const keyword = await getKeyword(id, tenantId);
      if (keyword) created.push(keyword);
    } catch (err: any) {
      skipped.push({ ...kw, reason: err.message ?? 'Unknown error' });
    }
  }
  
  return { created, skipped };
}

export async function getAllContentHistory(tenantId?: string): Promise<ContentLog[]> {
  return getContentLogs(tenantId);
}

export async function getContentHistoryByUrl(targetUrl: string, tenantId?: string): Promise<ContentLog[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const normUrl = normalizeUrl(targetUrl);
    const [urlRecord] = await tx
      .select({ id: urls.id })
      .from(urls)
      .where(and(eq(urls.url, normUrl), eq(urls.tenantId, tenant)))
      .limit(1);

    if (!urlRecord) return [];

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
      .where(and(eq(processEvents.urlId, urlRecord.id), eq(processEvents.tenantId, tenant)))
      .orderBy(desc(processEvents.eventTimestamp));

    return events.map(({ event, url, cycle, version }) => ({
      id: String(event.id),
      ID: event.id,
      Keyword_ID: event.keywordId ? [event.keywordId] : undefined,
      Target_URL: url?.url,
      Logged_URL: url?.url,
      Action_Type: cycle?.actionType ? mapToOldActionType(cycle.actionType) as any : undefined,
      Page_Type: url?.pageType as any,
      Version: version?.contentHtml ? 'v2' : 'v1',
      Event_Label: (event.eventData as any)?.original_event_label || mapEventTypeToLabel(event.eventType),
      Created_At: event.eventTimestamp.toISOString(),
      Updated_At: event.eventTimestamp.toISOString(),
      Editor: event.userId ? [event.userId] : undefined,
      Commission_Log_Id: cycle?.id,
    }));
  });
}

export async function getContentHistoryByUrlOrKeywords(
  urlOrKeywords: string | string[],
  keywordIds: string[] | undefined,
  tenantId?: string
): Promise<ContentLog[]> {
  if (typeof urlOrKeywords === 'string') {
    // Primary: URL-based lookup (finds events where urlId is set correctly)
    const urlResults = await getContentHistoryByUrl(urlOrKeywords, tenantId);

    // Always also fetch by keyword IDs and merge — this catches events that were
    // stored with urlId = null (e.g. callbacks that couldn't resolve the URL) but
    // DO have a keywordId. Deduplicate by event ID so nothing appears twice.
    if (keywordIds && keywordIds.length > 0) {
      const kwResults = await getContentHistoryByUrlOrKeywords(keywordIds, keywordIds, tenantId);
      const seen = new Set(urlResults.map(e => e.id));
      const merged = [...urlResults, ...kwResults.filter(e => !seen.has(e.id))];
      merged.sort((a, b) => new Date(b.Created_At).getTime() - new Date(a.Created_At).getTime());
      return merged;
    }

    return urlResults;
  }
  
  const tenant = tid(tenantId);
  const keywordIdsToQuery = keywordIds ?? (Array.isArray(urlOrKeywords) ? urlOrKeywords : []);
  
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
      .where(and(
        eq(processEvents.tenantId, tenant),
        keywordIdsToQuery.length > 0 ? inArray(processEvents.keywordId, keywordIdsToQuery.filter(Boolean) as string[]) : sql`1=1`
      ))
      .orderBy(desc(processEvents.eventTimestamp));

    return events.map(({ event, url, cycle, version }) => ({
      id: String(event.id),
      ID: event.id,
      Keyword_ID: event.keywordId ? [event.keywordId] : undefined,
      Target_URL: url?.url,
      Logged_URL: url?.url,
      Action_Type: cycle?.actionType ? mapToOldActionType(cycle.actionType) as any : undefined,
      Page_Type: url?.pageType as any,
      Version: version?.contentHtml ? 'v2' : 'v1',
      Event_Label: (event.eventData as any)?.original_event_label || mapEventTypeToLabel(event.eventType),
      Created_At: event.eventTimestamp.toISOString(),
      Updated_At: event.eventTimestamp.toISOString(),
      Editor: event.userId ? [event.userId] : undefined,
      Commission_Log_Id: cycle?.id,
    }));
  });
}

export async function getContentHistoryByKeyword(keywordId: string, tenantId?: string): Promise<ContentLog[]> {
  return getContentHistoryByUrlOrKeywords([keywordId], [keywordId], tenantId);
}

export async function bulkUpdateKeywordRankings(): Promise<void> { }

/**
 * Normalise a URL for consistent storage and lookup.
 * Strips trailing slash, lowercases scheme+host, preserves path casing.
 * e.g. "HTTPS://www.Example.com/Ratgeber/" → "https://www.example.com/Ratgeber"
 */
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    // Lowercase scheme and host, keep path/search/hash as-is
    const normalised = `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '') || '/'}${u.search}${u.hash}`;
    // Remove trailing slash unless it's the root "/"
    return normalised.endsWith('/') && normalised !== `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}/`
      ? normalised.slice(0, -1)
      : normalised;
  } catch {
    // Not a valid absolute URL — return trimmed original
    return raw.trim().replace(/\/+$/, '');
  }
}

export async function getPerformanceData(tenantId?: string, dayRange: number = 90): Promise<PerformanceData[]> {
  const tenant = tid(tenantId);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dayRange);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select()
      .from(urlPerformance)
      .where(and(eq(urlPerformance.tenantId, tenant), gte(urlPerformance.date, cutoffDate)))
      .orderBy(desc(urlPerformance.date));

    return rows.map((r, i) => ({
      id: String(r.id),
      ID: r.id,
      Target_URL: r.targetUrl,
      Date: r.date,
      GSC_Clicks: r.gscClicks ?? undefined,
      GSC_Impressions: r.gscImpressions ?? undefined,
      Position: r.position ? Number(r.position) : undefined,
      Sistrix_VI: r.sistrixVi ? Number(r.sistrixVi) : undefined,
    }));
  });
}

export async function getPerformanceDataByUrl(targetUrl: string, tenantId?: string, dayRange: number = 365): Promise<PerformanceData[]> {
  const tenant = tid(tenantId);
  const normUrl = normalizeUrl(targetUrl);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dayRange);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select()
      .from(urlPerformance)
      .where(and(
        eq(urlPerformance.tenantId, tenant),
        eq(urlPerformance.targetUrl, normUrl),
        gte(urlPerformance.date, cutoffDate)
      ))
      .orderBy(desc(urlPerformance.date));

    return rows.map(r => ({
      id: String(r.id),
      ID: r.id,
      Target_URL: r.targetUrl,
      Date: r.date,
      GSC_Clicks: r.gscClicks ?? undefined,
      GSC_Impressions: r.gscImpressions ?? undefined,
      Position: r.position ? Number(r.position) : undefined,
      Sistrix_VI: r.sistrixVi ? Number(r.sistrixVi) : undefined,
    }));
  });
}

export async function getURLPerformanceHistory(targetUrl: string, tenantId?: string, dayRange: number = 365): Promise<URLPerformance[]> {
  const tenant = tid(tenantId);
  const normUrl = normalizeUrl(targetUrl);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dayRange);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select()
      .from(urlPerformance)
      .where(and(
        eq(urlPerformance.tenantId, tenant),
        eq(urlPerformance.targetUrl, normUrl),
        gte(urlPerformance.date, cutoffDate)
      ))
      .orderBy(asc(urlPerformance.date));

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
export async function upsertURLPerformance(records: any[], tenantId?: string): Promise<{ errors: any[] }> { 
  const tenant = tid(tenantId);
  const errors: any[] = [];
  
  await withTenant(tenant, async (tx) => {
    for (const record of records) {
      try {
        await tx.insert(urlPerformance).values({
          tenantId: tenant,
          targetUrl: normalizeUrl(record.Target_URL),
          date: record.Date,
          gscClicks: record.GSC_Clicks,
          gscImpressions: record.GSC_Impressions,
          position: record.Position ? String(record.Position) : null,
          sistrixVi: record.Sistrix_VI ? String(record.Sistrix_VI) : null,
        }).onConflictDoUpdate({
          target: [urlPerformance.targetUrl, urlPerformance.date, urlPerformance.tenantId],
          set: {
            gscClicks: record.GSC_Clicks,
            gscImpressions: record.GSC_Impressions,
            position: record.Position ? String(record.Position) : null,
            sistrixVi: record.Sistrix_VI ? String(record.Sistrix_VI) : null,
          },
        });
      } catch (err) {
        errors.push({ record, error: err });
      }
    }
  });
  
  return { errors };
}
export async function upsertPerformanceData(records: any[], tenantId?: string): Promise<{ created: number; updated: number; errors: any[] }> { 
  const result = await upsertURLPerformance(records, tenantId);
  return {
    created: records.length - result.errors.length,
    updated: 0,
    errors: result.errors,
  };
}
export async function getKeywordRankingHistory(keywordIds: string[], tenantId?: string): Promise<KeywordRankingHistory[]> { 
  const tenant = tid(tenantId);
  if (!keywordIds.length) return [];
  
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select()
      .from(keywordRankings)
      .where(and(
        inArray(keywordRankings.keywordId, keywordIds),
        eq(keywordRankings.tenantId, tenant)
      ))
      .orderBy(desc(keywordRankings.date));
    
    return rows.map(r => ({
      id: r.id,
      Keyword_ID: r.keywordId,
      Date: r.date,
      Ranking: r.ranking ?? undefined,
    }));
  });
}
export async function getExistingRankingDates(keywordIds: string[], weekDate: string, tenantId?: string): Promise<Set<string>> { 
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select({ keywordId: keywordRankings.keywordId, date: keywordRankings.date })
      .from(keywordRankings)
      .where(and(
        inArray(keywordRankings.keywordId, keywordIds),
        eq(keywordRankings.date, weekDate),
        eq(keywordRankings.tenantId, tenant)
      ));
    
    return new Set(rows.map(r => r.keywordId));
  });
}
export async function upsertKeywordRankingHistory(rankings: any[], tenantId?: string): Promise<{ errors: any[] }> { 
  const tenant = tid(tenantId);
  const errors: any[] = [];
  if (!rankings.length) return { errors };
  
  await withTenant(tenant, async (tx) => {
    for (const ranking of rankings) {
      try {
        await tx.insert(keywordRankings).values({
          tenantId: tenant,
          keywordId: Array.isArray(ranking.Keyword_ID) ? ranking.Keyword_ID[0] : ranking.Keyword_ID,
          date: ranking.Date,
          ranking: ranking.Ranking,
        }).onConflictDoUpdate({
          target: [keywordRankings.keywordId, keywordRankings.date, keywordRankings.tenantId],
          set: { ranking: ranking.Ranking },
        });
      } catch (err) {
        errors.push({ ranking, error: err });
      }
    }
  });
  
  return { errors };
}
export async function updateBlacklist(id: number, updates: any, tenantId?: string): Promise<BlacklistEntry | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    // Try keyword blacklist first
    if (updates.Reason !== undefined || updates.reason !== undefined) {
      const reason = updates.Reason ?? updates.reason;
      const kwRows = await tx
        .update(blacklistedKeywords)
        .set({ reason })
        .where(and(eq(blacklistedKeywords.id, id), eq(blacklistedKeywords.tenantId, tenant)))
        .returning();
      if (kwRows.length > 0) {
        const r = kwRows[0];
        return { id: r.id, Type: 'Keyword' as const, Keyword: r.keyword, Target_URL: null, Reason: r.reason ?? undefined, Added_At: r.addedAt.toISOString() };
      }
      const urlRows = await tx
        .update(blacklistedUrls)
        .set({ reason })
        .where(and(eq(blacklistedUrls.id, id), eq(blacklistedUrls.tenantId, tenant)))
        .returning();
      if (urlRows.length > 0) {
        const b = urlRows[0];
        const urlRow = await tx.select().from(urls).where(eq(urls.id, b.urlId)).limit(1);
        return { id: b.id, Type: 'URL' as const, Keyword: null, Target_URL: urlRow[0]?.url ?? null, Reason: b.reason ?? undefined, Added_At: b.addedAt.toISOString() };
      }
    }
    return null;
  });
}
export async function deleteFromBlacklist(id: number, tenantId?: string): Promise<boolean> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    // Try both tables
    await tx.delete(blacklistedKeywords).where(and(eq(blacklistedKeywords.id, id), eq(blacklistedKeywords.tenantId, tenant)));
    await tx.delete(blacklistedUrls).where(and(eq(blacklistedUrls.id, id), eq(blacklistedUrls.tenantId, tenant)));
    return true;
  });
}
export async function bulkDeleteFromBlacklist(ids: number[], tenantId?: string): Promise<boolean> {
  for (const id of ids) {
    await deleteFromBlacklist(id, tenantId);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Cost Summary (materialized cache — updated on every delivery event)
// ---------------------------------------------------------------------------

/**
 * Recomputes the cost summary for a single URL and upserts it into
 * url_cost_summary. Called after every cycle_delivered / content_published
 * event so the monitoring routes never need to do a full event scan.
 *
 * Mirrors the deduplication logic in the monitoring routes:
 *   - Dedup key = cycle ID (Commission_Log_Id) if present, else calendar day
 *   - Positional fallback: first delivery = Erstellung, rest = Optimierung
 */
export async function recomputeUrlCostSummary(
  urlId: string,
  tenantId?: string
): Promise<void> {
  const tenant = tid(tenantId);

  await withTenant(tenant, async (tx) => {
    // 1. Load all delivery events for this URL
    const deliveryEvents = await tx
      .select({
        event: processEvents,
        cycle: executionCycles,
        url: urls,
      })
      .from(processEvents)
      .leftJoin(executionCycles, eq(executionCycles.id, processEvents.cycleId))
      .leftJoin(urls, eq(urls.id, processEvents.urlId))
      .where(
        and(
          eq(processEvents.urlId, urlId),
          eq(processEvents.tenantId, tenant),
          inArray(processEvents.eventType, ['cycle_delivered', 'content_published'])
        )
      )
      .orderBy(asc(processEvents.eventTimestamp));

    if (deliveryEvents.length === 0) return;

    // 2. Load cost configs for this tenant
    const costs = await tx
      .select()
      .from(costConfigTable)
      .where(eq(costConfigTable.tenantId, tenant));

    const urlRecord = deliveryEvents[0].url;
    const rawPageType = urlRecord?.pageType ?? '';

    const inferPageType = (pt: string): string => {
      if (pt) return pt;
      const u = urlRecord?.url?.toLowerCase() ?? '';
      if (u.includes('/ratgeber/')) return 'Ratgeber';
      if (u.includes('/kategorie/')) return 'Kategorie';
      if (u.includes('/marke/')) return 'Marke';
      if (u.includes('/produkt/')) return 'Produkt';
      return 'Kategorie';
    };

    // 3. Deduplicate: one entry per cycle, fall back to day for legacy events
    const seenKeys = new Set<string>();
    const dedupedEvents: typeof deliveryEvents = [];
    for (const row of deliveryEvents) {
      const key = row.event.cycleId
        ? `cycle:${row.event.cycleId}`
        : `day:${row.event.eventTimestamp.toISOString().split('T')[0]}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        dedupedEvents.push(row);
      }
    }

    // 4. Calculate totals
    let totalAgency = 0;
    let totalOverhead = 0;
    let erstellungCount = 0;
    let optimierungCount = 0;
    let lastDeliveryAt: Date | null = null;

    dedupedEvents.forEach((row, index) => {
      const cycleActionType = row.cycle?.actionType
        ? mapToOldActionType(row.cycle.actionType)
        : undefined;
      const eventDataActionType = (row.event.eventData as any)?.action_type as string | undefined;
      const actionType: string =
        cycleActionType ?? eventDataActionType ?? (index === 0 ? 'Erstellung' : 'Optimierung');

      const pageType = inferPageType(rawPageType);

      const cost = costs.find(
        (c) =>
          String(c.pageType ?? '').toLowerCase() === pageType.toLowerCase() &&
          String(c.actionType ?? '').toLowerCase() === actionType.toLowerCase()
      );

      if (cost) {
        totalAgency += Number(cost.agencyCost ?? 0);
        totalOverhead += Number(cost.overheadCost ?? 0);
      }

      if (actionType.toLowerCase() === 'optimierung') {
        optimierungCount++;
      } else {
        erstellungCount++;
      }

      const ts = row.event.eventTimestamp;
      if (!lastDeliveryAt || ts > lastDeliveryAt) lastDeliveryAt = ts;
    });

    // 5. Upsert into url_cost_summary
    await tx
      .insert(urlCostSummary)
      .values({
        tenantId: tenant,
        urlId,
        totalAgencyCost: String(totalAgency),
        totalOverheadCost: String(totalOverhead),
        erstellungCount,
        optimierungCount,
        lastDeliveryAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [urlCostSummary.urlId, urlCostSummary.tenantId],
        set: {
          totalAgencyCost: String(totalAgency),
          totalOverheadCost: String(totalOverhead),
          erstellungCount,
          optimierungCount,
          lastDeliveryAt,
          updatedAt: new Date(),
        },
      });
  });
}

/**
 * Fetch the precomputed cost summary for a single URL.
 * Returns null if no summary exists yet (URL never had a delivery).
 */
export async function getUrlCostSummary(
  urlId: string,
  tenantId?: string
): Promise<{
  totalAgencyCost: number;
  totalOverheadCost: number;
  erstellungCount: number;
  optimierungCount: number;
  lastDeliveryAt: Date | null;
} | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const [row] = await tx
      .select()
      .from(urlCostSummary)
      .where(
        and(eq(urlCostSummary.urlId, urlId), eq(urlCostSummary.tenantId, tenant))
      )
      .limit(1);
    if (!row) return null;
    return {
      totalAgencyCost: Number(row.totalAgencyCost),
      totalOverheadCost: Number(row.totalOverheadCost),
      erstellungCount: row.erstellungCount,
      optimierungCount: row.optimierungCount,
      lastDeliveryAt: row.lastDeliveryAt,
    };
  });
}

/**
 * Fetch cost summaries for all URLs of a tenant in one query.
 * Returns a map: url (string) → summary (includes pageType for count aggregation).
 */
export async function getAllUrlCostSummaries(
  tenantId?: string
): Promise<
  Map<
    string,
    {
      totalAgencyCost: number;
      totalOverheadCost: number;
      erstellungCount: number;
      optimierungCount: number;
      pageType: string;
    }
  >
> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select({
        summary: urlCostSummary,
        url: urls,
      })
      .from(urlCostSummary)
      .leftJoin(urls, eq(urls.id, urlCostSummary.urlId))
      .where(eq(urlCostSummary.tenantId, tenant));

    const map = new Map<
      string,
      {
        totalAgencyCost: number;
        totalOverheadCost: number;
        erstellungCount: number;
        optimierungCount: number;
        pageType: string;
      }
    >();
    for (const row of rows) {
      const urlStr = row.url?.url;
      if (!urlStr) continue;
      map.set(urlStr, {
        totalAgencyCost: Number(row.summary.totalAgencyCost),
        totalOverheadCost: Number(row.summary.totalOverheadCost),
        erstellungCount: row.summary.erstellungCount,
        optimierungCount: row.summary.optimierungCount,
        pageType: row.url?.pageType ?? '',
      });
    }
    return map;
  });
}

export async function getCostConfigs(tenantId?: string): Promise<CostConfig[]> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const rows = await tx.select().from(costConfigTable).where(eq(costConfigTable.tenantId, tenant));
    return rows.map(r => ({
      id: r.id,
      Page_Type: r.pageType as any,
      Action_Type: r.actionType === 'Erstellung' ? 'Erstellung' : 'Optimierung',
      Agency_Cost: Number(r.agencyCost),
      Overhead_Cost: Number(r.overheadCost),
    }));
  });
}
export async function createCostConfig(config: any, tenantId?: string): Promise<CostConfig | null> { 
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const [row] = await tx.insert(costConfigTable).values({
      tenantId: tenant,
      pageType: config.Page_Type,
      actionType: config.Action_Type,
      agencyCost: String(config.Agency_Cost ?? 0),
      overheadCost: String(config.Overhead_Cost ?? 0),
    }).returning();
    
    return {
      id: row.id,
      Page_Type: row.pageType as any,
      Action_Type: row.actionType as any,
      Agency_Cost: Number(row.agencyCost),
      Overhead_Cost: Number(row.overheadCost),
    };
  });
}
export async function updateCostConfig(id: number, config: any, tenantId?: string): Promise<CostConfig | null> { 
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const [row] = await tx.update(costConfigTable)
      .set({
        pageType: config.Page_Type,
        actionType: config.Action_Type,
        agencyCost: config.Agency_Cost !== undefined ? String(config.Agency_Cost) : undefined,
        overheadCost: config.Overhead_Cost !== undefined ? String(config.Overhead_Cost) : undefined,
      })
      .where(and(eq(costConfigTable.id, id), eq(costConfigTable.tenantId, tenant)))
      .returning();
    
    if (!row) return null;
    
    return {
      id: row.id,
      Page_Type: row.pageType as any,
      Action_Type: row.actionType as any,
      Agency_Cost: Number(row.agencyCost),
      Overhead_Cost: Number(row.overheadCost),
    };
  });
}
export async function deleteCostConfig(id: number, tenantId?: string): Promise<boolean> { 
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    await tx.delete(costConfigTable).where(and(eq(costConfigTable.id, id), eq(costConfigTable.tenantId, tenant)));
    return true;
  });
}
export async function updateConfig(key: string, value: string, fileUrl?: string, tenantId?: string): Promise<any> {
  await setConfig(key, value, tenantId);
  return { key, value };
}
export async function getSyncCursor(key: string, tenantId?: string): Promise<number> {
  const val = await getConfig(key, tenantId);
  return val ? parseInt(val, 10) : 0;
}
export async function setSyncCursor(key: string, value: number, tenantId?: string): Promise<void> {
  await setConfig(key, String(value), tenantId);
}
export async function getUserByEmail(email: string, tenantId?: string): Promise<UserRecord | null> {
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const [user] = await tx
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.email, email), eq(usersTable.tenantId, tenant)))
      .limit(1);
    
    if (!user) return null;
    
    return {
      id: user.id,
      Name: user.name ?? undefined,
      Email: user.email,
      Role: user.role,
      Password: user.password ?? undefined,
      Password_Changed: user.passwordChanged ?? false,
      Is_Active: user.isActive,
      TenantId: user.tenantId,
    };
  });
}
export async function countUsers(tenantId?: string): Promise<number> {
  const users = await getUsers(tenantId);
  return users.length;
}
export async function getAllUsers(tenantId?: string): Promise<UserRecord[]> {
  return getUsers(tenantId);
}
export async function createUser(userData: any, tenantId?: string): Promise<UserRecord | null> { 
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const id = crypto.randomUUID();
    const [user] = await tx.insert(usersTable).values({
      id,
      tenantId: tenant,
      name: userData.Name,
      email: userData.Email,
      role: userData.Role || 'Editor',
      password: userData.Password,
      passwordChanged: userData.Password_Changed ?? false,
      isActive: userData.Is_Active ?? true,
    }).returning();
    
    return {
      id: user.id,
      Name: user.name ?? undefined,
      Email: user.email,
      Role: user.role,
      Password: user.password ?? undefined,
      Password_Changed: user.passwordChanged ?? false,
      Is_Active: user.isActive,
    };
  });
}
export async function updateUser(id: string, userData: any, tenantId?: string): Promise<UserRecord | null> { 
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const updates: any = {};
    if (userData.Name !== undefined) updates.name = userData.Name;
    if (userData.Email !== undefined) updates.email = userData.Email;
    if (userData.Role !== undefined) updates.role = userData.Role;
    if (userData.Password !== undefined) updates.password = userData.Password;
    if (userData.Password_Changed !== undefined) updates.passwordChanged = userData.Password_Changed;
    if (userData.Is_Active !== undefined) updates.isActive = userData.Is_Active;
    
    const [user] = await tx.update(usersTable)
      .set(updates)
      .where(and(eq(usersTable.id, id), eq(usersTable.tenantId, tenant)))
      .returning();
    
    if (!user) return null;
    
    return {
      id: user.id,
      Name: user.name ?? undefined,
      Email: user.email,
      Role: user.role,
      Password: user.password ?? undefined,
      Password_Changed: user.passwordChanged ?? false,
      Is_Active: user.isActive,
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
      id: r.id,
      ID: r.id,
      Action: r.action,
      Timestamp: r.timestamp.toISOString(),
      User_ID: r.userId ? [r.userId] : undefined,
      Raw_Payload: r.rawPayload as any,
    }));
  });
}
export async function purgeOldAuditLogs(retainDays: number = 180, tenantId?: string): Promise<number> { 
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retainDays);
    
    const deleted = await tx.delete(auditLogsTable)
      .where(and(
        eq(auditLogsTable.tenantId, tenant),
        lt(auditLogsTable.timestamp, cutoffDate)
      ));
    
    return 0; // Drizzle doesn't return count, return 0 for now
  });
}
export async function purgeOldPerformanceData(retainDays: number = 400, tenantId?: string): Promise<number> { 
  const tenant = tid(tenantId);
  return withTenant(tenant, async (tx) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retainDays);
    
    await tx.delete(urlPerformance)
      .where(and(
        eq(urlPerformance.tenantId, tenant),
        lt(urlPerformance.date, cutoffDate.toISOString().split('T')[0])
      ));
    
    return 0;
  });
}
export async function getPotentialTrends(tenantId?: string): Promise<PotentialTrend[]> { return []; }
export async function createTrend(trend: any, tenantId?: string): Promise<PotentialTrend | null> { return null; }

/**
 * db-adapter.ts
 * -------------
 * Adapter layer that provides backwards-compatible API using new schema.
 * This allows gradual migration without breaking existing code.
 */

import 'server-only';
import { eq, and, or, desc, asc, inArray, sql, gte, lte, isNull, notExists } from 'drizzle-orm';
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
} from './db/schema';

import type {
  KeywordStatus,
  KeywordMap,
} from './postgres-types';

// ===========================================================================
// MAPPING FUNCTIONS: New Schema → Old API Format
// ===========================================================================

function mapNewToOldStatus(
  planning: typeof planningStatus.$inferSelect | null,
  execution: typeof executionCycles.$inferSelect | null,
  publishing: typeof publishingStatus.$inferSelect | null
): KeywordStatus {
  // Map new statuses back to old format
  if (publishing?.status === 'published') return 'Published';
  if (publishing?.status === 'in_review') return 'Review';
  if (execution?.status === 'delivered') return 'Angeliefert';
  if (execution?.status === 'in_progress') return 'In Arbeit';
  if (execution?.status === 'commissioned') return 'Beauftragt';
  if (planning?.status === 'planned') return 'Planned';
  return 'Backlog';
}

function mapNewToOldActionType(actionType: 'creation' | 'optimization' | null): 'Erstellung' | 'Optimierung' {
  if (actionType === 'optimization') return 'Optimierung';
  return 'Erstellung';
}

function toIsoDate(d: string | Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const str = typeof d === 'string' ? d : d.toISOString();
  return str.split('T')[0];
}

export async function getKeywordMapFromNewSchema(tenantId: string): Promise<KeywordMap[]> {
  return withTenant(tenantId, async (tx) => {
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
          // Get latest cycle
          eq(
            executionCycles.cycleNumber,
            tx
              .select({ max: sql<number>`MAX(${executionCycles.cycleNumber})` })
              .from(executionCycles)
              .where(eq(executionCycles.urlId, urls.id))
          )
        )
      )
      .leftJoin(publishingStatus, eq(publishingStatus.cycleId, executionCycles.id))
      .where(
        and(
          eq(urlKeywords.tenantId, tenantId),
          // Not blacklisted
          notExists(
            tx
              .select({ one: sql`1` })
              .from(blacklistedKeywords)
              .where(
                and(
                  eq(blacklistedKeywords.tenantId, tenantId),
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
                  eq(blacklistedUrls.tenantId, tenantId),
                  eq(blacklistedUrls.urlId, urls.id)
                )
              )
          )
        )
      );

    // Get editor assignments
    const editorMap = new Map<string, string[]>();
    const editorRows = await tx
      .select({
        keywordId: urlKeywordEditors.keywordId,
        userId: urlKeywordEditors.userId,
      })
      .from(urlKeywordEditors)
      .where(inArray(urlKeywordEditors.keywordId, rows.map(r => r.keyword.id)));

    for (const { keywordId, userId } of editorRows) {
      if (!editorMap.has(keywordId)) editorMap.set(keywordId, []);
      editorMap.get(keywordId)!.push(userId);
    }

    return rows.map(({ keyword: kw, url, planning, cycle, publishing }) => ({
      id: kw.id,
      Keyword: kw.keyword,
      Target_URL: url.url,
      Search_Volume: kw.searchVolume ?? undefined,
      Difficulty: kw.difficulty ?? undefined,
      Status: mapNewToOldStatus(planning, cycle, publishing),
      Editorial_Deadline: toIsoDate(planning?.editorialDeadline),
      Assigned_Editor: editorMap.get(kw.id),
      Main_Keyword: kw.isMainKeyword ? 'Y' : 'N',
      Article_Count: kw.articleCount ?? undefined,
      Avg_Product_Value: kw.avgProductValue ? Number(kw.avgProductValue) : undefined,
      Policy: kw.policy ? Number(kw.policy) : undefined,
      Priority_Score: kw.priorityScore ? Number(kw.priorityScore) : undefined,
      Ranking: kw.ranking ?? undefined,
      Action_Type: mapNewToOldActionType(planning?.plannedActionType ?? cycle?.actionType ?? null),
      Page_Type: url.pageType as any,
      Last_Published: toIsoDate(publishing?.publishedAt),
    }));
  });
}

// ===========================================================================
// HELPER FUNCTIONS: Create/Update operations with new schema
// ===========================================================================

export async function ensureUrl(url: string, tenantId: string, pageType?: string): Promise<string> {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx
      .select({ id: urls.id })
      .from(urls)
      .where(and(eq(urls.url, url), eq(urls.tenantId, tenantId)))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    const [newUrl] = await tx
      .insert(urls)
      .values({
        tenantId,
        url,
        pageType: pageType as any,
      })
      .returning({ id: urls.id });

    // Create default planning status
    await tx.insert(planningStatus).values({
      tenantId,
      urlId: newUrl.id,
      status: 'backlog',
    });

    return newUrl.id;
  });
}

export async function createKeywordWithNewSchema(
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
  },
  tenantId: string
): Promise<string> {
  return withTenant(tenantId, async (tx) => {
    const urlId = await ensureUrl(data.targetUrl, tenantId, data.pageType);

    const [newKeyword] = await tx
      .insert(urlKeywords)
      .values({
        tenantId,
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

    // Log event
    await tx.insert(processEvents).values({
      tenantId,
      eventType: 'keyword_added',
      urlId,
      keywordId: newKeyword.id,
      eventData: { keyword: data.keyword, url: data.targetUrl },
    });

    return newKeyword.id;
  });
}

export async function updateKeywordWithNewSchema(
  keywordId: string,
  updates: {
    status?: KeywordStatus;
    editorialDeadline?: string;
    priorityScore?: number;
    assignedEditor?: string[];
  },
  tenantId: string
): Promise<void> {
  return withTenant(tenantId, async (tx) => {
    // Get keyword to find URL
    const [keyword] = await tx
      .select({ urlId: urlKeywords.urlId })
      .from(urlKeywords)
      .where(and(eq(urlKeywords.id, keywordId), eq(urlKeywords.tenantId, tenantId)))
      .limit(1);

    if (!keyword) throw new Error('Keyword not found');

    // Update planning status if needed
    if (updates.status || updates.editorialDeadline !== undefined || updates.priorityScore !== undefined) {
      const newPlanningStatus = updates.status
        ? (updates.status === 'Planned' ? 'planned' : updates.status === 'Backlog' ? 'backlog' : 'planned')
        : undefined;

      await tx
        .update(planningStatus)
        .set({
          status: newPlanningStatus,
          editorialDeadline: updates.editorialDeadline,
          priorityScore: updates.priorityScore ? String(updates.priorityScore) : undefined,
        })
        .where(and(eq(planningStatus.urlId, keyword.urlId), eq(planningStatus.tenantId, tenantId)));
    }

    // Update keyword data
    if (updates.priorityScore !== undefined) {
      await tx
        .update(urlKeywords)
        .set({ priorityScore: String(updates.priorityScore) })
        .where(and(eq(urlKeywords.id, keywordId), eq(urlKeywords.tenantId, tenantId)));
    }

    // Handle editor assignments
    if (updates.assignedEditor) {
      await tx
        .delete(urlKeywordEditors)
        .where(eq(urlKeywordEditors.keywordId, keywordId));

      if (updates.assignedEditor.length > 0) {
        await tx.insert(urlKeywordEditors).values(
          updates.assignedEditor.map((userId) => ({
            keywordId,
            userId,
          }))
        );
      }
    }
  });
}

export async function commissionCycle(
  urlId: string,
  actionType: 'creation' | 'optimization',
  commissionedByUserId: string,
  tenantId: string,
  agentRunId?: string
): Promise<number> {
  return withTenant(tenantId, async (tx) => {
    // Get next cycle number
    const lastCycle = await tx
      .select({ cycleNumber: executionCycles.cycleNumber })
      .from(executionCycles)
      .where(and(eq(executionCycles.urlId, urlId), eq(executionCycles.tenantId, tenantId)))
      .orderBy(desc(executionCycles.cycleNumber))
      .limit(1);

    const nextCycleNumber = lastCycle.length > 0 ? lastCycle[0].cycleNumber + 1 : 1;

    const [cycle] = await tx
      .insert(executionCycles)
      .values({
        tenantId,
        urlId,
        cycleNumber: nextCycleNumber,
        actionType,
        status: 'commissioned',
        commissionedByUserId,
        agentRunId,
      })
      .returning({ id: executionCycles.id });

    // Log event
    await tx.insert(processEvents).values({
      tenantId,
      eventType: 'cycle_commissioned',
      urlId,
      cycleId: cycle.id,
      userId: commissionedByUserId,
      eventData: { actionType, agentRunId, cycleNumber: nextCycleNumber },
    });

    return cycle.id;
  });
}

export async function deliverVersion(
  cycleId: number,
  contentHtml: string,
  tenantId: string,
  diffSummary?: string,
  createdByUserId?: string
): Promise<number> {
  return withTenant(tenantId, async (tx) => {
    // Get next version number
    const lastVersion = await tx
      .select({ versionNumber: executionVersions.versionNumber })
      .from(executionVersions)
      .where(and(eq(executionVersions.cycleId, cycleId), eq(executionVersions.tenantId, tenantId)))
      .orderBy(desc(executionVersions.versionNumber))
      .limit(1);

    const nextVersionNumber = lastVersion.length > 0 ? lastVersion[0].versionNumber + 1 : 1;

    const [version] = await tx
      .insert(executionVersions)
      .values({
        tenantId,
        cycleId,
        versionNumber: nextVersionNumber,
        contentHtml,
        diffSummary,
        createdByUserId,
        createdByAi: !createdByUserId,
      })
      .returning({ id: executionVersions.id });

    // Update cycle status
    await tx
      .update(executionCycles)
      .set({ status: 'delivered', deliveredAt: new Date() })
      .where(and(eq(executionCycles.id, cycleId), eq(executionCycles.tenantId, tenantId)));

    // Create or update publishing status
    const existingPublishing = await tx
      .select({ id: publishingStatus.id })
      .from(publishingStatus)
      .where(and(eq(publishingStatus.cycleId, cycleId), eq(publishingStatus.tenantId, tenantId)))
      .limit(1);

    if (existingPublishing.length === 0) {
      await tx.insert(publishingStatus).values({
        tenantId,
        cycleId,
        versionId: version.id,
        status: 'approved',
      });
    } else {
      await tx
        .update(publishingStatus)
        .set({ versionId: version.id })
        .where(and(eq(publishingStatus.cycleId, cycleId), eq(publishingStatus.tenantId, tenantId)));
    }

    // Log event
    const [cycle] = await tx
      .select({ urlId: executionCycles.urlId })
      .from(executionCycles)
      .where(eq(executionCycles.id, cycleId))
      .limit(1);

    await tx.insert(processEvents).values({
      tenantId,
      eventType: 'cycle_delivered',
      urlId: cycle.urlId,
      cycleId,
      versionId: version.id,
      userId: createdByUserId,
      eventData: { versionNumber: nextVersionNumber },
    });

    return version.id;
  });
}

export async function publishContent(
  cycleId: number,
  versionId: number,
  publishedByUserId: string,
  tenantId: string
): Promise<void> {
  return withTenant(tenantId, async (tx) => {
    await tx
      .update(publishingStatus)
      .set({
        status: 'published',
        publishedAt: new Date(),
        publishedByUserId,
      })
      .where(and(eq(publishingStatus.cycleId, cycleId), eq(publishingStatus.tenantId, tenantId)));

    // Fetch the cycle to get the urlId
    const [cycle] = await tx
      .select({ urlId: executionCycles.urlId })
      .from(executionCycles)
      .where(eq(executionCycles.id, cycleId))
      .limit(1);

    // Reset planningStatus to 'published' and clear all workflow flags
    if (cycle) {
      await tx
        .update(planningStatus)
        .set({
          status: 'published',
          plannedActionType: null,
          optimizationRequestedAt: null,
          lastPublishedAt: new Date(),
          lastPublishedCycleId: cycleId,
        })
        .where(and(eq(planningStatus.urlId, cycle.urlId), eq(planningStatus.tenantId, tenantId)));
    }

    // Log event
    await tx.insert(processEvents).values({
      tenantId,
      eventType: 'content_published',
      urlId: cycle.urlId,
      cycleId,
      versionId,
      userId: publishedByUserId,
    });
  });
}

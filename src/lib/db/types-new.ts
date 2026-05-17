// TypeScript types for new database schema
// Auto-generated types from Drizzle schema

import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import * as schema from './schema-new';

// ============================================================================
// ENUMS
// ============================================================================

export type PlanningStatusEnum = 'suggested' | 'backlog' | 'planned' | 'cancelled';
export type ExecutionStatusEnum = 'commissioned' | 'in_progress' | 'delivered' | 'failed' | 'cancelled';
export type PublishingStatusEnum = 'draft' | 'in_review' | 'approved' | 'published' | 'unpublished';
export type ActionTypeEnum = 'creation' | 'optimization';
export type EventTypeEnum =
  | 'url_suggested'
  | 'url_added_to_backlog'
  | 'url_planned'
  | 'planning_cancelled'
  | 'cycle_commissioned'
  | 'cycle_started'
  | 'cycle_delivered'
  | 'cycle_failed'
  | 'version_created'
  | 'version_edited'
  | 'submitted_for_review'
  | 'review_approved'
  | 'review_rejected'
  | 'content_published'
  | 'content_unpublished'
  | 'url_blacklisted'
  | 'url_unblacklisted'
  | 'keyword_added'
  | 'keyword_removed';

export type PageType = 'Ratgeber' | 'Kategorie' | 'Marke' | 'Produkt';

// ============================================================================
// TABLE TYPES
// ============================================================================

export type Url = InferSelectModel<typeof schema.urls>;
export type NewUrl = InferInsertModel<typeof schema.urls>;

export type UrlKeyword = InferSelectModel<typeof schema.urlKeywords>;
export type NewUrlKeyword = InferInsertModel<typeof schema.urlKeywords>;

export type UrlKeywordEditor = InferSelectModel<typeof schema.urlKeywordEditors>;
export type NewUrlKeywordEditor = InferInsertModel<typeof schema.urlKeywordEditors>;

export type PlanningStatus = InferSelectModel<typeof schema.planningStatus>;
export type NewPlanningStatus = InferInsertModel<typeof schema.planningStatus>;

export type ExecutionCycle = InferSelectModel<typeof schema.executionCycles>;
export type NewExecutionCycle = InferInsertModel<typeof schema.executionCycles>;

export type ExecutionVersion = InferSelectModel<typeof schema.executionVersions>;
export type NewExecutionVersion = InferInsertModel<typeof schema.executionVersions>;

export type PublishingStatus = InferSelectModel<typeof schema.publishingStatus>;
export type NewPublishingStatus = InferInsertModel<typeof schema.publishingStatus>;

export type ProcessEvent = InferSelectModel<typeof schema.processEvents>;
export type NewProcessEvent = InferInsertModel<typeof schema.processEvents>;

export type KeywordRanking = InferSelectModel<typeof schema.keywordRankings>;
export type NewKeywordRanking = InferInsertModel<typeof schema.keywordRankings>;

export type UrlPerformance = InferSelectModel<typeof schema.urlPerformance>;
export type NewUrlPerformance = InferInsertModel<typeof schema.urlPerformance>;

export type BlacklistedKeyword = InferSelectModel<typeof schema.blacklistedKeywords>;
export type NewBlacklistedKeyword = InferInsertModel<typeof schema.blacklistedKeywords>;

export type BlacklistedUrl = InferSelectModel<typeof schema.blacklistedUrls>;
export type NewBlacklistedUrl = InferInsertModel<typeof schema.blacklistedUrls>;

// ============================================================================
// EXTENDED TYPES WITH RELATIONS
// ============================================================================

export interface UrlWithDetails extends Url {
  keywords: UrlKeyword[];
  mainKeyword?: UrlKeyword;
  planningStatus?: PlanningStatus;
  activeCycle?: ExecutionCycle;
  latestPublishedCycle?: ExecutionCycle & {
    publishingStatus: PublishingStatus;
    latestVersion: ExecutionVersion;
  };
}

export interface ExecutionCycleWithDetails extends ExecutionCycle {
  url: Url;
  versions: ExecutionVersion[];
  latestVersion?: ExecutionVersion;
  publishingStatus?: PublishingStatus;
}

export interface ExecutionVersionWithDetails extends ExecutionVersion {
  cycle: ExecutionCycle;
  createdByUser?: { id: string; name: string | null; email: string };
}

// ============================================================================
// DASHBOARD / UI TYPES
// ============================================================================

export interface UrlDashboard {
  urlId: string;
  url: string;
  pageType: PageType | null;
  tenantId: string;
  
  // Planning info
  planningStatus: PlanningStatusEnum | null;
  editorialDeadline: string | null;
  assignedEditorId: string | null;
  
  // Execution info
  activeCycleId: number | null;
  activeCycleNumber: number | null;
  executionStatus: ExecutionStatusEnum | null;
  commissionedAt: Date | null;
  
  // Publishing info
  publishingStatus: PublishingStatusEnum | null;
  publishedAt: Date | null;
  
  // Metrics
  keywordCount: number;
  versionCount: number;
}

export interface CycleTimeline {
  cycleId: number;
  cycleNumber: number;
  actionType: ActionTypeEnum;
  commissionedAt: Date;
  deliveredAt: Date | null;
  publishedAt: Date | null;
  versions: Array<{
    id: number;
    versionNumber: number;
    createdAt: Date;
    createdBy: string | null;
    isAiGenerated: boolean;
  }>;
  status: ExecutionStatusEnum;
  publishingStatus: PublishingStatusEnum | null;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface GetUrlsResponse {
  urls: UrlWithDetails[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface GetUrlDetailsResponse {
  url: UrlWithDetails;
  cycles: CycleTimeline[];
  events: ProcessEvent[];
  performance: UrlPerformance[];
}

export interface CommissionCycleRequest {
  urlId: string;
  actionType: ActionTypeEnum;
  commissionedByUserId: string;
  agentRunId?: string;
}

export interface CommissionCycleResponse {
  cycle: ExecutionCycle;
  cycleNumber: number;
  message: string;
}

export interface CreateVersionRequest {
  cycleId: number;
  contentHtml: string;
  diffSummary?: string;
  createdByUserId?: string;
  createdByAi?: boolean;
  aiProvider?: string;
  aiModel?: string;
  aiInstructions?: string;
}

export interface CreateVersionResponse {
  version: ExecutionVersion;
  versionNumber: number;
  message: string;
}

export interface PublishContentRequest {
  cycleId: number;
  versionId: number;
  publishedByUserId: string;
  reviewNotes?: string;
}

export interface PublishContentResponse {
  publishingStatus: PublishingStatus;
  message: string;
}

// ============================================================================
// FILTER/QUERY TYPES
// ============================================================================

export interface UrlFilters {
  tenantId: string;
  planningStatus?: PlanningStatusEnum[];
  executionStatus?: ExecutionStatusEnum[];
  publishingStatus?: PublishingStatusEnum[];
  pageType?: PageType[];
  assignedEditorId?: string;
  search?: string; // Search in URL or keywords
  hasActiveWorkflow?: boolean;
  deadlineBefore?: Date;
  deadlineAfter?: Date;
}

export interface ProcessEventFilters {
  tenantId: string;
  urlId?: string;
  cycleId?: number;
  eventType?: EventTypeEnum[];
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

// ============================================================================
// STATE MACHINE VALIDATORS
// ============================================================================

export const VALID_EXECUTION_TRANSITIONS: Record<ExecutionStatusEnum, ExecutionStatusEnum[]> = {
  commissioned: ['in_progress', 'failed', 'cancelled'],
  in_progress: ['delivered', 'failed', 'cancelled'],
  delivered: ['cancelled'], // Cannot regress
  failed: ['cancelled'], // Cannot restart
  cancelled: [], // Terminal
};

export const VALID_PUBLISHING_TRANSITIONS: Record<PublishingStatusEnum, PublishingStatusEnum[]> = {
  draft: ['in_review', 'approved', 'published'],
  in_review: ['approved', 'draft'], // Can reject back to draft
  approved: ['published', 'in_review'], // Can send back for review
  published: ['unpublished'],
  unpublished: ['in_review'], // Can republish after review
};

export const VALID_PLANNING_TRANSITIONS: Record<PlanningStatusEnum, PlanningStatusEnum[]> = {
  suggested: ['backlog', 'planned', 'cancelled'],
  backlog: ['planned', 'cancelled'],
  planned: ['cancelled', 'backlog'], // Can unplan
  cancelled: ['backlog'], // Can reactivate
};

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface StatusTransition<T extends string> {
  from: T;
  to: T;
  timestamp: Date;
  userId?: string;
  reason?: string;
}

export type ExecutionStatusTransition = StatusTransition<ExecutionStatusEnum>;
export type PublishingStatusTransition = StatusTransition<PublishingStatusEnum>;
export type PlanningStatusTransition = StatusTransition<PlanningStatusEnum>;

// ============================================================================
// MAPPING HELPERS (Old Schema → New Schema)
// ============================================================================

export const OLD_TO_NEW_STATUS_MAPPING: Record<string, {
  planning: PlanningStatusEnum | null;
  execution: ExecutionStatusEnum | null;
  publishing: PublishingStatusEnum | null;
}> = {
  'Backlog': { planning: 'backlog', execution: null, publishing: null },
  'Planned': { planning: 'planned', execution: null, publishing: null },
  'Beauftragt': { planning: 'planned', execution: 'commissioned', publishing: 'draft' },
  'In Arbeit': { planning: 'planned', execution: 'in_progress', publishing: 'draft' },
  'Angeliefert': { planning: 'planned', execution: 'delivered', publishing: 'approved' },
  'Review': { planning: 'planned', execution: 'delivered', publishing: 'in_review' },
  'Optimierung': { planning: 'planned', execution: 'delivered', publishing: 'in_review' },
  'Published': { planning: 'planned', execution: 'delivered', publishing: 'published' },
};

export const OLD_TO_NEW_ACTION_TYPE: Record<string, ActionTypeEnum> = {
  'Erstellung': 'creation',
  'Optimierung': 'optimization',
};

export const NEW_TO_OLD_ACTION_TYPE: Record<ActionTypeEnum, string> = {
  'creation': 'Erstellung',
  'optimization': 'Optimierung',
};

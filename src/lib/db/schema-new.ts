import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  serial,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Import existing tables that remain unchanged
export { tenants, users } from './schema';

// ---------------------------------------------------------------------------
// ENUMS for new schema
// ---------------------------------------------------------------------------

export const planningStatusEnum = pgEnum('planning_status_enum', [
  'suggested',
  'backlog',
  'planned',
  'cancelled',
]);

export const executionStatusEnum = pgEnum('execution_status_enum', [
  'commissioned',
  'in_progress',
  'delivered',
  'failed',
  'cancelled',
]);

export const publishingStatusEnum = pgEnum('publishing_status_enum', [
  'draft',
  'in_review',
  'approved',
  'published',
  'unpublished',
]);

export const actionTypeEnum = pgEnum('action_type_enum', [
  'creation',
  'optimization',
]);

export const eventTypeEnum = pgEnum('event_type_enum', [
  // Planning Events
  'url_suggested',
  'url_added_to_backlog',
  'url_planned',
  'planning_cancelled',
  
  // Execution Events
  'cycle_commissioned',
  'cycle_started',
  'cycle_delivered',
  'cycle_failed',
  'version_created',
  'version_edited',
  
  // Publishing Events
  'submitted_for_review',
  'review_approved',
  'review_rejected',
  'content_published',
  'content_unpublished',
  
  // Admin Events
  'url_blacklisted',
  'url_unblacklisted',
  'keyword_added',
  'keyword_removed',
]);

// ---------------------------------------------------------------------------
// urls - Main entity for URL-centric architecture
// ---------------------------------------------------------------------------
export const urls = pgTable(
  'urls',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    pageType: text('page_type').$type<'Ratgeber' | 'Kategorie' | 'Marke' | 'Produkt'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    urlTenantUnique: uniqueIndex('urls_url_tenant_idx').on(t.url, t.tenantId),
    tenantIdx: index('urls_tenant_idx').on(t.tenantId),
    pageTypeIdx: index('urls_page_type_idx').on(t.tenantId, t.pageType),
  })
);

// ---------------------------------------------------------------------------
// url_keywords - Keywords as attributes of URLs
// ---------------------------------------------------------------------------
export const urlKeywords = pgTable(
  'url_keywords',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    urlId: text('url_id').notNull().references(() => urls.id, { onDelete: 'cascade' }),
    keyword: text('keyword').notNull(),
    isMainKeyword: boolean('is_main_keyword').notNull().default(false),
    searchVolume: integer('search_volume'),
    difficulty: integer('difficulty'),
    ranking: integer('ranking'),
    priorityScore: numeric('priority_score'),
    articleCount: integer('article_count'),
    avgProductValue: numeric('avg_product_value'),
    policy: numeric('policy'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    keywordUrlTenantUnique: uniqueIndex('url_keywords_keyword_url_tenant_idx').on(
      t.keyword,
      t.urlId,
      t.tenantId
    ),
    tenantIdx: index('url_keywords_tenant_idx').on(t.tenantId),
    urlIdx: index('url_keywords_url_idx').on(t.urlId),
    mainKwIdx: index('url_keywords_main_kw_idx').on(t.tenantId, t.urlId, t.isMainKeyword),
    priorityIdx: index('url_keywords_priority_idx').on(t.tenantId, t.priorityScore),
  })
);

// ---------------------------------------------------------------------------
// url_keyword_editors - Junction table for keyword assignments
// ---------------------------------------------------------------------------
export const urlKeywordEditors = pgTable(
  'url_keyword_editors',
  {
    keywordId: text('keyword_id').notNull().references(() => urlKeywords.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.keywordId, t.userId] }),
    userIdx: index('url_keyword_editors_user_idx').on(t.userId),
  })
);

// ---------------------------------------------------------------------------
// planning_status - Planning workflow status
// ---------------------------------------------------------------------------
export const planningStatus = pgTable(
  'planning_status',
  {
    id: serial('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    urlId: text('url_id').notNull().references(() => urls.id, { onDelete: 'cascade' }),
    status: planningStatusEnum('status').notNull().default('backlog'),
    editorialDeadline: date('editorial_deadline'),
    priorityScore: numeric('priority_score'),
    plannedActionType: actionTypeEnum('planned_action_type'),
    assignedEditorId: text('assigned_editor_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    urlTenantUnique: uniqueIndex('planning_status_url_tenant_idx').on(t.urlId, t.tenantId),
    tenantIdx: index('planning_status_tenant_idx').on(t.tenantId),
    statusIdx: index('planning_status_status_idx').on(t.tenantId, t.status),
    deadlineIdx: index('planning_status_deadline_idx').on(t.tenantId, t.editorialDeadline),
    editorIdx: index('planning_status_editor_idx').on(t.assignedEditorId),
  })
);

// ---------------------------------------------------------------------------
// execution_cycles - Execution workflow with multi-cycle support
// ---------------------------------------------------------------------------
export const executionCycles = pgTable(
  'execution_cycles',
  {
    id: serial('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    urlId: text('url_id').notNull().references(() => urls.id, { onDelete: 'cascade' }),
    cycleNumber: integer('cycle_number').notNull(),
    actionType: actionTypeEnum('action_type').notNull(),
    status: executionStatusEnum('status').notNull().default('commissioned'),
    commissionedByUserId: text('commissioned_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    commissionedAt: timestamp('commissioned_at', { withTimezone: true }).defaultNow().notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    agentRunId: text('agent_run_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    urlCycleTenantUnique: uniqueIndex('execution_cycles_url_cycle_tenant_idx').on(
      t.urlId,
      t.cycleNumber,
      t.tenantId
    ),
    tenantIdx: index('execution_cycles_tenant_idx').on(t.tenantId),
    urlIdx: index('execution_cycles_url_idx').on(t.urlId),
    statusIdx: index('execution_cycles_status_idx').on(t.tenantId, t.status),
    commissionedAtIdx: index('execution_cycles_commissioned_at_idx').on(t.commissionedAt),
    activeIdx: index('execution_cycles_active_idx').on(t.tenantId, t.urlId, t.cycleNumber),
  })
);

// ---------------------------------------------------------------------------
// execution_versions - Content versions per cycle
// ---------------------------------------------------------------------------
export const executionVersions = pgTable(
  'execution_versions',
  {
    id: serial('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    cycleId: integer('cycle_id').notNull().references(() => executionCycles.id, {
      onDelete: 'cascade',
    }),
    versionNumber: integer('version_number').notNull(),
    contentHtml: text('content_html'),
    diffSummary: text('diff_summary'),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdByAi: boolean('created_by_ai').notNull().default(false),
    aiProvider: text('ai_provider'),
    aiModel: text('ai_model'),
    aiInstructions: text('ai_instructions'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    cycleVersionUnique: uniqueIndex('execution_versions_cycle_version_idx').on(
      t.cycleId,
      t.versionNumber
    ),
    cycleIdx: index('execution_versions_cycle_idx').on(t.cycleId),
    createdAtIdx: index('execution_versions_created_at_idx').on(t.createdAt),
  })
);

// ---------------------------------------------------------------------------
// publishing_status - Publishing workflow status
// ---------------------------------------------------------------------------
export const publishingStatus = pgTable(
  'publishing_status',
  {
    id: serial('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    cycleId: integer('cycle_id').notNull().references(() => executionCycles.id, {
      onDelete: 'cascade',
    }),
    versionId: integer('version_id').notNull().references(() => executionVersions.id, {
      onDelete: 'cascade',
    }),
    status: publishingStatusEnum('status').notNull().default('draft'),
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNotes: text('review_notes'),
    publishedByUserId: text('published_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    unpublishedByUserId: text('unpublished_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    unpublishedAt: timestamp('unpublished_at', { withTimezone: true }),
    unpublishReason: text('unpublish_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    cycleTenantUnique: uniqueIndex('publishing_status_cycle_tenant_idx').on(t.cycleId, t.tenantId),
    tenantIdx: index('publishing_status_tenant_idx').on(t.tenantId),
    statusIdx: index('publishing_status_status_idx').on(t.tenantId, t.status),
    publishedAtIdx: index('publishing_status_published_at_idx').on(t.publishedAt),
  })
);

// ---------------------------------------------------------------------------
// process_events - Structured event log
// ---------------------------------------------------------------------------
export const processEvents = pgTable(
  'process_events',
  {
    id: serial('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    eventType: eventTypeEnum('event_type').notNull(),

    // Polymorphic references
    urlId: text('url_id').references(() => urls.id, { onDelete: 'set null' }),
    keywordId: text('keyword_id').references(() => urlKeywords.id, { onDelete: 'set null' }),
    planningStatusId: integer('planning_status_id').references(() => planningStatus.id, {
      onDelete: 'set null',
    }),
    cycleId: integer('cycle_id').references(() => executionCycles.id, { onDelete: 'set null' }),
    versionId: integer('version_id').references(() => executionVersions.id, {
      onDelete: 'set null',
    }),
    publishingStatusId: integer('publishing_status_id').references(() => publishingStatus.id, {
      onDelete: 'set null',
    }),

    // Event metadata
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    eventData: jsonb('event_data'),
    eventTimestamp: timestamp('event_timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index('process_events_tenant_idx').on(t.tenantId),
    urlIdx: index('process_events_url_idx').on(t.urlId),
    cycleIdx: index('process_events_cycle_idx').on(t.cycleId),
    typeIdx: index('process_events_type_idx').on(t.eventType),
    timestampIdx: index('process_events_timestamp_idx').on(t.tenantId, t.eventTimestamp),
  })
);

// ---------------------------------------------------------------------------
// keyword_rankings - Historical keyword ranking data
// ---------------------------------------------------------------------------
export const keywordRankings = pgTable(
  'keyword_rankings',
  {
    id: serial('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    keywordId: text('keyword_id').notNull().references(() => urlKeywords.id, {
      onDelete: 'cascade',
    }),
    date: date('date').notNull(),
    ranking: integer('ranking'),
  },
  (t) => ({
    kwDateTenantUnique: uniqueIndex('keyword_rankings_kw_date_tenant_idx').on(
      t.keywordId,
      t.date,
      t.tenantId
    ),
    tenantIdx: index('keyword_rankings_tenant_idx').on(t.tenantId),
    dateIdx: index('keyword_rankings_date_idx').on(t.tenantId, t.date),
    kwDateCombined: index('keyword_rankings_kw_date_combined_idx').on(
      t.tenantId,
      t.keywordId,
      t.date
    ),
  })
);

// ---------------------------------------------------------------------------
// url_performance - Historical URL performance data
// ---------------------------------------------------------------------------
export const urlPerformance = pgTable(
  'url_performance',
  {
    id: serial('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    urlId: text('url_id').notNull().references(() => urls.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    gscClicks: integer('gsc_clicks'),
    gscImpressions: integer('gsc_impressions'),
    position: numeric('position'),
    sistrixVi: numeric('sistrix_vi'),
  },
  (t) => ({
    urlDateTenantUnique: uniqueIndex('url_performance_url_date_tenant_idx').on(
      t.urlId,
      t.date,
      t.tenantId
    ),
    tenantIdx: index('url_performance_tenant_idx').on(t.tenantId),
    dateIdx: index('url_performance_date_idx').on(t.tenantId, t.date),
    urlDateIdx: index('url_performance_url_date_combined_idx').on(t.tenantId, t.urlId, t.date),
  })
);

// ---------------------------------------------------------------------------
// blacklisted_keywords
// ---------------------------------------------------------------------------
export const blacklistedKeywords = pgTable(
  'blacklisted_keywords',
  {
    id: serial('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    keyword: text('keyword').notNull(),
    reason: text('reason'),
    addedByUserId: text('added_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    kwTenantUnique: uniqueIndex('blacklisted_keywords_kw_tenant_idx').on(t.keyword, t.tenantId),
    tenantIdx: index('blacklisted_keywords_tenant_idx').on(t.tenantId),
    kwLookupIdx: index('blacklisted_keywords_kw_lookup_idx').on(t.tenantId, t.keyword),
  })
);

// ---------------------------------------------------------------------------
// blacklisted_urls
// ---------------------------------------------------------------------------
export const blacklistedUrls = pgTable(
  'blacklisted_urls',
  {
    id: serial('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    urlId: text('url_id').notNull().references(() => urls.id, { onDelete: 'cascade' }),
    reason: text('reason'),
    addedByUserId: text('added_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    urlTenantUnique: uniqueIndex('blacklisted_urls_url_tenant_idx').on(t.urlId, t.tenantId),
    tenantIdx: index('blacklisted_urls_tenant_idx').on(t.tenantId),
    urlLookupIdx: index('blacklisted_urls_url_lookup_idx').on(t.tenantId, t.urlId),
  })
);

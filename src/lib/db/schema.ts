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
  primaryKey,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// tenants
// ---------------------------------------------------------------------------
export const tenants = pgTable('tenants', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = pgTable(
  'users',
  {
    id:              text('id').primaryKey(),
    tenantId:        text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    name:            text('name'),
    email:           text('email').notNull(),
    role:            text('role').$type<'SuperAdmin' | 'Admin' | 'Editor' | 'Viewer'>().notNull().default('Editor'),
    password:        text('password'),
    passwordChanged: boolean('password_changed').default(false),
    isActive:        boolean('is_active').notNull().default(true),
  },
  (t) => ({
    emailTenantUnique: uniqueIndex('users_email_tenant_idx').on(t.email, t.tenantId),
  })
);

// ===========================================================================
// NEW SCHEMA - URL-CENTRIC ARCHITECTURE
// ===========================================================================

// ---------------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------------

export const planningStatusEnum = pgEnum('planning_status_enum', [
  'suggested',
  'backlog',
  'planned',
  'published',
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
  'url_suggested',
  'url_added_to_backlog',
  'url_planned',
  'planning_cancelled',
  'cycle_commissioned',
  'cycle_started',
  'cycle_delivered',
  'cycle_failed',
  'version_created',
  'version_edited',
  'submitted_for_review',
  'review_approved',
  'review_rejected',
  'content_published',
  'content_unpublished',
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
    pageType: text('page_type').notNull().$type<'Ratgeber' | 'Kategorie' | 'Marke' | 'Produkt'>(),
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
    lastPublishedAt: timestamp('last_published_at', { withTimezone: true }),
    lastPublishedCycleId: integer('last_published_cycle_id').references(() => executionCycles.id, { onDelete: 'set null' }),
    optimizationRequestedAt: timestamp('optimization_requested_at', { withTimezone: true }),
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

// ---------------------------------------------------------------------------
// cost_config
// ---------------------------------------------------------------------------
export const costConfig = pgTable(
  'cost_config',
  {
    id:           serial('id').primaryKey(),
    tenantId:     text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    pageType:     text('page_type').$type<'Ratgeber' | 'Kategorie' | 'Marke' | 'Produkt'>().notNull(),
    actionType:   text('action_type').$type<'Erstellung' | 'Optimierung'>().notNull(),
    agencyCost:   numeric('agency_cost').notNull().default('0'),
    overheadCost: numeric('overhead_cost').notNull().default('0'),
  },
  (t) => ({
    tenantIdx:   index('cost_config_tenant_idx').on(t.tenantId),
    uniqueEntry: uniqueIndex('cost_config_tenant_page_action_uniq').on(t.tenantId, t.pageType, t.actionType),
  })
);

// ---------------------------------------------------------------------------
// config  (Key-Value store)
// ---------------------------------------------------------------------------
export const config = pgTable(
  'config',
  {
    tenantId:    text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    key:         text('key').notNull(),
    value:       text('value'),
    description: text('description'),
    fileUrl:     text('file_url'),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk:        primaryKey({ columns: [t.tenantId, t.key] }),
    tenantIdx: index('config_tenant_idx').on(t.tenantId),
  })
);

// ---------------------------------------------------------------------------
// pricing_tiers
// ---------------------------------------------------------------------------
export const pricingTiers = pgTable('pricing_tiers', {
  id:           text('id').primaryKey(),
  name:         text('name').notNull(),
  monthlyPrice: numeric('monthly_price').notNull().default('0'),
  yearlyPrice:  numeric('yearly_price').notNull().default('0'),
  features:     jsonb('features').$type<string[]>().default([]),
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// tenant_subscriptions
// ---------------------------------------------------------------------------
export const tenantSubscriptions = pgTable('tenant_subscriptions', {
  tenantId:     text('tenant_id').primaryKey().references(() => tenants.id, { onDelete: 'cascade' }),
  tierId:       text('tier_id').references(() => pricingTiers.id, { onDelete: 'set null' }),
  billingCycle: text('billing_cycle').$type<'monthly' | 'yearly'>().notNull().default('monthly'),
  startDate:    timestamp('start_date', { withTimezone: true }).defaultNow().notNull(),
  status:       text('status').$type<'active' | 'inactive' | 'trial'>().notNull().default('active'),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// feature_requests
// ---------------------------------------------------------------------------
export const featureRequests = pgTable(
  'feature_requests',
  {
    id:          text('id').primaryKey(),
    tenantId:    text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    userId:      text('user_id').references(() => users.id, { onDelete: 'set null' }),
    type:        text('type').$type<'feature' | 'bug'>().notNull().default('feature'),
    title:       text('title').notNull(),
    description: text('description'),
    status:      text('status')
      .$type<'Open' | 'InValidation' | 'Planned' | 'InDevelopment' | 'Released' | 'Cancelled'>()
      .notNull()
      .default('Open'),
    priority:    text('priority').$type<'low' | 'medium' | 'high'>().notNull().default('medium'),
    plannedQuarter: text('planned_quarter'), // Format: "Q1 2025", nullable — set by SuperAdmin only
    isPublic:    boolean('is_public').default(false).notNull(), // SuperAdmin kann Einträge für alle Tenants freischalten
    createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx:   index('feature_requests_tenant_idx').on(t.tenantId),
    statusIdx:   index('feature_requests_status_idx').on(t.status),
    typeIdx:     index('feature_requests_type_idx').on(t.type),
  })
);

// ---------------------------------------------------------------------------
// alert_rules
// ---------------------------------------------------------------------------
export const alertRules = pgTable(
  'alert_rules',
  {
    id:               text('id').primaryKey(),
    tenantId:         text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    name:             text('name').notNull(),
    // Unterstützte Metriken: 'gsc_clicks_drop' | 'keyword_rank_drop'
    metric:           text('metric').notNull(),
    // Operatoren: 'lt' (kleiner als), 'gt' (größer als), 'pct_drop' (prozentualer Abfall)
    operator:         text('operator').notNull(),
    threshold:        numeric('threshold').notNull(),
    // Beobachtungszeitraum in Tagen (Vergleich aktuell vs. vor N Tagen)
    windowDays:       integer('window_days').notNull().default(7),
    notifyEmails:     text('notify_emails').array().notNull().default([]),
    enabled:          boolean('enabled').notNull().default(true),
    // Cooldown-Schutz: kein erneuter Alert innerhalb von 24h
    lastTriggeredAt:  timestamp('last_triggered_at', { withTimezone: true }),
    createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:        timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx:   index('alert_rules_tenant_idx').on(t.tenantId),
    enabledIdx:  index('alert_rules_enabled_idx').on(t.tenantId, t.enabled),
  })
);

// ---------------------------------------------------------------------------
// password_reset_tokens
// ---------------------------------------------------------------------------
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    token:     text('token').primaryKey(),
    userId:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tenantId:  text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    used:      boolean('used').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx:   index('prt_user_idx').on(t.userId),
    tenantIdx: index('prt_tenant_idx').on(t.tenantId),
  })
);

// ---------------------------------------------------------------------------
// audit_logs
// ---------------------------------------------------------------------------
export const auditLogs = pgTable(
  'audit_logs',
  {
    id:         serial('id').primaryKey(),
    tenantId:   text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    action:     text('action').notNull(),
    timestamp:  timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
    userId:     text('user_id').references(() => users.id, { onDelete: 'set null' }),
    rawPayload: jsonb('raw_payload'),
  },
  (t) => ({
    tenantIdx:    index('audit_logs_tenant_idx').on(t.tenantId),
    // ── Performance: newest-first queries + prefix search (system health)
    timestampIdx: index('audit_logs_timestamp_idx').on(t.tenantId, t.timestamp),
    // ── Performance: action prefix search (cron health checks)
    actionIdx:    index('audit_logs_action_idx').on(t.tenantId, t.action),
  })
);

// ===========================================================================
// LEGACY TABLES (for backwards compatibility during migration)
// ===========================================================================

// Old url_performance table structure (still in use)
export const urlPerformance = pgTable(
  'url_performance',
  {
    id:             serial('id').primaryKey(),
    tenantId:       text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    targetUrl:      text('target_url').notNull(),
    date:           date('date').notNull(),
    gscClicks:      integer('gsc_clicks'),
    gscImpressions: integer('gsc_impressions'),
    position:       numeric('position'),
    sistrixVi:      numeric('sistrix_vi'),
  },
  (t) => ({
    urlDateUnique: uniqueIndex('url_performance_url_date_tenant_idx').on(t.targetUrl, t.date, t.tenantId),
    tenantIdx:     index('url_performance_tenant_idx').on(t.tenantId),
    dateIdx:       index('url_performance_date_idx').on(t.tenantId, t.date),
    urlDateIdx:    index('url_performance_url_date_combined_idx').on(t.tenantId, t.targetUrl, t.date),
  })
);

// ---------------------------------------------------------------------------
// sync_jobs — background sync job queue
// ---------------------------------------------------------------------------
export const syncJobs = pgTable(
  'sync_jobs',
  {
    id:          serial('id').primaryKey(),
    tenantId:    text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    status:      text('status').notNull().default('pending'), // pending | running | done | failed
    retryCount:  integer('retry_count').notNull().default(0),
    payload:     jsonb('payload').notNull(),
    result:      jsonb('result'),
    error:       text('error'),
    createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
    startedAt:   timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    tenantStatusIdx: index('sync_jobs_tenant_status_idx').on(t.tenantId, t.status, t.createdAt),
  })
);

// ---------------------------------------------------------------------------
// url_cost_summary  (materialized per-URL cost cache — updated on every delivery)
// ---------------------------------------------------------------------------
export const urlCostSummary = pgTable(
  'url_cost_summary',
  {
    id:                serial('id').primaryKey(),
    tenantId:          text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    urlId:             text('url_id').notNull().references(() => urls.id, { onDelete: 'cascade' }),
    totalAgencyCost:   numeric('total_agency_cost').notNull().default('0'),
    totalOverheadCost: numeric('total_overhead_cost').notNull().default('0'),
    erstellungCount:   integer('erstellung_count').notNull().default(0),
    optimierungCount:  integer('optimierung_count').notNull().default(0),
    lastDeliveryAt:    timestamp('last_delivery_at', { withTimezone: true }),
    updatedAt:         timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq:      uniqueIndex('url_cost_summary_url_tenant_uniq').on(t.urlId, t.tenantId),
    tenantIdx: index('url_cost_summary_tenant_idx').on(t.tenantId),
  })
);

// ===========================================================================
// AGENT WORKFLOW RUNS  (replaces JSON-blob storage in config table)
// ===========================================================================

// ---------------------------------------------------------------------------
// agent_workflow_runs — one row per agent run execution
// ---------------------------------------------------------------------------
export const agentWorkflowRuns = pgTable(
  'agent_workflow_runs',
  {
    id:               text('id').primaryKey(),
    tenantId:         text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    workflowId:       text('workflow_id').notNull(),
    workflowVersionId: text('workflow_version_id').notNull(),
    trigger:          text('trigger').notNull().default('manual'),
    // pending | running | success | failed | cancelled
    status:           text('status').notNull().default('pending'),
    idempotencyKey:   text('idempotency_key').notNull(),
    input:            jsonb('input'),
    output:           jsonb('output'),
    // Stored separately so SQL queries can filter/read without parsing JSONB
    finalHtml:        text('final_html'),
    // Set to true by cancel requests; the running loop polls this flag
    cancelRequested:  boolean('cancel_requested').notNull().default(false),
    deletedAt:        timestamp('deleted_at', { withTimezone: true }),
    startedAt:        timestamp('started_at', { withTimezone: true }).defaultNow(),
    finishedAt:       timestamp('finished_at', { withTimezone: true }),
    durationMs:       integer('duration_ms'),
    createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:        timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx:        index('awr_tenant_idx').on(t.tenantId),
    workflowIdx:      index('awr_workflow_idx').on(t.tenantId, t.workflowId),
    statusIdx:        index('awr_status_idx').on(t.tenantId, t.status),
    idempotencyIdx:   uniqueIndex('awr_idempotency_idx').on(t.tenantId, t.workflowVersionId, t.idempotencyKey),
    createdAtIdx:     index('awr_created_at_idx').on(t.tenantId, t.createdAt),
  })
);

// ---------------------------------------------------------------------------
// agent_run_steps — one row per individual LLM call within a run
// ---------------------------------------------------------------------------
export const agentRunSteps = pgTable(
  'agent_run_steps',
  {
    id:            text('id').primaryKey(),
    tenantId:      text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    runId:         text('run_id').notNull().references(() => agentWorkflowRuns.id, { onDelete: 'cascade' }),
    nodeId:        text('node_id').notNull(),
    nodeName:      text('node_name').notNull(),
    nodeType:      text('node_type').notNull(),
    provider:      text('provider').notNull(),
    model:         text('model').notNull(),
    attempt:       integer('attempt').notNull().default(1),
    // pending | running | success | failed | skipped
    status:        text('status').notNull().default('pending'),
    round:         integer('round'),
    // orchestrator_decision | subagent_execution
    phase:         text('phase'),
    correlationId: text('correlation_id'),
    // Full payloads — no size limits now that we use PostgreSQL
    input:         jsonb('input'),
    output:        jsonb('output'),
    error:         text('error'),
    startedAt:     timestamp('started_at', { withTimezone: true }),
    finishedAt:    timestamp('finished_at', { withTimezone: true }),
    durationMs:    integer('duration_ms'),
    createdAt:     timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:     timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx:    index('ars_tenant_idx').on(t.tenantId),
    runIdx:       index('ars_run_idx').on(t.runId),
    roundIdx:     index('ars_round_idx').on(t.runId, t.round),
    createdAtIdx: index('ars_created_at_idx').on(t.runId, t.createdAt),
  })
);

// ---------------------------------------------------------------------------
// agent_run_messages — inter-agent messages (task_request / task_result / control)
// ---------------------------------------------------------------------------
export const agentRunMessages = pgTable(
  'agent_run_messages',
  {
    id:             text('id').primaryKey(),
    tenantId:       text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    runId:          text('run_id').notNull().references(() => agentWorkflowRuns.id, { onDelete: 'cascade' }),
    fromNodeId:     text('from_node_id').notNull(),
    fromNodeName:   text('from_node_name').notNull(),
    toNodeId:       text('to_node_id').notNull(),
    toNodeName:     text('to_node_name').notNull(),
    channel:        text('channel').notNull(),
    // task_request | task_result | control
    messageType:    text('message_type'),
    correlationId:  text('correlation_id'),
    round:          integer('round'),
    targetInputKey: text('target_input_key').notNull(),
    // Full payload stored without truncation
    payload:        jsonb('payload'),
    createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx:       index('arm_tenant_idx').on(t.tenantId),
    runIdx:          index('arm_run_idx').on(t.runId),
    correlationIdx:  index('arm_correlation_idx').on(t.runId, t.correlationId),
    createdAtIdx:    index('arm_created_at_idx').on(t.runId, t.createdAt),
  })
);

// ===========================================================================
// BACKWARDS COMPATIBILITY ALIASES
// ===========================================================================
export const keywordMap = urlKeywords;
export const keywordMapEditors = urlKeywordEditors;
export const contentLog = processEvents;
export const contentLogBody = executionVersions;
export const keywordRankingHistory = keywordRankings;
export const blacklist = blacklistedKeywords;

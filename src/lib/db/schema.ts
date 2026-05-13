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
  },
  (t) => ({
    emailTenantUnique: uniqueIndex('users_email_tenant_idx').on(t.email, t.tenantId),
  })
);

// ---------------------------------------------------------------------------
// keyword_map
// ---------------------------------------------------------------------------
export const keywordMap = pgTable(
  'keyword_map',
  {
    id:                text('id').primaryKey(),
    tenantId:          text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    keyword:           text('keyword').notNull(),
    targetUrl:         text('target_url').notNull(),
    searchVolume:      integer('search_volume'),
    difficulty:        integer('difficulty'),
    status:            text('status')
      .$type<'Backlog' | 'Planned' | 'Beauftragt' | 'In Arbeit' | 'Angeliefert' | 'Review' | 'Optimierung' | 'Published'>()
      .notNull()
      .default('Backlog'),
    editorialDeadline: date('editorial_deadline'),
    mainKeyword:       text('main_keyword').$type<'Y' | 'N'>().notNull().default('N'),
    articleCount:      integer('article_count'),
    avgProductValue:   numeric('avg_product_value'),
    policy:            numeric('policy'),
    priorityScore:     numeric('priority_score'),
    ranking:           integer('ranking'),
    actionType:        text('action_type').$type<'Erstellung' | 'Optimierung'>().default('Erstellung'),
    pageType:          text('page_type').$type<'Ratgeber' | 'Kategorie' | 'Marke' | 'Produkt'>(),
    lastPublished:     date('last_published'),
  },
  (t) => ({
    keywordUrlUnique:  uniqueIndex('keyword_map_keyword_url_tenant_idx').on(t.keyword, t.targetUrl, t.tenantId),
    tenantIdx:         index('keyword_map_tenant_idx').on(t.tenantId),
    urlIdx:            index('keyword_map_url_idx').on(t.targetUrl),
    // ── Performance: filter by status (pipeline views)
    statusIdx:         index('keyword_map_status_idx').on(t.tenantId, t.status),
    // ── Performance: sort by priority_score (planning dashboard)
    priorityIdx:       index('keyword_map_priority_idx').on(t.tenantId, t.priorityScore),
    // ── Performance: main keyword lookup per URL
    mainKwIdx:         index('keyword_map_main_kw_idx').on(t.tenantId, t.targetUrl, t.mainKeyword),
  })
);

// ---------------------------------------------------------------------------
// keyword_map_editors  (Junction: keyword_map <-> users)
// ---------------------------------------------------------------------------
export const keywordMapEditors = pgTable(
  'keyword_map_editors',
  {
    keywordId: text('keyword_id').notNull().references(() => keywordMap.id, { onDelete: 'cascade' }),
    userId:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk:        primaryKey({ columns: [t.keywordId, t.userId] }),
    userIdx:   index('keyword_map_editors_user_idx').on(t.userId),
  })
);

// ---------------------------------------------------------------------------
// content_log  — metadata only, NO large text fields
// ---------------------------------------------------------------------------
export const contentLog = pgTable(
  'content_log',
  {
    id:          serial('id').primaryKey(),
    tenantId:    text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    keywordId:   text('keyword_id').references(() => keywordMap.id, { onDelete: 'set null' }),
    loggedUrl:   text('logged_url'),
    actionType:  text('action_type').$type<'Planung' | 'Erstellung' | 'Optimierung' | 'KI-Chat'>(),
    pageType:    text('page_type').$type<'Ratgeber' | 'Kategorie' | 'Marke' | 'Produkt'>(),
    editorId:    text('editor_id').references(() => users.id, { onDelete: 'set null' }),
    timeCreated: timestamp('time_created', { withTimezone: true }).defaultNow().notNull(),
    timeChanged: timestamp('time_changed', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx:   index('content_log_tenant_idx').on(t.tenantId),
    urlIdx:      index('content_log_logged_url_idx').on(t.loggedUrl),
    kwIdx:       index('content_log_keyword_idx').on(t.keywordId),
    // ── Performance: newest-first listing (most common query pattern)
    timeIdx:     index('content_log_time_idx').on(t.tenantId, t.timeCreated),
  })
);

// ---------------------------------------------------------------------------
// content_log_body  — large text storage, separated from metadata
// Only loaded when the full content is explicitly requested.
// ---------------------------------------------------------------------------
export const contentLogBody = pgTable(
  'content_log_body',
  {
    contentLogId: integer('content_log_id').primaryKey().references(() => contentLog.id, { onDelete: 'cascade' }),
    contentBody:  text('content_body'),
    diffSummary:  text('diff_summary'),
  }
);

// ---------------------------------------------------------------------------
// url_performance
// ---------------------------------------------------------------------------
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
    // ── Performance: time-series queries — tenant + date range
    dateIdx:       index('url_performance_date_idx').on(t.tenantId, t.date),
    // ── Performance: per-URL history (most common detail view query)
    urlDateIdx:    index('url_performance_url_date_combined_idx').on(t.tenantId, t.targetUrl, t.date),
  })
);

// ---------------------------------------------------------------------------
// keyword_ranking_history
// ---------------------------------------------------------------------------
export const keywordRankingHistory = pgTable(
  'keyword_ranking_history',
  {
    id:        serial('id').primaryKey(),
    tenantId:  text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    keywordId: text('keyword_id').notNull().references(() => keywordMap.id, { onDelete: 'cascade' }),
    date:      date('date').notNull(),
    ranking:   integer('ranking'),
  },
  (t) => ({
    kwDateUnique: uniqueIndex('keyword_ranking_kw_date_tenant_idx').on(t.keywordId, t.date, t.tenantId),
    tenantIdx:    index('keyword_ranking_tenant_idx').on(t.tenantId),
    // ── Performance: time-series queries — tenant + date range
    dateIdx:      index('keyword_ranking_date_idx').on(t.tenantId, t.date),
    // ── Performance: per-keyword history
    kwDateCombined: index('keyword_ranking_kw_date_combined_idx').on(t.tenantId, t.keywordId, t.date),
  })
);

// ---------------------------------------------------------------------------
// blacklist
// ---------------------------------------------------------------------------
export const blacklist = pgTable(
  'blacklist',
  {
    id:        serial('id').primaryKey(),
    tenantId:  text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    keyword:   text('keyword'),
    targetUrl: text('target_url'),
    type:      text('type').$type<'Keyword' | 'URL'>().notNull(),
    reason:    text('reason'),
    addedAt:   timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx:   index('blacklist_tenant_idx').on(t.tenantId),
    // ── Performance: DB-level blacklist filtering in getKeywordMap()
    kwLookupIdx: index('blacklist_kw_lookup_idx').on(t.tenantId, t.keyword),
    urlLookupIdx: index('blacklist_url_lookup_idx').on(t.tenantId, t.targetUrl),
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
    tenantIdx: index('cost_config_tenant_idx').on(t.tenantId),
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

-- =====================================================================
-- COMPLETE DATABASE MIGRATION SCRIPT
-- 
-- This script combines:
-- 1. Schema creation (0006_create_new_schema.sql)
-- 2. Data backfill (0007_backfill_data.sql)
--
-- IMPORTANT: 
-- - Backup your database before running this!
-- - This creates NEW tables alongside the old ones
-- - Old tables (keyword_map, content_log, etc.) remain intact
-- - Run validation queries at the end to verify migration
-- 
-- Run with: psql -d your_database < COMPLETE_MIGRATION.sql
-- Or execute in your database management tool
-- =====================================================================

-- PART 1: CREATE ENUMS

DO $$ BEGIN
  CREATE TYPE planning_status_enum AS ENUM (
    'suggested',
    'backlog',
    'planned',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE execution_status_enum AS ENUM (
    'commissioned',
    'in_progress',
    'delivered',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE publishing_status_enum AS ENUM (
    'draft',
    'in_review',
    'approved',
    'published',
    'unpublished'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE action_type_enum AS ENUM (
    'creation',
    'optimization'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE event_type_enum AS ENUM (
  -- Planning Events
  'url_suggested',
  'url_added_to_backlog',
  'url_planned',
  'planning_cancelled',
  
  -- Execution Events
  'cycle_commissioned',
  'cycle_started',
  'cycle_delivered',
  'cycle_failed',
  'version_created',
  'version_edited',
  
  -- Publishing Events
  'submitted_for_review',
  'review_approved',
  'review_rejected',
  'content_published',
  'content_unpublished',
  
  -- Admin Events
  'url_blacklisted',
  'url_unblacklisted',
  'keyword_added',
  'keyword_removed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- PART 2: CREATE TABLES

CREATE TABLE IF NOT EXISTS urls (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  page_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT urls_url_tenant_unique UNIQUE(url, tenant_id)
);

CREATE TABLE IF NOT EXISTS url_keywords (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url_id TEXT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  is_main_keyword BOOLEAN DEFAULT false NOT NULL,
  search_volume INTEGER,
  difficulty INTEGER,
  ranking INTEGER,
  priority_score NUMERIC,
  article_count INTEGER,
  avg_product_value NUMERIC,
  policy NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT url_keywords_keyword_url_tenant_unique UNIQUE(keyword, url_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS url_keyword_editors (
  keyword_id TEXT NOT NULL REFERENCES url_keywords(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  CONSTRAINT url_keyword_editors_pk PRIMARY KEY(keyword_id, user_id)
);

CREATE TABLE IF NOT EXISTS planning_status (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url_id TEXT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  status planning_status_enum DEFAULT 'backlog' NOT NULL,
  editorial_deadline DATE,
  priority_score NUMERIC,
  planned_action_type action_type_enum,
  assigned_editor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT planning_status_url_tenant_unique UNIQUE(url_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS execution_cycles (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url_id TEXT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  action_type action_type_enum NOT NULL,
  status execution_status_enum DEFAULT 'commissioned' NOT NULL,
  commissioned_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  commissioned_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  agent_run_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT execution_cycles_url_cycle_tenant_unique UNIQUE(url_id, cycle_number, tenant_id)
);

CREATE TABLE IF NOT EXISTS execution_versions (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cycle_id INTEGER NOT NULL REFERENCES execution_cycles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_html TEXT,
  diff_summary TEXT,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by_ai BOOLEAN DEFAULT false NOT NULL,
  ai_provider TEXT,
  ai_model TEXT,
  ai_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT execution_versions_cycle_version_unique UNIQUE(cycle_id, version_number)
);

CREATE TABLE IF NOT EXISTS publishing_status (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cycle_id INTEGER NOT NULL REFERENCES execution_cycles(id) ON DELETE CASCADE,
  version_id INTEGER NOT NULL REFERENCES execution_versions(id) ON DELETE CASCADE,
  status publishing_status_enum DEFAULT 'draft' NOT NULL,
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  published_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  unpublished_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  unpublished_at TIMESTAMP WITH TIME ZONE,
  unpublish_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT publishing_status_cycle_tenant_unique UNIQUE(cycle_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS process_events (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type event_type_enum NOT NULL,
  
  url_id TEXT REFERENCES urls(id) ON DELETE SET NULL,
  keyword_id TEXT REFERENCES url_keywords(id) ON DELETE SET NULL,
  planning_status_id INTEGER REFERENCES planning_status(id) ON DELETE SET NULL,
  cycle_id INTEGER REFERENCES execution_cycles(id) ON DELETE SET NULL,
  version_id INTEGER REFERENCES execution_versions(id) ON DELETE SET NULL,
  publishing_status_id INTEGER REFERENCES publishing_status(id) ON DELETE SET NULL,
  
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_data JSONB,
  event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS keyword_rankings (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  keyword_id TEXT NOT NULL REFERENCES url_keywords(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  ranking INTEGER,
  
  CONSTRAINT keyword_rankings_kw_date_tenant_unique UNIQUE(keyword_id, date, tenant_id)
);

CREATE TABLE IF NOT EXISTS url_performance_new (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url_id TEXT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  gsc_clicks INTEGER,
  gsc_impressions INTEGER,
  position NUMERIC,
  sistrix_vi NUMERIC,
  
  CONSTRAINT url_performance_new_url_date_tenant_unique UNIQUE(url_id, date, tenant_id)
);

CREATE TABLE IF NOT EXISTS blacklisted_keywords (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  reason TEXT,
  added_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT blacklisted_keywords_kw_tenant_unique UNIQUE(keyword, tenant_id)
);

CREATE TABLE IF NOT EXISTS blacklisted_urls (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url_id TEXT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  reason TEXT,
  added_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT blacklisted_urls_url_tenant_unique UNIQUE(url_id, tenant_id)
);

-- PART 3: CREATE INDEXES

-- urls indexes
CREATE INDEX IF NOT EXISTS urls_tenant_idx ON urls(tenant_id);
CREATE INDEX IF NOT EXISTS urls_page_type_idx ON urls(tenant_id, page_type);

-- url_keywords indexes
CREATE INDEX IF NOT EXISTS url_keywords_tenant_idx ON url_keywords(tenant_id);
CREATE INDEX IF NOT EXISTS url_keywords_url_idx ON url_keywords(url_id);
CREATE INDEX IF NOT EXISTS url_keywords_main_kw_idx ON url_keywords(tenant_id, url_id, is_main_keyword);
CREATE INDEX IF NOT EXISTS url_keywords_priority_idx ON url_keywords(tenant_id, priority_score DESC NULLS LAST);

-- url_keyword_editors indexes
CREATE INDEX IF NOT EXISTS url_keyword_editors_user_idx ON url_keyword_editors(user_id);

-- planning_status indexes
CREATE INDEX IF NOT EXISTS planning_status_tenant_idx ON planning_status(tenant_id);
CREATE INDEX IF NOT EXISTS planning_status_status_idx ON planning_status(tenant_id, status);
CREATE INDEX IF NOT EXISTS planning_status_deadline_idx ON planning_status(tenant_id, editorial_deadline);
CREATE INDEX IF NOT EXISTS planning_status_editor_idx ON planning_status(assigned_editor_id);

-- execution_cycles indexes
CREATE INDEX IF NOT EXISTS execution_cycles_tenant_idx ON execution_cycles(tenant_id);
CREATE INDEX IF NOT EXISTS execution_cycles_url_idx ON execution_cycles(url_id);
CREATE INDEX IF NOT EXISTS execution_cycles_status_idx ON execution_cycles(tenant_id, status);
CREATE INDEX IF NOT EXISTS execution_cycles_commissioned_at_idx ON execution_cycles(commissioned_at DESC);
CREATE INDEX IF NOT EXISTS execution_cycles_active_idx ON execution_cycles(tenant_id, url_id, cycle_number DESC);

-- execution_versions indexes
CREATE INDEX IF NOT EXISTS execution_versions_cycle_idx ON execution_versions(cycle_id);
CREATE INDEX IF NOT EXISTS execution_versions_created_at_idx ON execution_versions(created_at DESC);

-- publishing_status indexes
CREATE INDEX IF NOT EXISTS publishing_status_tenant_idx ON publishing_status(tenant_id);
CREATE INDEX IF NOT EXISTS publishing_status_status_idx ON publishing_status(tenant_id, status);
CREATE INDEX IF NOT EXISTS publishing_status_published_at_idx ON publishing_status(published_at DESC);

-- process_events indexes
CREATE INDEX IF NOT EXISTS process_events_tenant_idx ON process_events(tenant_id);
CREATE INDEX IF NOT EXISTS process_events_url_idx ON process_events(url_id);
CREATE INDEX IF NOT EXISTS process_events_cycle_idx ON process_events(cycle_id);
CREATE INDEX IF NOT EXISTS process_events_type_idx ON process_events(event_type);
CREATE INDEX IF NOT EXISTS process_events_timestamp_idx ON process_events(tenant_id, event_timestamp DESC);

-- keyword_rankings indexes
CREATE INDEX IF NOT EXISTS keyword_rankings_tenant_idx ON keyword_rankings(tenant_id);
CREATE INDEX IF NOT EXISTS keyword_rankings_date_idx ON keyword_rankings(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS keyword_rankings_kw_date_combined_idx ON keyword_rankings(tenant_id, keyword_id, date DESC);

-- url_performance_new indexes
CREATE INDEX IF NOT EXISTS url_performance_new_tenant_idx ON url_performance_new(tenant_id);
CREATE INDEX IF NOT EXISTS url_performance_new_date_idx ON url_performance_new(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS url_performance_new_url_date_combined_idx ON url_performance_new(tenant_id, url_id, date DESC);

-- blacklisted_keywords indexes
CREATE INDEX IF NOT EXISTS blacklisted_keywords_tenant_idx ON blacklisted_keywords(tenant_id);
CREATE INDEX IF NOT EXISTS blacklisted_keywords_kw_lookup_idx ON blacklisted_keywords(tenant_id, keyword);

-- blacklisted_urls indexes
CREATE INDEX IF NOT EXISTS blacklisted_urls_tenant_idx ON blacklisted_urls(tenant_id);
CREATE INDEX IF NOT EXISTS blacklisted_urls_url_lookup_idx ON blacklisted_urls(tenant_id, url_id);

-- PART 4: CREATE TRIGGERS

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_urls_updated_at ON urls;
CREATE TRIGGER update_urls_updated_at
  BEFORE UPDATE ON urls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_planning_status_updated_at ON planning_status;
CREATE TRIGGER update_planning_status_updated_at
  BEFORE UPDATE ON planning_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_execution_cycles_updated_at ON execution_cycles;
CREATE TRIGGER update_execution_cycles_updated_at
  BEFORE UPDATE ON execution_cycles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_publishing_status_updated_at ON publishing_status;
CREATE TRIGGER update_publishing_status_updated_at
  BEFORE UPDATE ON publishing_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- State machine validation triggers
CREATE OR REPLACE FUNCTION validate_execution_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'delivered' AND NEW.status IN ('in_progress', 'commissioned') THEN
    RAISE EXCEPTION 'Cannot transition from delivered to %', NEW.status;
  END IF;
  
  IF OLD.status IN ('failed', 'cancelled') AND NEW.status = 'in_progress' THEN
    RAISE EXCEPTION 'Cannot transition from % to in_progress', OLD.status;
  END IF;
  
  IF OLD.status != 'delivered' AND NEW.status = 'delivered' THEN
    NEW.delivered_at = now();
  END IF;
  
  IF OLD.status != 'failed' AND NEW.status = 'failed' THEN
    NEW.failed_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS execution_status_validation ON execution_cycles;
CREATE TRIGGER execution_status_validation
  BEFORE UPDATE ON execution_cycles
  FOR EACH ROW
  EXECUTE FUNCTION validate_execution_status_transition();

CREATE OR REPLACE FUNCTION validate_publishing_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'published' AND NEW.status = 'unpublished' THEN
    RAISE EXCEPTION 'Cannot unpublish content that is not published';
  END IF;
  
  IF OLD.status != 'in_review' AND NEW.status = 'in_review' THEN
    NEW.reviewed_at = now();
  END IF;
  
  IF OLD.status != 'published' AND NEW.status = 'published' THEN
    NEW.published_at = now();
  END IF;
  
  IF OLD.status != 'unpublished' AND NEW.status = 'unpublished' THEN
    NEW.unpublished_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS publishing_status_validation ON publishing_status;
CREATE TRIGGER publishing_status_validation
  BEFORE UPDATE ON publishing_status
  FOR EACH ROW
  EXECUTE FUNCTION validate_publishing_status_transition();

-- PART 5: DATA MIGRATION

-- Migrating URLs...

INSERT INTO urls (id, tenant_id, url, page_type, created_at, updated_at)
SELECT 
  gen_random_uuid()::text AS id,
  tenant_id,
  target_url AS url,
  page_type,
  now() AS created_at,
  now() AS updated_at
FROM keyword_map
GROUP BY tenant_id, target_url, page_type
ON CONFLICT (url, tenant_id) DO NOTHING;

-- Migrating keywords...

INSERT INTO url_keywords (
  id, tenant_id, url_id, keyword, is_main_keyword,
  search_volume, difficulty, ranking, priority_score,
  article_count, avg_product_value, policy, created_at
)
SELECT 
  km.id, km.tenant_id, u.id AS url_id, km.keyword,
  (km.main_keyword = 'Y') AS is_main_keyword,
  km.search_volume, km.difficulty, km.ranking, km.priority_score,
  km.article_count, km.avg_product_value, km.policy,
  now() AS created_at
FROM keyword_map km
JOIN urls u ON u.url = km.target_url AND u.tenant_id = km.tenant_id
ON CONFLICT (keyword, url_id, tenant_id) DO NOTHING;

-- Migrating keyword editors...

INSERT INTO url_keyword_editors (keyword_id, user_id)
SELECT kme.keyword_id, kme.user_id
FROM keyword_map_editors kme
WHERE EXISTS (SELECT 1 FROM url_keywords WHERE id = kme.keyword_id)
ON CONFLICT (keyword_id, user_id) DO NOTHING;

-- Migrating planning status...

INSERT INTO planning_status (
  tenant_id, url_id, status, editorial_deadline, priority_score,
  planned_action_type, assigned_editor_id, created_at, updated_at
)
SELECT DISTINCT ON (u.id)
  u.tenant_id, u.id AS url_id,
  CASE 
    WHEN km.status = 'Backlog' THEN 'backlog'::planning_status_enum
    WHEN km.status = 'Planned' THEN 'planned'::planning_status_enum
    WHEN km.status = 'Published' THEN 'planned'::planning_status_enum
    ELSE 'backlog'::planning_status_enum
  END AS status,
  km.editorial_deadline, km.priority_score,
  CASE 
    WHEN km.action_type = 'Erstellung' THEN 'creation'::action_type_enum
    WHEN km.action_type = 'Optimierung' THEN 'optimization'::action_type_enum
    ELSE 'creation'::action_type_enum
  END AS planned_action_type,
  (SELECT user_id FROM keyword_map_editors kme WHERE kme.keyword_id = km.id LIMIT 1) AS assigned_editor_id,
  now() AS created_at,
  now() AS updated_at
FROM urls u
JOIN keyword_map km ON km.target_url = u.url AND km.tenant_id = u.tenant_id
WHERE km.main_keyword = 'Y'
ORDER BY u.id, km.priority_score DESC NULLS LAST
ON CONFLICT (url_id, tenant_id) DO NOTHING;

-- Migrating execution cycles...

WITH commissioning_logs AS (
  SELECT 
    cl.id, cl.tenant_id, cl.keyword_id, km.target_url, cl.action_type,
    cl.time_created, cl.editor_id,
    ROW_NUMBER() OVER (
      PARTITION BY km.target_url, km.tenant_id 
      ORDER BY cl.time_created
    ) AS cycle_number,
    EXISTS (
      SELECT 1 FROM content_log cl2 
      JOIN content_log_body clb2 ON clb2.content_log_id = cl2.id
      WHERE cl2.commission_log_id = cl.id AND clb2.content_body IS NOT NULL
    ) AS has_delivery
  FROM content_log cl
  JOIN keyword_map km ON km.id = cl.keyword_id
  LEFT JOIN content_log_body clb ON clb.content_log_id = cl.id
  WHERE (cl.commission_log_id IS NULL OR clb.event_label ILIKE '%beauftragt%')
    AND cl.action_type IN ('Erstellung', 'Optimierung')
)
INSERT INTO execution_cycles (
  id, tenant_id, url_id, cycle_number, action_type, status,
  commissioned_by_user_id, commissioned_at, delivered_at, created_at, updated_at
)
SELECT 
  c.id, c.tenant_id, u.id AS url_id, c.cycle_number,
  CASE c.action_type
    WHEN 'Erstellung' THEN 'creation'::action_type_enum
    WHEN 'Optimierung' THEN 'optimization'::action_type_enum
    ELSE 'creation'::action_type_enum
  END AS action_type,
  CASE WHEN c.has_delivery THEN 'delivered'::execution_status_enum
       ELSE 'failed'::execution_status_enum
  END AS status,
  c.editor_id, c.time_created,
  CASE WHEN c.has_delivery THEN (
    SELECT MIN(cl2.time_created) FROM content_log cl2 WHERE cl2.commission_log_id = c.id
  ) ELSE NULL END AS delivered_at,
  c.time_created, now()
FROM commissioning_logs c
JOIN urls u ON u.url = c.target_url AND u.tenant_id = c.tenant_id
ON CONFLICT (url_id, cycle_number, tenant_id) DO NOTHING;

-- Migrating execution versions...

WITH delivery_and_saves AS (
  SELECT 
    cl.commission_log_id AS cycle_id, cl.tenant_id,
    clb.content_body, clb.event_label, cl.editor_id, cl.time_created,
    ROW_NUMBER() OVER (PARTITION BY cl.commission_log_id ORDER BY cl.time_created) AS version_number,
    (clb.event_label ILIKE '%KI-%' OR clb.event_label ILIKE '%AI%') AS is_ai_generated
  FROM content_log cl
  JOIN content_log_body clb ON clb.content_log_id = cl.id
  WHERE cl.commission_log_id IS NOT NULL AND clb.content_body IS NOT NULL
    AND EXISTS (SELECT 1 FROM execution_cycles WHERE id = cl.commission_log_id)
)
INSERT INTO execution_versions (
  tenant_id, cycle_id, version_number, content_html, diff_summary,
  created_by_user_id, created_by_ai, created_at
)
SELECT 
  d.tenant_id, d.cycle_id, d.version_number, d.content_body,
  d.event_label, d.editor_id, d.is_ai_generated, d.time_created
FROM delivery_and_saves d
ON CONFLICT (cycle_id, version_number) DO NOTHING;

-- Migrating publishing status...

INSERT INTO publishing_status (
  tenant_id, cycle_id, version_id, status, published_by_user_id,
  published_at, created_at, updated_at
)
SELECT 
  ec.tenant_id, ec.id AS cycle_id,
  (SELECT id FROM execution_versions WHERE cycle_id = ec.id ORDER BY version_number DESC LIMIT 1) AS version_id,
  CASE 
    WHEN km.status = 'Published' AND km.last_published IS NOT NULL THEN 'published'::publishing_status_enum
    WHEN km.status = 'Review' THEN 'in_review'::publishing_status_enum
    WHEN km.status = 'Angeliefert' THEN 'approved'::publishing_status_enum
    ELSE 'draft'::publishing_status_enum
  END AS status,
  (SELECT cl.editor_id FROM content_log cl
   JOIN content_log_body clb ON clb.content_log_id = cl.id
   WHERE cl.commission_log_id = ec.id AND clb.event_label ILIKE '%veröffentlicht%'
   ORDER BY cl.time_created DESC LIMIT 1) AS published_by_user_id,
  CASE WHEN km.status = 'Published' THEN km.last_published::timestamp with time zone ELSE NULL END AS published_at,
  ec.created_at, now() AS updated_at
FROM execution_cycles ec
JOIN urls u ON u.id = ec.url_id
JOIN keyword_map km ON km.target_url = u.url AND km.tenant_id = u.tenant_id AND km.main_keyword = 'Y'
WHERE EXISTS (SELECT 1 FROM execution_versions WHERE cycle_id = ec.id)
ON CONFLICT (cycle_id, tenant_id) DO NOTHING;

-- Migrating process events...

INSERT INTO process_events (
  tenant_id, event_type, url_id, keyword_id, cycle_id, user_id, event_data, event_timestamp
)
SELECT 
  cl.tenant_id,
  CASE 
    WHEN clb.event_label ILIKE '%beauftragt%' THEN 'cycle_commissioned'::event_type_enum
    WHEN clb.event_label ILIKE '%angeliefert%' THEN 'cycle_delivered'::event_type_enum
    WHEN clb.event_label ILIKE '%veröffentlicht%' THEN 'content_published'::event_type_enum
    WHEN clb.event_label ILIKE '%geplant%' OR clb.event_label ILIKE '%hinzugefügt%' THEN 'url_planned'::event_type_enum
    WHEN clb.event_label ILIKE '%blacklist%' THEN 'url_blacklisted'::event_type_enum
    ELSE 'version_created'::event_type_enum
  END AS event_type,
  (SELECT u.id FROM urls u WHERE u.url = COALESCE(cl.logged_url, km.target_url) AND u.tenant_id = cl.tenant_id LIMIT 1) AS url_id,
  (SELECT uk.id FROM url_keywords uk WHERE uk.id = cl.keyword_id LIMIT 1) AS keyword_id,
  CASE WHEN cl.commission_log_id IS NOT NULL THEN cl.commission_log_id
       WHEN clb.event_label ILIKE '%beauftragt%' THEN cl.id
       ELSE NULL END AS cycle_id,
  cl.editor_id AS user_id,
  jsonb_build_object('original_event_label', clb.event_label, 'action_type', cl.action_type, 'page_type', cl.page_type) AS event_data,
  cl.time_created AS event_timestamp
FROM content_log cl
LEFT JOIN content_log_body clb ON clb.content_log_id = cl.id
LEFT JOIN keyword_map km ON km.id = cl.keyword_id
WHERE clb.event_label IS NOT NULL OR cl.action_type IS NOT NULL;

-- Migrating keyword rankings...

INSERT INTO keyword_rankings (tenant_id, keyword_id, date, ranking)
SELECT krh.tenant_id, krh.keyword_id, krh.date, krh.ranking
FROM keyword_ranking_history krh
WHERE EXISTS (SELECT 1 FROM url_keywords WHERE id = krh.keyword_id)
ON CONFLICT (keyword_id, date, tenant_id) DO NOTHING;

-- Migrating URL performance...

INSERT INTO url_performance_new (tenant_id, url_id, date, gsc_clicks, gsc_impressions, position, sistrix_vi)
SELECT up.tenant_id, u.id AS url_id, up.date, up.gsc_clicks, up.gsc_impressions, up.position, up.sistrix_vi
FROM url_performance up
JOIN urls u ON u.url = up.target_url AND u.tenant_id = up.tenant_id
ON CONFLICT (url_id, date, tenant_id) DO NOTHING;

-- Migrating blacklist...

INSERT INTO blacklisted_keywords (tenant_id, keyword, reason, added_at)
SELECT tenant_id, keyword, reason, added_at
FROM blacklist
WHERE type = 'Keyword' AND keyword IS NOT NULL
ON CONFLICT (keyword, tenant_id) DO NOTHING;

INSERT INTO blacklisted_urls (tenant_id, url_id, reason, added_at)
SELECT b.tenant_id, u.id AS url_id, b.reason, b.added_at
FROM blacklist b
JOIN urls u ON u.url = b.target_url AND u.tenant_id = b.tenant_id
WHERE b.type = 'URL' AND b.target_url IS NOT NULL
ON CONFLICT (url_id, tenant_id) DO NOTHING;

-- PART 6: VALIDATION

DO $$
DECLARE
  v_keyword_map_count INTEGER;
  v_url_keywords_count INTEGER;
  v_urls_count INTEGER;
  v_unique_urls_count INTEGER;
  v_cycles_count INTEGER;
  v_versions_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_keyword_map_count FROM keyword_map;
  SELECT COUNT(*) INTO v_url_keywords_count FROM url_keywords;
  SELECT COUNT(*) INTO v_urls_count FROM urls;
  SELECT COUNT(DISTINCT target_url) INTO v_unique_urls_count FROM keyword_map;
  SELECT COUNT(*) INTO v_cycles_count FROM execution_cycles;
  SELECT COUNT(*) INTO v_versions_count FROM execution_versions;
  
  RAISE NOTICE 'keyword_map count: %', v_keyword_map_count;
  RAISE NOTICE 'url_keywords count: %', v_url_keywords_count;
  RAISE NOTICE 'urls count: %', v_urls_count;
  RAISE NOTICE 'unique URLs in keyword_map: %', v_unique_urls_count;
  RAISE NOTICE 'execution_cycles count: %', v_cycles_count;
  RAISE NOTICE 'execution_versions count: %', v_versions_count;
  
  IF v_keyword_map_count != v_url_keywords_count THEN
    RAISE WARNING 'Mismatch: keyword_map (%) != url_keywords (%)', v_keyword_map_count, v_url_keywords_count;
  ELSE
    RAISE NOTICE 'Keywords migrated successfully';
  END IF;
  
  IF v_urls_count != v_unique_urls_count THEN
    RAISE WARNING 'Mismatch: urls (%) != unique URLs (%)', v_urls_count, v_unique_urls_count;
  ELSE
    RAISE NOTICE 'URLs migrated successfully';
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '========================================';
END $$;

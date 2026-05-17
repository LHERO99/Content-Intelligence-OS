-- =====================================================================
-- Migration 0006: Create New URL-Centric Schema
-- 
-- This migration creates the new schema structure that separates
-- planning, execution, and publishing workflows into distinct tables.
-- The old schema (keyword_map, content_log) remains intact for now.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. CREATE ENUMS
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE planning_status_enum AS ENUM (
  'suggested',
  'backlog',
  'planned',
  'cancelled'
);

CREATE TYPE execution_status_enum AS ENUM (
  'commissioned',
  'in_progress',
  'delivered',
  'failed',
  'cancelled'
);

CREATE TYPE publishing_status_enum AS ENUM (
  'draft',
  'in_review',
  'approved',
  'published',
  'unpublished'
);

CREATE TYPE action_type_enum AS ENUM (
  'creation',
  'optimization'
);

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

-- ─────────────────────────────────────────────────────────────────────
-- 2. CREATE TABLES
-- ─────────────────────────────────────────────────────────────────────

-- urls: Main entity for URL-centric architecture
CREATE TABLE urls (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  page_type TEXT, -- 'Ratgeber' | 'Kategorie' | 'Marke' | 'Produkt'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT urls_url_tenant_unique UNIQUE(url, tenant_id)
);

-- url_keywords: Keywords as attributes of URLs (refactored keyword_map)
CREATE TABLE url_keywords (
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

-- url_keyword_editors: Junction table for keyword assignments
CREATE TABLE url_keyword_editors (
  keyword_id TEXT NOT NULL REFERENCES url_keywords(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  CONSTRAINT url_keyword_editors_pk PRIMARY KEY(keyword_id, user_id)
);

-- planning_status: Planning workflow status (one per URL)
CREATE TABLE planning_status (
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

-- execution_cycles: Execution workflow with multi-cycle support
CREATE TABLE execution_cycles (
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

-- execution_versions: Content versions per cycle
CREATE TABLE execution_versions (
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

-- publishing_status: Publishing workflow status (one per cycle)
CREATE TABLE publishing_status (
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

-- process_events: Structured event log
CREATE TABLE process_events (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type event_type_enum NOT NULL,
  
  -- Polymorphic references
  url_id TEXT REFERENCES urls(id) ON DELETE SET NULL,
  keyword_id TEXT REFERENCES url_keywords(id) ON DELETE SET NULL,
  planning_status_id INTEGER REFERENCES planning_status(id) ON DELETE SET NULL,
  cycle_id INTEGER REFERENCES execution_cycles(id) ON DELETE SET NULL,
  version_id INTEGER REFERENCES execution_versions(id) ON DELETE SET NULL,
  publishing_status_id INTEGER REFERENCES publishing_status(id) ON DELETE SET NULL,
  
  -- Event metadata
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_data JSONB,
  event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- keyword_rankings: Historical keyword ranking data (refactored)
CREATE TABLE keyword_rankings (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  keyword_id TEXT NOT NULL REFERENCES url_keywords(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  ranking INTEGER,
  
  CONSTRAINT keyword_rankings_kw_date_tenant_unique UNIQUE(keyword_id, date, tenant_id)
);

-- url_performance_new: Historical URL performance data (refactored)
CREATE TABLE url_performance_new (
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

-- blacklisted_keywords: Separated from blacklist table
CREATE TABLE blacklisted_keywords (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  reason TEXT,
  added_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT blacklisted_keywords_kw_tenant_unique UNIQUE(keyword, tenant_id)
);

-- blacklisted_urls: Separated from blacklist table
CREATE TABLE blacklisted_urls (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url_id TEXT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  reason TEXT,
  added_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT blacklisted_urls_url_tenant_unique UNIQUE(url_id, tenant_id)
);

-- ─────────────────────────────────────────────────────────────────────
-- 3. CREATE INDEXES
-- ─────────────────────────────────────────────────────────────────────

-- urls indexes
CREATE INDEX urls_tenant_idx ON urls(tenant_id);
CREATE INDEX urls_page_type_idx ON urls(tenant_id, page_type);
CREATE UNIQUE INDEX urls_url_tenant_idx ON urls(url, tenant_id);

-- url_keywords indexes
CREATE INDEX url_keywords_tenant_idx ON url_keywords(tenant_id);
CREATE INDEX url_keywords_url_idx ON url_keywords(url_id);
CREATE INDEX url_keywords_main_kw_idx ON url_keywords(tenant_id, url_id, is_main_keyword);
CREATE INDEX url_keywords_priority_idx ON url_keywords(tenant_id, priority_score DESC NULLS LAST);

-- url_keyword_editors indexes
CREATE INDEX url_keyword_editors_user_idx ON url_keyword_editors(user_id);

-- planning_status indexes
CREATE INDEX planning_status_tenant_idx ON planning_status(tenant_id);
CREATE INDEX planning_status_status_idx ON planning_status(tenant_id, status);
CREATE INDEX planning_status_deadline_idx ON planning_status(tenant_id, editorial_deadline);
CREATE INDEX planning_status_editor_idx ON planning_status(assigned_editor_id);

-- execution_cycles indexes
CREATE INDEX execution_cycles_tenant_idx ON execution_cycles(tenant_id);
CREATE INDEX execution_cycles_url_idx ON execution_cycles(url_id);
CREATE INDEX execution_cycles_status_idx ON execution_cycles(tenant_id, status);
CREATE INDEX execution_cycles_commissioned_at_idx ON execution_cycles(commissioned_at DESC);
CREATE INDEX execution_cycles_active_idx ON execution_cycles(tenant_id, url_id, cycle_number DESC);

-- execution_versions indexes
CREATE INDEX execution_versions_cycle_idx ON execution_versions(cycle_id);
CREATE INDEX execution_versions_created_at_idx ON execution_versions(created_at DESC);

-- publishing_status indexes
CREATE INDEX publishing_status_tenant_idx ON publishing_status(tenant_id);
CREATE INDEX publishing_status_status_idx ON publishing_status(tenant_id, status);
CREATE INDEX publishing_status_published_at_idx ON publishing_status(published_at DESC);

-- process_events indexes
CREATE INDEX process_events_tenant_idx ON process_events(tenant_id);
CREATE INDEX process_events_url_idx ON process_events(url_id);
CREATE INDEX process_events_cycle_idx ON process_events(cycle_id);
CREATE INDEX process_events_type_idx ON process_events(event_type);
CREATE INDEX process_events_timestamp_idx ON process_events(tenant_id, event_timestamp DESC);

-- keyword_rankings indexes
CREATE INDEX keyword_rankings_tenant_idx ON keyword_rankings(tenant_id);
CREATE INDEX keyword_rankings_date_idx ON keyword_rankings(tenant_id, date DESC);
CREATE INDEX keyword_rankings_kw_date_combined_idx ON keyword_rankings(tenant_id, keyword_id, date DESC);

-- url_performance_new indexes
CREATE INDEX url_performance_new_tenant_idx ON url_performance_new(tenant_id);
CREATE INDEX url_performance_new_date_idx ON url_performance_new(tenant_id, date DESC);
CREATE INDEX url_performance_new_url_date_combined_idx ON url_performance_new(tenant_id, url_id, date DESC);

-- blacklisted_keywords indexes
CREATE INDEX blacklisted_keywords_tenant_idx ON blacklisted_keywords(tenant_id);
CREATE INDEX blacklisted_keywords_kw_lookup_idx ON blacklisted_keywords(tenant_id, keyword);

-- blacklisted_urls indexes
CREATE INDEX blacklisted_urls_tenant_idx ON blacklisted_urls(tenant_id);
CREATE INDEX blacklisted_urls_url_lookup_idx ON blacklisted_urls(tenant_id, url_id);

-- ─────────────────────────────────────────────────────────────────────
-- 4. CREATE TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_urls_updated_at
  BEFORE UPDATE ON urls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planning_status_updated_at
  BEFORE UPDATE ON planning_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_execution_cycles_updated_at
  BEFORE UPDATE ON execution_cycles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_publishing_status_updated_at
  BEFORE UPDATE ON publishing_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────
-- 5. CREATE STATE MACHINE VALIDATION TRIGGERS
-- ─────────────────────────────────────────────────────────────────────

-- Prevent invalid execution status transitions
CREATE OR REPLACE FUNCTION validate_execution_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Cannot regress from delivered to in_progress or commissioned
  IF OLD.status = 'delivered' AND NEW.status IN ('in_progress', 'commissioned') THEN
    RAISE EXCEPTION 'Cannot transition from delivered to %', NEW.status;
  END IF;
  
  -- Cannot go from failed/cancelled to in_progress
  IF OLD.status IN ('failed', 'cancelled') AND NEW.status = 'in_progress' THEN
    RAISE EXCEPTION 'Cannot transition from % to in_progress', OLD.status;
  END IF;
  
  -- Set delivered_at timestamp
  IF OLD.status != 'delivered' AND NEW.status = 'delivered' THEN
    NEW.delivered_at = now();
  END IF;
  
  -- Set failed_at timestamp
  IF OLD.status != 'failed' AND NEW.status = 'failed' THEN
    NEW.failed_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER execution_status_validation
  BEFORE UPDATE ON execution_cycles
  FOR EACH ROW
  EXECUTE FUNCTION validate_execution_status_transition();

-- Prevent invalid publishing status transitions
CREATE OR REPLACE FUNCTION validate_publishing_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Cannot unpublish without being published first
  IF OLD.status != 'published' AND NEW.status = 'unpublished' THEN
    RAISE EXCEPTION 'Cannot unpublish content that is not published';
  END IF;
  
  -- Set review timestamp
  IF OLD.status != 'in_review' AND NEW.status = 'in_review' THEN
    NEW.reviewed_at = now();
  END IF;
  
  -- Set published timestamp
  IF OLD.status != 'published' AND NEW.status = 'published' THEN
    NEW.published_at = now();
  END IF;
  
  -- Set unpublished timestamp
  IF OLD.status != 'unpublished' AND NEW.status = 'unpublished' THEN
    NEW.unpublished_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER publishing_status_validation
  BEFORE UPDATE ON publishing_status
  FOR EACH ROW
  EXECUTE FUNCTION validate_publishing_status_transition();

-- ─────────────────────────────────────────────────────────────────────
-- 6. COMMENTS FOR DOCUMENTATION
-- ─────────────────────────────────────────────────────────────────────

COMMENT ON TABLE urls IS 'Main entity for URL-centric architecture. One row per unique URL.';
COMMENT ON TABLE url_keywords IS 'Keywords as attributes of URLs. Replaces keyword_map with URL-first approach.';
COMMENT ON TABLE planning_status IS 'Planning workflow status. One status per URL for editorial planning.';
COMMENT ON TABLE execution_cycles IS 'Execution workflow with native multi-cycle support. Each commissioning creates a new cycle.';
COMMENT ON TABLE execution_versions IS 'Content versions per cycle. Supports manual edits and AI refinements.';
COMMENT ON TABLE publishing_status IS 'Publishing workflow status. Tracks review and publish state per cycle.';
COMMENT ON TABLE process_events IS 'Structured event log with typed events. Replaces content_log with better structure.';

COMMENT ON COLUMN execution_cycles.cycle_number IS 'Incrementing cycle number per URL. 1 = first creation, 2+ = optimizations/updates.';
COMMENT ON COLUMN execution_versions.version_number IS 'Incrementing version per cycle. 1 = initial delivery, 2+ = edits.';
COMMENT ON COLUMN publishing_status.version_id IS 'Which version of the content is published. FK to execution_versions.';

-- =====================================================================
-- END OF MIGRATION
-- =====================================================================

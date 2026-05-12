-- =============================================================================
-- SEO Content Tool — PostgreSQL Database Setup
-- =============================================================================
-- Run this script once against a fresh PostgreSQL database (≥ 14).
--
-- Usage:
--   psql postgresql://<user>:<password>@<host>:<port>/<dbname> -f setup.sql
--
-- What this script creates:
--   1. All application tables with constraints and indexes
--   2. Row Level Security (RLS) policies for multi-tenancy
--   3. A default tenant record
--   4. Helper function to set the active tenant in a session
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Prerequisites — enable pgcrypto for gen_random_uuid() if needed
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. tenants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id         TEXT        PRIMARY KEY,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert the default single tenant used during the initial migration phase.
-- Additional tenants can be added here or via INSERT later.
INSERT INTO tenants (id, name)
VALUES ('default', 'Default Tenant')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id               TEXT        PRIMARY KEY,
  tenant_id        TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             TEXT,
  email            TEXT        NOT NULL,
  role             TEXT        NOT NULL DEFAULT 'Editor'
                                CHECK (role IN ('Admin', 'Editor', 'Viewer')),
  password         TEXT,
  password_changed BOOLEAN     DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_tenant_idx
  ON users (email, tenant_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS users_tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- ---------------------------------------------------------------------------
-- 3. keyword_map
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS keyword_map (
  id                 TEXT        PRIMARY KEY,
  tenant_id          TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  keyword            TEXT        NOT NULL,
  target_url         TEXT        NOT NULL,
  search_volume      INTEGER,
  difficulty         INTEGER,
  status             TEXT        NOT NULL DEFAULT 'Backlog'
                                  CHECK (status IN (
                                    'Backlog','Planned','Beauftragt','In Arbeit',
                                    'Angeliefert','Review','Optimierung','Published'
                                  )),
  editorial_deadline DATE,
  main_keyword       TEXT        NOT NULL DEFAULT 'N' CHECK (main_keyword IN ('Y','N')),
  article_count      INTEGER,
  avg_product_value  NUMERIC,
  policy             NUMERIC,
  priority_score     NUMERIC,
  ranking            INTEGER,
  action_type        TEXT        DEFAULT 'Erstellung'
                                  CHECK (action_type IN ('Erstellung','Optimierung')),
  page_type          TEXT        CHECK (page_type IN ('Ratgeber','Kategorie','Marke','Produkt')),
  last_published     DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS keyword_map_keyword_url_tenant_idx
  ON keyword_map (keyword, target_url, tenant_id);

CREATE INDEX IF NOT EXISTS keyword_map_tenant_idx ON keyword_map (tenant_id);
CREATE INDEX IF NOT EXISTS keyword_map_url_idx    ON keyword_map (target_url);

ALTER TABLE keyword_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS keyword_map_tenant_isolation ON keyword_map
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- ---------------------------------------------------------------------------
-- 4. keyword_map_editors  (Junction table: keyword_map ↔ users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS keyword_map_editors (
  keyword_id TEXT NOT NULL REFERENCES keyword_map(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  PRIMARY KEY (keyword_id, user_id)
);

-- No RLS needed — access is controlled through keyword_map

-- ---------------------------------------------------------------------------
-- 5. content_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_log (
  id           SERIAL      PRIMARY KEY,
  tenant_id    TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  keyword_id   TEXT        REFERENCES keyword_map(id) ON DELETE SET NULL,
  logged_url   TEXT,
  action_type  TEXT        CHECK (action_type IN ('Planung','Erstellung','Optimierung','KI-Chat')),
  page_type    TEXT        CHECK (page_type IN ('Ratgeber','Kategorie','Marke','Produkt')),
  content_body TEXT,
  diff_summary TEXT,
  editor_id    TEXT        REFERENCES users(id) ON DELETE SET NULL,
  time_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_changed TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_log_tenant_idx     ON content_log (tenant_id);
CREATE INDEX IF NOT EXISTS content_log_logged_url_idx ON content_log (logged_url);
CREATE INDEX IF NOT EXISTS content_log_keyword_idx    ON content_log (keyword_id);

ALTER TABLE content_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS content_log_tenant_isolation ON content_log
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- Automatically update time_changed on UPDATE
CREATE OR REPLACE FUNCTION update_time_changed()
RETURNS TRIGGER AS $$
BEGIN
  NEW.time_changed = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_log_time_changed_trigger ON content_log;
CREATE TRIGGER content_log_time_changed_trigger
  BEFORE UPDATE ON content_log
  FOR EACH ROW EXECUTE FUNCTION update_time_changed();

-- ---------------------------------------------------------------------------
-- 6. url_performance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS url_performance (
  id              SERIAL      PRIMARY KEY,
  tenant_id       TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_url      TEXT        NOT NULL,
  date            DATE        NOT NULL,
  gsc_clicks      INTEGER,
  gsc_impressions INTEGER,
  position        NUMERIC,
  sistrix_vi      NUMERIC
);

CREATE UNIQUE INDEX IF NOT EXISTS url_performance_url_date_tenant_idx
  ON url_performance (target_url, date, tenant_id);

CREATE INDEX IF NOT EXISTS url_performance_tenant_idx ON url_performance (tenant_id);

ALTER TABLE url_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS url_performance_tenant_isolation ON url_performance
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- ---------------------------------------------------------------------------
-- 7. keyword_ranking_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS keyword_ranking_history (
  id         SERIAL PRIMARY KEY,
  tenant_id  TEXT   NOT NULL REFERENCES tenants(id)      ON DELETE CASCADE,
  keyword_id TEXT   NOT NULL REFERENCES keyword_map(id)  ON DELETE CASCADE,
  date       DATE   NOT NULL,
  ranking    INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS keyword_ranking_kw_date_tenant_idx
  ON keyword_ranking_history (keyword_id, date, tenant_id);

CREATE INDEX IF NOT EXISTS keyword_ranking_tenant_idx
  ON keyword_ranking_history (tenant_id);

ALTER TABLE keyword_ranking_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS keyword_ranking_history_tenant_isolation ON keyword_ranking_history
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- ---------------------------------------------------------------------------
-- 8. blacklist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blacklist (
  id         SERIAL      PRIMARY KEY,
  tenant_id  TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  keyword    TEXT,
  target_url TEXT,
  type       TEXT        NOT NULL CHECK (type IN ('Keyword','URL')),
  reason     TEXT,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blacklist_tenant_idx ON blacklist (tenant_id);

ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS blacklist_tenant_isolation ON blacklist
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- ---------------------------------------------------------------------------
-- 9. cost_config
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cost_config (
  id            SERIAL  PRIMARY KEY,
  tenant_id     TEXT    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_type     TEXT    NOT NULL
                         CHECK (page_type IN ('Ratgeber','Kategorie','Marke','Produkt')),
  action_type   TEXT    NOT NULL
                         CHECK (action_type IN ('Erstellung','Optimierung')),
  agency_cost   NUMERIC NOT NULL DEFAULT 0,
  overhead_cost NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS cost_config_tenant_idx ON cost_config (tenant_id);

ALTER TABLE cost_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS cost_config_tenant_isolation ON cost_config
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- ---------------------------------------------------------------------------
-- 10. config  (key-value store, replaces Airtable Config table)
--     Stores plain values AND large JSON blobs (workflow engine state)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS config (
  tenant_id   TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key         TEXT        NOT NULL,
  value       TEXT,                       -- plain values and JSON blobs
  description TEXT,
  file_url    TEXT,                       -- replaces Airtable attachment field
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS config_tenant_idx ON config (tenant_id);

ALTER TABLE config ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS config_tenant_isolation ON config
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- ---------------------------------------------------------------------------
-- 11. audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL      PRIMARY KEY,
  tenant_id   TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id     TEXT        REFERENCES users(id) ON DELETE SET NULL,
  raw_payload JSONB       -- native JSON replaces Airtable TEXT field
);

CREATE INDEX IF NOT EXISTS audit_logs_tenant_idx ON audit_logs (tenant_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS audit_logs_tenant_isolation ON audit_logs
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- ---------------------------------------------------------------------------
-- 12. Application role + RLS helper
--     Create a dedicated DB role for the application and grant it access.
-- ---------------------------------------------------------------------------

-- Create role (idempotent — ignore error if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'seo_app') THEN
    CREATE ROLE seo_app LOGIN;
  END IF;
END
$$;

-- Grant table access to the application role
GRANT USAGE ON SCHEMA public TO seo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO seo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO seo_app;

-- Allow the role to call set_config (needed by withTenant())
GRANT EXECUTE ON FUNCTION set_config(text, text, boolean) TO seo_app;

-- ---------------------------------------------------------------------------
-- 13. Helper view: active config per tenant (optional convenience)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW config_current AS
SELECT tenant_id, key, value, file_url, updated_at
FROM config;

-- =============================================================================
-- Done. Connect with:
--   DATABASE_URL=postgresql://seo_app:<password>@<host>/<dbname>
--   TENANT_ID=default   (or per-deployment tenant ID)
-- =============================================================================

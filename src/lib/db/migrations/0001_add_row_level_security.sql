-- Migration: 0001_add_row_level_security
-- Adds Postgres Row Level Security (RLS) as a second enforcement layer on all
-- tenant-scoped tables. The application already filters by tenant_id in every
-- query, but RLS ensures that even a buggy or unreviewed query path cannot
-- accidentally leak data across tenants.
--
-- Policy design:
--   - USING clause: every SELECT/UPDATE/DELETE must match the session-local
--     config variable `app.tenant_id` set by withTenant() in src/lib/db/index.ts.
--   - WITH CHECK clause: every INSERT/UPDATE must write the same tenant_id.
--   - The policies are PERMISSIVE (default), so SuperAdmin code that connects
--     as a privileged role and sets the variable to the target tenant still works.
--   - FORCE ROW LEVEL SECURITY is intentionally NOT used: the table owner
--     (i.e. the DB user the application runs as) bypasses RLS automatically.
--     This keeps SuperAdmin direct queries and cron getAllTenants() working
--     without modification. In a hardened setup, create a separate unprivileged
--     DB role for the app and grant it table access — then RLS is enforced for
--     that role even without FORCE.
--   - `pricing_tiers` is intentionally excluded — it is global/shared data.
--   - `keyword_map_editors` is excluded — isolation flows through keyword_id FK.
--   - `content_log_body` is excluded — isolation flows through content_log_id FK.
--   - `tenants` is excluded — read access is needed to resolve tenant lists.

-- ---------------------------------------------------------------------------
-- Helper: current tenant from transaction-local config
-- Falls back to '' so the policy simply blocks rows when no tenant is set.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$
    SELECT COALESCE(current_setting('app.tenant_id', true), '')
  $$;

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- blacklist
-- ---------------------------------------------------------------------------
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY blacklist_tenant_isolation ON blacklist
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- config
-- ---------------------------------------------------------------------------
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

CREATE POLICY config_tenant_isolation ON config
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- content_log
-- ---------------------------------------------------------------------------
ALTER TABLE content_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_log_tenant_isolation ON content_log
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- cost_config
-- ---------------------------------------------------------------------------
ALTER TABLE cost_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_config_tenant_isolation ON cost_config
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- feature_requests
-- ---------------------------------------------------------------------------
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY feature_requests_tenant_isolation ON feature_requests
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- keyword_map
-- ---------------------------------------------------------------------------
ALTER TABLE keyword_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY keyword_map_tenant_isolation ON keyword_map
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- keyword_ranking_history
-- ---------------------------------------------------------------------------
ALTER TABLE keyword_ranking_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY keyword_ranking_history_tenant_isolation ON keyword_ranking_history
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- tenant_subscriptions
-- ---------------------------------------------------------------------------
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_subscriptions_tenant_isolation ON tenant_subscriptions
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- url_performance
-- ---------------------------------------------------------------------------
ALTER TABLE url_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY url_performance_tenant_isolation ON url_performance
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

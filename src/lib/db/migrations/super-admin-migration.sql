-- Super-Admin Migration
-- Run this against your existing database to add Super-Admin features
-- Date: 2026-05-13

-- 1. Extend user roles to include SuperAdmin
-- (No column change needed since role is text — just start using 'SuperAdmin' as a value)

-- 2. Pricing tiers
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  monthly_price NUMERIC NOT NULL DEFAULT 0,
  yearly_price  NUMERIC NOT NULL DEFAULT 0,
  features      JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tenant subscriptions
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  tenant_id     TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  tier_id       TEXT REFERENCES pricing_tiers(id) ON DELETE SET NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  start_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'trial')),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Feature requests & bug reports
CREATE TABLE IF NOT EXISTS feature_requests (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL DEFAULT 'feature' CHECK (type IN ('feature', 'bug')),
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','InValidation','Planned','InDevelopment','Released','Cancelled')),
  priority    TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feature_requests_tenant_idx ON feature_requests(tenant_id);
CREATE INDEX IF NOT EXISTS feature_requests_status_idx ON feature_requests(status);
CREATE INDEX IF NOT EXISTS feature_requests_type_idx   ON feature_requests(type);

-- 5. Quarterly planning field (added in follow-up iteration)
ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS planned_quarter TEXT;

-- 6. User active/inactive status (account locking)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

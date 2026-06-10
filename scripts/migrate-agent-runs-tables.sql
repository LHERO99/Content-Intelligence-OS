-- =============================================================================
-- Migration: Agent Workflow Runs Tables
-- Replaces JSON-blob storage in the config table with proper PostgreSQL tables.
-- Run once against the production database.
-- =============================================================================

-- ─── agent_workflow_runs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_workflow_runs (
  id                  TEXT        PRIMARY KEY,
  tenant_id           TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id         TEXT        NOT NULL,
  workflow_version_id TEXT        NOT NULL,
  trigger             TEXT        NOT NULL DEFAULT 'manual',
  -- pending | running | success | failed | cancelled
  status              TEXT        NOT NULL DEFAULT 'pending',
  idempotency_key     TEXT        NOT NULL,
  input               JSONB,
  output              JSONB,
  -- Stored separately for easy SQL access without JSONB parsing
  final_html          TEXT,
  -- Cancellation flag — set by cancel requests; running loop polls this
  cancel_requested    BOOLEAN     NOT NULL DEFAULT FALSE,
  deleted_at          TIMESTAMPTZ,
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  finished_at         TIMESTAMPTZ,
  duration_ms         INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS awr_tenant_idx        ON agent_workflow_runs(tenant_id);
CREATE INDEX IF NOT EXISTS awr_workflow_idx      ON agent_workflow_runs(tenant_id, workflow_id);
CREATE INDEX IF NOT EXISTS awr_status_idx        ON agent_workflow_runs(tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS awr_idempotency_idx
  ON agent_workflow_runs(tenant_id, workflow_version_id, idempotency_key);
CREATE INDEX IF NOT EXISTS awr_created_at_idx    ON agent_workflow_runs(tenant_id, created_at);

-- ─── agent_run_steps ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_run_steps (
  id              TEXT        PRIMARY KEY,
  tenant_id       TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id          TEXT        NOT NULL REFERENCES agent_workflow_runs(id) ON DELETE CASCADE,
  node_id         TEXT        NOT NULL,
  node_name       TEXT        NOT NULL,
  node_type       TEXT        NOT NULL,
  provider        TEXT        NOT NULL,
  model           TEXT        NOT NULL,
  attempt         INTEGER     NOT NULL DEFAULT 1,
  -- pending | running | success | failed | skipped
  status          TEXT        NOT NULL DEFAULT 'pending',
  round           INTEGER,
  -- orchestrator_decision | subagent_execution
  phase           TEXT,
  correlation_id  TEXT,
  -- Full payloads without any size limit
  input           JSONB,
  output          JSONB,
  error           TEXT,
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ars_tenant_idx    ON agent_run_steps(tenant_id);
CREATE INDEX IF NOT EXISTS ars_run_idx       ON agent_run_steps(run_id);
CREATE INDEX IF NOT EXISTS ars_round_idx     ON agent_run_steps(run_id, round);
CREATE INDEX IF NOT EXISTS ars_created_at_idx ON agent_run_steps(run_id, created_at);

-- ─── agent_run_messages ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_run_messages (
  id               TEXT        PRIMARY KEY,
  tenant_id        TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id           TEXT        NOT NULL REFERENCES agent_workflow_runs(id) ON DELETE CASCADE,
  from_node_id     TEXT        NOT NULL,
  from_node_name   TEXT        NOT NULL,
  to_node_id       TEXT        NOT NULL,
  to_node_name     TEXT        NOT NULL,
  channel          TEXT        NOT NULL,
  -- task_request | task_result | control
  message_type     TEXT,
  correlation_id   TEXT,
  round            INTEGER,
  target_input_key TEXT        NOT NULL,
  -- Full payload without truncation
  payload          JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS arm_tenant_idx      ON agent_run_messages(tenant_id);
CREATE INDEX IF NOT EXISTS arm_run_idx         ON agent_run_messages(run_id);
CREATE INDEX IF NOT EXISTS arm_correlation_idx ON agent_run_messages(run_id, correlation_id);
CREATE INDEX IF NOT EXISTS arm_created_at_idx  ON agent_run_messages(run_id, created_at);

-- =============================================================================
-- End of migration
-- =============================================================================

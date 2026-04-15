# Migration Guide: Airtable -> PostgreSQL (Agent Workflows)

This document defines the migration path for the Agent-Workflow MVP, which currently uses Airtable-backed JSON persistence via config keys.

## 1. Scope

Entities to migrate:

- `Workflow`
- `WorkflowVersion`
- `WorkflowNode`
- `WorkflowEdge`
- `WorkflowRun`
- `WorkflowRunStep`

Current Airtable storage keys:

- `AGENT_WORKFLOWS_V1`
- `AGENT_WORKFLOW_VERSIONS_V1`
- `AGENT_WORKFLOW_RUNS_V1`
- `AGENT_WORKFLOW_RUN_STEPS_V1`

## 2. Field Mapping

### workflows

- `id` -> `workflows.id` (UUID, PK)
- `tenantId` -> `workflows.tenant_id` (TEXT, indexed)
- `name` -> `workflows.name`
- `description` -> `workflows.description`
- `mode` -> `workflows.mode` (ENUM: default/custom)
- `state` -> `workflows.state` (ENUM: draft/published/archived)
- `draftVersionId` -> `workflows.draft_version_id` (FK)
- `activeVersionId` -> `workflows.active_version_id` (FK)
- `createdAt` -> `workflows.created_at`
- `updatedAt` -> `workflows.updated_at`
- `sourceRef` -> `workflows.source_ref` (nullable)

### workflow_versions

- `id` -> `workflow_versions.id` (UUID, PK)
- `tenantId` -> `workflow_versions.tenant_id`
- `workflowId` -> `workflow_versions.workflow_id` (FK)
- `version` -> `workflow_versions.version`
- `isPublished` -> `workflow_versions.is_published`
- `createdAt` -> `workflow_versions.created_at`
- `updatedAt` -> `workflow_versions.updated_at`

### workflow_nodes

- `id` -> `workflow_nodes.id` (UUID, PK)
- `tenantId` -> `workflow_nodes.tenant_id`
- `workflowVersionId` -> `workflow_nodes.workflow_version_id` (FK)
- `name` -> `workflow_nodes.name`
- `type` -> `workflow_nodes.type` (ENUM)
- `position` -> `workflow_nodes.position`
- `config` -> split columns:
  - `instruction`
  - `provider`
  - `model`
  - `timeout_ms`
  - `retries`
  - `enabled`
- `createdAt` -> `workflow_nodes.created_at`
- `updatedAt` -> `workflow_nodes.updated_at`

### workflow_edges

- `id` -> `workflow_edges.id` (UUID, PK)
- `tenantId` -> `workflow_edges.tenant_id`
- `workflowVersionId` -> `workflow_edges.workflow_version_id` (FK)
- `sourceNodeId` -> `workflow_edges.source_node_id` (FK)
- `targetNodeId` -> `workflow_edges.target_node_id` (FK)
- `createdAt` -> `workflow_edges.created_at`
- `updatedAt` -> `workflow_edges.updated_at`

### workflow_runs

- `id` -> `workflow_runs.id` (UUID, PK)
- `tenantId` -> `workflow_runs.tenant_id`
- `workflowId` -> `workflow_runs.workflow_id`
- `workflowVersionId` -> `workflow_runs.workflow_version_id`
- `trigger` -> `workflow_runs.trigger`
- `status` -> `workflow_runs.status`
- `idempotencyKey` -> `workflow_runs.idempotency_key`
- `input` -> `workflow_runs.input_jsonb`
- `startedAt` -> `workflow_runs.started_at`
- `finishedAt` -> `workflow_runs.finished_at`
- `durationMs` -> `workflow_runs.duration_ms`
- `createdAt` -> `workflow_runs.created_at`
- `updatedAt` -> `workflow_runs.updated_at`

### workflow_run_steps

- `id` -> `workflow_run_steps.id` (UUID, PK)
- `tenantId` -> `workflow_run_steps.tenant_id`
- `runId` -> `workflow_run_steps.run_id` (FK)
- `nodeId` -> `workflow_run_steps.node_id`
- `nodeName` -> `workflow_run_steps.node_name`
- `nodeType` -> `workflow_run_steps.node_type`
- `provider` -> `workflow_run_steps.provider`
- `model` -> `workflow_run_steps.model`
- `attempt` -> `workflow_run_steps.attempt`
- `status` -> `workflow_run_steps.status`
- `input` -> `workflow_run_steps.input_jsonb`
- `output` -> `workflow_run_steps.output_jsonb`
- `error` -> `workflow_run_steps.error`
- `startedAt` -> `workflow_run_steps.started_at`
- `finishedAt` -> `workflow_run_steps.finished_at`
- `durationMs` -> `workflow_run_steps.duration_ms`
- `createdAt` -> `workflow_run_steps.created_at`
- `updatedAt` -> `workflow_run_steps.updated_at`

## 3. Cutover Sequence

### Step A: Backfill

1. Read JSON blobs from Airtable config keys.
2. Validate entity schemas.
3. Insert into PostgreSQL in order:
   - workflows
   - workflow_versions
   - workflow_nodes
   - workflow_edges
   - workflow_runs
   - workflow_run_steps
4. Store migration watermark and record counts.

### Step B: Read Switch

1. Add feature flag `AGENT_WORKFLOW_READ_FROM_PG`.
2. Enable in staging.
3. Verify parity against Airtable snapshots.
4. Enable in production.

### Step C: Write Switch

1. Add feature flag `AGENT_WORKFLOW_WRITE_TO_PG`.
2. Temporarily dual-write (Airtable + PG) with integrity checks.
3. Disable Airtable write path once parity is stable.

### Step D: Airtable Decommission

1. Freeze Airtable workflow keys.
2. Keep read-only backup exports.
3. Remove Airtable repository adapter after observation window.

## 4. Multi-Tenant Readiness Checklist

- Every table contains `tenant_id`.
- Composite indexes include `tenant_id`.
- API attaches tenant context before repository calls.
- Secrets moved to per-tenant encrypted secret store.
- Add tenant-aware concurrency and quota controls.

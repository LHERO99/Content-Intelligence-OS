-- =============================================================================
-- Migration: Topic Map & Journey Mapping tables
-- =============================================================================

-- ---------------------------------------------------------------------------
-- topic_clusters
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "topic_clusters" (
  "id"          text PRIMARY KEY,
  "tenant_id"   text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name"        text NOT NULL,
  "description" text,
  "color"       text NOT NULL DEFAULT '#6366f1',
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "topic_clusters_tenant_idx"
  ON "topic_clusters"("tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "topic_clusters_name_tenant_idx"
  ON "topic_clusters"("name", "tenant_id");

-- ---------------------------------------------------------------------------
-- url_topic_clusters  (Junction: URL <-> Topic Cluster)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "url_topic_clusters" (
  "url_id"           text NOT NULL REFERENCES "urls"("id") ON DELETE CASCADE,
  "topic_cluster_id" text NOT NULL REFERENCES "topic_clusters"("id") ON DELETE CASCADE,
  "tenant_id"        text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("url_id", "topic_cluster_id")
);

CREATE INDEX IF NOT EXISTS "url_topic_clusters_tenant_idx"
  ON "url_topic_clusters"("tenant_id");

CREATE INDEX IF NOT EXISTS "url_topic_clusters_cluster_idx"
  ON "url_topic_clusters"("topic_cluster_id");

-- ---------------------------------------------------------------------------
-- topic_ideas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "topic_ideas" (
  "id"                 text PRIMARY KEY,
  "tenant_id"          text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "topic_cluster_id"   text NOT NULL REFERENCES "topic_clusters"("id") ON DELETE CASCADE,
  "keyword"            text NOT NULL,
  "search_volume"      integer,
  "keyword_difficulty" integer,
  "source"             text NOT NULL DEFAULT 'manual' CHECK ("source" IN ('manual', 'dataforseo')),
  "created_at"         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "topic_ideas_tenant_idx"
  ON "topic_ideas"("tenant_id");

CREATE INDEX IF NOT EXISTS "topic_ideas_cluster_idx"
  ON "topic_ideas"("topic_cluster_id");

-- ---------------------------------------------------------------------------
-- journeys
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "journeys" (
  "id"          text PRIMARY KEY,
  "tenant_id"   text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name"        text NOT NULL,
  "description" text,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "journeys_tenant_idx"
  ON "journeys"("tenant_id");

-- ---------------------------------------------------------------------------
-- journey_page_mappings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "journey_page_mappings" (
  "id"           text PRIMARY KEY,
  "tenant_id"    text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "journey_id"   text NOT NULL REFERENCES "journeys"("id") ON DELETE CASCADE,
  "url_id"       text NOT NULL REFERENCES "urls"("id") ON DELETE CASCADE,
  "funnel_phase" text NOT NULL CHECK ("funnel_phase" IN ('awareness', 'consideration', 'decision', 'retention')),
  "created_at"   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "journey_page_mappings_journey_url_idx"
  ON "journey_page_mappings"("journey_id", "url_id");

CREATE INDEX IF NOT EXISTS "journey_page_mappings_tenant_idx"
  ON "journey_page_mappings"("tenant_id");

CREATE INDEX IF NOT EXISTS "journey_page_mappings_journey_idx"
  ON "journey_page_mappings"("journey_id");

CREATE INDEX IF NOT EXISTS "journey_page_mappings_phase_idx"
  ON "journey_page_mappings"("journey_id", "funnel_phase");

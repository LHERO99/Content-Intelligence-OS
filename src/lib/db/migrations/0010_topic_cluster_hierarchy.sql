-- =============================================================================
-- Migration: Add parent_id to topic_clusters for arbitrary-depth hierarchy
-- =============================================================================

ALTER TABLE "topic_clusters"
  ADD COLUMN IF NOT EXISTS "parent_id" text REFERENCES "topic_clusters"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "topic_clusters_parent_idx"
  ON "topic_clusters"("parent_id");

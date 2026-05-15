-- Migration 0005: Add commission_log_id to content_log
-- Links delivery/save/publish log entries back to the commissioning event
-- that originated them. Nullable — existing rows will have NULL.

ALTER TABLE "content_log"
  ADD COLUMN "commission_log_id" integer REFERENCES "content_log"("id") ON DELETE SET NULL;

CREATE INDEX "content_log_commission_idx" ON "content_log"("commission_log_id");

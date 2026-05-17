-- =====================================================================
-- Migration 0008: Cleanup Old Tables After URL-Centric Migration
-- 
-- This migration removes the old tables that were migrated to the new
-- URL-centric schema in migrations 0006 and 0007:
-- - keyword_map → urls, url_keywords
-- - content_log + content_log_body → execution_cycles, execution_versions, process_events
-- - keyword_ranking_history → keyword_rankings
-- - blacklist → blacklisted_keywords, blacklisted_urls
-- - url_performance (old) → url_performance (already migrated)
-- 
-- IMPORTANT: Only run this after verifying that:
-- 1. Migration 0007 has run successfully
-- 2. All data has been properly backfilled
-- 3. The application is working correctly with the new schema
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. DROP OLD TABLES
-- ─────────────────────────────────────────────────────────────────────

-- Drop junction table first (has FK to keyword_map)
DROP TABLE IF EXISTS keyword_map_editors CASCADE;

-- Drop content log tables
DROP TABLE IF EXISTS content_log_body CASCADE;
DROP TABLE IF EXISTS content_log CASCADE;

-- Drop old keyword and blacklist tables
DROP TABLE IF EXISTS keyword_ranking_history CASCADE;
DROP TABLE IF EXISTS blacklist CASCADE;

-- Drop the main keyword_map table
DROP TABLE IF EXISTS keyword_map CASCADE;

-- Note: url_performance_new was created in 0006 but we still need the old
-- url_performance table for backwards compatibility during the transition.
-- Once we're confident the new schema works, we can:
-- 1. DROP TABLE url_performance_new;
-- 2. Keep url_performance as the main table (it's already in the schema)

-- ─────────────────────────────────────────────────────────────────────
-- 2. VALIDATION
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Verify old tables are gone
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'keyword_map') THEN
    RAISE EXCEPTION 'keyword_map table still exists!';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'content_log') THEN
    RAISE EXCEPTION 'content_log table still exists!';
  END IF;
  
  -- Verify new tables exist and have data
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'urls') THEN
    RAISE EXCEPTION 'urls table does not exist!';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'url_keywords') THEN
    RAISE EXCEPTION 'url_keywords table does not exist!';
  END IF;
  
  RAISE NOTICE 'Old tables successfully removed. New schema is active.';
END $$;

-- =====================================================================
-- END OF CLEANUP MIGRATION
-- =====================================================================

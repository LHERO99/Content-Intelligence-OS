-- =============================================================================
-- SEO Content Tool — Performance Migration
-- Führe dieses Script in pgAdmin aus (Query Tool → F5)
-- Alle Befehle sind idempotent (IF NOT EXISTS / CREATE INDEX CONCURRENTLY)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. content_log_body — neue Tabelle für große Texte
-- Trennt Content-Body (~15KB) vom Metadata-Row in content_log.
-- Ermöglicht schnelle Metadaten-Queries ohne große Texte zu laden.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_log_body (
  content_log_id INTEGER PRIMARY KEY REFERENCES content_log(id) ON DELETE CASCADE,
  content_body   TEXT,
  diff_summary   TEXT
);

-- Bestehende content_body Daten migrieren (falls content_log noch die alten Spalten hat)
-- Nur ausführen wenn content_log noch content_body / diff_summary Spalten hat:
-- INSERT INTO content_log_body (content_log_id, content_body, diff_summary)
-- SELECT id, content_body, diff_summary
-- FROM content_log
-- WHERE content_body IS NOT NULL OR diff_summary IS NOT NULL
-- ON CONFLICT (content_log_id) DO NOTHING;

-- Alte Spalten aus content_log entfernen (nach Datenmigration):
-- ALTER TABLE content_log DROP COLUMN IF EXISTS content_body;
-- ALTER TABLE content_log DROP COLUMN IF EXISTS diff_summary;

-- ---------------------------------------------------------------------------
-- 2. Neue Indexes — keyword_map
-- CONCURRENTLY: kein Table-Lock, läuft im Hintergrund (dauert etwas länger)
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS keyword_map_status_idx
  ON keyword_map (tenant_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS keyword_map_priority_idx
  ON keyword_map (tenant_id, priority_score);

CREATE INDEX CONCURRENTLY IF NOT EXISTS keyword_map_main_kw_idx
  ON keyword_map (tenant_id, target_url, main_keyword);

-- ---------------------------------------------------------------------------
-- 3. Neue Indexes — keyword_map_editors
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS keyword_map_editors_user_idx
  ON keyword_map_editors (user_id);

-- ---------------------------------------------------------------------------
-- 4. Neue Indexes — content_log
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS content_log_time_idx
  ON content_log (tenant_id, time_created DESC);

-- ---------------------------------------------------------------------------
-- 5. Neue Indexes — url_performance (kritisch bei 32 Mio Zeilen)
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS url_performance_date_idx
  ON url_performance (tenant_id, date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS url_performance_url_date_combined_idx
  ON url_performance (tenant_id, target_url, date DESC);

-- ---------------------------------------------------------------------------
-- 6. Neue Indexes — keyword_ranking_history (kritisch bei 46 Mio Zeilen)
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS keyword_ranking_date_idx
  ON keyword_ranking_history (tenant_id, date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS keyword_ranking_kw_date_combined_idx
  ON keyword_ranking_history (tenant_id, keyword_id, date DESC);

-- ---------------------------------------------------------------------------
-- 7. Neue Indexes — blacklist (für DB-level filtering in getKeywordMap)
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS blacklist_kw_lookup_idx
  ON blacklist (tenant_id, keyword);

CREATE INDEX CONCURRENTLY IF NOT EXISTS blacklist_url_lookup_idx
  ON blacklist (tenant_id, target_url);

-- ---------------------------------------------------------------------------
-- 8. Neue Indexes — audit_logs
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_timestamp_idx
  ON audit_logs (tenant_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_action_idx
  ON audit_logs (tenant_id, action);

-- ---------------------------------------------------------------------------
-- 9. Automatische Retention via pg_cron (optional)
-- Nur ausführen wenn pg_cron Extension verfügbar ist.
-- Alternativ: Coolify Cron → GET /api/cron/purge-old-data (wöchentlich)
-- ---------------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- -- Audit Logs älter als 180 Tage löschen (jeden Sonntag 03:00)
-- SELECT cron.schedule('purge-audit-logs', '0 3 * * 0',
--   $$DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '180 days'$$
-- );
--
-- -- Performance Daten älter als 400 Tage löschen (jeden Sonntag 03:30)
-- SELECT cron.schedule('purge-performance-data', '30 3 * * 0',
--   $$DELETE FROM url_performance WHERE date < (NOW() - INTERVAL '400 days')::date$$
-- );

-- ---------------------------------------------------------------------------
-- 10. Analyse-Statistiken aktualisieren
-- Damit der Query Planner die neuen Indexes sofort optimal nutzt
-- ---------------------------------------------------------------------------
ANALYZE keyword_map;
ANALYZE content_log;
ANALYZE url_performance;
ANALYZE keyword_ranking_history;
ANALYZE blacklist;
ANALYZE audit_logs;

-- =============================================================================
-- Fertig. Alle Indexes wurden angelegt, Tabelle content_log_body erstellt.
--
-- Nächste Schritte:
-- 1. App neu deployen
-- 2. Coolify Cron anlegen: GET /api/cron/purge-old-data — wöchentlich
--    (z.B. "0 3 * * 0" = Sonntags 03:00)
-- =============================================================================

-- =====================================================================
-- Migration 0007: Backfill Data from Old Schema to New Schema
-- 
-- This migration populates the new tables with data from:
-- - keyword_map → urls, url_keywords, planning_status
-- - content_log → execution_cycles, execution_versions, process_events
-- - keyword_ranking_history → keyword_rankings
-- - url_performance (old) → url_performance_new
-- - blacklist → blacklisted_keywords, blacklisted_urls
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. MIGRATE URLS (Extract unique URLs from keyword_map)
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO urls (id, tenant_id, url, page_type, created_at, updated_at)
SELECT 
  gen_random_uuid()::text AS id,
  tenant_id,
  target_url AS url,
  page_type,
  MIN(COALESCE(created_at, now())) AS created_at,
  now() AS updated_at
FROM keyword_map
GROUP BY tenant_id, target_url, page_type
ON CONFLICT (url, tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 2. MIGRATE URL_KEYWORDS (from keyword_map)
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO url_keywords (
  id,
  tenant_id,
  url_id,
  keyword,
  is_main_keyword,
  search_volume,
  difficulty,
  ranking,
  priority_score,
  article_count,
  avg_product_value,
  policy,
  created_at
)
SELECT 
  km.id,
  km.tenant_id,
  u.id AS url_id,
  km.keyword,
  (km.main_keyword = 'Y') AS is_main_keyword,
  km.search_volume,
  km.difficulty,
  km.ranking,
  km.priority_score,
  km.article_count,
  km.avg_product_value,
  km.policy,
  COALESCE(km.created_at, now()) AS created_at
FROM keyword_map km
JOIN urls u ON u.url = km.target_url AND u.tenant_id = km.tenant_id
ON CONFLICT (keyword, url_id, tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 3. MIGRATE URL_KEYWORD_EDITORS (from keyword_map_editors)
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO url_keyword_editors (keyword_id, user_id)
SELECT 
  kme.keyword_id,
  kme.user_id
FROM keyword_map_editors kme
WHERE EXISTS (SELECT 1 FROM url_keywords WHERE id = kme.keyword_id)
ON CONFLICT (keyword_id, user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 4. MIGRATE PLANNING_STATUS (from keyword_map - main keywords only)
-- ─────────────────────────────────────────────────────────────────────

-- Only create planning_status for URLs that have a main keyword
-- Status mapping:
--   'Backlog' → 'backlog'
--   'Planned' → 'planned'
--   'Beauftragt', 'In Arbeit', 'Angeliefert', 'Review', 'Published' → 'planned' (was in workflow)
--   'Optimierung' → 'planned'

INSERT INTO planning_status (
  tenant_id,
  url_id,
  status,
  editorial_deadline,
  priority_score,
  planned_action_type,
  assigned_editor_id,
  created_at,
  updated_at
)
SELECT DISTINCT ON (u.id)
  u.tenant_id,
  u.id AS url_id,
  CASE 
    WHEN km.status = 'Backlog' THEN 'backlog'::planning_status_enum
    WHEN km.status = 'Planned' THEN 'planned'::planning_status_enum
    WHEN km.status = 'Published' THEN 'planned'::planning_status_enum -- Keep as planned for potential re-optimization
    ELSE 'backlog'::planning_status_enum
  END AS status,
  km.editorial_deadline,
  km.priority_score,
  CASE 
    WHEN km.action_type = 'Erstellung' THEN 'creation'::action_type_enum
    WHEN km.action_type = 'Optimierung' THEN 'optimization'::action_type_enum
    ELSE 'creation'::action_type_enum
  END AS planned_action_type,
  (
    SELECT user_id 
    FROM keyword_map_editors kme 
    WHERE kme.keyword_id = km.id 
    LIMIT 1
  ) AS assigned_editor_id,
  COALESCE(km.created_at, now()) AS created_at,
  now() AS updated_at
FROM urls u
JOIN keyword_map km ON km.target_url = u.url AND km.tenant_id = u.tenant_id
WHERE km.main_keyword = 'Y'
ORDER BY u.id, km.priority_score DESC NULLS LAST
ON CONFLICT (url_id, tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 5. MIGRATE EXECUTION_CYCLES (from content_log - commissioning events)
-- ─────────────────────────────────────────────────────────────────────

-- Identify commissioning events (where commission_log_id IS NULL or event has "beauftragt")
WITH commissioning_logs AS (
  SELECT 
    cl.id,
    cl.tenant_id,
    cl.keyword_id,
    km.target_url,
    cl.action_type,
    cl.time_created,
    cl.editor_id,
    -- Calculate cycle number per URL
    ROW_NUMBER() OVER (
      PARTITION BY km.target_url, km.tenant_id 
      ORDER BY cl.time_created
    ) AS cycle_number,
    -- Determine if delivered
    EXISTS (
      SELECT 1 
      FROM content_log cl2 
      JOIN content_log_body clb2 ON clb2.content_log_id = cl2.id
      WHERE cl2.commission_log_id = cl.id 
        AND clb2.content_body IS NOT NULL
    ) AS has_delivery,
    -- Check for published status
    EXISTS (
      SELECT 1 
      FROM content_log cl3
      JOIN content_log_body clb3 ON clb3.content_log_id = cl3.id
      WHERE cl3.commission_log_id = cl.id
        AND clb3.event_label ILIKE '%veröffentlicht%'
    ) AS was_published
  FROM content_log cl
  JOIN keyword_map km ON km.id = cl.keyword_id
  LEFT JOIN content_log_body clb ON clb.content_log_id = cl.id
  WHERE (
    cl.commission_log_id IS NULL 
    OR clb.event_label ILIKE '%beauftragt%'
  )
  AND cl.action_type IN ('Erstellung', 'Optimierung')
)
INSERT INTO execution_cycles (
  id,
  tenant_id,
  url_id,
  cycle_number,
  action_type,
  status,
  commissioned_by_user_id,
  commissioned_at,
  delivered_at,
  agent_run_id,
  created_at,
  updated_at
)
SELECT 
  c.id,
  c.tenant_id,
  u.id AS url_id,
  c.cycle_number,
  CASE c.action_type
    WHEN 'Erstellung' THEN 'creation'::action_type_enum
    WHEN 'Optimierung' THEN 'optimization'::action_type_enum
    ELSE 'creation'::action_type_enum
  END AS action_type,
  CASE 
    WHEN c.has_delivery THEN 'delivered'::execution_status_enum
    ELSE 'failed'::execution_status_enum
  END AS status,
  c.editor_id AS commissioned_by_user_id,
  c.time_created AS commissioned_at,
  CASE 
    WHEN c.has_delivery THEN (
      SELECT MIN(cl2.time_created)
      FROM content_log cl2
      WHERE cl2.commission_log_id = c.id
    )
    ELSE NULL
  END AS delivered_at,
  NULL AS agent_run_id,
  c.time_created AS created_at,
  now() AS updated_at
FROM commissioning_logs c
JOIN urls u ON u.url = c.target_url AND u.tenant_id = c.tenant_id
ON CONFLICT (url_id, cycle_number, tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 6. MIGRATE EXECUTION_VERSIONS (from content_log_body)
-- ─────────────────────────────────────────────────────────────────────

-- Get all content deliveries and saves linked to commission cycles
WITH delivery_and_saves AS (
  SELECT 
    cl.id,
    cl.commission_log_id AS cycle_id,
    cl.tenant_id,
    clb.content_body,
    clb.event_label,
    cl.editor_id,
    cl.time_created,
    -- Version number per cycle
    ROW_NUMBER() OVER (
      PARTITION BY cl.commission_log_id 
      ORDER BY cl.time_created
    ) AS version_number,
    -- Detect AI-generated content
    (clb.event_label ILIKE '%KI-%' OR clb.event_label ILIKE '%AI%') AS is_ai_generated
  FROM content_log cl
  JOIN content_log_body clb ON clb.content_log_id = cl.id
  WHERE cl.commission_log_id IS NOT NULL
    AND clb.content_body IS NOT NULL
    AND EXISTS (SELECT 1 FROM execution_cycles WHERE id = cl.commission_log_id)
)
INSERT INTO execution_versions (
  tenant_id,
  cycle_id,
  version_number,
  content_html,
  diff_summary,
  created_by_user_id,
  created_by_ai,
  ai_provider,
  ai_model,
  ai_instructions,
  created_at
)
SELECT 
  d.tenant_id,
  d.cycle_id,
  d.version_number,
  d.content_body AS content_html,
  d.event_label AS diff_summary,
  d.editor_id AS created_by_user_id,
  d.is_ai_generated AS created_by_ai,
  CASE 
    WHEN d.is_ai_generated THEN 
      -- Try to extract provider from event_label like "KI-Chat (openai/gpt-4)"
      CASE 
        WHEN d.event_label ~ '\([^/]+/' THEN 
          substring(d.event_label from '\(([^/]+)/')
        ELSE NULL
      END
    ELSE NULL
  END AS ai_provider,
  CASE 
    WHEN d.is_ai_generated THEN 
      -- Try to extract model from event_label
      CASE 
        WHEN d.event_label ~ '/[^\)]+\)' THEN 
          substring(d.event_label from '/([^\)]+)\)')
        ELSE NULL
      END
    ELSE NULL
  END AS ai_model,
  CASE 
    WHEN d.is_ai_generated THEN 
      -- Try to extract instructions after colon
      CASE 
        WHEN d.event_label ~ ':\s*' THEN 
          substring(d.event_label from ':\s*(.+)$')
        ELSE NULL
      END
    ELSE NULL
  END AS ai_instructions,
  d.time_created AS created_at
FROM delivery_and_saves d
ON CONFLICT (cycle_id, version_number) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 7. MIGRATE PUBLISHING_STATUS (from keyword_map + content_log)
-- ─────────────────────────────────────────────────────────────────────

-- Create publishing_status for cycles that have at least one version
INSERT INTO publishing_status (
  tenant_id,
  cycle_id,
  version_id,
  status,
  published_by_user_id,
  published_at,
  created_at,
  updated_at
)
SELECT 
  ec.tenant_id,
  ec.id AS cycle_id,
  -- Get latest version for this cycle
  (
    SELECT id 
    FROM execution_versions 
    WHERE cycle_id = ec.id 
    ORDER BY version_number DESC 
    LIMIT 1
  ) AS version_id,
  -- Determine status from keyword_map and logs
  CASE 
    WHEN km.status = 'Published' AND km.last_published IS NOT NULL THEN 'published'::publishing_status_enum
    WHEN km.status = 'Review' THEN 'in_review'::publishing_status_enum
    WHEN km.status = 'Angeliefert' THEN 'approved'::publishing_status_enum
    ELSE 'draft'::publishing_status_enum
  END AS status,
  -- Find who published it
  (
    SELECT cl.editor_id
    FROM content_log cl
    JOIN content_log_body clb ON clb.content_log_id = cl.id
    WHERE cl.commission_log_id = ec.id
      AND clb.event_label ILIKE '%veröffentlicht%'
    ORDER BY cl.time_created DESC
    LIMIT 1
  ) AS published_by_user_id,
  -- Published date
  CASE 
    WHEN km.status = 'Published' THEN km.last_published::timestamp with time zone
    ELSE NULL
  END AS published_at,
  ec.created_at,
  now() AS updated_at
FROM execution_cycles ec
JOIN urls u ON u.id = ec.url_id
JOIN keyword_map km ON km.target_url = u.url AND km.tenant_id = u.tenant_id AND km.main_keyword = 'Y'
WHERE EXISTS (
  SELECT 1 FROM execution_versions WHERE cycle_id = ec.id
)
ON CONFLICT (cycle_id, tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 8. MIGRATE PROCESS_EVENTS (from content_log)
-- ─────────────────────────────────────────────────────────────────────

-- Map content_log events to structured process_events
INSERT INTO process_events (
  tenant_id,
  event_type,
  url_id,
  keyword_id,
  cycle_id,
  version_id,
  user_id,
  event_data,
  event_timestamp
)
SELECT 
  cl.tenant_id,
  -- Map event_label to event_type enum
  CASE 
    WHEN clb.event_label ILIKE '%beauftragt%' THEN 'cycle_commissioned'::event_type_enum
    WHEN clb.event_label ILIKE '%angeliefert%' THEN 'cycle_delivered'::event_type_enum
    WHEN clb.event_label ILIKE '%veröffentlicht%' THEN 'content_published'::event_type_enum
    WHEN clb.event_label ILIKE '%geplant%' OR clb.event_label ILIKE '%hinzugefügt%' THEN 'url_planned'::event_type_enum
    WHEN clb.event_label ILIKE '%blacklist%' THEN 'url_blacklisted'::event_type_enum
    WHEN clb.event_label ILIKE '%KI-%' OR clb.event_label ILIKE '%AI%' THEN 'version_edited'::event_type_enum
    ELSE 'version_created'::event_type_enum
  END AS event_type,
  -- url_id
  (
    SELECT u.id 
    FROM urls u 
    WHERE u.url = COALESCE(cl.logged_url, km.target_url) 
      AND u.tenant_id = cl.tenant_id 
    LIMIT 1
  ) AS url_id,
  -- keyword_id (map to new url_keywords)
  (
    SELECT uk.id
    FROM url_keywords uk
    WHERE uk.id = cl.keyword_id
    LIMIT 1
  ) AS keyword_id,
  -- cycle_id
  CASE 
    WHEN cl.commission_log_id IS NOT NULL THEN cl.commission_log_id
    WHEN clb.event_label ILIKE '%beauftragt%' THEN cl.id
    ELSE NULL
  END AS cycle_id,
  -- version_id (try to find matching version)
  (
    SELECT ev.id
    FROM execution_versions ev
    WHERE ev.cycle_id = COALESCE(cl.commission_log_id, cl.id)
      AND ev.content_html = clb.content_body
    ORDER BY ev.version_number DESC
    LIMIT 1
  ) AS version_id,
  cl.editor_id AS user_id,
  -- Store original data in JSONB
  jsonb_build_object(
    'original_event_label', clb.event_label,
    'action_type', cl.action_type,
    'page_type', cl.page_type,
    'logged_url', cl.logged_url
  ) AS event_data,
  cl.time_created AS event_timestamp
FROM content_log cl
LEFT JOIN content_log_body clb ON clb.content_log_id = cl.id
LEFT JOIN keyword_map km ON km.id = cl.keyword_id
WHERE clb.event_label IS NOT NULL OR cl.action_type IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 9. MIGRATE KEYWORD_RANKINGS (from keyword_ranking_history)
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO keyword_rankings (
  tenant_id,
  keyword_id,
  date,
  ranking
)
SELECT 
  krh.tenant_id,
  krh.keyword_id,
  krh.date,
  krh.ranking
FROM keyword_ranking_history krh
WHERE EXISTS (SELECT 1 FROM url_keywords WHERE id = krh.keyword_id)
ON CONFLICT (keyword_id, date, tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 10. MIGRATE URL_PERFORMANCE (old table → new table)
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO url_performance_new (
  tenant_id,
  url_id,
  date,
  gsc_clicks,
  gsc_impressions,
  position,
  sistrix_vi
)
SELECT 
  up.tenant_id,
  u.id AS url_id,
  up.date,
  up.gsc_clicks,
  up.gsc_impressions,
  up.position,
  up.sistrix_vi
FROM url_performance up
JOIN urls u ON u.url = up.target_url AND u.tenant_id = up.tenant_id
ON CONFLICT (url_id, date, tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 11. MIGRATE BLACKLIST (split into keywords and URLs)
-- ─────────────────────────────────────────────────────────────────────

-- Migrate keyword blacklist entries
INSERT INTO blacklisted_keywords (
  tenant_id,
  keyword,
  reason,
  added_by_user_id,
  added_at
)
SELECT 
  tenant_id,
  keyword,
  reason,
  NULL AS added_by_user_id, -- old table doesn't have this
  added_at
FROM blacklist
WHERE type = 'Keyword' AND keyword IS NOT NULL
ON CONFLICT (keyword, tenant_id) DO NOTHING;

-- Migrate URL blacklist entries
INSERT INTO blacklisted_urls (
  tenant_id,
  url_id,
  reason,
  added_by_user_id,
  added_at
)
SELECT 
  b.tenant_id,
  u.id AS url_id,
  b.reason,
  NULL AS added_by_user_id,
  b.added_at
FROM blacklist b
JOIN urls u ON u.url = b.target_url AND u.tenant_id = b.tenant_id
WHERE b.type = 'URL' AND b.target_url IS NOT NULL
ON CONFLICT (url_id, tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 12. VALIDATION QUERIES
-- ─────────────────────────────────────────────────────────────────────

-- These are just informational - run manually to verify migration

-- Count checks
DO $$
DECLARE
  v_keyword_map_count INTEGER;
  v_url_keywords_count INTEGER;
  v_urls_count INTEGER;
  v_unique_urls_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_keyword_map_count FROM keyword_map;
  SELECT COUNT(*) INTO v_url_keywords_count FROM url_keywords;
  SELECT COUNT(*) INTO v_urls_count FROM urls;
  SELECT COUNT(DISTINCT target_url) INTO v_unique_urls_count FROM keyword_map;
  
  RAISE NOTICE 'keyword_map count: %', v_keyword_map_count;
  RAISE NOTICE 'url_keywords count: %', v_url_keywords_count;
  RAISE NOTICE 'urls count: %', v_urls_count;
  RAISE NOTICE 'unique URLs in keyword_map: %', v_unique_urls_count;
  
  IF v_keyword_map_count != v_url_keywords_count THEN
    RAISE WARNING 'Mismatch: keyword_map (%) != url_keywords (%)', v_keyword_map_count, v_url_keywords_count;
  END IF;
  
  IF v_urls_count != v_unique_urls_count THEN
    RAISE WARNING 'Mismatch: urls (%) != unique URLs in keyword_map (%)', v_urls_count, v_unique_urls_count;
  END IF;
END $$;

-- =====================================================================
-- END OF BACKFILL MIGRATION
-- =====================================================================

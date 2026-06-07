# TODO Historie

## Abgeschlossen (chronologisch)

- [x] **GeneralSettingsTab & TENANT_DOMAIN (02.06.2026 + 07.06.2026)**
  - `BrandingTab` durch `GeneralSettingsTab` ersetzt (Domain + Branding in einem Tab)
  - Admin-Panel: Tab "Allgemein" als neuer Default-Tab
  - `SetupStatus.tenantDomain: { ok: boolean }` als Pflichtfeld hinzugefügt
  - Dashboard-Checkliste: `tenantDomain.ok` ist Bedingung für Ausblenden
  - `syncDataForSeoForKeywords()`: `tenantDomain`-Parameter für korrekte Ranking-Abfragen
  - Monitoring: `isPublished` auf `k.Status === 'Published'` umgestellt
  - i18n: `setup.tenantDomain*` + `admin.general` Keys
  - URL-Tooltip in Monitoring-Tabelle

- [x] **HistoryList: User-Info & Keywords im Editor (31.05.2026)**
  - `ContentLog`: `User_Name?` + `User_Email?` hinzugefügt
  - `getContentLogs()` JOIN auf `usersTable` → User-Daten in einer Query
  - HistoryItem zeigt User-Icon + Name/Email unterhalb Timestamp
  - Neuer Endpoint `GET /api/planning/keywords/by-url`
  - `AIEditorWorkspace`: `targetUrl`-Prop + Keywords-Info-Block mit Badges

## Offen / Ausstehend


  - Problem 1: Commission erstellte keine execution_cycles → Keyword blieb in Redaktionsplan
  - Problem 2: Content wurde nicht in execution_versions gespeichert → "KI generiert..." trotz Content
  - Problem 3: Alle Keywords (nicht nur Main) in Auftragsliste
  - Problem 4: Manual Save funktionierte nicht (keine Version erstellt)
  - Problem 5: Case-Mismatch contentBody vs Content_Body
  - Fix: createExecutionCycle() + createExecutionVersion() Funktionen erstellt
  - Fix: trigger/route.ts - Commission erstellt Cycle, Success/Failure updated/deleted Cycle
  - Fix: callback/route.ts - External Agent Delivery erstellt Version + updated Cycle
  - Fix: /api/planning/history POST - Manual Save erstellt neue Version (versionNumber++)
  - Fix: Main Keyword Filter in creation/page.tsx und editorial-planning.tsx
  - Fix: Case-Mismatch in creation/page.tsx und HistoryList.tsx behoben
  - Fix: Cycle_Id vs Commission_Log_Id Trennung in createContentLog
  - Fix: Auto-Resolution von commissionLogId aus process_events
  - SQL-Migration für alte Daten ausgeführt
  - Legacy-Files (postgres-legacy.ts, postgres-old-backup.ts) → .bak
  - Debug-Logging vollständig entfernt nach Fertigstellung
  - TypeScript-Build erfolgreich
  - Kompletter Workflow funktional: Commission → Delivery → Save → Display

- [x] **DB-Schema-Refactoring: URL-zentrische Architektur (17.05.2026)**
  - Neue Tabellen: urls, url_keywords, planning_status, execution_cycles, execution_versions, publishing_status, process_events
  - Vollständige Daten-Migration via COMPLETE_MIGRATION.sql
  - postgres.ts auf neue Architektur migriert
  - 50+ API-Routen und UI-Komponenten angepasst
  - TypeScript-Build erfolgreich
  - Alte Tabellen bleiben als Fallback

- [x] Fix: Build-Fehler `ai-editor-workspace.tsx` (Orphaned CSS + TooltipTrigger TypeScript-Fix).

- [x] Fix: `/api/branding` in Middleware als public path freigeschaltet.
- [x] Fix: Custom `cookies`-Config aus `authOptions` entfernt (Cookie-Name-Mismatch auf Vercel).
- [x] Fix: `NEXTAUTH_URL` korrekt in Vercel für Production und Preview gesetzt.
- [x] Debug: Temporärer `/api/debug/env-check` Endpoint erstellt und wieder entfernt.
- [x] Feature: Externer Agent Webhook — Admin kann zwischen internem Agent Builder und externem Webhook wechseln.
- [x] Feature: GSC OAuth Flow — Google Search Console Anbindung via OAuth.
- [x] Feature: DataForSEO Integration — Rankings fetchen via SERP-API.
- [x] Feature: `sync-performance.ts` — Orchestrierung GSC + DataForSEO + Sistrix.
- [x] Feature: Vercel Cron `GET /api/cron/sync-gsc` (Mo 04:00 UTC) + `sync-dataforseo` (Mo 04:30 UTC).
- [x] Feature: `getKeywordsByUrl(targetUrl)` in `airtable.ts` ergänzt.
- [x] Feature: `agent-settings-tab.tsx` — Admin-Tab für externen Webhook mit Test-Ping.
- [x] Feature: `admin-integrations.ts` — `google_search_console` als neuer Provider.
- [x] KI-Chat Feature: `AIChatPanel` + `AIEditorWorkspace` vollständig implementiert.
- [x] KI-Chat Fix: Stale-closure race condition in `onApplyChanges` behoben.
- [x] KI-Chat Fix: Airtable 422 für `Action_Type: 'KI-Chat'` behoben.
- [x] API: `/api/planning/history` POST macht `actionType` optional.
- [x] Agent Builder V2 als Standard etabliert, V1 entfernt.
- [x] OpenAI als ausführbarer Provider im Agent-Runner integriert.
- [x] Integrationen: Model Discovery Endpoint eingeführt.
- [x] Admin Integrationen-Tab auf Master-Detail UX umgestellt.
- [x] Agent Runtime: Orchestrator Round-Loop implementiert.
- [x] Agent Runtime: Strukturierte Parent-Decision Auswertung implementiert.
- [x] Agent Runtime: A2A-Messages typisiert inkl. `round`/`correlationId`.
- [x] Node-Config Datenmodell um `purpose`, `inputContract`, `outputContract` erweitert.
- [x] Builder: Node-Konfiguration UX komplett neu strukturiert.
- [x] Builder: Pre-Run Validierung ergänzt.
- [x] Run-API/Service: `runFrom` ergänzt; Commissioning auf `published` gesetzt.
- [x] Ranking-System integriert (Airtable, Types, UI).
- [x] Striking Distance Priorisierung implementiert.
- [x] Aktualitäts-Faktor in Priorisierung aufgenommen.
- [x] Tab-Refactoring: Vorschläge-Tab erstellt, Trend-Radar entfernt.
- [x] Zentralisiertes Status-Logging in `airtable.ts`.
- [x] Schema: `Reasoning_Chain` systemweit entfernt.
- [x] Architektur: Performance-Speicherung auf `URL_Performance` & `Keyword_Ranking_History` umgestellt.
- [x] Fix: `Keyword_ID` in `upsertKeywordRankingHistory` von Array auf plain String geändert.
- [x] Fix: `sync-performance.ts` — `null`-Rankings → `Ranking: 101` als Sonderwert.
- [x] Feature: Debug-Endpoint `/api/admin/debug` um vollständige DataForSEO End-to-End-Diagnose erweitert.
- [x] UI: Keyword-Ranking-Chart auf logarithmische Y-Achse umgestellt.
- [x] UI: Keywords-Karte in URL-Detail komplett neu gestaltet.
- [x] UI: Content Monitoring URL-Detail — ReferenceLine für Erstellungs-/Optimierungszeitpunkt.
- [x] Feature: Dynamic Branding Tab im Admin-Bereich (Logo, Favicon, Primärfarbe).
- [x] Refactor: Branding-Upload nutzt nun native Airtable Attachments.
- [x] i18n: LanguageProvider + useI18n Hook + LanguageSwitcher implementiert (DE/EN).
- [x] i18n: Alle UI-Komponenten vollständig lokalisiert.

## System Health Dashboard (30.04.2026)
- [x] Refactor: Provider-Test-Funktionen in `src/lib/integration-tests.ts` extrahiert.
- [x] Feature: `createAuditLog(action, rawPayload?)` Hilfsfunktion in `airtable.ts` ergänzt.
- [x] Feature: Neue Cron-Routes mit AuditLog-Einträgen.
- [x] Feature: `GET /api/system-health` — Admin-only, aggregiert alle Health-Checks.
- [x] Feature: `SystemHealthCard`-Komponente.

## Agent Flow: finalHtml & Content-Delivery-Pipeline (01.05.2026)
- [x] Feature: `OrchestratorDecision` um `finalHtml?: string` erweitert.
- [x] Feature: 3-stufige `capturedFinalHtml`-Fallback-Kette implementiert.
- [x] Feature: `finalOutput` wird in-memory injiziert, nicht in Airtable geschrieben.
- [x] Feature: `trigger/route.ts` — Nach erfolgreichem Run Status + Content-Log schreiben.
- [x] Fix: `Event_Label: 'Content angeliefert'` (exakter String für HistoryList-Preview-Gate).

## Optimistisches UI: Commissioning-Button (01.05.2026)
- [x] Fix: `setCommissionedIds` + `addAlert` vor `await triggerN8nAction(...)` verschoben.
- [x] Fix: Bei API-Fehler optimistisches Update rückgängig machen.

## Tenant-Isolation (13.05.2026)
- [x] Alle API-Routes auf `session.user.tenantId` umgestellt.
- [x] Security-Fix: `lookup-tenants/route.ts` — Passwort pro Tenant geprüft.
- [x] Security-Fix: `[...nextauth]/route.ts` — tenantId im JWT nur aus DB-Row.
- [x] `postgres.ts` `tid()`: console.warn bei fehlendem tenantId.

## Agent Builder UI Refactoring (01.05.2026)
- [x] Refactor: Run Controls Card + manueller Run-Button entfernt.
- [x] Refactor: Execution Panel in linke Sidebar integriert.
- [x] Refactor: Resize-Mechanismus vollständig entfernt.

## Super-Admin & UI-Verbesserungen (14.05.2026)
- [x] Feature: `GET /api/super-admin/dashboard`.
- [x] Feature: `/super-admin/dashboard` Page.
- [x] Feature: Sidebar-Footer Umbau — User-Avatar-Dropdown.
- [x] Feature: `/legal` Page mit Impressum, Datenschutz, AGB.
- [x] Fix: Login-Seite `fixed inset-0`.

## Multi-Tenant Sicherheitslücken (14.05.2026)
- [x] Security-Fix: `monitoring/import/route.ts` — tenantId erzwungen.
- [x] Security-Fix: `cron/purge-old-data/route.ts` — alle Tenants.
- [x] Security-Fix: `admin/upload/route.ts` — Blob-Pfad mit tenantId.
- [x] Feature: RLS-Migration `0001_add_row_level_security.sql`.
- [x] Refactor: `tid()` — MULTI_TENANT=true Hard-Fail.

## UX-Verbesserung: Keyword-Map als Startpunkt (14.05.2026)
- [x] Refactor: `planning/page.tsx` — Keyword-Map als Default-Tab, `?tab=`-Query-Parameter.
- [x] Feature: Empty States in Vorschläge, Redaktionsplanung, Blacklist, Creation, Monitoring, Dashboard.

## Alert-Regeln & Sistrix Health-Fix (14.05.2026)
- [x] Feature: `alert-rules-tab.tsx` — `RecipientPicker`-Checkbox-Liste.
- [x] Fix: `sync-gsc/route.ts` — `cron:sync-sistrix:success` nur bei `urlsProcessed > 0`.
- [x] Fix: `health/route.ts` — Sistrix in zwei separate Jobs.

## Branding, Sprache & Feature-Flags (15.05.2026)
- [x] Branding: „Plexaro" in 9 E-Mail-Templates.
- [x] Sprache: Du-Form in ~43 Stellen.
- [x] Feature: SuperAdmin Feedback `is_public`-Toggle.
- [x] Feature: Keyword Import — Beispieldatei-Download.
- [x] Fix: SMTP aus Tenant Health entfernt; in SuperAdmin ergänzt.
- [x] Fix: Filter-Dropdown Labels (`getColumnLabel()`).

## Security-Audit Fixes (15.05.2026)
- [x] Security-Fix 1: `/api/debug/*` — SuperAdmin-Auth erzwungen.
- [x] Security-Fix 3: `PATCH /api/admin/users/:id` — Field Allowlist.
- [x] Security-Fix 4: `callback/route.ts` — tenantId aus API-Key-Auth.
- [x] Security-Fix 6: Alle 5 Cron-Routes — Auth immer erzwungen.
- [x] Security-Fix 8+9: Invite-Routen — hardcodierte URL + tempPassword entfernt.
- [x] Security-Fix 10: `notifyEmails` Regex-Validierung + max. 10 Adressen.
- [x] Security-Fix 11: SSRF-Schutz in `agent-webhook/test/route.ts`.
- [x] Security-Fix 12: Bootstrap-Pfad erfordert `BOOTSTRAP_ENABLED=true`.
- [x] Security-Fix 13: `priority`-Enum in `/api/feedback` validiert.

## Password Reset Feature (15.05.2026)
- [x] DB-Tabelle `password_reset_tokens` + Migration `0003_lazy_cerise.sql` (ausgeführt).
- [x] `POST /api/auth/forgot-password`.
- [x] `GET + POST /api/auth/reset-password`.
- [x] `POST /api/admin/users/[id]/reset-password`.
- [x] UI: Forgot/Reset-Passwort-Seiten + Admin-Dialog.

## DB-Refactoring: diff_summary → event_label (15.05.2026)
- [x] Schema: `content_log_body.diff_summary` → `event_label`.
- [x] Migration `0004_rename_diff_summary_to_event_label.sql` erstellt und ausgeführt.
- [x] `postgres-types.ts` + `airtable-types.ts`: `Diff_Summary` → `Event_Label` auf `ContentLog`.
- [x] `postgres.ts`: alle internen Referenzen umbenannt.
- [x] 10 API-Routes + 5 Frontend-Dateien umbenannt.
- [x] `airtable.ts` + `optimization-rules.ts` umbenannt.

## HistoryList Bugs (15.05.2026)
- [x] Fix: Icon-Bug `"vorschlägen hinzugefügt"` → `"vorschläge"`.
- [x] Fix: `isDelivery` nur noch `summary === "Content angeliefert"` (kein `|| log.Version === 'v2'`).
- [x] Fix: `versionMap` zählt nur noch `Event_Label === "Content angeliefert"`.

## Bug-Fix: Editor-ID war E-Mail statt UUID (15.05.2026)
- [x] Fix: Alle 8 API-Routes auf `session.user.id` statt `session.user.email` für `Editor`-Feld umgestellt.
  - `api/creation/refine/route.ts`
  - `api/planning/history/route.ts`
  - `api/planning/keywords/route.ts` (2 Stellen)
  - `api/planning/blacklist/route.ts` (2 Stellen)
  - `api/planning/trends/route.ts`
  - `api/monitoring/suggest/route.ts`

## Offen / Ausstehend

- [ ] **DB-Migration**: `CREATE UNIQUE INDEX cost_config_tenant_page_action_uniq ON cost_config (tenant_id, page_type, action_type);` — noch nicht gegen DB ausgeführt (Voraussetzung für seedDefaultCostConfig ON CONFLICT)

## Abgeschlossen (chronologisch)

- [x] **Super-Admin Setup-Status & Wartungsaktionen (21.05.2026)**
  - Setup-Status API `GET /api/admin/setup-status` mit Pflicht + Optional Feldern
  - Dashboard-Checkliste auf `page.tsx` (verschwindet wenn komplett)
  - Monitoring Warn-Banner für fehlende Kostenkonfiguration
  - Tenant-Liste: Setup-Spalte mit Ampel-Icons + Setup-Counts in Query
  - Tenant-Detail: Health Score 4×20+2×10, Setup-Status-Block 3-spaltig
  - `seedDefaultCostConfig()` — 8 Standardwerte, ON CONFLICT DO NOTHING
  - Seed wird automatisch bei Tenant-Erstellung ausgeführt
  - `POST /api/super-admin/backfill-cost-config` — Backfill für alle Tenants
  - Backfill-Button auf System-Gesundheit-Seite in "Wartungsaktionen"-Karte platziert
  - Backfill-Logik vollständig aus Tenant-Listenseite entfernt
  - i18n `setup.*` Keys in de.ts + en.ts
  - tsc --noEmit ✅
- [x] Fix: Admin Panel Config-Speicher-Fehler (Tenant-Id Rückgabe bei Login) (17.05.2026)
- [x] Cleanup: Migration 0008 für alte Tabellen entfernt (17.05.2026)
- [x] Cleanup: Nicht mehr verwendete Airtable-Dateien dokumentiert (17.05.2026)

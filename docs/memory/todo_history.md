# TODO Historie

## Abgeschlossen (chronologisch)

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
- [x] Integrationen: Model Discovery Endpoint eingeführt (OpenAI, OpenRouter, Gemini, Copilot, Perplexity).
- [x] Admin Integrationen-Tab auf Master-Detail UX umgestellt.
- [x] Agent Runtime: Orchestrator Round-Loop implementiert.
- [x] Agent Runtime: Strukturierte Parent-Decision Auswertung implementiert.
- [x] Agent Runtime: A2A-Messages typisiert inkl. `round`/`correlationId`.
- [x] Node-Config Datenmodell um `purpose`, `inputContract`, `outputContract` erweitert.
- [x] Builder: Node-Konfiguration UX komplett neu strukturiert.
- [x] Builder: Pre-Run Validierung ergänzt.
- [x] Run-API/Service: `runFrom` ergänzt; Builder-Default auf Draft gesetzt.
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
- [x] i18n: Alle UI-Komponenten vollständig lokalisiert (sidebar, admin, planning, monitoring, etc.).
- [x] i18n: `dashboard.systemHealth.*` Keys in `de.ts` + `en.ts` ergänzt.

## System Health Dashboard (30.04.2026)
- [x] Refactor: Provider-Test-Funktionen aus `integrations/[provider]/route.ts` in `src/lib/integration-tests.ts` extrahiert (Shared Lib).
- [x] Feature: `createAuditLog(action, rawPayload?)` Hilfsfunktion in `airtable.ts` ergänzt.
- [x] Feature: `src/app/api/cron/sync-gsc/route.ts` — schreibt nach jedem Lauf AuditLog-Einträge für `cron:sync-gsc` und `cron:sync-sistrix`.
- [x] Feature: Neuer Cron `GET /api/cron/check-integrations` (täglich 06:00 UTC) — testet alle Integrationen und schreibt AuditLog.
- [x] Feature: Neuer Endpunkt `GET /api/system-health` — Admin-only, aggregiert alle Health-Checks mit Live-Tests für Integrationen.
- [x] Feature: Neue Komponente `src/components/system-health-card.tsx` — Admin-only, Polling 5 Min, vollständig i18n-fähig via `detailKey`/`detailParams`.
- [x] Refactor: Dashboard `src/app/page.tsx` — Alerts Feed + Diagnostic-Alert-Polling entfernt, `SystemHealthCard` eingebunden.
- [x] Config: `vercel.json` — Neuer Cron `check-integrations` täglich 06:00 UTC hinzugefügt.
- [x] Fix: Content-Pipeline-Check — `fields: ['Last Modified']` entfernt (Airtable-Fehler), nur `fields: ['Status']` abgefragt; Staleness-Prüfung entfällt.

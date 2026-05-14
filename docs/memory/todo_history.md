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
- [x] i18n: `dashboard.systemHealth.*` Keys in `de.ts` + `en.ts` ergänzt.

## System Health Dashboard (30.04.2026)
- [x] Refactor: Provider-Test-Funktionen in `src/lib/integration-tests.ts` extrahiert.
- [x] Feature: `createAuditLog(action, rawPayload?)` Hilfsfunktion in `airtable.ts` ergänzt.
- [x] Feature: `src/app/api/cron/sync-gsc/route.ts` — schreibt AuditLog-Einträge für `cron:sync-gsc` und `cron:sync-sistrix`.
- [x] Feature: Neuer Cron `GET /api/cron/check-integrations` (täglich 06:00 UTC).
- [x] Feature: Neuer Endpunkt `GET /api/system-health` — Admin-only, aggregiert alle Health-Checks.
- [x] Feature: Neue Komponente `src/components/system-health-card.tsx` — Admin-only, i18n-fähig.
- [x] Refactor: Dashboard `src/app/page.tsx` — Alerts Feed entfernt, `SystemHealthCard` eingebunden.
- [x] Config: `vercel.json` — Neuer Cron `check-integrations` täglich 06:00 UTC.
- [x] Fix: Content-Pipeline-Check — `fields: ['Last Modified']` entfernt.

## Agent Flow: finalHtml & Content-Delivery-Pipeline (01.05.2026)
- [x] Feature: Run Detail Modal Sheet-Breite auf `sm:max-w-3xl` erhöht.
- [x] Feature: Run Detail Modal — `finalHtml`-Preview im Step-Output (grüne HTML-Vorschau, Rohdaten collapsible).
- [x] Feature: `OrchestratorDecision` um `finalHtml?: string` erweitert (Service + `createOrchestratorNode`).
- [x] Feature: `extractDecisionFromOutput` extrahiert `finalHtml` aus Orchestrator-Output.
- [x] Feature: 3-stufige `capturedFinalHtml`-Fallback-Kette in `service.ts` implementiert (Orchestrator-JSON → bekannte Felder → längster String).
- [x] Feature: `finalOutput` wird in-memory in Rückgabewert injiziert (`return { ...finalRun, output: finalOutput }`), nicht in Airtable geschrieben.
- [x] Feature: `WorkflowRunV2.output?: Record<string, unknown>` in Domain-Model ergänzt.
- [x] Feature: `trigger/route.ts` — Nach erfolgreichem Run `Status: 'Angeliefert'` setzen + `createContentLog` mit `finalHtml`.
- [x] Fix: `Diff_Summary: 'Content angeliefert'` (exakter String für `HistoryList`-Preview-Gate).
- [x] Fix: Step-basierten Fallback aus `trigger/route.ts` entfernt (durch `pruneStore`-Truncation unzuverlässig).

## Optimistisches UI: Commissioning-Button (01.05.2026)
- [x] Fix: `setCommissionedIds` + `addAlert` vor `await triggerN8nAction(...)` verschoben (sofortiges UI-Feedback).
- [x] Fix: Bei API-Fehler `commissionedIds.delete(id)` (optimistisches Update rückgängig machen).

## Tenant-Isolation (13.05.2026)
- [x] Alle API-Routes unter `planning/`, `admin/`, `agent-workflows-v2/`, `cron/`, `n8n/`, `monitoring/`, `creation/`, `system-health/`, `branding/`, `feedback/` auf `session.user.tenantId` umgestellt
- [x] `DEFAULT_TENANT_ID` aus allen agent-workflows-v2 Sub-Routes entfernt
- [x] `postgres.ts`: `getAllTenants()`, `getPotentialTrends(_tenantId?)`, `createTrend(_tenantId?)`, `invalidateConfigCache(tenantId)` gefixt
- [x] `admin-integrations.ts`, `optimization-rules.ts`, `sync-performance.ts`: alle Funktionen mit tenantId
- [x] `admin/costs/route.ts` + `admin/costs/[id]/route.ts`: tenantId an alle Cost-DB-Calls
- [x] `admin/users/[id]/route.ts`: tenantId an updateUser + deleteUser
- [x] `admin/invite/route.ts`: tenantId an getUserByEmail + createUser; hardcodierte baseUrl durch NEXTAUTH_URL ersetzt
- [x] `feedback/route.ts`: getDefaultTenantId() durch session.user.tenantId ersetzt
- [x] Security-Fix: `lookup-tenants/route.ts` — Passwort wird pro Tenant einzeln geprüft (first-password-wins Bug behoben)
- [x] Security-Fix: `[...nextauth]/route.ts` — tenantId im JWT kommt nur noch aus DB-Row, nicht aus credentials
- [x] `postgres.ts` `tid()`: console.warn bei fehlendem tenantId
- [x] `app-sidebar.tsx`: App-Name von "SEO Content Intelligence" auf "Plexaro" geändert

## Agent Builder UI Refactoring (01.05.2026)
- [x] Refactor: Run Controls Card + manueller Run-Button entfernt.
- [x] Refactor: Auto-Save-Strip in Toolbar-Zeile neben Flow-Tabs verschoben.
- [x] Refactor: Execution Panel — Tabs (Executions/Timeline/Messages) entfernt, nur Run-Liste.
- [x] Refactor: Status-Filter in Card-Header, Actions in `...`-DropdownMenu.
- [x] Refactor: Execution Panel in linke Sidebar integriert (Option B: festes Side-Panel).
- [x] Refactor: Resize-Mechanismus vollständig entfernt.
- [x] Fix: Canvas-Höhe auf `h-[calc(100vh-220px)]` für bündiges Alignment.
- [x] Style: NodePalette + ExecutionPanel + RunCard auf App-Standard-Styling (weiße Cards, `border border-border`).
- [x] Style: Header-Vereinheitlichung — identische Icon+Titel+Subline-Struktur für beide Karten.
- [x] Fix: Empty States + Amber-Banner — Alpha-Transparenz entfernt (`/60` → voll opak), Kontrast auf `text-white`/`text-slate-200` erhöht.
- [x] i18n: `toolboxTitle`, `toolboxDescription`, `executionPanel`, `executionPanelDescription` ergänzt.
- [x] i18n: `customFlowActiveTitle/Body/Deactivate`, `customFlowDisabledTitle/Body/Agents/Reactivate` ergänzt.
- [x] i18n: `noCustomFlowTitle/Body/Warning/Action` ergänzt.
- [x] i18n: Alle hardcodierten deutschen Texte in Empty States und Amber-Banner ausgelagert.

## Super-Admin & UI-Verbesserungen (14.05.2026)
- [x] Feature: `GET /api/super-admin/dashboard` — aggregiert Tenant-Stats, MRR/ARR, Subscription-Verteilung, Feedback-Stats
- [x] Feature: `/super-admin/dashboard` Page — KPI-Cards, MRR-Balkendiagramm, Subscription-Verteilung, Recent Tenants
- [x] i18n: `superAdmin`-Namespace in `de.ts` + `en.ts` (~150 Keys)
- [x] i18n: `feedback`-Namespace in `de.ts` + `en.ts`
- [x] i18n: `legal`-Namespace in `de.ts` + `en.ts`
- [x] i18n: `sidebar.feedbackLink`, `sidebar.legalLink`, `sidebar.profile` Keys ergänzt
- [x] Refactor: Super-Admin-Seiten (Tenants, Pricing, Feedback) vollständig auf `useI18n()` umgestellt
- [x] Fix: Redirect `/super-admin` → `/super-admin/dashboard`
- [x] Feature: `/feedback` Page für alle Rollen (Admin, Editor, Viewer) mit `plannedQuarter`-Spalte
- [x] Refactor: Feedback-Tab aus Admin-Page entfernt
- [x] Fix: SelectValue Dropdown-Bug — explizite Kinder in `super-admin/feedback/page.tsx` + `feedback/page.tsx`
- [x] Fix: `<span>`-Wrapper aus `<SelectItem value="none">` entfernt (Quarter-Inline-Edit)
- [x] Refactor: Sidebar ShieldCheck-Icon bei "Plexaro" entfernt
- [x] Feature: Sidebar-Footer Umbau — User-Avatar öffnet DropdownMenu (Profil, Rechtliches, Sprache, Abmelden)
- [x] Fix: Base UI error #31 — `DropdownMenuLabel` durch `div` ersetzt (kein `Menu.Group`-Parent vorhanden)
- [x] Fix: Base UI `asChild` nicht verfügbar — `DropdownMenuTrigger` mit `className`, Items mit `onClick + router.push`
- [x] Feature: Copyright-Zeile `© {year} Plexaro` im Sidebar-Footer (linksbündig, ausgegraut)
- [x] Feature: `/legal` Page mit 4 Tabs (Impressum, Datenschutz, AGB, Copyright), `?tab=`-Query-Parameter, `Suspense`
- [x] Fix: SuperAdmin-Zugriff auf `/legal` — in `SUPER_ADMIN_EXEMPT_PREFIXES` eingetragen
- [x] Fix: Login-Seite scrollbar — `fixed inset-0` statt `h-screen`, Auth-Layout-Branch ohne `p-6`-Wrapper
- [x] Feature: Login-Seite Footer — Impressum/Datenschutz/AGB Links + Copyright

## Multi-Tenant Sicherheitslücken (14.05.2026)
- [x] Security-Fix: `monitoring/import/route.ts` — tenantId aus body/Header, Hard 400 wenn fehlend, explizit an upsert-Funktionen übergeben
- [x] Security-Fix: `cron/purge-old-data/route.ts` — loopt über alle Tenants via getAllTenants(), Purge + AuditLog pro Tenant
- [x] Security-Fix: `admin/upload/route.ts` — Blob-Pfad enthält jetzt `tenantId` (`branding/{tenantId}/...`)
- [x] Feature: `src/lib/db/migrations/0001_add_row_level_security.sql` — RLS-Policies auf 9 tenant-scoped Tabellen + `current_tenant_id()` Helper
- [x] Refactor: `postgres.ts` `tid()` — MULTI_TENANT=true schaltet auf Hard-Fail (Exception statt warn+fallback)

## Offen / Ausstehend
- [ ] DB-Migration ausführen (manuell via psql):
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
  ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS planned_quarter TEXT;
  ```
- [ ] RLS-Migration auf DB einspielen: `psql $DATABASE_URL < src/lib/db/migrations/0001_add_row_level_security.sql`
- [ ] Env-Variable `MULTI_TENANT=true` in Production setzen (nach n8n-Webhook-Anpassung)
- [ ] n8n-Workflows: `tenantId` im Payload oder `x-tenant-id`-Header beim `/api/monitoring/import`-Webhook ergänzen
- [ ] Legal-Seite: Tatsächliche Inhalte für Impressum, Datenschutz, AGB, Copyright eintragen (aktuell Platzhalter in `de.ts`/`en.ts`)

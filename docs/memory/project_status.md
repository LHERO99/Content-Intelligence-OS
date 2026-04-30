# Projekt-Status (Stand: 30.04.2026)

## System Health Dashboard (30.04.2026)
- **Neue Section auf dem Dashboard**: Ersetzt die bisherige "Alerts Feed" Section.
- **Nur für Admins sichtbar**: `SystemHealthCard` rendert nur wenn `session.user.role === 'Admin'`.
- **Polling**: Alle 5 Minuten via `setInterval`.
- **Gesamtstatus-Banner**: Grün ("Alle Systeme laufen") / Orange (Warnungen) / Rot (Fehler).
- **Gruppierte Checks** in 4 Sektionen: Infrastruktur, Daten-Sync (Cron), Integrationen, Workflows & Content.

### Geprüfte Checks:
| Check | Datenquelle | Logik |
|---|---|---|
| Airtable | Live | Users-Tabelle abrufbar |
| GSC Sync | AuditLog `cron:sync-gsc:*` | Letzter Lauf + Staleness >8 Tage |
| Sistrix Sync | AuditLog `cron:sync-sistrix:*` | Letzter Lauf (läuft im selben Cron wie GSC) |
| DataForSEO Sync | AuditLog `cron:sync-dataforseo:*` | Letzter Lauf + Staleness >8 Tage |
| Integrationen | Live-Test via `testProviderConnection()` | Nur konfigurierte Provider werden angezeigt |
| Agent Webhook | Live-Test via `testAgentWebhook()` | Nur wenn `AGENT_WEBHOOK_URL` in Config hinterlegt |
| Agent Runs | Agent Workflow Service | Runs mit `status: running` & `updatedAt` >30 Min → Error |
| Content Pipeline | Airtable Keyword-Map | Anzahl Keywords in Status `Beauftragt`/`In Arbeit` |

### Neue Dateien:
- `src/lib/integration-tests.ts` — Shared Connectivity-Test-Funktionen (extrahiert aus `integrations/[provider]/route.ts`)
- `src/app/api/cron/check-integrations/route.ts` — Täglicher Cron (06:00 UTC), schreibt AuditLog-Einträge für alle Integrationen
- `src/app/api/system-health/route.ts` — Admin-only Endpunkt, aggregiert alle Health-Checks
- `src/components/system-health-card.tsx` — Client-Komponente, vollständig i18n-fähig

### Geänderte Dateien:
- `src/app/api/cron/sync-gsc/route.ts` — Schreibt nach jedem Lauf AuditLog-Einträge für `cron:sync-gsc` und `cron:sync-sistrix`
- `src/app/api/admin/integrations/[provider]/route.ts` — Importiert `testProviderConnection` aus Shared Lib (kein Duplicate Code mehr)
- `src/lib/airtable.ts` — Neue Hilfsfunktion `createAuditLog(action, rawPayload?)`
- `src/app/page.tsx` — Alerts Feed entfernt, `SystemHealthCard` eingebunden; Diagnostic-Alert-Polling entfernt
- `vercel.json` — Neuer Cron `check-integrations` täglich 06:00 UTC
- `src/i18n/messages/de.ts` + `en.ts` — Neue Keys unter `dashboard.systemHealth.*`

### AuditLog Action-Konventionen:
- Crons: `cron:sync-gsc:success|error`, `cron:sync-sistrix:success|error|skipped`, `cron:sync-dataforseo:success|error`
- Integration-Checks: `integration:check:<provider>:ok|error|skipped`, `integration:check:agent_webhook:ok|error|skipped`

### i18n-Architektur für System Health:
- API-Endpunkt gibt `detailKey` (i18n-Pfad) + `detailParams` (Platzhalter-Werte) zurück
- Komponente löst via `resolveDetail(t, locale, detailKey, detailParams, fallback)` auf
- Timestamp-Formatierung erfolgt locale-sensitiv in der Komponente (`de-DE` / `en-US`)
- Externe Fehlermeldungen (z.B. API-Fehler) haben kein `detailKey` → Rohstring wird direkt angezeigt

### Bekannte Einschränkungen:
- `Last Modified` ist kein verfügbares Airtable-Feld in `Keyword-Map` → Content-Pipeline zeigt nur Anzahl aktiver Jobs, keine Staleness-Prüfung

---

## KI-Chat Feature (Creation Page) — Status: Funktionsfähig (28.04.2026)
- **Ziel**: User gibt im KI-Optimierung-Tab eine Anweisung ein → KI überarbeitet Text → linke Vorschau zeigt neuen Text sofort → "Übernehmen" speichert in Airtable via `/api/planning/history`.
- **Architektur**: `AIEditorWorkspace` (Parent) hält `workingContent` + `previewContent` als State. `AIChatPanel` (Child) ist immer gemountet via `hidden`-Klasse (Chat-State bleibt bei Tab-Wechsel erhalten).
- **Vorschau**: Nach KI-Antwort → `onPreviewChange(refinedContent)` → linke Vorschau zeigt KI-Vorschlag sofort. "KI-Vorschlag (Vorschau)" + "Nicht gespeichert" Badge werden angezeigt.
- **Übernehmen-Fix**: `onApplyChanges(content: string)` — `AIChatPanel` übergibt `refinedContent` direkt als Parameter. Kein `useRef`-Syncing mehr nötig (stale-closure race condition behoben).
- **Ablehnen**: Setzt Vorschau zurück auf `workingContent` (kein Save).
- **Save-Logik**: POST an `/api/planning/history` ohne `actionType` — KI-Chat-Saves werden über `Diff_Summary: 'KI-Chat: KI-Optimierung übernommen'` identifiziert.
- **Airtable Action_Type**: `'KI-Chat'` ist kein gültiger Select-Wert in Airtable. Lösung: `actionType` wird für KI-Chat-Saves gar nicht gesendet. `/api/planning/history` macht `actionType` optional (kein 400 bei fehlendem Wert). `createContentLog` löscht `undefined`-Felder bereits aktiv.
- **Markdown-Stripping**: `stripMarkdownCodeFences()` in `/api/creation/refine/route.ts` entfernt Code-Fences aus KI-Antworten.
- **Modell-Dropdown**: `AIChatPanel` lädt verfügbare Modelle via `/api/creation/models`. Auto-Select des ersten Modells. Grouped Select (Provider → Modelle).

## Content-Agent Builder V2 (Orchestrierung, UX, Integrationen)
- **V2 als Standard etabliert**: Der Builder läuft auf `/content-agent-builder`; V1 wurde entfernt und nicht mehr verwendet.
- **Orchestrator-Loop implementiert**: Ausführung läuft nun seriell in Runden (`Parent -> 1 Subagent -> Parent`), ohne parallele Subagent-Runs.
- **Entscheidungslogik über Parent-LLM**: Der Parent trifft die nächste Delegationsentscheidung über ein strukturiertes JSON-Schema (`finalize`, `next.targetNodeId`, `objective`, `memoryPatch`).
- **Run-Metadaten erweitert**: Steps/Messages enthalten nun `round`, `phase`, `correlationId` sowie Message-Typen (`task_request`, `task_result`, `control`) für nachvollziehbares Agent-to-Agent Tracing.
- **Subagent-Kontext standardisiert**: Node-Config enthält nun `purpose`, `inputContract`, `outputContract`; diese Daten werden in die Parent-Entscheidung und Subagent-Execution eingespeist.
- **Run-Version explizit steuerbar**: Start eines Flows unterstützt `runFrom` (`draft`/`published`), Default im Builder ist `draft` zur Vermeidung von Draft-vs-Published Mismatches.
- **Pre-Run Validierung im UI**: Vor Ausführung wird geprüft auf genau 1 Parent, aktiven Parent, mindestens 1 aktiven Subagent und gesetzte Subagent-Purpose.

## Integrationen & Modell-Discovery
- **Model Discovery ausgebaut**: Serverseitige Modellauflistung via `/api/admin/integrations/[provider]/models` mit Caching und optionalem Refresh.
- **Unterstützte Discovery-Provider**: `openai`, `openrouter`, `gemini`, `copilot (GitHub Models)`, `perplexity`.
- **Admin-Integrationen modernisiert**: Master-Detail UI (Provider-Liste links, Detail rechts) statt paralleler Kartenübersicht.
- **Provider-Portfolio erweitert**: OpenAI für Builder/Runtime ergänzt; Copilot & Perplexity im Integrationsmanagement (Test + Modellauflistung) ergänzt.
- **Vertex Legal Agent**: Integration eines externen Legal Agents über Vertex AI Endpunkte für rechtliche Prüfungen.
- **DataForSEO**: Integration für Performance- und SEO-Datenquellen ergänzt.
- **Shared Test-Lib**: Alle Provider-Test-Funktionen in `src/lib/integration-tests.ts` zentralisiert (genutzt von Admin-UI und `check-integrations` Cron).

## Node-Konfigurations-UX (Builder)
- **Komplette UX-Neustrukturierung**: Node-Drawer in klaren Sektionen (`Rolle & Identität`, `Aufgabe`, `LLM Setup`, `I/O Vertrag`, `Erweitert`) mit selbsterklärender Mikrocopy.
- **Bessere Bedienbarkeit**: Sektionen sind auf-/zuklappbar, relevante Bereiche initial offen; Sticky-Aktionsleiste im Footer (`Node entfernen`, `Fertig`).
- **Model-UI harmonisiert**: Einheitliches Verhalten für Laden/Aktualisieren/Auswählen inkl. Admin-Hinweis bei fehlender Provider-Anbindung.

## Content-Lifecycle & Logging-Events
- **Status-Workflow**: Der Workflow umfasst nun: `Backlog` -> `Planned` -> `Beauftragt` -> `Angeliefert` -> `Published`.
- **Lückenloses Event-Logging**: Alle Kern-Meilensteine werden nun robust in der `Content-Log` Tabelle erfasst.

## Datenbank & API-Stabilität
- **Airtable Service-Härtung**: Computed Field Fix, URL-Historie Persistenz, aggressives URL-Grouping.
- **Blacklist-Sicherheitsmechanismen**: Main Keyword Schutz, Double Confirmation, UI Fix.
- **Schema-Cleanup**: `Reasoning_Chain` systemweit entfernt.
- **`createAuditLog(action, rawPayload?)`**: Neue Hilfsfunktion in `airtable.ts` für strukturiertes AuditLog-Writing aus Crons und Services.
- **Airtable-Einschränkung**: `Last Modified` ist kein reguläres Tabellenfeld in `Keyword-Map` — Airtable-API lehnt es im `fields`-Parameter ab.

## n8n Integration & Performance-Monitoring
- **Webhook-Optimierung**: Alle n8n-Webhook-Calls laufen asynchron ("Fire & Forget").
- **Detaillierte Payload-Struktur**: `IMPORT_DATA` Webhook sendet gruppierte Daten pro URL.
- **API-Key Schutz**: Endpunkt `/api/monitoring/import` gesichert via `x-api-key`.

## Optimierte Performance-Speicherung
- **Tabellen-Split**: `URL_Performance` + `Keyword_Ranking_History` ersetzen `Performance_Data`.
- **Cron-Jobs** (`vercel.json`):
  - `GET /api/cron/sync-gsc` — Mo 04:00 UTC (inkl. Sistrix-Sync in `syncGscChunk()`)
  - `GET /api/cron/sync-dataforseo` — Mo 04:30 UTC
  - `GET /api/cron/check-integrations` — täglich 06:00 UTC

## Keyword-Ranking Sync & UX
- **DataForSEO Bug behoben**: `Keyword_ID` als plain String (kein Array).
- **Sonderwert `101`**: Keywords nicht in Top 100 erhalten `Ranking: 101`.
- **Dedup-Logik**: Wöchentliche Deduplizierung vor DataForSEO-API-Call.

## UI & Visualisierung
- **URL-Detail**: Zwei Charts (URL-Performance + Keyword-Rankings mit log. Y-Achse).
- **Keywords-Karte**: Tabellarisches Layout mit Ranking-Farbkodierung.
- **Monitoring-Tabelle**: Klickbare Zeilen, individuelle ROI-Anzeige.

## Dynamic Branding & Asset Management
- **Konfigurierbares Branding**: Logo, Favicon, Primärfarbe via Admin-Tab.
- **Airtable Attachments**: Assets als native Attachments im `File`-Feld.
- **BrandingProvider**: Injiziert `--primary` CSS-Variable, aktualisiert Favicon dynamisch.

## Vercel Deployment & Auth-Fixes
- **Cookie-Name-Mismatch behoben**: Custom `cookies`-Config aus `authOptions` entfernt.
- **`NEXTAUTH_URL` korrekt konfiguriert**: Pro Environment.
- **GSC OAuth `redirect_uri_mismatch` behoben**.

## Internationalisierung / i18n (28.04.2026)
- **Vollständige DE/EN Sprachumschaltung** via Language Switcher.
- **LanguageProvider** in `src/app/layout.tsx`; persistiert Sprache in `localStorage`.
- **useI18n Hook**: Gibt `{ locale, setLocale, t }` zurück.
- **Inline-Translate Pattern**: `const tr = (de: string, en: string) => (locale === "de" ? de : en);`
- **Dictionary-Pattern**: `t("dashboard.systemHealth.title")` für strukturierte Keys.
- **Reactive Columns Pattern**: `buildColumns(tr)` + `useMemo(() => buildColumns(tr), [locale])`.
- **`dashboard.systemHealth.*`** Keys vollständig in `de.ts` + `en.ts` vorhanden.

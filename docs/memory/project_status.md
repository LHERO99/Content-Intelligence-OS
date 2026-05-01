# Projekt-Status (Stand: 01.05.2026)

## Agent Flow: finalHtml-Extraction & Content-Delivery-Pipeline (01.05.2026)

### Ziel
Der Parent Agent soll am Ende des Runs den fertigen HTML-Artikel zurückgeben. Nach erfolgreichem Run wird:
- der Keyword-Status auf `"Angeliefert"` gesetzt
- ein Content-Log mit `Content_Body: finalHtml` angelegt (erscheint in Content-Erstellung + Content-Historie)

### Implementierungsdetails

**Orchestrator Output-Contract erweitert (`finalHtml`):**
- `src/application/agent-workflow-v2/service.ts` → `buildParentNode()`: outputContract fordert nun `"finalHtml"?: string` wenn `finalize: true`
- `src/features/agent-workflow-v2/components/agent-workflow-v2-management.tsx` → `createOrchestratorNode()`: gleiche Erweiterung

**finalHtml-Extraktion (3-stufiger Fallback in `service.ts`):**
1. Orchestrator liefert `finalHtml` direkt im Finalisierungs-JSON
2. Bekannte Feldnamen im letzten Sub-Agenten-Task-Result: `finalHtml`, `html`, `content`, `result`, `text`
3. Längster String-Wert (≥100 Zeichen) im letzten Task-Output (agnostisch gegenüber Feldnamen)

**In-Memory-Transport (kein Airtable-Overflow):**
- `finalHtml` wird **NICHT** in den Airtable-Store geschrieben (`run.output` bleibt aus `updateRun` raus)
- Nach `getRunWithDetails` wird `output: finalOutput` direkt in den Rückgabewert injiziert: `return { ...finalRun, output: finalOutput }`
- Begründung: HTML-Artikel (10–50k Zeichen) × 20 Runs = Airtable-Feld-Limit (~100k) wird überschritten; `persistRuns` würde still fehlschlagen und `output` wäre beim nächsten Readback leer

**Status + Content-Log in `trigger/route.ts`:**
- Nach `run.status === 'success'`: `updateKeyword(keywordId, { Status: 'Angeliefert' })`
- Falls `finalHtml` vorhanden: `createContentLog({ ..., Content_Body: finalHtml, Diff_Summary: 'Content angeliefert' })`
- `Diff_Summary` muss exakt `'Content angeliefert'` sein — `HistoryList.tsx` prüft auf exakten String-Match für Preview-Rendering

**Content-Historie Preview:**
- `src/features/shared/components/HistoryList.tsx` Zeile 18: `const isDelivery = summary === "Content angeliefert";`
- Preview (collapse/expand) nur wenn `isDelivery && log.Content_Body`
- Rendert via `dangerouslySetInnerHTML={{ __html: log.Content_Body }}`
- Erwartet HTML-Format; Markdown wird literal angezeigt

### Empfehlung Sub-Agenten-Instructions
Sub-Agenten (Draft, Review) sollten explizit angewiesen werden, HTML zurückzugeben:
> "Antworte mit dem fertigen Artikel als sauberes HTML mit `<h1>`, `<h2>`, `<p>`, `<ul>`. Kein Markdown."

---

## Optimistisches UI: "Beauftragen"-Button (01.05.2026)

**Vorher:** Button wartete auf `await triggerN8nAction(...)` (= kompletter Agent-Run) bevor er auf "Beauftragt" umschaltete und die Alert-Message anzeigte.

**Nachher (`editorial-planning.tsx`):**
1. `setCommissionedIds(...)` — Button schaltet sofort auf "Beauftragt" Badge um
2. `addAlert("Content beauftragt.")` — Fly-in-Message erscheint sofort
3. `await triggerN8nAction(...)` — läuft im Hintergrund weiter
4. Bei API-Fehler: `commissionedIds.delete(id)` — optimistisches Update wird rückgängig gemacht

---

## Run Detail Modal: Verbesserungen (01.05.2026)
- Sheet-Breite: `sm:max-w-2xl` → `sm:max-w-3xl`
- Step-Output mit `finalHtml`: Grüne HTML-Vorschau via `dangerouslySetInnerHTML`; Rohdaten per `<details>` collapsible

---

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
- `src/lib/integration-tests.ts` — Shared Connectivity-Test-Funktionen
- `src/app/api/cron/check-integrations/route.ts` — Täglicher Cron (06:00 UTC)
- `src/app/api/system-health/route.ts` — Admin-only Endpunkt
- `src/components/system-health-card.tsx` — Client-Komponente, vollständig i18n-fähig

### AuditLog Action-Konventionen:
- Crons: `cron:sync-gsc:success|error`, `cron:sync-sistrix:success|error|skipped`, `cron:sync-dataforseo:success|error`
- Integration-Checks: `integration:check:<provider>:ok|error|skipped`, `integration:check:agent_webhook:ok|error|skipped`

---

## KI-Chat Feature (Creation Page) — Status: Funktionsfähig (28.04.2026)
- **Architektur**: `AIEditorWorkspace` (Parent) hält `workingContent` + `previewContent` als State. `AIChatPanel` (Child) ist immer gemountet via `hidden`-Klasse.
- **Übernehmen-Fix**: `onApplyChanges(content: string)` — kein `useRef`-Syncing (stale-closure behoben).
- **Airtable Action_Type**: `'KI-Chat'` ist kein gültiger Select-Wert → wird weggelassen. Identifikation via `Diff_Summary: 'KI-Chat: KI-Optimierung übernommen'`.
- **Markdown-Stripping**: `stripMarkdownCodeFences()` in `/api/creation/refine/route.ts`.
- **Modell-Dropdown**: Lädt verfügbare Modelle via `/api/creation/models`. Grouped Select.

## Content-Agent Builder V2 (Orchestrierung, UX, Integrationen)
- **V2 als Standard**: Builder auf `/content-agent-builder`; V1 entfernt.
- **Orchestrator-Loop**: Seriell in Runden (`Parent -> 1 Subagent -> Parent`).
- **Parent-Decision Contract**: `finalize`, `summary`, `finalHtml` (neu), `next.targetNodeId`, `objective`, `memoryPatch`.
- **Run-Version explizit steuerbar**: `runFrom: 'published'` für Commissioning-Flows.
- **Pre-Run Validierung im UI**: Genau 1 aktiver Parent, ≥1 aktiver Subagent, Subagent-Purpose gesetzt.
- **Custom Flow**: `CUSTOM_FLOW_ENABLED` Config-Key steuert Routing atomar. Amber-Banner wenn aktiv. Reaktivieren/Deaktivieren über Settings-Endpoint.
- **pruneStore**: Steps auf 1500 Zeichen, Messages auf 1000 Zeichen. `persistRuns` in try/catch (non-fatal). `MAX_RETAINED_RUNS = 20`.
- **`WorkflowRunV2.output`**: Optionales Feld im Domain-Model — wird aber **NICHT** in Airtable persistiert (Overflow-Schutz).

## Integrationen & Modell-Discovery
- **Model Discovery**: `/api/admin/integrations/[provider]/models` mit Caching + optionalem Refresh.
- **Unterstützte Discovery-Provider**: `openai`, `openrouter`, `gemini`, `copilot`, `perplexity`.
- **Shared Test-Lib**: `src/lib/integration-tests.ts`.

## Content-Lifecycle & Logging-Events
- **Status-Workflow**: `Backlog` → `Planned` → `Beauftragt` → `Angeliefert` → `Review` → `Published`.
- **Lückenloses Event-Logging**: Alle Kern-Meilensteine in der `Content-Log` Tabelle.
- **Diff_Summary-Konventionen**:
  - `"Content beauftragt"` — beim Start (trigger/route.ts)
  - `"Content angeliefert"` — nach erfolgreichem Run (trigger/route.ts) — **exakter String für HistoryList-Preview**
  - `"KI-Chat: KI-Optimierung übernommen"` — KI-Chat-Saves

## Datenbank & API-Stabilität
- **Airtable Service-Härtung**: Computed Field Fix, URL-Historie Persistenz.
- **Blacklist-Sicherheitsmechanismen**: Main Keyword Schutz, Double Confirmation.
- **Schema-Cleanup**: `Reasoning_Chain` systemweit entfernt.
- **`createAuditLog(action, rawPayload?)`**: Non-blocking AuditLog-Writing aus Crons und Services.

## n8n Integration & Performance-Monitoring
- **Webhook-Optimierung**: n8n-Webhook-Calls laufen asynchron ("Fire & Forget").
- **Callback-Route**: `/api/n8n/callback` für externe Agents — setzt Status + erstellt Content-Log.

## Optimierte Performance-Speicherung
- **Tabellen-Split**: `URL_Performance` + `Keyword_Ranking_History` ersetzen `Performance_Data`.
- **Cron-Jobs** (`vercel.json`):
  - `GET /api/cron/sync-gsc` — Mo 04:00 UTC
  - `GET /api/cron/sync-dataforseo` — Mo 04:30 UTC
  - `GET /api/cron/check-integrations` — täglich 06:00 UTC

## UI & Visualisierung
- **URL-Detail**: Zwei Charts (URL-Performance + Keyword-Rankings mit log. Y-Achse).
- **Monitoring-Tabelle**: Klickbare Zeilen, individuelle ROI-Anzeige.

## Dynamic Branding & Asset Management
- **Konfigurierbares Branding**: Logo, Favicon, Primärfarbe via Admin-Tab.
- **BrandingProvider**: Injiziert `--primary` CSS-Variable, aktualisiert Favicon dynamisch.

## Vercel Deployment & Auth-Fixes
- **Cookie-Name-Mismatch behoben**: Custom `cookies`-Config aus `authOptions` entfernt.
- **`NEXTAUTH_URL` korrekt konfiguriert**: Pro Environment.

## Internationalisierung / i18n (28.04.2026)
- **Vollständige DE/EN Sprachumschaltung** via Language Switcher.
- **useI18n Hook**: Gibt `{ locale, setLocale, t }` zurück.
- **Inline-Translate Pattern**: `const tr = (de: string, en: string) => (locale === "de" ? de : en);`
- **Dictionary-Pattern**: `t("dashboard.systemHealth.title")` für strukturierte Keys.
- **`dashboard.systemHealth.*`** Keys vollständig in `de.ts` + `en.ts` vorhanden.

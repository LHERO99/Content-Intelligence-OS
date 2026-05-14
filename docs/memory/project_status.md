# Projekt-Status (Stand: 14.05.2026)

## Tenant-Isolation: Vollständig abgeschlossen (13.05.2026)

### Ziel
Vollständige Multi-Tenant-Datenisolation: Jeder eingeloggte User sieht und bearbeitet ausschließlich die Daten seines eigenen Tenants. `session.user.tenantId` wird überall an DB-Funktionen weitergereicht.

### Strategie
- `session.user.tenantId` stammt aus dem JWT (gesetzt beim Login via `getUserByEmail`)
- Alle DB-Funktionen in `postgres.ts` akzeptieren `tenantId?: string`
- `withTenant(tenantId, ...)` setzt via `set_config('app.tenant_id', tenantId, true)` einen transaktionslokalen PostgreSQL-Kontext
- Cron-Jobs iterieren über alle Tenants via `getAllTenants()`

### Vollständig gefixt — API Routes

**Planning:**
- `planning/keywords/route.ts` ✅
- `planning/blacklist/route.ts` ✅
- `planning/history/route.ts` ✅
- `planning/trends/route.ts` ✅
- `planning/editors/route.ts` ✅
- `planning/import/route.ts` ✅
- `planning/optimization-suggestions/route.ts` ✅

**Admin:**
- `admin/config/route.ts` ✅
- `admin/users/route.ts` ✅
- `admin/users/[id]/route.ts` ✅ (updateUser + deleteUser mit tenantId)
- `admin/invite/route.ts` ✅ (getUserByEmail + createUser mit tenantId; baseUrl aus NEXTAUTH_URL)
- `admin/costs/route.ts` ✅ (getCostConfigs + createCostConfig mit tenantId)
- `admin/costs/[id]/route.ts` ✅ (updateCostConfig + deleteCostConfig mit tenantId)
- `admin/sync/manual/route.ts` ✅
- `admin/sync/urls/route.ts` ✅
- `admin/integrations/route.ts` ✅
- `admin/integrations/[provider]/route.ts` ✅
- `admin/integrations/[provider]/models/route.ts` ✅
- `admin/integrations/google_search_console/properties/route.ts` ✅

**Sonstige:**
- `branding/route.ts` ✅
- `monitoring/route.ts` ✅
- `monitoring/detail/route.ts` ✅
- `monitoring/suggest/route.ts` ✅
- `creation/refine/route.ts` ✅
- `creation/models/route.ts` ✅
- `feedback/route.ts` ✅ (getDefaultTenantId() ersetzt durch session.user.tenantId)
- `agent-workflows-v2/route.ts` ✅
- `agent-workflows-v2/settings/route.ts` ✅
- `agent-workflows-v2/[id]/route.ts` ✅
- `agent-workflows-v2/[id]/publish/route.ts` ✅
- `agent-workflows-v2/[id]/run/route.ts` ✅
- `agent-workflows-v2/runs/route.ts` ✅
- `agent-workflows-v2/runs/[runId]/route.ts` ✅
- `agent-workflows-v2/runs/[runId]/messages/route.ts` ✅
- `n8n/trigger/route.ts` ✅
- `n8n/callback/route.ts` ✅
- `system-health/route.ts` ✅

**Crons:**
- `cron/sync-gsc/route.ts` ✅ (iteriert alle Tenants via getAllTenants())
- `cron/sync-dataforseo/route.ts` ✅
- `cron/sync-performance/route.ts` ✅
- `cron/check-integrations/route.ts` ✅

### Vollständig gefixt — Lib-Funktionen
- `postgres.ts`: `getAllTenants()`, `invalidateConfigCache(tenantId)`, `getPotentialTrends(_tenantId?)`, `createTrend(_trend, _tenantId?)`
- `postgres.ts` `tid()`: Loggt `console.warn` wenn tenantId fehlt und auf Default-Tenant gefallen wird
- `admin-integrations.ts`: alle Funktionen mit tenantId
- `optimization-rules.ts`: alle Funktionen mit tenantId
- `sync-performance.ts`: alle Funktionen mit tenantId

### Login-Flow Security-Fixes (13.05.2026)

**Bug:** Ein User konnte sich mit dem Passwort von Tenant A in Tenant B einloggen, wenn dieselbe E-Mail in beiden Tenants existierte. `lookup-tenants` prüfte das Passwort nur gegen den ersten gefundenen User-Row.

**Fix 1 — `api/auth/lookup-tenants/route.ts`:**
- Passwort wird jetzt **pro Tenant einzeln** via `bcrypt.compare()` geprüft
- Nur Tenants, bei denen der eigene Password-Hash übereinstimmt, kommen in die Rückgabe
- Inaktive Accounts und Accounts ohne Passwort werden übersprungen

**Fix 2 — `api/auth/[...nextauth]/route.ts`:**
- `tenantId` im JWT kommt jetzt ausschließlich aus dem **DB-Row** (`user.TenantId`)
- Der client-seitig übermittelte `credentials.tenantId` wird nur noch für die `getUserByEmail`-Abfrage genutzt, aber nie mehr direkt in den Token geschrieben

**Fix 3 — `lib/postgres.ts` `tid()`:**
- `console.warn` wenn tenantId fehlt und auf Default-Tenant gefallen wird

### Noch ausstehend
- DB-Migration ausführen:
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
  ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS planned_quarter TEXT;
  ```

---

## Multi-Tenant Isolation — Sicherheitslücken geschlossen (14.05.2026)

### Audit-Ergebnis
Vollständiger Multi-Tenant-Sicherheits-Audit durchgeführt. Folgende Lücken identifiziert und geschlossen:

### Fix #1 — `monitoring/import/route.ts` (kritisch)
- **Problem**: n8n-Webhook schrieb alle Performance-Daten ohne tenantId → alles landete beim Default-Tenant
- **Fix**: `tenantId` wird aus `body.tenantId` oder `x-tenant-id`-Header gelesen; fehlt beides → HTTP 400
- **Explizit an** `upsertURLPerformance()` + `upsertKeywordRankingHistory()` übergeben
- **Achtung**: n8n-Workflows müssen `tenantId` im Payload ergänzen

### Fix #2 — `cron/purge-old-data/route.ts` (kritisch)
- **Problem**: Purge-Funktionen wurden ohne tenantId aufgerufen → nur Default-Tenant wurde bereinigt
- **Fix**: Loopt jetzt über alle Tenants via `getAllTenants()`, ruft Purge + AuditLog pro Tenant auf
- **Response** enthält zusätzlich `tenantsProcessed`

### Fix #3 — `admin/upload/route.ts` (mittel)
- **Problem**: Blob-Pfad hatte kein Tenant-Präfix → alle Branding-Dateien lagen im gemeinsamen `branding/`-Namespace
- **Fix**: Pfad ist jetzt `branding/{tenantId}/logo-…` / `branding/{tenantId}/favicon-…`
- `tenantId` wird aus Session gelesen; fehlt sie → HTTP 400
- Bestehende Blob-URLs in der `config`-Tabelle funktionieren weiterhin (Vercel Blob-URLs sind unveränderlich)

### Fix #4 — `src/lib/db/migrations/0001_add_row_level_security.sql` (neu)
- Neue Migration-Datei mit Postgres RLS-Policies auf allen 9 tenant-scoped Tabellen
- `current_tenant_id()` Helper-Funktion liest `app.tenant_id` aus dem Transaktionskontext (gesetzt von `withTenant()`)
- Ohne `FORCE ROW LEVEL SECURITY` → Table Owner bypassed RLS (SuperAdmin-Queries + `getAllTenants()` bleiben unverändert)
- **Muss manuell ausgeführt werden**: `psql $DATABASE_URL < src/lib/db/migrations/0001_add_row_level_security.sql`

### Fix #5 — `postgres.ts` `tid()`-Funktion (niedrig)
- **Neu**: Env-Variable `MULTI_TENANT=true` aktiviert Hard-Fail-Modus
- Im Hard-Fail: fehlendes `tenantId` → Exception statt stillem Env-Var-Fallback
- Im Legacy-Modus: wie bisher, `console.warn`
- Empfehlung: `MULTI_TENANT=true` in Production setzen sobald alle n8n-Workflows angepasst sind

---

## Super-Admin-Bereich & UI-Verbesserungen (14.05.2026)

### Super-Admin Dashboard + i18n
- Neue API-Route `GET /api/super-admin/dashboard` — aggregiert Tenant-Stats, MRR/ARR (€), Subscription-Verteilung, Feedback-Stats, Recent Tenants
- Neue Dashboard-Seite `/super-admin/dashboard` — KPI-Cards, Finanzübersicht mit MRR-Balkendiagramm, Subscription-Verteilung, Feedback-Status-Badges, Recent-Tenants
- `superAdmin`-Namespace in `de.ts` + `en.ts` (~150 Keys für alle 4 Super-Admin-Seiten)
- Alle Super-Admin-Seiten (Tenants, Pricing, Feedback) vollständig auf `useI18n()` umgestellt
- Redirect `/super-admin` → `/super-admin/dashboard` (vorher: `/super-admin/tenants`)
- Sidebar: Dashboard-Link als erster Eintrag in Super-Admin-Nav

### Feedback-Seite für alle Rollen
- Neue Seite `/feedback/page.tsx` — vollständig i18n-konform, `plannedQuarter`-Spalte mit Kalender-Icon
- Zugänglich für alle Rollen (Admin, Editor, Viewer)
- `feedback`-Namespace in `de.ts` + `en.ts`
- Sidebar-Footer: `MessageSquare`-Icon + `/feedback`-Link für alle Nicht-SuperAdmin-Nutzer
- Admin-Page: Feedback-Tab entfernt

### Dropdown-Bug Fix (Radix/Base UI SelectValue)
- **Problem**: `<SelectValue />` zeigte bei komplexen `<SelectItem>`-Kindern (JSX, `t()`-Calls) den rohen `value`-String statt dem Label
- **Fix**: Explizite Kinder auf `<SelectValue>` — ternäre Ausdrücke die direkt den übersetzten Text liefern
- **Betroffene Dateien**: `src/app/super-admin/feedback/page.tsx`, `src/app/feedback/page.tsx`
- Zusätzlich: `<span>`-Wrapper aus `<SelectItem value="none">` in der Inline-Quarter-Edit entfernt

### Sidebar-Umbau: User-Avatar-Dropdown + Copyright
- **ShieldCheck-Icon** neben "Plexaro" im Sidebar-Header entfernt
- **Neues Footer-Design**: User-Avatar-Button öffnet `DropdownMenu` nach oben (`side="top"`) mit:
  - Nutzername (als Label via `div`, nicht `DropdownMenuLabel` — Base UI error #31 Fix)
  - Profil & Einstellungen (`/profile`)
  - Rechtliches (`/legal`)
  - Sprache-Toggle (DE/EN, inline als `LanguageSwitcherItem`-Funktion)
  - Abmelden (rot)
- **Copyright-Zeile** `© {year} Plexaro` — linksbündig, `text-muted-foreground/60`, unterhalb des Dropdowns
- `LanguageSwitcher`-Import aus Sidebar entfernt (jetzt inline als `LanguageSwitcherItem`)

### Legal-Page `/legal`
- Neue Seite mit 4 Tabs: Impressum, Datenschutz, AGB, Copyright
- Vollständig i18n-konform (`legal`-Namespace in `de.ts` + `en.ts`)
- Liest `?tab=`-Query-Parameter → öffnet direkt den richtigen Tab
- `Suspense`-Wrapper für `useSearchParams()`
- SuperAdmin-Zugriff: `/legal` in `SUPER_ADMIN_EXEMPT_PREFIXES` in `authenticated-layout.tsx` eingetragen

### Login-Seite Redesign
- `fixed inset-0 flex flex-col justify-between` — exakt Viewport-groß, kein Scrollen möglich
- Footer mit `Impressum · Datenschutz · AGB` Links (deep-links auf `/legal?tab=...`) + `© {year} Plexaro`
- `authenticated-layout.tsx`: Auth-Seiten (`/auth/*`) erhalten keinen `<div class="p-6">`-Wrapper mehr — direkt `{children}`

### Base UI Dropdown-Kompatibilität
- `DropdownMenuLabel` (= `Menu.Group.Label`) erfordert `Menu.Group`-Parent → durch einfaches `div` ersetzt (error #31)
- `asChild`-Prop existiert in Base UI nicht → durch `render`-Prop bzw. `onClick + router.push` ersetzt
- `DropdownMenuTrigger`: `className` direkt setzen (kein `asChild`/`render`)

---

## Agent Builder UI — Refactoring (01.05.2026)

### Übersicht
Umfangreiches UI-Refactoring des Content-Agent Builders. Ziel: Konsistenz mit der restlichen App-UI, klarere Struktur der Seitenleiste, Entfernung ungenutzter Komponenten.

### Änderungen

**Run Controls entfernt:**
- Die "Run Controls"-Kachel (inkl. manueller Run-Button) wurde entfernt — Runs werden ausschließlich durch externe Aktionen ausgelöst.
- Auto-Save-Status als kompakter Statusstreifen in die Toolbar-Zeile neben die Flow-Tabs verschoben.
- Auto-Save-Strip zeigt: `CheckCircle2` (gespeichert + Uhrzeit) / `Loader2` (speichert) / `AlertCircle` amber (ungespeichert) / `AlertCircle` rot (Fehler).

**Execution Panel — Vereinfachung:**
- Die drei Tabs (Executions / Timeline / Messages) wurden entfernt — Timeline und Messages sind redundant, da das Run-Detail-Modal alle Infos enthält.
- Panel zeigt nur noch die Run-Liste (gruppiert: Aktiv / Abgeschlossen).
- Status-Filter direkt im Card-Header (inline neben Titel).
- Cleanup + Hidden-Runs-Toggle in `...`-DropdownMenu ausgelagert.

**Layout-Umbau (Option B — festes Side-Panel):**
- Linke Spalte: `h-[calc(100vh-220px)]`, `overflow-hidden`, `flex flex-col`.
- Reihenfolge: NodePalette (`shrink-0`) → Trennlinie → ExecutionPanel (`flex-1 min-h-0`).
- ExecutionPanel ist in die linke Spalte integriert — kein Full-Width-Panel unterhalb des Canvas mehr.
- Resize-Mechanismus (State, Refs, MouseMove-Handler) komplett entfernt.
- Canvas (`flow-canvas.tsx`): Höhe von `h-[72vh]` auf `h-[calc(100vh-220px)]` angepasst.

**Farb-/Styling-Anpassungen:**
- NodePalette + ExecutionPanel + RunCard auf App-Standard-Styling umgestellt (weiße Cards, `border border-border`, `text-primary`, `text-muted-foreground`).
- Canvas und Node-Styles behalten ihr dunkles Theme.
- Empty States (Custom Flow deaktiviert / kein Custom Flow) auf `bg-[#0b1220]` (voll opak, kein Alpha-Overlay), Texte auf `text-white` / `text-slate-200`.
- Amber-Banner (Custom Flow aktiv): `bg-amber-950` (voll opak), `text-amber-300` Titel, `text-amber-100/80` Body, kohärenter Button.

**Header-Vereinheitlichung (NodePalette + ExecutionPanel):**
- Beide Karten haben identische Header-Struktur: Icon (`LayoutGrid` / `Activity`) + Titel (`text-sm font-semibold text-primary`) + Subline (`text-xs text-muted-foreground`).
- `NodePalette` akzeptiert `t`-Prop für i18n.

**i18n-Erweiterungen (`agentBuilder`-Block in `en.ts` + `de.ts`):**
- `toolboxTitle`, `toolboxDescription`
- `executionPanel` (umbenannt auf "Runs"), `executionPanelDescription`
- `customFlowActiveTitle`, `customFlowActiveBody`, `customFlowDeactivate`
- `customFlowDisabledTitle`, `customFlowDisabledBody`, `customFlowDisabledAgents`, `customFlowReactivate`
- `noCustomFlowTitle`, `noCustomFlowBody`, `noCustomFlowWarning`, `noCustomFlowAction`
- Alle hardcodierten deutschen Texte in Empty States und Banner ausgelagert.

### Betroffene Dateien
- `src/features/agent-workflow-v2/components/agent-workflow-v2-management.tsx`
- `src/features/agent-workflow-v2/components/execution-panel.tsx`
- `src/features/agent-workflow-v2/components/node-palette.tsx`
- `src/features/agent-workflow-v2/components/run-card.tsx`
- `src/features/agent-workflow-v2/components/flow-canvas.tsx`
- `src/i18n/messages/en.ts`
- `src/i18n/messages/de.ts`

---

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

---

## KI-Chat Feature (Creation Page) — Status: Funktionsfähig (28.04.2026)
- **Architektur**: `AIEditorWorkspace` (Parent) hält `workingContent` + `previewContent` als State. `AIChatPanel` (Child) ist immer gemountet via `hidden`-Klasse.
- **Übernehmen-Fix**: `onApplyChanges(content: string)` — kein `useRef`-Syncing (stale-closure behoben).
- **Airtable Action_Type**: `'KI-Chat'` ist kein gültiger Select-Wert → wird weggelassen. Identifikation via `Diff_Summary: 'KI-Chat: KI-Optimierung übernommen'`.
- **Markdown-Stripping**: `stripMarkdownCodeFences()` in `/api/creation/refine/route.ts`.
- **Modell-Dropdown**: Lädt verfügbare Modelle via `/api/creation/models`. Grouped Select.

## Internationalisierung / i18n (28.04.2026)
- **Vollständige DE/EN Sprachumschaltung** via Language Switcher.
- **useI18n Hook**: Gibt `{ locale, setLocale, t }` zurück.
- **Inline-Translate Pattern**: `const tr = (de: string, en: string) => (locale === "de" ? de : en);`
- **Dictionary-Pattern**: `t("dashboard.systemHealth.title")` für strukturierte Keys.
- **`dashboard.systemHealth.*`** Keys vollständig in `de.ts` + `en.ts` vorhanden.
- **`superAdmin.*`** Keys vollständig in `de.ts` + `en.ts` vorhanden.
- **`feedback.*`** Keys vollständig in `de.ts` + `en.ts` vorhanden.
- **`legal.*`** Keys vollständig in `de.ts` + `en.ts` vorhanden.
- **`sidebar.feedbackLink`, `sidebar.legalLink`, `sidebar.profile`** Keys vorhanden.

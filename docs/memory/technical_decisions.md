# Technische Entscheidungen (Stand: 14.05.2026)

## Tenant-Isolation: tenantId immer aus DB-Row, nie aus Client-Input (13.05.2026)
- In `authorize()` (NextAuth) wird `tenantId` ausschließlich aus `user.TenantId` (DB-Row) genommen — nie aus `credentials.tenantId`
- `credentials.tenantId` dient nur als Filter-Parameter für `getUserByEmail`, hat aber keinen Einfluss auf den JWT-Inhalt
- Begründung: Client-seitig übermittelte Werte dürfen nicht direkt in den Session-Token fließen

## Tenant-Isolation: Password-Verifikation pro Tenant in lookup-tenants (13.05.2026)
- `lookup-tenants` prüft das Passwort **für jeden Tenant-Row einzeln** via `bcrypt.compare()`
- Vorher: "first-password-wins" — Passwort wurde nur gegen den ersten gefundenen User-Row geprüft, alle weiteren Tenants kamen automatisch zurück
- Nachher: Nur Tenants, bei denen `bcrypt.compare(password, row.password)` `true` ergibt, sind im Response
- Rows ohne Passwort oder mit `isActive === false` werden übersprungen

## Tenant-Isolation: tid()-Fallback-Warnung (13.05.2026)
- `tid()` in `postgres.ts` loggt `console.warn` wenn `tenantId` fehlt und auf `getDefaultTenantId()` zurückgefallen wird
- Dient als Frühwarnsystem für fehlende tenantId-Weitergabe in neuen API-Routes

## Tenant-Isolation: Hardcodierte baseUrl in invite/route.ts (13.05.2026)
- `baseUrl` in `admin/invite/route.ts` wurde von `"https://content-intelligence-os-sigma.vercel.app"` auf `process.env.NEXTAUTH_URL ?? "..."` geändert
- Begründung: Invite-Links müssen zur jeweiligen Deploy-URL passen, nicht zu einer hardcodierten Production-URL

## SuperAdmin-Route-Exempt-Liste (14.05.2026)
- `SUPER_ADMIN_EXEMPT_PREFIXES` in `authenticated-layout.tsx` enthält Routen, auf die SuperAdmin zugreifen darf ohne Redirect auf `/super-admin/tenants`
- Aktuell: `["/profile", "/auth/", "/legal"]`
- **Regel**: Jede neue Route die für alle Rollen zugänglich sein soll, muss hier eingetragen werden

## Base UI DropdownMenu: kein asChild, kein DropdownMenuLabel ohne Group (14.05.2026)
- **`asChild`-Prop existiert nicht in Base UI** (nur Radix) → stattdessen `render`-Prop oder direktes `className`/`onClick`
- **`DropdownMenuTrigger`**: `className` direkt setzen, Children direkt rein — kein Wrapper nötig
- **`DropdownMenuItem` als Link**: `onClick={() => router.push(...)}` verwenden — kein `render={<Link>}`
- **`DropdownMenuLabel`** (`Menu.Group.Label`) **benötigt zwingend einen `DropdownMenuGroup`-Parent** → sonst Base UI error #31 (`MenuGroupRootContext is missing`)
- **Workaround**: Für einfache Menü-Header ein `div` mit gleichem Styling verwenden statt `DropdownMenuLabel`

## Base UI SelectValue: explizite Kinder erforderlich (14.05.2026)
- `<SelectValue />` in Base UI/Radix extrahiert automatisch Text aus `SelectItem`-Kindern — funktioniert aber nicht zuverlässig wenn Kinder komplexes JSX (`<span>`, `<Badge>`) oder `t()`-Aufrufe sind
- **Fix-Pattern**: `<SelectValue>{form.type === "feature" ? t("...typeFeature") : t("...typeBug")}</SelectValue>` — ternärer Ausdruck direkt als Kind
- **Regel**: Bei allen `<SelectValue>` die `t()` im zugehörigen `SelectItem` verwenden: explizite Kinder setzen

## Login-Seite: fixed inset-0 statt h-screen (14.05.2026)
- `h-screen overflow-hidden` auf einem inneren Div funktioniert nicht zuverlässig wenn äußere Container `min-h-full` haben
- **Lösung**: `fixed inset-0` auf dem Wurzel-Div der Login-Seite — garantiert exakt Viewport-groß, unabhängig von äußeren Containern
- Gleichzeitig: `authenticated-layout.tsx` Auth-Seiten-Branch rendert nur `{children}` ohne `<div class="p-6">`-Wrapper

## Legal-Page: URL-gesteuerte Tab-Selektion (14.05.2026)
- `/legal?tab=imprint|privacy|terms|copyright` öffnet direkt den gewünschten Tab
- `useSearchParams()` erfordert `Suspense`-Wrapper
- Login-Seite verlinkt direkt auf `/legal?tab=imprint`, `/legal?tab=privacy`, `/legal?tab=terms`

## Agent Builder: Execution Panel als Side-Panel (01.05.2026)
- Das Execution Panel sitzt in der linken Sidebar unterhalb der NodePalette — kein Full-Width-Panel mehr.
- Linke Spalte: `h-[calc(100vh-220px)] flex flex-col overflow-hidden`. NodePalette `shrink-0`, ExecutionPanel `flex-1 min-h-0`.
- Canvas: gleiche Höhe `h-[calc(100vh-220px)]` für bündiges Alignment.
- Resize-Mechanismus (State + Refs + MouseMove useEffect) vollständig entfernt — nicht mehr nötig.

## Agent Builder: Keine manuellen Run-Controls (01.05.2026)
- Run-Button und Run Controls Card entfernt. Runs werden ausschließlich extern getriggert (Commissioning-Flow).
- Auto-Save-Status ist in der Toolbar-Zeile neben den Flow-Tabs platziert (`flex justify-between`).

## Agent Builder: Dark-Theme-Flächen müssen voll opak sein (01.05.2026)
- Alle dunklen Hintergründe im Builder (`bg-[#0b1220]`, `bg-amber-950` etc.) müssen **ohne Alpha** gesetzt werden.
- Der Seiten-Hintergrund ist `bg-white` — ein `bg-[#0b1220]/60` lässt das weiße Layout durchscheinen und erzeugt einen ungewollten Grauschleier.
- **Regel**: Transparenz-Suffix (`/60`, `/80` etc.) nur auf dunklen Overlays über dunklem Hintergrund verwenden — nie auf Canvas-Flächen über dem hellen Seiten-Layout.

## Agent Builder: App-Styling vs. Dark-Theme (01.05.2026)
- **Canvas + Nodes**: Behalten dunkles Theme (`bg-[#0a101d]`, `text-slate-100`, etc.).
- **NodePalette + ExecutionPanel + RunCard**: App-Standard (`bg-white`, `border border-border`, `text-primary`, `text-muted-foreground`).
- **Empty States + Banner innerhalb des Canvas-Bereichs**: Dunkles Theme mit hohem Kontrast (`text-white`, `text-slate-200`, `text-amber-200`).

## finalHtml: Nicht in Airtable persistieren (01.05.2026)
- **Problem**: HTML-Artikel (10–50k Zeichen) × 20 gespeicherte Runs würde den RUNS_KEY-Airtable-Blob (~100k Zeichen Limit) sprengen. `persistRuns` fängt den Fehler still (`console.error`). Beim nächsten `getRunWithDetails`-Readback liest `loadStore()` aus Airtable den alten Stand — `run.output` ist leer.
- **Lösung**: `finalOutput` wird **nicht** in `updateRun` übergeben. Nach dem Readback-Call wird `output: finalOutput` direkt in den Rückgabewert injiziert: `return { ...finalRun, output: finalOutput }`. Das `finalHtml` existiert rein in-memory und kommt sicher beim Aufrufer an.
- **Regel**: `WorkflowRunV2.output` ist ein Domain-Model-Feld, aber kein Persistenz-Feld. Nie `output` in `updateRun` übergeben.

## finalHtml-Fallback-Kette (01.05.2026)
- Stufe 1 (Orchestrator): `decision.finalHtml` aus dem Finalisierungs-JSON
- Stufe 2 (bekannte Feldnamen): `finalHtml`, `html`, `content`, `result`, `text` im letzten `completedTask.output`
- Stufe 3 (längster String): Längster String-Wert ≥100 Zeichen im letzten `completedTask.output` — agnostisch gegenüber Feldnamen, da LLMs keine konsistenten Feldnamen garantieren
- Step-basierter Fallback (aus `run.steps`) wurde bewusst **entfernt** — `pruneStore` trunciert Step-Outputs auf 1500 Zeichen, was abgeschnittenes HTML liefern würde

## HistoryList: Diff_Summary muss exakter String sein (01.05.2026)
- `HistoryList.tsx` Zeile 18: `const isDelivery = summary === "Content angeliefert";` — **exakter String-Vergleich**
- Der Preview-Toggle (Inhalt anzeigen/ausblenden) und die `dangerouslySetInnerHTML`-Vorschau erscheinen **nur** bei exakt `"Content angeliefert"`
- Alle `createContentLog`-Aufrufe die deliverbare Inhalte erstellen müssen `Diff_Summary: 'Content angeliefert'` verwenden — nie Varianten wie `'Content vom Agent angeliefert'`

## Optimistisches UI-Update: Commissioning (01.05.2026)
- `setCommissionedIds` + `addAlert` werden **vor** `await triggerN8nAction(...)` aufgerufen
- Bei API-Fehler: `commissionedIds.delete(id)` macht das optimistische Update rückgängig
- Begründung: `triggerN8nAction` → `/api/n8n/trigger` → `agentService.run()` läuft synchron (kompletter Agent-Run). UI würde sonst für die gesamte Laufzeit des Runs geblockt.

## System Health: Live-Test statt AuditLog für Integrationen (30.04.2026)
- **Integrationen werden live getestet** beim Aufruf von `GET /api/system-health`.
- Tests laufen parallel via `Promise.allSettled` für minimale Latenz.
- Der `check-integrations` Cron bleibt für historisches AuditLog-Logging — ist aber nicht Datenquelle für das Health Dashboard.

## System Health: i18n-Architektur (30.04.2026)
- **API gibt `detailKey` + `detailParams` zurück** (optional), zusätzlich zu `detail` (Fallback-String).
- `{timestamp}` Sonderbehandlung: locale-sensitiv formatiert in der Komponente.
- `resolveDetail(t, locale, detailKey, detailParams, fallback)` ist die zentrale Auflösungsfunktion.

## System Health: AuditLog-Konventionen für Crons (30.04.2026)
- **Cron-Actions**: `cron:sync-gsc:success|error`, `cron:sync-sistrix:success|error|skipped`, `cron:sync-dataforseo:success|error`
- **Integration-Check-Actions**: `integration:check:<provider>:ok|error|skipped`, `integration:check:agent_webhook:ok|error|skipped`
- Sistrix-Sync läuft innerhalb von `syncGscChunk()` — kein separater Cron.
- `createAuditLog(action, rawPayload?)` in `airtable.ts` ist die zentrale Schreibfunktion. Non-blocking.

## Airtable: `Last Modified` nicht als Feldname verfügbar (30.04.2026)
- Das Airtable System-Feld "Last Modified Time" ist **kein reguläres Tabellenfeld** in `Keyword-Map`.
- **Regel**: Nur Felder abfragen, die explizit in `airtable-types.ts` als `KeywordMap`-Properties definiert sind.

## NextAuth Cookie-Konfiguration auf Vercel (29.04.2026)
- **Keine Custom Cookie Names in `authOptions`**: `withAuth` aus `next-auth/middleware` ruft intern `getToken()` auf ohne `authOptions` zu kennen → Endlos-Redirect bei abweichendem Cookie-Namen.
- **Regel**: `cookies`-Block in `authOptions` nur setzen wenn zwingend notwendig und in der `withAuth`-Middleware gespiegelt.

## NextAuth auf Vercel: `NEXTAUTH_URL` Pflicht (29.04.2026)
- **`NEXTAUTH_URL` muss pro Environment gesetzt sein**: Ohne diese Variable baut NextAuth Callback-URLs mit `http://localhost:3000`.
- `trustHost` existiert in NextAuth v4 nicht.

## KI-Chat Save-Architektur (28.04.2026)
- **Content-Parameter statt Ref**: `onApplyChanges(content: string)` — Child übergibt `refinedContent` direkt als Parameter.
- **Action_Type für KI-Chat omitted**: `'KI-Chat'` ist kein gültiger Airtable Select-Wert. `actionType` wird bei KI-Chat-Saves weggelassen.
- **Identifikation via Diff_Summary**: `'KI-Chat: KI-Optimierung übernommen'`.

## Agent-Workflow V2: Orchestrierungsmodell (26.04.2026)
- **Serielles Parent-Orchestrierungsmodell**: Parent → ein Subagent → Ergebnis → Parent. Keine Parallelität.
- **Parent-Decision Contract**: `finalize`, `summary`, `finalHtml` (neu, bei finalize=true), `next.targetNodeId`, `objective`, `memoryPatch`.
- **A2A Message Typisierung**: `messageType` (`task_request`, `task_result`, `control`) + `round` + `correlationId`.
- **runFrom**: `'published'` für Commissioning-Flows (trigger/route.ts).

## Airtable: CUSTOM_FLOW_ENABLED Config-Key (atomarer Write) (01.05.2026)
- `updateConfig(key, value)` schreibt einzelne Airtable-Rows atomar — kein JSON-Blob-Race-Condition.
- `CUSTOM_FLOW_ENABLED === 'true'` steuert Routing in trigger/route.ts unabhängig vom `state`-Feld des Workflow-Objekts (Eventual-Consistency-Schutz).

## Integrationsstrategie für Modellauflistung (26.04.2026)
- **Server-side Discovery only**: API-Keys verbleiben im Backend.
- **Cache-Strategie**: In-Memory TTL Cache, optionaler `refresh=1`.

## Optimierte Performance-Architektur (06.04.2026)
- **Tabellen-Split**: `URL_Performance` + `Keyword_Ranking_History` ersetzen `Performance_Data`.

## Computed Fields Policy (05.04.2026)
- Felder als Lookup/Formel in Airtable dürfen nie im `create`/`update`-Call gesendet werden.
- `createContentLog` filtert `undefined`-Felder aktiv aus.

## Keyword-Ranking: Sonderwert 101 (29.04.2026)
- Keywords ohne Top-100-Ranking erhalten `Ranking: 101`. UI zeigt `>100`.

## Logarithmische Y-Achse im Keyword-Ranking-Chart (29.04.2026)
- Datentransformation: `${keyword}_log = Math.log(rank)`, `${keyword}_raw = rank`.

## Dynamic Branding & Theming (06.04.2026)
- **CSS Variable Injection**: `--primary` via `BrandingProvider`.
- **Airtable Attachment Storage**: Logo/Favicon als native Attachments im `File`-Feld.

## Internationalisierung (i18n) — Pattern & Regeln (28.04.2026)
- **Inline-Translate Helper**: `const tr = (de: string, en: string) => (locale === "de" ? de : en);`
- **useI18n API**: Gibt `{ locale, setLocale, t }` zurück — kein `tr` im Hook.
- **Dictionary-Pattern**: `t("dashboard.systemHealth.title")` für strukturierte Keys.
- **Kein Base UI für Language Switcher**: Native `<button>` Elemente.
- **Columns mit Locale-Reaktivität**: `buildColumns(tr)` + `useMemo(() => buildColumns(tr), [locale])`.
- **Alle UI-Texte müssen multilingual sein**.
- **Locale-Persistenz**: `localStorage` via `LanguageProvider`. Standard-Locale ist `"de"`.

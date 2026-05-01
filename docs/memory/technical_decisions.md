# Technische Entscheidungen (Stand: 01.05.2026)

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

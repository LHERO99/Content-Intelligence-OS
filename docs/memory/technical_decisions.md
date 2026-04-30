# Technische Entscheidungen (Stand: 30.04.2026)

## System Health: Live-Test statt AuditLog für Integrationen (30.04.2026)
- **Integrationen werden live getestet** beim Aufruf von `GET /api/system-health`.
- Keine AuditLog-Abhängigkeit für Integrationsstatus — immer aktuelle Daten.
- `getIntegrationsState()` liefert, welche Provider konfiguriert sind. Nur konfigurierte Provider werden getestet und angezeigt.
- Tests laufen parallel via `Promise.allSettled` für minimale Latenz.
- Agent Webhook wird nur getestet wenn `AGENT_WEBHOOK_URL` in der Airtable Config hinterlegt ist.
- Der `check-integrations` Cron bleibt bestehen für historisches AuditLog-Logging — ist aber nicht mehr Datenquelle für das Health Dashboard.

## System Health: i18n-Architektur (30.04.2026)
- **API gibt `detailKey` + `detailParams` zurück** (optional), zusätzlich zu `detail` (Fallback-String).
- `detailKey` ist ein vollständiger i18n-Pfad: `dashboard.systemHealth.cron.lastRun`.
- `detailParams` enthält Platzhalter-Werte: `{ timestamp: "2026-04-28T04:00:00Z", days: 8 }`.
- **`{timestamp}` Sonderbehandlung**: Wird in der Komponente locale-sensitiv formatiert (`de-DE` / `en-US`) bevor es als `{time}` eingesetzt wird.
- Externe Fehlermeldungen (API-Fehler von Drittanbietern) haben **kein `detailKey`** → `detail` Rohstring wird direkt angezeigt.
- `resolveDetail(t, locale, detailKey, detailParams, fallback)` ist die zentrale Auflösungsfunktion in der Komponente.

## System Health: AuditLog-Konventionen für Crons (30.04.2026)
- **Cron-Actions**: `cron:sync-gsc:success|error`, `cron:sync-sistrix:success|error|skipped`, `cron:sync-dataforseo:success|error`
- **Integration-Check-Actions**: `integration:check:<provider>:ok|error|skipped`, `integration:check:agent_webhook:ok|error|skipped`
- Sistrix-Sync läuft innerhalb von `syncGscChunk()` — es gibt keinen separaten Sistrix-Cron. Der GSC-Cron schreibt beide Einträge.
- `createAuditLog(action, rawPayload?)` in `airtable.ts` ist die zentrale Schreibfunktion. Fehler werden geloggt aber nie nach oben geworfen (non-blocking).

## Airtable: `Last Modified` nicht als Feldname verfügbar (30.04.2026)
- Das Airtable System-Feld "Last Modified Time" ist **kein reguläres Tabellenfeld** in `Keyword-Map`.
- Wenn `fields: ['Last Modified']` im `select()`-Call angegeben wird, wirft Airtable einen Validierungsfehler.
- **Regel**: Nur Felder abfragen, die explizit in `airtable-types.ts` als `KeywordMap`-Properties definiert sind.
- Content-Pipeline-Check fragt nur `fields: ['Status']` ab.

## NextAuth Cookie-Konfiguration auf Vercel (29.04.2026)
- **Keine Custom Cookie Names in `authOptions`**: `withAuth` aus `next-auth/middleware` ruft intern `getToken()` auf, ohne `authOptions` zu kennen. Wenn `authOptions` einen custom Cookie-Namen setzt, der vom NextAuth-Default abweicht, findet die Middleware das Session-Cookie nicht → Endlos-Redirect auf Login trotz erfolgreichem Login.
- **HTTPS-Default**: NextAuth v4 verwendet auf HTTPS automatisch `__Secure-next-auth.session-token`, auf HTTP `next-auth.session-token`. Diese Automatik darf nicht durch Custom-Config überschrieben werden.
- **Regel**: `cookies`-Block in `authOptions` nur setzen wenn zwingend notwendig und dann auch in der `withAuth`-Middleware-Konfiguration spiegeln.

## NextAuth auf Vercel: `NEXTAUTH_URL` Pflicht (29.04.2026)
- **`NEXTAUTH_URL` muss pro Environment gesetzt sein**: Ohne diese Variable baut NextAuth Callback-URLs mit `http://localhost:3000` — auch in Production.
- **Vercel Environments**: Production und Preview sind separate Umgebungen mit separaten `NEXTAUTH_URL`-Werten.
- **`trustHost` ist NextAuth v5**: Die Option existiert in v4 nicht — kein Workaround über `trustHost`.

## KI-Chat Save-Architektur (28.04.2026)
- **Content-Parameter statt Ref**: `onApplyChanges(content: string)` — der Child (`AIChatPanel`) übergibt den `refinedContent` direkt als Parameter beim Klick. Kein `useRef` + `useEffect`-Sync mehr (war fragil durch stale closures).
- **Action_Type für KI-Chat omitted**: `'KI-Chat'` ist kein gültiger Airtable Select-Wert für `Action_Type`. Statt einem ungültigen Wert zu senden (422) oder einen falschen zu wählen (`'Optimierung'`), wird `actionType` bei KI-Chat-Saves vollständig weggelassen.
- **Identifikation via Diff_Summary**: KI-Chat-Saves sind in der Historie erkennbar über `Diff_Summary: 'KI-Chat: KI-Optimierung übernommen'`.
- **API-Route macht actionType optional**: `/api/planning/history` POST-Handler validiert nur noch `keywordId` als Pflichtfeld.

## Agent-Workflow V2: Orchestrierungsmodell (26.04.2026)
- **Serielles Parent-Orchestrierungsmodell**: Parent entscheidet -> ein Subagent wird beauftragt -> Ergebnis an Parent zurück -> nächste Entscheidung. Keine Parallelität auf Subagent-Ebene.
- **Parent-Decision Contract**: Parent muss ein valides JSON liefern (`finalize`, optional `summary`, optional `next`, optional `memoryPatch`).
- **A2A Message Typisierung**: `messageType` (`task_request`, `task_result`, `control`) plus `round` und `correlationId`.
- **Run-Version-Semantik**: `runFrom` (`draft`/`published`) als Eingabe; Builder-Default ist `draft`.

## Integrationsstrategie für Modellauflistung (26.04.2026)
- **Server-side Discovery only**: API-Keys verbleiben im Backend, kein Direct-to-Provider Call aus dem Browser.
- **Cache-Strategie**: In-Memory TTL Cache, optionaler `refresh=1` zur erzwungenen Aktualisierung.
- **Spezial-Integrationen**: Vertex Legal Agent (Project ID, Location, Endpoint ID, Access Token), DataForSEO (Basic Auth).

## Optimierte Performance-Architektur (06.04.2026)
- **Tabellen-Split**: `URL_Performance` (aggregiert) und `Keyword_Ranking_History` (granular) ersetzen `Performance_Data`.
- **De-Normalisierung & Bereinigung**: Alte `Performance_Data` Tabelle vollständig aus Code entfernt.

## Keyword-Ranking: Airtable Feldtyp `Keyword_ID` (29.04.2026)
- **`Keyword_ID` in `Keyword_Ranking_History` ist ein plain Text-Feld**, kein Linked-Record-Feld.
- Fix: `Keyword_ID: item._kwId` (String) statt `Keyword_ID: [item._kwId]`.

## Keyword-Ranking: Sonderwert 101 (29.04.2026)
- **Keywords ohne Top-100-Ranking erhalten `Ranking: 101`** statt still verworfen zu werden.
- UI-Konvention: `101` wird als `>100` / "Nicht in Top 100" angezeigt.

## Logarithmische Y-Achse im Keyword-Ranking-Chart (29.04.2026)
- **Datentransformation**: `${keyword}_log = Math.log(rank)`, `${keyword}_raw = rank`.
- Y-Achse: `ticks={[1,3,5,10,20,50,101].map(Math.log)}`, Tooltip liest `_raw`-Wert.

## Computed Fields Policy (05.04.2026)
- Felder die in Airtable als Lookup oder Formel definiert sind (z.B. `Target_URL` in `Content-Log`) dürfen niemals im `create`- oder `update`-Call gesendet werden.
- `createContentLog` filtert diese aktiv aus.

## Monitoring & Kosten-Logik (06.04.2026)
- **Graceful Degradation**: "Try-Best" Pattern für parallele API-Calls.
- **Daily Billing Aggregation**: Alle Log-Events einer URL innerhalb eines Tages = ein Abrechnungs-Event.
- **Case-Insensitive Config Lookup**: Alle Vergleiche gegen `Cost_Config` normalisiert (Lowercase).

## Dynamic Branding & Theming (06.04.2026)
- **CSS Variable Injection**: `--primary` als zentrale CSS-Variable via `BrandingProvider`.
- **Airtable Attachment Storage**: Logo/Favicon als native Attachments im `File`-Feld.

## Internationalisierung (i18n) — Pattern & Regeln (28.04.2026)
- **Inline-Translate Helper**:
  ```ts
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);
  ```
- **useI18n API**: Gibt `{ locale, setLocale, t }` zurück — kein `tr`. Kein `tr` in den Hook hinzufügen.
- **Dictionary-Pattern**: `t("dashboard.systemHealth.title")` für strukturierte Keys (bevorzugt für neue Features).
- **Kein Base UI für Language Switcher**: Language Switcher bleibt als native `<button>` Elemente.
- **Columns mit Locale-Reaktivität**:
  ```ts
  function buildColumns(tr: (de: string, en: string) => string): ColumnDef<T>[] { ... }
  const columns = useMemo(() => buildColumns(tr), [locale]);
  ```
- **Alle UI-Texte müssen multilingual sein**: Hardcodierte deutsche oder englische UI-Strings sind nicht akzeptiert.
- **Locale-Persistenz**: `localStorage` via `LanguageProvider`. Standard-Locale ist `"de"`.

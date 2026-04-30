# Technische Entscheidungen (Stand: 29.04.2026)

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
- **API-Route macht actionType optional**: `/api/planning/history` POST-Handler validiert nur noch `keywordId` als Pflichtfeld. `actionType` ist optional — `createContentLog` in `airtable.ts` löscht `undefined`-Felder ohnehin aktiv.

## Agent-Workflow V2: Orchestrierungsmodell (26.04.2026)
- **Serielles Parent-Orchestrierungsmodell**:
  - Die Engine wurde von linearem Topology-Run auf einen orchestrierten Round-Loop umgestellt.
  - Ablauf: Parent entscheidet -> ein Subagent wird beauftragt -> Ergebnis an Parent zurück -> nächste Entscheidung.
  - Keine Parallelität auf Subagent-Ebene (bewusste Produktentscheidung).
- **Parent-Decision Contract**:
  - Parent muss ein valides JSON liefern (`finalize`, optional `summary`, optional `next`, optional `memoryPatch`).
  - Bei ungültiger Entscheidung wird ein `control`-Message-Event geschrieben und der Run als fehlerhaft beendet.
- **A2A Message Typisierung**:
  - Einführung von `messageType` (`task_request`, `task_result`, `control`) plus `round` und `correlationId` für Nachvollziehbarkeit und Audit-Trails.
- **Konfigurations-Contract für Subagents**:
  - Node-Config wurde um `purpose`, `inputContract`, `outputContract` erweitert.
  - Diese Felder dienen als Entscheidungskontext für den Parent und als Ausführungsrahmen für Subagents.
- **Run-Version-Semantik explizit gemacht**:
  - `runFrom` (`draft` oder `published`) wurde als Eingabe eingeführt.
  - Builder-Default ist `draft`, um UI/Cavas und auszuführende Version konsistent zu halten.

## Integrationsstrategie für Modellauflistung (26.04.2026)
- **Server-side Discovery only**:
  - Modelllisten werden ausschließlich serverseitig über `/api/admin/integrations/[provider]/models` geladen.
  - API-Keys verbleiben im Backend, kein Direct-to-Provider Call aus dem Browser.
- **Cache-Strategie**:
  - In-Memory TTL Cache für Modelllisten, optionaler `refresh=1` zur erzwungenen Aktualisierung.
- **Provider-Abdeckung**:
  - Discovery für `openai`, `openrouter`, `gemini`, `copilot (GitHub Models)`, `perplexity`.
- **Spezial-Integrationen**:
  - **Vertex Legal Agent**: Nutzt spezifische Felder (Project ID, Location, Endpoint ID, Access Token) für die Kommunikation mit Google Cloud Vertex AI Endpunkten.
  - **DataForSEO**: Nutzt Basic Auth (Username/Password) für den Zugriff auf SEO-Daten-Schnittstellen.

## UX-Entscheidung: Node-Konfiguration (26.04.2026)
- **Section-first statt Flat-Form**:
  - Node-Konfiguration wurde in klar benannte, auf-/zuklappbare Sektionen aufgeteilt.
  - Ziel: geringere kognitive Last, schnellere Orientierung, bessere Erstnutzung ohne Erklärbedarf.
- **Progressive Disclosure**:
  - Kernsektionen standardmäßig offen, erweiterte Bereiche separat gekapselt.
  - Actions im Sticky-Footer für konstante Erreichbarkeit.

## Optimierte Performance-Architektur (06.04.2026)
- **Tabellen-Split Strategie**: 
  - Ersetzung der redundanten `Performance_Data` (Keyword + URL Metriken) durch zwei spezialisierte Tabellen: `URL_Performance` (aggregiert) und `Keyword_Ranking_History` (granual).
  - Ziel: Reduzierung der Datenmenge in Airtable und Vermeidung von Inkonsistenzen bei URL-Metriken.
- **De-Normalisierung & Bereinigung**: 
  - Die alte `Performance_Data` Tabelle wurde aus dem Code entfernt. 
  - Alle API-Schnittstellen (Import, Detail, Übersicht) nutzen nun die neue Struktur.
  - Veraltete Debug-Endpunkte (z.B. `/api/debug/trends`), die auf gelöschte Tabellen verweisen, wurden entfernt, um Build-Fehler zu vermeiden.

## Keyword-Ranking: Airtable Feldtyp `Keyword_ID` (29.04.2026)
- **`Keyword_ID` in `Keyword_Ranking_History` ist ein plain Text-Feld**, kein Linked-Record-Feld.
- Der Code hat ursprünglich `Keyword_ID: ["recXYZ"]` (Array) geschrieben → Airtable-Fehler `"Field cannot accept the provided value"`.
- Fix in `upsertKeywordRankingHistory` (`airtable.ts`): `Keyword_ID: item._kwId` (String) statt `Keyword_ID: [item._kwId]`.
- Gleiches gilt für Update-Calls. Lookup/Dedup-Query via `SEARCH(ARRAYJOIN({Keyword_ID}))` funktioniert unverändert auch mit Text-Feldern.

## Keyword-Ranking: Sonderwert 101 für "nicht in Top 100" (29.04.2026)
- **Keywords ohne Top-100-Ranking erhalten `Ranking: 101`** statt still verworfen zu werden.
- Vorteil: Vollständige Datenbasis (jedes Keyword hat jede Woche einen Eintrag), Lückenerkennung im Chart möglich.
- UI-Konvention: `101` wird als `>100` / "Nicht in Top 100" angezeigt. Datenpunkte mit `101` erhalten einen gesonderten Dot-Style (grauer gestrichelter Kreis).

## Logarithmische Y-Achse im Keyword-Ranking-Chart (29.04.2026)
- **Recharts unterstützt keine native `scale="log"` mit `reversed`** zuverlässig.
- Lösung: **Datentransformation** vor dem Render. Jedes Keyword bekommt zwei Felder: `${keyword}_log = Math.log(rank)` und `${keyword}_raw = rank`.
- `<Line dataKey="${keyword}_log">` — Chart arbeitet mit transformierten Werten.
- Y-Achse: `ticks={[1,3,5,10,20,50,101].map(Math.log)}`, `tickFormatter` rechnet via `Math.round(Math.exp(v))` zurück.
- Tooltip: liest `_raw`-Wert aus `props.payload` für korrekte Originalanzeige.
- Ergebnis: Positionen 1–20 nehmen ~75% der Chart-Höhe ein, 20–100 komprimiert.


- **Computed Fields Policy (05.04.2026)**: 
  - Felder, die in Airtable als Lookup oder Formel definiert sind (z.B. `Target_URL` in `Content-Log`), dürfen niemals im `create`- oder `update`-Call der API gesendet werden. 
  - Der Airtable-Service (`createContentLog`) filtert diese nun aktiv aus, um 422 Unprocessable Entity Fehler zu vermeiden.
- **ID-First Validation**: Verknüpfungsfelder (Link fields) in Airtable werden vor dem Senden auf das Präfix `rec` validiert. Ungültige Daten führen zum Abbruch des Log-Eintrags mit Fehlerprotokollierung, anstatt fehlerhafte Daten in die DB zu schreiben.
- **Persistent URL Logging**: Da Keywords beim Blacklisting gelöscht werden, wird die `Target_URL` nun als statischer Text in der Blacklist-Tabelle (nur bei Typ URL) und in den Logs mitgeführt, um die Historien-Integrität zu wahren.
- **Differenziertes Blacklist-Logging (06.04.2026)**: Unterscheidung zwischen `URL der Blacklist hinzugefügt` und `Keyword der Blacklist hinzugefügt`. Dies steuert die Anzeige des "Blacklisted"-Badges in der Historie (Badge erscheint nur bei URL-Level Events via `startsWith` Check).
- **Main Keyword Integrität**: Erzwingung, dass Main Keywords nur über das URL-Blacklisting entfernt werden können, um verwaiste URLs ohne Main Keyword im Planning zu verhindern.
- **Server-side Proxy Logging**: Kritische Events wie "Beauftragt" werden nicht mehr vom Client (Frontend) geloggt, sondern im Server-Proxy (`api/n8n/trigger`), um Race Conditions und blockierte Webhooks zu verhindern.
- **URL-Deduplizierung beim Bulk-Import**: Um die Historie sauber zu halten, wird beim Import einer Liste mit Main- und Nebenkeywords das Event "URL hinzugefügt" nur einmal pro eindeutiger URL ausgelöst (via `Set` Tracking in der Route).
- **Background Task Pattern**: Webhooks an externe Systeme (n8n) werden im API-Layer nicht mehr "awaited", sondern als Background-Promises ausgeführt, um Timeouts und UI-Blocking zu verhindern. Fehler werden via `.catch()` im Server-Log isoliert.
- **Middleware Standardization**: Nutzung der standardkonformen `src/middleware.ts` anstelle von proprietären Proxy-Dateien, um Next.js Build-Konflikte zu vermeiden und granulare Pfad-Freigaben (z.B. für n8n-Inbound) zu ermöglichen.
- **Inbound Data Resilience (06.04.2026)**: Implementierung von "Double-JSON Parsing" im n8n Callback, um Robustheit gegen unterschiedliche Serialisierungs-Strategien in n8n-Workflows zu gewährleisten.
- **Schema Alignment Policy**: Bei Löschung von Feldern in Airtable (z.B. `Reasoning_Chain`) erfolgt eine sofortige systemweite Entfernung im Code, da Airtable keine unbekannten Felder akzeptiert (422 Error). Grund-Details werden stattdessen im `Diff_Summary` konsolidiert.

## Monitoring & Kosten-Logik (06.04.2026)
- **Graceful Degradation Policy**: Die Monitoring-Route nutzt nun ein "Try-Best" Pattern für parallele API-Calls. Das Fehlschlagen einer Tabelle (z.B. Cost_Config) führt nicht mehr zum Totalausfall des Dashboards, sondern wird durch Log-Warnungen und leere Default-Werte abgefangen.
- **Contextual Page_Type Inference**: Bei fehlenden Metadaten im Log/Keyword wird der `Page_Type` über die URL-Struktur (`/ratgeber/` vs. `/kategorie/`) hergeleitet. Dies stellt sicher, dass ROI-Berechnungen auch bei unvollständigen Airtable-Daten funktionieren.
- **Daily Billing Aggregation**: Um Kosten-Ausreißer durch technische Korrekturen zu vermeiden, werden alle Log-Ereignisse einer URL innerhalb eines Kalendertages als ein einziges Abrechnungs-Event gewertet.
- **Case-Insensitive Config Lookup**: Alle Vergleiche gegen die `Cost_Config` (Page_Type, Action_Type) werden normalisiert (Lowercase) durchgeführt, um Fehler durch unterschiedliche Schreibweisen in Airtable zu eliminieren.
- **Extended Target-Source for Monitoring**: Das Monitoring-Dashboard basiert nun primär auf der `URL_Performance` Tabelle. Sobald Daten für eine URL existieren, wird sie gelistet, unabhängig davon, ob bereits Logs vorliegen.
- **Inbound Data Resilience (Monitoring API, 06.04.2026)**: Aggressives String-Casting (`String(val)`) in der Monitoring-API zur Vermeidung von `TypeError: toLowerCase is not a function` bei unvollständigen Airtable-Daten.

## Dynamic Branding & Theming (06.04.2026)
- **CSS Variable Injection**: Nutzung von `--primary` als zentrale CSS-Variable für das Corporate Design, injiziert über den `BrandingProvider`.
- **Dynamic Asset Hook**: Komponenten laden Logo- und Favicon-URLs über den `useBranding` Hook, der diese aus der globalen `Config` (Airtable) bezieht.
- **Airtable Attachment Storage Strategy**: 
  - Da Airtable-Textfelder auf 100k Zeichen begrenzt sind, werden Logo und Favicon als native **Attachments** in der Spalte `File` gespeichert.
  - Die API (`updateConfig`) nimmt Base64-Daten entgegen und lädt diese via Airtable-Proxy als Datei hoch.
  - Fallback: Der Pfad wird zusätzlich als Text in `Value` gespeichert, sofern er keine Base64-Daten enthält.
- **Admin Tab Implementation**: Neuer Admin-Bereich für Branding-Einstellungen mit integriertem Farb-Picker und Datei-Upload (max. 2MB).
- **Tailwind Integration**: Tailwind wurde so konfiguriert (via `globals.css`), dass die `primary` Farbe direkt auf die CSS-Variable zugreift.

## Monitoring UI & Workflow (06.04.2026)
- **Optimierungs-Guard**: Planung einer Optimierung erfordert nun zwingend, dass bereits ein "Content angeliefert" oder "Content veröffentlicht" Event in der Historie existiert.
- **Row-Action Pattern**: Umstellung von expliziten "Details"-Buttons auf zeilenbasiertes Klicken in der Monitoring-Tabelle zur Verbesserung der UX.
- **ROI Data Injection**: Die Monitoring-Übersicht API berechnet nun aggregierte Kosten-Einsparungen pro URL on-the-fly, um sie in der Haupttabelle anzuzeigen.

## Internationalisierung (i18n) — Pattern & Regeln (28.04.2026)
- **Inline-Translate Helper**: Statt eines zentralen `tr`-Exports aus `useI18n` wird `tr` als lokale Funktion in jeder Komponente definiert:
  ```ts
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);
  ```
  Dies ist das etablierte, konsistente Pattern im gesamten Projekt.
- **useI18n API**: Gibt nur `{ locale, setLocale, t }` zurück — kein `tr`. Kein `tr` in den Hook hinzufügen.
- **Kein Base UI für Language Switcher**: `@base-ui/react DropdownMenu.Trigger` mit Children führt zu Error #31. Language Switcher bleibt als native `<button>` Elemente.
- **Columns mit Locale-Reaktivität**: Statische `const columns: ColumnDef[]` außerhalb von Komponenten können `useI18n` nicht nutzen. Pflicht-Pattern:
  ```ts
  function buildColumns(tr: (de: string, en: string) => string): ColumnDef<T>[] { ... }
  // In Komponente:
  const columns = useMemo(() => buildColumns(tr), [locale]);
  ```
- **Alle UI-Texte müssen multilingual sein**: Bei jeder neuen Komponente oder jedem neuen Feature müssen alle sichtbaren Strings mit `tr(de, en)` gewrappt werden. Hardcodierte deutsche oder englische UI-Strings sind nicht akzeptiert.
- **Locale-Persistenz**: Die gewählte Sprache wird in `localStorage` gespeichert (via `LanguageProvider`). Standard-Locale ist `"de"`.
- **Keine `document.documentElement.lang` für reaktive Übersetzungen**: Dieser Wert reagiert nicht auf React-State-Änderungen und darf nur als Fallback für nicht-reaktive Kontexte (z.B. `toLocaleDateString`) genutzt werden — nicht als Basis für UI-Text-Entscheidungen.

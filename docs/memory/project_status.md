# Projekt-Status (Stand: 29.04.2026)

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

## Node-Konfigurations-UX (Builder)
- **Komplette UX-Neustrukturierung**: Node-Drawer in klaren Sektionen (`Rolle & Identität`, `Aufgabe`, `LLM Setup`, `I/O Vertrag`, `Erweitert`) mit selbsterklärender Mikrocopy.
- **Bessere Bedienbarkeit**: Sektionen sind auf-/zuklappbar, relevante Bereiche initial offen; Sticky-Aktionsleiste im Footer (`Node entfernen`, `Fertig`).
- **Model-UI harmonisiert**: Einheitliches Verhalten für Laden/Aktualisieren/Auswählen inkl. Admin-Hinweis bei fehlender Provider-Anbindung.

## Content-Lifecycle & Logging-Events
- **Status-Workflow**: Der Workflow umfasst nun: `Backlog` -> `Planned` -> `Beauftragt` -> `Angeliefert` -> `Published`.
- **Lückenloses Event-Logging**: Alle Kern-Meilensteine werden nun robust in der `Content-Log` Tabelle erfasst:
  1. **URL dem Tool hinzugefügt**: Automatisches Log beim Import (`import/route.ts`) und bei manueller Erstellung (`keywords/route.ts`).
  2. **URL wurde dem Tab 'Vorschläge' hinzugefügt**: Automatisches Log, wenn ein Keyword im `Backlog` landet und `Main_Keyword === 'Y'` ist (Import, manuelle Erstellung, Trends/Monitoring).
  3. **URL wurde der Redaktionsplanung hinzugefügt**: Log bei Status-Transition zu `Planned`.
  4. **Content wurde beauftragt**: Zentrales Logging im n8n-Trigger-Proxy (`api/n8n/trigger/route.ts`) bei Klick auf "Beauftragen".
  5. **Content angeliefert**: Erfasst via n8n Callback Webhook (`api/n8n/callback/route.ts`).
  6. **Content veröffentlicht**: Log bei Status-Transition zu `Published`.
  7. **URL der Blacklist hinzugefügt**: Automatisches Logging beim Verschieben oder Hinzufügen zur Blacklist (nur bei Blacklist-Typ "URL").
  8. **URL von der Blacklist entfernt**: Logging bei Wiederherstellung aus der Blacklist.
  9. **Keyword der Blacklist hinzugefügt**: Separates Logging für Keyword-spezifische Blacklist-Einträge ohne URL-Impact.

## Datenbank & API-Stabilität
- **Airtable Service-Härtung**:
  - **Computed Field Fix**: Das Feld `Target_URL` in `Content-Log` wird beim Schreiben explizit ignoriert.
  - **URL-Historie Persistenz**: `getContentHistoryByUrl` nutzt nun einen `OR`-Filter (`Target_URL` ODER `Logged_URL`), um Historie auch nach Keyword-Löschung (Blacklisting) anzuzeigen. Der "Blacklisted" Badge wird nur bei URL-Level Events angezeigt.
  - **Aggressives URL-Grouping**: Die UI (`content-history-table.tsx`) nutzt eine Fallback-Kette (Logged_URL -> Keyword-Map -> Target_URL), um Logs einer URL zuozuordnen.
- **Blacklist-Sicherheitsmechanismen (06.04.2026)**:
  - **Main Keyword Schutz**: Main Keywords können nicht einzeln blacklisted werden; erfordert URL-Blacklisting oder Neuzuweisung des Main Keywords.
  - **Double Confirmation**: URL-Blacklisting erfordert eine zweite Bestätigung mit Datenverlust-Warnung.
  - **UI Fix**: Lange URLs in der Blacklist-Bestätigung werden nun umgebrochen statt abgeschnitten.
- **Schema-Cleanup (06.04.2026)**: Das Feld `Reasoning_Chain` wurde systemweit entfernt (Airtable, Types, Routen, UI), da es aus der Datenbank gelöscht wurde.
- **n8n Callback Härtung**: Der n8n Callback (`api/n8n/callback`) beherrscht nun "Double-JSON Parsing", um robust gegen fehlerhafte Serialisierung in n8n-Workflows zu sein.
- **Blacklist-Logging**: Manuelle Keyword-Erstellung und Monitoring-Vorschläge (Trends) triggern nun korrekt die "Vorschläge"-Historie.

## n8n Integration & Performance-Monitoring
- **Webhook-Optimierung**: Alle n8n-Webhook-Calls (Import & Content) laufen nun asynchron im Hintergrund ("Fire & Forget"), um die UI-Antwortzeit beim Speichern von Keywords zu minimieren.
- **Detaillierte Payload-Struktur**: Der `IMPORT_DATA` Webhook sendet nun gruppierte Daten pro URL inklusive differenzierter Felder für `MainKeyword` und durchnummerierte `SecondaryKeywordX`.
- **API-Key Schutz**: Neuer Endpunkt `/api/monitoring/import` für Daten-Rückfluss von n8n, gesichert via `x-api-key`.

## Optimierte Performance-Speicherung (06.04.2026)
- **Tabellen-Split**: Die redundante `Performance_Data` Tabelle wurde durch zwei spezialisierte Tabellen ersetzt:
  1. **`URL_Performance`**: Speichert aggregierte Metriken (Klicks, Impressions, Position, Sistrix VI) auf URL-Ebene pro Woche.
  2. **`Keyword_Ranking_History`**: Speichert wöchentliche Rankings pro Keyword (verknüpft mit `Keyword-Map`).
- **Migration**: Die alte `Performance_Data` Tabelle wurde aus dem Code entfernt, um Berechtigungsfehler (403/404) nach deren Löschung in Airtable zu verhindern.
- **Import-Logik**: Der Import-Endpunkt `/api/monitoring/import` verteilt eingehende Daten nun automatisch auf beide neuen Tabellen.
- **Monitoring Übersicht**: Die globale Übersicht nutzt nun `URL_Performance` als Datenbasis, was die Ladezeiten verbessert und Redundanzen eliminiert.

## UI & Visualisierung (URL Detail & Monitoring)
- **Erweiterte Detailansicht**: Die `UrlDetail` Komponente zeigt nun zwei separate Charts:
  1. **URL-Performance**: Zeitverlauf von Klicks und Sistrix VI.
  2. **Keyword-Rankings**: Individuelle Kurven für alle zugeordneten Keywords (Main vs. Secondaries) mit Invertierter Y-Achse (Position 1 oben).
- **Dynamic Icons**: Neues `Hash` Icon für Keyword-Zählungen und verbesserte `Badge` Logik für Main Keywords.
- **Fehlertoleranz**: Alle Monitoring-Komponenten fangen nun fehlende Tabellen oder leere Datensätze ab, um "Failed to fetch" Fehler zu vermeiden.

## UI & Visualisierung (HistoryList)
- **Dynamischer Blacklist-Status**: Der "Blacklisted" Badge in der Historie ist nicht mehr "sticky", sondern richtet sich nach dem zeitlich letzten Event (Hinzugefügt vs. Entfernt).
- **Icon-System**: Icons für Blacklist (`ShieldAlert` in Rot) und Vorschläge (`Lightbulb` in Amber).
- **Editor-Tracking**: User-E-Mail wird bei fast allen Events erfasst.

## Monitoring & Kosten-Berechnung (Status: Stable)
- **Fehler-Resilienz**: In `api/monitoring/route.ts` wurden individuelle `.catch()` Blöcke für parallele Airtable-Anfragen implementiert.
- **Härtung gegen Datenfehler (06.04.2026)**: Die API nutzt nun aggressives String-Casting (`String(val)`) für alle Metadaten aus Airtable, um `TypeError: toLowerCase is not a function` bei unvollständigen Datensätzen zu verhindern.
- **Programmatisches Page_Type Mapping**: Die API zieht den `Page_Type` primär aus der `Keyword-Map` oder nutzt ein URL-basiertes Fallback (`/ratgeber/` vs. `/kategorie/`).
- **Kosten-Präzision**: 
  - **Deduplizierung**: Mehrfache Logs pro Tag/URL werden zu einem Abrechnungs-Event zusammengefasst.
  - **Trigger**: "Content angeliefert" im `Diff_Summary` fungiert als Kern-Trigger für die ROI-Berechnung.
- **Monitoring-Tabelle Upgrade (06.04.2026)**:
  - **Klickbare Zeilen**: Die gesamte Tabellenzeile öffnet nun per Klick die Detailansicht.
  - **Individuelle ROI-Anzeige**: Neue Spalte für die kumulierten "Eingesparten Kosten" pro URL direkt in der Liste.
  - **Optimierungs-Sperre**: Buttons zur Optimierungs-Planung sind deaktiviert, sofern nicht bereits Content erstellt UND als veröffentlicht markiert wurde.
- **Importer-Upgrade**: Unterstützung für direktes Mapping des `Page_Type` Feldes ("Seitentyp").

## Dynamic Branding & Asset Management (06.04.2026)
- **Konfigurierbares Branding**: Einführung eines "Branding"-Tabs im Admin-Bereich zur Pflege von Logo, Favicon und Primärfarbe.
- **Native Airtable-Integration**: Umstellung auf das Airtable-Feld **"File" (Attachment)** zur Speicherung von Assets, um Zeichenbegrenzungen von Textfeldern zu umgehen.
- **Base64-Upload**: Der Upload-Prozess konvertiert Bilder in Base64 für den Transfer und speichert sie sicher in Airtable.
- **UI/UX**: Interaktive Drag&Drop-Zonen für Logo und Favicon im Admin-Bereich mit Größen-Validierung (max. 2MB).
- **Echtzeit-Anwendung**: Der `BrandingProvider` injiziert die Primärfarbe via CSS-Variable (`--primary`) und aktualisiert das Favicon dynamisch im Browser.
- **Refactoring**: Hardcodierte DocMorris-Brandings in Sidebar und Layout wurden durch dynamische Assets ersetzt.

## Vercel Deployment & Auth-Fixes (29.04.2026)
- **`/api/branding` public gemacht**: Die Route wurde nicht als public path in der Middleware eingetragen und wurde daher für nicht-eingeloggte User auf die Login-Seite umgeleitet (HTML statt JSON). Fix: Path in `authorized`-Callback und `matcher` ergänzt.
- **Cookie-Name-Mismatch behoben**: `authOptions` hatte eine custom `cookies`-Config mit `name: 'next-auth.session-token'`. Auf HTTPS (Vercel) verwendet NextAuth standardmäßig `__Secure-next-auth.session-token`. Die `withAuth` Middleware hat eigene `getToken`-Logik ohne Zugriff auf `authOptions` → konnte das Cookie nicht finden → hat User trotz erfolgreichem Login auf `/auth/signin` umgeleitet. Fix: Custom `cookies`-Config vollständig entfernt — NextAuth wählt den korrekten Cookie-Namen nun automatisch je nach Umgebung.
- **`NEXTAUTH_URL` korrekt konfiguriert**: War auf `https://www.concycle.io` gesetzt (falsch). Korrigiert auf `https://content-intelligence-os-sigma.vercel.app` (Production) und `https://content-intelligence-os-git-development-lhero99s-projects.vercel.app` (Preview).
- **GSC OAuth `redirect_uri_mismatch` behoben**: `NEXTAUTH_URL` war nicht gesetzt → App baute `http://localhost:3000/api/auth/google/gsc/callback` als Redirect-URI. Nach korrektem Setzen der Var funktioniert der OAuth-Flow.

## Internationalisierung / i18n (28.04.2026)
- **Vollständige DE/EN Sprachumschaltung**: Die gesamte UI kann per Language Switcher zwischen Deutsch und Englisch umgeschaltet werden.
- **LanguageProvider**: Eingebunden in `src/app/layout.tsx`; persistiert die gewählte Sprache in `localStorage`.
- **useI18n Hook** (`src/i18n/use-i18n.ts`): Gibt `{ locale, setLocale, t }` zurück. Liefert kein `tr` direkt — dieses wird per Inline-Helper definiert: `const tr = (de: string, en: string) => (locale === "de" ? de : en);`
- **Inline-Translate Pattern**: Alle lokalisierten Komponenten verwenden `tr(de, en)` direkt im JSX für schnelle Inline-Übersetzungen. Dictionary-basiertes `t("key")` ist ebenfalls verfügbar.
- **LanguageSwitcher**: Zwei native `<button>` Elemente (DE / EN) — kein Base UI mehr (Base UI Error #31 bei DropdownMenu.Trigger vermieden).
- **Lokalisierte Dateien** (vollständig):
  - `src/components/language-switcher.tsx`
  - `src/components/app-sidebar.tsx`
  - `src/components/authenticated-layout.tsx` (Viewport-Warnung)
  - `src/app/planning/blacklist.tsx` (inkl. dynamische `buildColumns(tr)` Funktion für reaktive Spaltenköpfe)
  - `src/app/admin/page.tsx`
  - `src/app/admin/integrations-management.tsx`
  - `src/app/admin/cost-management.tsx`
  - `src/app/monitoring/page.tsx`
  - `src/features/planning/components/keyword-import.tsx`
  - `src/features/planning/components/KeywordFilterBar.tsx`
  - `src/features/planning/components/EditorialFilterBar.tsx`
  - `src/features/planning/components/EditKeywordModal.tsx`
  - `src/features/planning/components/EditEditorialModal.tsx`
  - `src/features/admin/components/optimization-rules-tab.tsx`
  - `src/features/admin/components/branding-tab.tsx`
- **Bekannte Eigenheit**: Statische `columns`-Arrays (ColumnDef[]) außerhalb von Komponenten können keine Hooks nutzen. Lösung: `buildColumns(tr)` als Funktion + `useMemo(() => buildColumns(tr), [locale])` innerhalb der Hauptkomponente.
- **Reactive Columns Pattern**: Alle Tabellenspalten-Definitionen, die übersetzbare Header haben, müssen in `useMemo` mit `locale` als Dependency definiert werden.


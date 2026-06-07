# Technische Entscheidungen (Stand: 07.06.2026 – aktualisiert 7)

## AIEditorWorkspace: v2Content-Stabilität via lastV2Ref (07.06.2026)
- **Problem**: Nach `handleSaveFromAI` → `refresh-planning-data` → `displayLogId` wechselt → `bodyCache[newId]` noch undefined → `v2Content = ''` → Workspace unmountet → AI-Chat-Tab und Nachrichten weg
- **Lösung**: `lastV2Ref = useRef<Record<number, string>>({})` in `page.tsx` hält den letzten bekannten `v2Content` pro `selectedJobId`; der angezeigte Wert ist `bodyCache[displayLogId]?.contentBody ?? lastV2Ref.current[selectedJobId] ?? ''`
- **Regel**: `AIEditorWorkspace` darf nie wegen eines kurzzeitig leerem Body-Cache unmounten — `lastV2Ref` stellt sicher, dass der zuletzt bekannte Inhalt gehalten wird bis der neue Body geladen ist

## Publish Idempotency: Guard in handlePublish (07.06.2026)
- `TooltipTrigger` um ein `disabled`-Prop wrappbares Element ist kein natives `<button>` → Click-Events werden nicht zuverlässig geblockt
- **Fix**: `if (isPublished) return;` als erster Guard in `handlePublish`
- **Regel**: Alle irreversiblen Aktionen (Publish, Commission) müssen einen expliziten State-Guard als erste Zeile haben, unabhängig vom disabled-State des auslösenden UI-Elements

## Publish Cross-Cycle Contamination: Expliziter Check in buildJobEntries (07.06.2026)
- **Problem**: `kw.Status = 'Published'` wird durch Re-Publish der Erstellung gesetzt. Der aktive Optimierungs-Cycle liest denselben `kw.Status` und erbt fälschlicherweise `'Published'`
- **Fix**: Im aktiven Cycle-Branch wird geprüft ob ein `publishLogs`-Eintrag mit passendem `Keyword_ID[0] === kwId` aber `Commission_Log_Id !== cl.ID` existiert. Wenn ja: Status-Override zu `'Angeliefert'` oder `'Backlog'`
- **Regel**: Status aus `kw.Status` ist URL/Keyword-global — für Cycle-spezifischen Status immer gegen `publishLogs` kreuzprüfen um Cycle-Kontamination zu vermeiden

## KI-Chat Logging: Prompt-Events nicht persistieren (07.06.2026)
- **Entscheidung**: KI-Chat-Prompts (`refine/route.ts`) werden nicht mehr als `ContentLog` persistiert
- `'KI-Chat: KI-Optimierung übernommen'` (via `handleSaveFromAI` → `/api/planning/history`) bleibt erhalten — das ist ein User-initiierter Übernahme-Event, kein Prompt-Event
- **Begründung**: Prompt-Logs erzeugen Rauschen im Event-Log ohne Mehrwert für den User; die Übernahme selbst ist das relevante Ereignis

## RichTextEditor: isSaved-Feedback-Pattern (07.06.2026)
- **Pattern**: Parent hält `isSaved: boolean` State; nach erfolgreichem Save `setIsSaved(true)`; RichTextEditor ruft `onContentChange?.()` on jede Änderung → Parent `setIsSaved(false)`
- Button-Zustände: Spinner (`isSaving`) → grün + `CheckCheck` + "Änderungen gespeichert" (`isSaved`, disabled) → normal "Speichern" (enabled)
- **Regel**: Feedback-States nie im Editor selbst halten — Parent kennt den API-Erfolg; Editor kennt die Content-Änderungen; Props verbinden beide Zustände

## GeneralSettingsTab: BrandingTab ersetzt (02.06.2026)
- `BrandingTab` wurde aufgelöst — `GeneralSettingsTab` übernimmt Domain + Branding in einem Tab
- Admin-Tab-Reihenfolge: `general` (Default) → `users` → `costs` → `optimization-rules` → `integrations` → `agent-settings` → `alerts` → `feedback`
- **Regel**: Konfigurationen die logisch zusammengehören (Domain + Branding = "Tenant-Identität") in einem Tab bündeln

## TENANT_DOMAIN: Pflichtfeld für DataForSEO-Ranking-Abfragen (02.06.2026)
- DataForSEO-Ranking-Abfragen verwenden als Ziel-Domain `TENANT_DOMAIN` aus der Tenant-Config
- Vorher: Die Target-URL aus der Keyword-Map wurde direkt als Domain für die Ranking-Abfrage verwendet
- **Problem**: Wenn Target-URLs Subpfade oder Unterseiten-URLs enthalten, schlägt die Domain-Erkennung fehl
- **Lösung**: `TENANT_DOMAIN` als zentraler Konfigurationspunkt → `targetForRanking = tenantDomain?.trim() ? tenantDomain : url`
- **Regel**: Für Ranking-Abfragen immer `TENANT_DOMAIN` aus der Tenant-Config verwenden, nicht aus URLs ableiten
- `TENANT_DOMAIN` ist als Pflichtfeld in der Setup-Checkliste aufgenommen

## Monitoring: isPublished via Status-Feld, nicht Event-Label (02.06.2026)
- Vorher: `urlLogs.some(l => s.includes('content angeliefert') || s.includes('content veröffentlicht'))`
- **Problem**: Event-Label-String-Matching ist fragil und kulturell abhängig
- **Jetzt**: `urlKeywords.some(k => k.Status === 'Published')`
- **Regel**: Status-Prüfungen immer auf Enum-Felder basieren, nie auf freitextigen Event-Labels

## ContentLog: User-Info via JOIN, kein separater Fetch (31.05.2026)
- `getContentLogs()` joined direkt auf `usersTable` via `processEvents.userId`
- `User_Name` + `User_Email` werden in einer einzigen Query geladen (kein N+1)
- `Editor?: string[]` bleibt für Backwards Compatibility erhalten
- **Regel**: User-Display-Daten via JOIN in der List-Query laden, nicht per separate Fetch-Schicht

## AIEditorWorkspace: Keywords-Info via dedizierten Endpoint (31.05.2026)
- `GET /api/planning/keywords/by-url?url=...` — Endpoint gibt alle Keywords für eine URL zurück
- Editor-Komponente fetcht Keywords on-mount wenn `targetUrl` gesetzt
- Fallback: nur Haupt-Keyword wenn URL fehlt oder Fetch schlägt fehl
- Main-Keyword wird immer zuerst sortiert (BY `Main_Keyword === 'Y'`)
- **Regel**: Für kontextuelle Info im Editor (welche Keywords gehören zur URL?) einen eigenen schlanken Endpoint verwenden



## Content Versioning: Neue Version bei jedem Save (18.05.2026)

### Entscheidung: Append-Only Versioning

**Verhalten:**
- Jeder Content-Save erstellt eine **neue** `execution_versions` Zeile
- `versionNumber` wird auto-inkrementiert (1, 2, 3...)
- **NICHT** Überschreiben der letzten Version

**Beispiel:**
1. Agent Delivery → Version 1 (versionNumber=1, createdByAi=true)
2. Manual Edit #1 → Version 2 (versionNumber=2, createdByAi=false)
3. Manual Edit #2 → Version 3 (versionNumber=3, createdByAi=false)

**Vorteile:**
- ✅ Vollständige Änderungs-Historie
- ✅ Rollback möglich (zu vorheriger Version)
- ✅ Audit-Trail: Wer hat wann was geändert
- ✅ AI vs. Manual Edits nachvollziehbar

**Schema:**
```sql
execution_versions (
  id SERIAL PRIMARY KEY,
  cycle_id INT REFERENCES execution_cycles(id),
  version_number INT NOT NULL,
  content_html TEXT,
  created_by_user_id TEXT REFERENCES users(id),
  created_by_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMP,
  UNIQUE(cycle_id, version_number)
)
```

**Frontend-Mapping:**
- `creation/page.tsx` zeigt immer die **neueste Version** pro Commission
- `latestV2LogByCommission.get(commissionLogId)` - nimmt neuesten Eintrag nach Timestamp
- Nach Save: Refresh zeigt automatisch neue Version

### Cycle_Id vs Commission_Log_Id Separation (18.05.2026)

**Problem:**
- `Commission_Log_Id` ist die **process_events.id** (Event-Log-Eintrag)
- `cycleId` ist die **execution_cycles.id** (Workflow-Entität)
- Ursprünglicher Code verwendete `Commission_Log_Id` als FK für `process_events.cycleId` → Foreign Key Constraint Fehler

**Lösung:**
- `createContentLog` akzeptiert jetzt **beide** Parameter:
  - `Cycle_Id?: number` - für FK Constraint zu execution_cycles
  - `Commission_Log_Id?: number` - für Display-Mapping zwischen Commission und Delivery
- `Commission_Log_Id` wird in `eventData.commission_log_id` gespeichert (JSONB)
- `getContentLogs()` extrahiert: `Commission_Log_Id: eventData.commission_log_id ?? cycle?.id`

**Warum beide nötig:**
- `Cycle_Id`: Database integrity (FK)
- `Commission_Log_Id`: Frontend benötigt Verknüpfung zwischen "beauftragt" und "angeliefert" Events für UI-Mapping

### Auto-Resolution von Commission Log ID (18.05.2026)

**Problem:**
- External Agent sendet `commissionLogId` nicht im Callback zurück
- Frontend benötigt es aber für Job-Mapping

**Lösung:**
- Wenn `commissionLogId` nicht im Callback-Body:
  - Query `process_events` für den gefundenen `cycleId`
  - Suche Event mit `eventType='cycle_commissioned'`
  - Verwende dessen `id` als `resolvedCommissionLogId`
- Wird automatisch in `eventData.commission_log_id` gespeichert

**SQL-Migration für alte Daten:**
```sql
UPDATE process_events pe_del
SET event_data = jsonb_set(
    COALESCE(pe_del.event_data, '{}'::jsonb), 
    '{commission_log_id}', 
    (SELECT pe_comm.id::text::jsonb FROM process_events pe_comm 
     WHERE pe_comm.keyword_id = pe_del.keyword_id 
       AND pe_comm.event_type = 'cycle_commissioned'
       AND pe_comm.event_timestamp < pe_del.event_timestamp
     ORDER BY pe_comm.event_timestamp DESC LIMIT 1)
)
WHERE pe_del.event_type = 'cycle_delivered' 
  AND (pe_del.event_data->>'commission_log_id' IS NULL);
```

### Case-Handling: contentBody vs Content_Body (18.05.2026)

**Problem:**
- API-Funktion `getContentLogBody()` gibt `{ contentBody, eventLabel }` zurück (lowercase)
- Frontend-Code erwartete `{ Content_Body, Event_Label }` (PascalCase)

**Entscheidung:**
- **Beide Schreibweisen unterstützen** für Backwards Compatibility
- `displayedBody?.contentBody ?? displayedBody?.Content_Body`
- TypeScript-Typen erweitert um beide Varianten

**Regel:**
- API gibt primär `contentBody` (camelCase) zurück
- Frontend akzeptiert beide (Fallback zu PascalCase für Kompatibilität)

---

## URL-zentrische Datenbank-Architektur (17.05.2026)

### Design-Entscheidungen

**1. URLs als First-Class-Entities:**
- URLs sind primäre Entitäten, Keywords sind Attribute
- Eine URL kann mehrere Keywords haben (1:N Beziehung)
- URL-ID als Foreign Key in allen abhängigen Tabellen

**2. Prozess-Separation:**
- Drei unabhängige State-Machines: Planning, Execution, Publishing
- Jeder Prozess hat eigene Status-Tabelle
- Ermöglicht parallele Workflows (z.B. neue Planung während vorheriger Cycle in Review ist)

**3. Multi-Cycle als natives Konzept:**
- `execution_cycles` mit `cycle_number` (1, 2, 3...)
- Erste Erstellung = Cycle 1, spätere Optimierungen = Cycle 2+
- Jeder Cycle kann unabhängig publiziert werden
- Keine commission_log_id-Workarounds mehr nötig

**4. Strukturierte Versionierung:**
- `execution_versions` pro Cycle
- Version 1 = initiale Agent-Delivery, Version 2+ = manuelle Edits/AI-Refinements
- `publishing_status.version_id` referenziert welche Version publiziert ist

**5. Event-Sourcing mit Typsicherheit:**
- `process_events` mit Enum statt Freitext-Labels
- Polymorphe FK zu allen relevanten Entitäten
- JSONB für flexible Event-spezifische Daten

**6. State-Machine-Validierung:**
- DB-Triggers verhindern ungültige Status-Übergänge
- `execution_status`: delivered kann nicht zurück zu in_progress
- `publishing_status`: unpublish nur wenn published

**7. Backwards Compatibility:**
- Alte Tabellen (keyword_map, content_log) bleiben erhalten
- Mapping-Layer in postgres.ts übersetzt neue Struktur → alte API
- Ermöglicht graduelle Code-Migration

### Mapping: Alt → Neu

**Status-Mapping:**
- `Backlog` → planning: backlog
- `Planned` → planning: planned
- `Beauftragt` → execution: commissioned, publishing: draft
- `In Arbeit` → execution: in_progress
- `Angeliefert` → execution: delivered, publishing: approved
- `Review` → publishing: in_review
- `Published` → publishing: published

**ActionType-Mapping:**
- `Erstellung` → action_type_enum: creation
- `Optimierung` → action_type_enum: optimization

### Performance-Optimierungen

**Indizierung:**
- Composite Indexes auf allen Status-Tabellen
- `(tenant_id, status)` für schnelle Filterung
- `(url_id, cycle_number DESC)` für Latest-Cycle-Queries

**Query-Optimierung:**
- Status-Queries nutzen B-Tree-Indizes statt Volltextsuche
- Direkte Joins statt Log-Parsing und Rekonstruktion
- Materialized Views möglich für Dashboard-Aggregationen

**Skalierbarkeit:**
- Partitionierung von process_events nach Datum möglich
- Archive-Strategie für alte Events
- Normalisierung reduziert Datenredundanz um ~70%

---

## content_log_body: diff_summary → event_label (15.05.2026)
- `diff_summary` war ein irreführender Name — das Feld ist keine Git-ähnliche Diff-Zusammenfassung, sondern ein **Event-Label** (Freitext-Ereignisbeschreibung)
- Umbenannt zu `event_label` in DB-Schema, Drizzle-Schema, TypeScript-Interface (`ContentLog.Event_Label`), allen API-Routes und Komponenten
- **Ausnahme**: `body.diffSummary` in `agent-webhook/callback/route.ts` bleibt — ist ein Feld im eingehenden Webhook-Payload des externen Agents (außerhalb unserer Kontrolle)
- **Regel**: Feldnamen sollen beschreiben was das Feld tatsächlich enthält, nicht wie es technisch verarbeitet wird

## Editor-ID: session.user.id statt session.user.email (15.05.2026)
- `content_log.editor_id` ist ein FK auf `users.id` (UUID) — nie eine E-Mail-Adresse
- **Regel**: Für DB-FKs immer `session.user.id` verwenden; `session.user.email` nur für E-Mail-Versand / Display
- `session.user.id` ist über das NextAuth JWT-Token verfügbar (gesetzt in `jwt()`-Callback aus `user.id`)

## content_log: page_type bleibt als Snapshot (15.05.2026)
- `content_log.page_type` ist bewusste Denormalisierung: Snapshot des Seitentyps zum Zeitpunkt des Log-Eintrags
- Wird aktiv genutzt in `monitoring/detail/route.ts` für Kostenberechnung (`page_type` + `action_type` → cost config)
- Falls `keyword_map`-Row gelöscht wird (`onDelete: set null` auf `keyword_id`), bleibt der Seitentyp trotzdem erhalten
- **Entscheidung**: Behalten — keine redundante Denormalisierung, sondern notwendiger Snapshot

## HistoryList: isDelivery nur bei exaktem Event_Label (15.05.2026)
- `isDelivery = summary === "Content angeliefert"` — **nur exakter String-Match**
- `|| log.Version === 'v2'` wurde entfernt: Version wird aus `hasBody` berechnet und kann theoretisch für andere Logs true sein
- Expand-Button + V-Badge erscheinen **ausschließlich** bei `Event_Label === "Content angeliefert"`
- **Regel**: UI-Gating immer auf semantischen Event-Labels basieren, nicht auf abgeleiteten Computed-Flags

## Shadcn/Base UI Dialog: `sm:max-w-sm` aus Basiskomponente entfernt (15.05.2026)
- Die `DialogContent`-Basiskomponente in `src/components/ui/dialog.tsx` hatte `sm:max-w-sm` als Standard-Klasse
- Diese übersteuerte alle `max-w-*`-Klassen vom Aufrufer, da beide auf der `sm:`-Breakpoint-Ebene lagen
- **Fix**: `sm:max-w-sm` aus der Basisklasse entfernt — Breite wird vollständig vom Aufrufer kontrolliert
- **Regel**: Keine Größen-Defaults in der Basiskomponente setzen; Aufrufer bestimmt die Breite via `className`

## Dialog-Overflow: Flex-Children mit inline Code-Tags (15.05.2026)
- Mehrere inline `<code>`-Tags als direkte Flex-Children eines `<li className="flex">` verursachen horizontalen Overflow
- **Fix**: Textinhalt (alles nach dem Bullet-`<span>`) in `<span className="min-w-0">` wrappen → ein einziger Flex-Child der intern normal umbricht
- **Regel**: In Flex-Containern mit gemischtem Text+Inline-Elementen immer einen wrappenden `<span className="min-w-0">` als Flex-Child verwenden

## Agent-Webhook Callback: `tenantId` aus API-Key-Auth, nie aus Request-Body (15.05.2026)
- **Problem**: `tenantId` aus dem Request-Body akzeptieren erlaubt Angreifern, beliebige Tenants zu adressieren
- **Fix**: `resolveTenantFromApiKey(apiKey)` scannt alle Tenants nach passendem `EXTERNAL_AGENT_WEBHOOK_SECRET`
- Rückgabe: `{ tenantId: string | undefined, isLegacy: boolean }` oder `null` (kein Match)
- Legacy N8N_API_KEY ist global (kein Tenant-Scope) → gibt `tenantId: undefined` zurück
- **Regel**: Sicherheitskritische Parameter (tenantId, userId) dürfen nie aus dem Request-Body kommen wenn sie per Auth ableitbar sind

## Cron-Endpoints: Immer Auth erzwingen (15.05.2026)
- **Vorher**: `if (cronSecret) { check }` — fehlendes `CRON_SECRET` erlaubte unauthentic Zugriff
- **Nachher**: Fehlendes `CRON_SECRET` → HTTP 503 "Cron endpoint not configured"; falsches Secret → HTTP 401
- **Regel**: Security-Checks nie hinter Feature-Flags verstecken die einen vollständigen Bypass ermöglichen

## Invite-Routen: kein plaintext Passwort in API-Response (15.05.2026)
- `tempPassword` wurde in `/api/admin/invite` und `/api/admin/users/[id]/resend-invite` im Response zurückgegeben
- **Fix**: `tempPassword` aus beiden Responses entfernt — Passwort wird nur per E-Mail zugestellt

## Bootstrap: Produktions-Schutz via BOOTSTRAP_ENABLED (15.05.2026)
- **Problem**: Jeder konnte sich als erster Admin registrieren wenn die Datenbank durch Race-Condition leer erschien
- **Fix**: Bootstrap-Pfad erfordert `BOOTSTRAP_ENABLED=true` ENV-Flag
- **Regel**: `BOOTSTRAP_ENABLED=true` nur für initiales Setup setzen, danach entfernen

## HTML-Sanitizing: `sanitize-html` statt `isomorphic-dompurify` (15.05.2026)
- `isomorphic-dompurify` v3 ist ESM-only (via `jsdom` v29 → `@exodus/bytes`) → nicht kompatibel mit Next.js/Turbopack
- **Ersatz**: `sanitize-html` (CJS-kompatibel, kein DOM benötigt, serverseitig nutzbar)
- Konfiguration in `src/lib/sanitize.ts`: Allowlist-basiert, `script`/`style`/`iframe`/`form` explizit geblockt

## SuperAdmin Health: Early-Return muss alle Pflichtfelder des Response-Interface enthalten (15.05.2026)
- `HealthSummaryResponse` enthält `smtp` als Pflichtfeld
- Jeder Early-Return (z.B. bei `allTenants.length === 0`) muss `smtp` explizit mitliefern
- **Regel**: Bei `satisfies`-Checks → alle Interface-Pflichtfelder in jedem Return-Pfad prüfen, nicht nur im Happy-Path

## SuperAdmin Feedback: `is_public` JSON-Key-Umbenennung (15.05.2026)
- `public` ist als JSON-Key in JavaScript problematisch (reserviertes Wort in manchen Kontexten)
- Umbenannt zu `plexaro` im GET-Response-Objekt: `{ own: [...], plexaro: [...] }`
- API PATCH akzeptiert `isPublic` als camelCase-Feld

## SuperAdmin Health: Sistrix in zwei unabhängige Jobs aufgeteilt (14.05.2026)
- `integration:check:sistrix` und `cron:sync-sistrix` werden in der Health-Route als **separate Jobs** geführt
- Begründung: Ein leerer Datensync (0 URLs → keine API-Calls → 0 Fehler) schrieb `:success` und überschrieb das korrekte `:error` aus dem Integration-Check
- **Regel**: Connectivity-Checks und Datensync-Status nie in einem Job-Eintrag zusammenfassen

## SuperAdmin Health: `cron:sync-sistrix:success` nur bei tatsächlich verarbeiteten URLs (14.05.2026)
- `sync-gsc/route.ts` schreibt `cron:sync-sistrix:success` **nur wenn** `result.urlsProcessed > 0`
- Bei konfiguriertem Key aber leerem URL-Chunk → `cron:sync-sistrix:skipped` mit `skippedReason: 'no_urls'`
- **Regel**: Ein `:success`-AuditLog-Eintrag darf nur geschrieben werden, wenn tatsächlich Arbeit verrichtet und API-Calls erfolgreich abgeschlossen wurden

## Alert-Regeln: Empfänger-Auswahl via Double-Opt-in (14.05.2026)
- Freies E-Mail-Eingabefeld ersetzt durch `RecipientPicker`-Checkbox-Liste
- Nur Nutzer mit `Password_Changed === true` (mind. einmal eingeloggt) sind auswählbar
- `notifyEmails` im Backend bleibt Array von E-Mail-Strings — kein Schema-Change

## Planning-Page: Tab-Navigation via URL-Query-Parameter (14.05.2026)
- `planning/page.tsx` liest `?tab=` via `useSearchParams()` beim Mount aus
- Query-Parameter überschreibt `localStorage`-Wert und wird in localStorage synchronisiert
- Ohne Query-Parameter: Fallback auf `localStorage.getItem('planning-active-tab')` → Default `"keyword-map"`

## Onboarding Empty States: Einheitliches Pattern (14.05.2026)
- Pattern: `border-2 border-dashed border-primary/20 bg-primary/5` Container + `Map`-Icon + Titel + Beschreibung + Button
- Button ruft `onGoToKeywordMap?: () => void` Callback auf
- Externe Seiten nutzen `<Link href="/planning?tab=keyword-map">`

## Tenant-Isolation: tenantId immer aus DB-Row, nie aus Client-Input (13.05.2026)
- In `authorize()` (NextAuth) wird `tenantId` ausschließlich aus `user.TenantId` (DB-Row) genommen
- `credentials.tenantId` dient nur als Filter-Parameter für `getUserByEmail`

## Tenant-Isolation: Password-Verifikation pro Tenant in lookup-tenants (13.05.2026)
- `lookup-tenants` prüft das Passwort **für jeden Tenant-Row einzeln** via `bcrypt.compare()`
- Vorher: "first-password-wins"-Bug

## Tenant-Isolation: tid()-Fallback-Warnung (13.05.2026)
- `tid()` in `postgres.ts` loggt `console.warn` wenn `tenantId` fehlt
- `MULTI_TENANT=true` → Hard-Fail (Exception)

## Tenant-Isolation: Blob-Upload Pfad-Struktur (14.05.2026)
- Blob-Pfad für Branding-Uploads: `branding/{tenantId}/{prefix}-{timestamp}.{ext}`

## Tenant-Isolation: Postgres RLS als zweite Schutzschicht (14.05.2026)
- Migration `0001_add_row_level_security.sql` fügt RLS-Policies auf allen 9 tenant-scoped Tabellen hinzu
- `current_tenant_id()` Helper liest `app.tenant_id` aus dem Postgres-Transaktionskontext
- Kein `FORCE ROW LEVEL SECURITY` — Table Owner bypassed RLS → SuperAdmin-Queries funktionieren

## Tenant-Isolation: monitoring/import Webhook erfordert explizite tenantId (14.05.2026)
- `POST /api/monitoring/import` verweigert Requests ohne `tenantId` mit HTTP 400

## SuperAdmin-Route-Exempt-Liste (14.05.2026)
- `SUPER_ADMIN_EXEMPT_PREFIXES` in `authenticated-layout.tsx`: `["/profile", "/auth/", "/legal"]`
- **Regel**: Jede neue Route für alle Rollen muss hier eingetragen werden

## Base UI DropdownMenu: kein asChild, kein DropdownMenuLabel ohne Group (14.05.2026)
- **`asChild`-Prop existiert nicht in Base UI** → stattdessen `render`-Prop oder direktes `onClick`
- **`DropdownMenuLabel`** benötigt zwingend `DropdownMenuGroup`-Parent → sonst Base UI error #31
- **Workaround**: Einfaches `div` mit gleichem Styling statt `DropdownMenuLabel`

## Base UI SelectValue: explizite Kinder erforderlich (14.05.2026)
- Bei `<SelectValue>` die `t()`-Aufrufe in `SelectItem` haben: explizite Kinder setzen
- **Fix-Pattern**: `<SelectValue>{form.type === "feature" ? t("...") : t("...")}</SelectValue>`

## Login-Seite: fixed inset-0 statt h-screen (14.05.2026)
- `fixed inset-0` auf dem Wurzel-Div garantiert exakt Viewport-groß, unabhängig von äußeren Containern

## Legal-Page: URL-gesteuerte Tab-Selektion (14.05.2026)
- `/legal?tab=imprint|privacy|terms` öffnet direkt den gewünschten Tab
- `useSearchParams()` erfordert `Suspense`-Wrapper

## Agent Builder: Execution Panel als Side-Panel (01.05.2026)
- Das Execution Panel sitzt in der linken Sidebar unterhalb der NodePalette
- Linke Spalte: `h-[calc(100vh-220px)] flex flex-col overflow-hidden`

## Agent Builder: Keine manuellen Run-Controls (01.05.2026)
- Runs werden ausschließlich extern getriggert (Commissioning-Flow)

## Agent Builder: Dark-Theme-Flächen müssen voll opak sein (01.05.2026)
- Alle dunklen Hintergründe (`bg-[#0b1220]`, `bg-amber-950` etc.) müssen ohne Alpha gesetzt werden
- **Regel**: Transparenz-Suffix nur auf Overlays über dunklem Hintergrund

## finalHtml: Nicht in Airtable persistieren (01.05.2026)
- HTML-Artikel (10–50k Zeichen) × 20 Runs würde Airtable-Feld-Limit sprengen
- `finalOutput` wird in-memory injiziert: `return { ...finalRun, output: finalOutput }`
- **Regel**: `WorkflowRunV2.output` ist kein Persistenz-Feld

## finalHtml-Fallback-Kette (01.05.2026)
- Stufe 1: `decision.finalHtml` aus dem Finalisierungs-JSON
- Stufe 2: Bekannte Feldnamen im letzten Sub-Agenten-Task-Result
- Stufe 3: Längster String-Wert ≥100 Zeichen im letzten Task-Output

## HistoryList: Event_Label muss exakter String sein (01.05.2026 / aktualisiert 15.05.2026)
- `isDelivery = summary === "Content angeliefert"` — exakter String-Vergleich
- Alle `createContentLog`-Aufrufe die deliverbare Inhalte erstellen müssen `Event_Label: 'Content angeliefert'` verwenden

## Optimistisches UI-Update: Commissioning (01.05.2026)
- `setCommissionedIds` + `addAlert` werden **vor** `await triggerN8nAction(...)` aufgerufen
- Bei API-Fehler: `commissionedIds.delete(id)` macht das optimistische Update rückgängig

## System Health: Live-Test statt AuditLog für Integrationen (30.04.2026)
- Integrationen werden live getestet beim Aufruf von `GET /api/system-health`
- Tests laufen parallel via `Promise.allSettled`

## System Health: AuditLog-Konventionen für Crons (30.04.2026)
- **Cron-Actions**: `cron:sync-gsc:success|error`, `cron:sync-sistrix:success|error|skipped`
- **Integration-Check-Actions**: `integration:check:<provider>:ok|error|skipped`

## NextAuth Cookie-Konfiguration auf Vercel (29.04.2026)
- **Keine Custom Cookie Names in `authOptions`**: `withAuth` aus `next-auth/middleware` kennt `authOptions` nicht → Endlos-Redirect
- **`NEXTAUTH_URL` muss pro Environment gesetzt sein**

## KI-Chat Save-Architektur (28.04.2026)
- **Content-Parameter statt Ref**: `onApplyChanges(content: string)`
- **Action_Type für KI-Chat omitted**: `'KI-Chat'` ist kein gültiger Airtable Select-Wert
- **Identifikation via Event_Label**: `'KI-Chat: KI-Optimierung übernommen'`

## Agent-Workflow V2: Orchestrierungsmodell (26.04.2026)
- **Serielles Parent-Orchestrierungsmodell**: Parent → ein Subagent → Ergebnis → Parent
- **Parent-Decision Contract**: `finalize`, `summary`, `finalHtml`, `next.targetNodeId`, `objective`, `memoryPatch`

## Optimierte Performance-Architektur (06.04.2026)
- **Tabellen-Split**: `URL_Performance` + `Keyword_Ranking_History` ersetzen `Performance_Data`

## Computed Fields Policy (05.04.2026)
- Felder als Lookup/Formel in Airtable dürfen nie im `create`/`update`-Call gesendet werden

## Keyword-Ranking: Sonderwert 101 (29.04.2026)
- Keywords ohne Top-100-Ranking erhalten `Ranking: 101`. UI zeigt `>100`

## Logarithmische Y-Achse im Keyword-Ranking-Chart (29.04.2026)
- Datentransformation: `${keyword}_log = Math.log(rank)`, `${keyword}_raw = rank`

## Dynamic Branding & Theming (06.04.2026)
- **CSS Variable Injection**: `--primary` via `BrandingProvider`

## Internationalisierung (i18n) — Pattern & Regeln (28.04.2026)
- **Inline-Translate Helper**: `const tr = (de: string, en: string) => (locale === "de" ? de : en);`
- **useI18n API**: Gibt `{ locale, setLocale, t }` zurück
- **Dictionary-Pattern**: `t("dashboard.systemHealth.title")`
- **Locale-Persistenz**: `localStorage` via `LanguageProvider`. Standard-Locale ist `"de"`

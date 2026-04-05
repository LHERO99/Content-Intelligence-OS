# Projekt-Status (Stand: 05.04.2026)

## Content-Lifecycle & Logging-Events
- **Status-Workflow**: Der Workflow umfasst nun: `Backlog` -> `Planned` -> `Beauftragt` -> `Angeliefert` -> `Published`.
- **Lückenloses Event-Logging**: Alle Kern-Meilensteine werden nun robust in der `Content-Log` Tabelle erfasst:
  1. **URL dem Tool hinzugefügt**: Automatisches Log beim Import (`import/route.ts`) und bei manueller Erstellung (`keywords/route.ts`).
  2. **URL wurde dem Tab 'Vorschläge' hinzugefügt**: Automatisches Log, wenn ein Keyword im `Backlog` landet und `Main_Keyword === 'Y'` ist (Import, manuelle Erstellung, Trends/Monitoring).
  3. **URL wurde der Redaktionsplanung hinzugefügt**: Log bei Status-Transition zu `Planned`.
  4. **Content wurde beauftragt**: Zentrales Logging im n8n-Trigger-Proxy (`api/n8n/trigger/route.ts`) bei Klick auf "Beauftragen".
  5. **Content angeliefert**: Erfasst via n8n Callback Webhook (`api/n8n/callback/route.ts`).
  6. **Content veröffentlicht**: Log bei Status-Transition zu `Published`.
  7. **URL der Blacklist hinzugefügt**: Automatisches Logging beim Verschieben oder Hinzufügen zur Blacklist.
  8. **URL von der Blacklist entfernt**: Logging bei Wiederherstellung aus der Blacklist.

## Datenbank & API-Stabilität
- **Airtable Service-Härtung**:
  - **Computed Field Fix**: Das Feld `Target_URL` in `Content-Log` wird beim Schreiben explizit ignoriert.
  - **URL-Historie Persistenz**: `getContentHistoryByUrl` nutzt nun einen `OR`-Filter (`Target_URL` ODER `Logged_URL`), um Historie auch nach Keyword-Löschung (Blacklisting) anzuzeigen.
  - **Aggressives URL-Grouping**: Die UI (`content-history-table.tsx`) nutzt eine Fallback-Kette (Logged_URL -> Keyword-Map -> Target_URL -> Reasoning_Chain), um Logs einer URL zuzuordnen, selbst wenn Airtable-Links gebrochen sind.
- **Blacklist-Logging**: Manuelle Keyword-Erstellung und Monitoring-Vorschläge (Trends) triggern nun korrekt die "Vorschläge"-Historie.

## n8n Integration & Performance-Monitoring
- **Webhook-Optimierung**: Alle n8n-Webhook-Calls (Import & Content) laufen nun asynchron im Hintergrund ("Fire & Forget"), um die UI-Antwortzeit beim Speichern von Keywords zu minimieren.
- **Detaillierte Payload-Struktur**: Der `IMPORT_DATA` Webhook sendet nun gruppierte Daten pro URL inklusive differenzierter Felder für `MainKeyword` und durchnummerierte `SecondaryKeywordX`.
- **API-Key Schutz**: Neuer Endpunkt `/api/monitoring/import` für Daten-Rückfluss von n8n, gesichert via `x-api-key`.

## Historisches Performance-Tracking
- **Keyword-Historie Architektur**: Das Ranking wurde aus der `Keyword-Map` (Stammdaten) in die `Performance_Data` (Zeitreihen) verschoben.
- **Multi-Keyword Support**: Ein Datensatz in `Performance_Data` repräsentiert nun die Kombination aus `Keyword_ID` + `Date`. Dies ermöglicht individuelle Ranking-Kurven für Main- und Nebenkeywords bei gleicher URL.
- **Upsert-Logik**: Robuste De-Duplizierung basierend auf `Keyword_ID` und `Date`, um Datenintegrität bei mehrfachen n8n-Rückmeldungen pro Woche sicherzustellen.
- **URL-Metriken**: GSC-Metriken (Klicks, Impressions, Average Position) werden auf URL-Ebene erfasst und redundant in den keyword-spezifischen Zeitreihen-Einträgen gespeichert, um einfache Aggregationen in Airtable zu ermöglichen.

## UI & Visualisierung (HistoryList)
- **Dynamischer Blacklist-Status**: Der "Blacklisted" Badge in der Historie ist nicht mehr "sticky", sondern richtet sich nach dem zeitlich letzten Event (Hinzugefügt vs. Entfernt).
- **Icon-System**: Icons für Blacklist (`ShieldAlert` in Rot) und Vorschläge (`Lightbulb` in Amber).
- **Editor-Tracking**: User-E-Mail wird bei fast allen Events erfasst.


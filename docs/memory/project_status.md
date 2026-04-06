# Projekt-Status (Stand: 06.04.2026)

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
- **Importer-Upgrade**: Unterstützung für direktes Mapping des `Page_Type` Feldes ("Seitentyp").

## Dynamic Branding (06.04.2026)
- **Konfigurierbares Branding**: Einführung eines "Branding"-Tabs im Admin-Bereich zur Pflege von Logo-URL, Favicon-URL und Primärfarbe.
- **Speicherung**: Werte werden in der `Config` Tabelle (Airtable) unter `BRAND_LOGO_URL`, `BRAND_FAVICON_URL` und `BRAND_PRIMARY_COLOR` gespeichert.
- **Echtzeit-Anwendung**: Der `BrandingProvider` injiziert die Primärfarbe via CSS-Variable (`--primary`) und aktualisiert das Favicon dynamisch im Browser.
- **Refactoring**: Hardcodierte DocMorris-Brandings in Sidebar und Layout wurden durch dynamische Assets ersetzt.


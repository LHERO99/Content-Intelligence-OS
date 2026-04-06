# Technische Entscheidungen (Stand: 06.04.2026)

## Optimierte Performance-Architektur (06.04.2026)
- **Tabellen-Split Strategie**: 
  - Ersetzung der redundanten `Performance_Data` (Keyword + URL Metriken) durch zwei spezialisierte Tabellen: `URL_Performance` (aggregiert) und `Keyword_Ranking_History` (granual).
  - Ziel: Reduzierung der Datenmenge in Airtable und Vermeidung von Inkonsistenzen bei URL-Metriken.
- **De-Normalisierung & Bereinigung**: 
  - Die alte `Performance_Data` Tabelle wurde aus dem Code entfernt. 
  - Alle API-Schnittstellen (Import, Detail, Übersicht) nutzen nun die neue Struktur.
  - Veraltete Debug-Endpunkte (z.B. `/api/debug/trends`), die auf gelöschte Tabellen verweisen, wurden entfernt, um Build-Fehler zu vermeiden.

## Aktuelle Strategien & Patterns
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


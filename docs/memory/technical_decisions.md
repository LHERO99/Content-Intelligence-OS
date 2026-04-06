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


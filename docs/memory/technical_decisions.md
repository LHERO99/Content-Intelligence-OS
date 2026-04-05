# Technische Entscheidungen (Stand: 05.04.2026)

## Aktuelle Strategien & Patterns
- **Computed Fields Policy (05.04.2026)**: 
  - Felder, die in Airtable als Lookup oder Formel definiert sind (z.B. `Target_URL` in `Content-Log`), dürfen niemals im `create`- oder `update`-Call der API gesendet werden. 
  - Der Airtable-Service (`createContentLog`) filtert diese nun aktiv aus, um 422 Unprocessable Entity Fehler zu vermeiden.
- **ID-First Validation**: Verknüpfungsfelder (Link fields) in Airtable werden vor dem Senden auf das Präfix `rec` validiert. Ungültige Daten führen zum Abbruch des Log-Eintrags mit Fehlerprotokollierung, anstatt fehlerhafte Daten in die DB zu schreiben.
- **Persistent URL Logging**: Da Keywords beim Blacklisting gelöscht werden, wird die `Target_URL` nun als statischer Text in der Blacklist-Tabelle und in den Logs mitgeführt, um die Historien-Integrität zu wahren.
- **Server-side Proxy Logging**: Kritische Events wie "Beauftragt" werden nicht mehr vom Client (Frontend) geloggt, sondern im Server-Proxy (`api/n8n/trigger`), um Race Conditions und blockierte Webhooks zu verhindern.
- **URL-Deduplizierung beim Bulk-Import**: Um die Historie sauber zu halten, wird beim Import einer Liste mit Main- und Nebenkeywords das Event "URL hinzugefügt" nur einmal pro eindeutiger URL ausgelöst (via `Set` Tracking in der Route).

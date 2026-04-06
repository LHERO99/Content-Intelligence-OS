# Plan: Behebung des "Failed to fetch" Fehlers & Robustes Monitoring

Der "Failed to fetch" Fehler im Content-Monitoring deutet auf ein serverseitiges Problem in der API-Route `/api/monitoring` hin, das die gesamte Übersicht blockiert.

## Analyse & Problemlösung
1.  **Fehlersuche (Backend):** Die Route `/api/monitoring/route.ts` nutzt `Promise.all` für vier parallele Airtable-Abfragen. Wenn eine davon fehlschlägt (z.B. Timeout, Rate-Limit oder fehlende Berechtigungen), bricht der gesamte Request ab. Wir werden:
    - Einzelne Abfragen absichern, sodass Teilerfolge möglich sind (Graceful Degradation).
    - Detailliertere Fehlermeldungen an das Frontend senden.
2.  **Fehlender Page_Type:** Da das Lookup-Feld in Airtable oft leer ist, werden wir die Zuordnung programmatisch in der API vornehmen.
3.  **Keywordmap Importer:** Der Importer wird um das Feld `Page_Type` erweitert.
4.  **Deduplizierung von Logs:** Wir verhindern Mehrfachberechnungen pro Tag/URL.

## Umsetzungsschritte

### 1. API-Robustheit (`src/app/api/monitoring/route.ts`)
*   **Fehler-Isolation:** Umstellung von `Promise.all` auf eine sicherere Methode oder Hinzufügen von individuellen `.catch()` Blöcken, die leere Arrays zurückgeben, anstatt den gesamten Request zu töten.
*   **Logging:** Verbesserung der Server-Logs, um genau zu sehen, welche Airtable-Tabelle das Problem verursacht.
*   **Page_Type Fallback:** Implementierung der URL-basierten Erkennung (`/ratgeber/` vs `/kategorie/`), wenn weder Log noch Keyword einen Typ liefern.

### 2. Keyword-Importer Erweiterung (`src/features/planning/components/keyword-import.tsx`)
*   Hinzufügen von `Page_Type` zu den `SYSTEM_COLUMNS` und `autoMapColumns`.

### 3. Kosten-Deduplizierung
*   Gruppierung der Logs nach URL und Kalendertag in der API-Logik.

## Geänderte Dateien
*   `src/app/api/monitoring/route.ts` (Hauptursache für den Fehler)
*   `src/features/planning/components/keyword-import.tsx`
*   `src/lib/airtable.ts`

## Offene Punkte
*   Könnte ein Airtable Rate-Limit (5 Requests/Sekunde) vorliegen? Falls ja, wäre ein kurzes Caching (z.B. 60s) sinnvoll.

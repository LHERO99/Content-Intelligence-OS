# Plan: Korrektur Monitoring-Daten & Spaltenbreiten

Das Content-Monitoring zeigt aktuell keine Daten an, und die Kostenberechnung greift nicht korrekt. Zudem sollen die URL-Spalten in der Historie und der Keyword-Map verbreitert werden.

## Analyse & Problemlösung
1.  **Monitoring-Liste leer:** Die API-Route `/api/monitoring` filtert aktuell URLs basierend auf den `logs`. Wenn für eine URL Performance-Daten (`URL_Performance`) vorliegen, soll diese aber unabhängig von Logs erscheinen. Wir ändern die Logik so, dass `performance` die primäre Quelle für die URL-Liste ist.
2.  **Kost-Savings Trigger:** Die Berechnung soll ausgelöst werden, sobald im `Content-Log` der Text "Content angeliefert" im Feld `Diff_Summary` steht. Dabei werden `Page_Type` (aus Keyword-Map), `Action_Type` und `Cost_Config` kombiniert.
3.  **Spaltenbreiten:**
    *   `src/app/content-history-table.tsx`: URL-Spalte verbreitern.
    *   `src/features/planning/components/keyword-columns.tsx`: "Target URL" Spalte verbreitern, "Main" und "Rank" schmaler machen.

## Umsetzungsschritte

### 1. API-Anpassung (`src/app/api/monitoring/route.ts`)
*   **URL-Liste:** Basis der `uniqueUrls` von `logs` auf `performance` (URL_Performance Tabelle) umstellen.
*   **Kosten-Logik:** Sicherstellen, dass "Content angeliefert" zuverlässig als Trigger für die Kostenberechnung fungiert, mit korrektem Mapping auf `Page_Type` aus der Keyword-Tabelle.

### 2. UI-Verbesserungen (Spaltenbreiten)
*   **Keyword-Map:** In `keyword-columns.tsx` die `max-w` der Target URL auf `max-w-[500px]` (oder flexibel) erhöhen. Header "Ranking" zu "Rank" kürzen und Spaltengrößen für "Main" und "Rank" reduzieren.
*   **Historie:** In `content-history-table.tsx` die `max-w` der URL-Zelle auf `max-w-[800px]` erhöhen.

### 3. Keyword-Importer & Airtable
*   Verifizierung, dass `Page_Type` beim Import korrekt in die `Keyword-Map` geschrieben wird (bereits vorbereitet).

## Geänderte Dateien
*   `src/app/api/monitoring/route.ts`
*   `src/app/content-history-table.tsx`
*   `src/features/planning/components/keyword-columns.tsx`

## Offene Punkte
*   Keine. Die Anforderungen sind klar definiert.


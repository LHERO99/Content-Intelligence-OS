# Plan: Korrektur der Kostenberechnung & Robustes Page_Type Mapping

Die Kostenberechnung ist aktuell ungenau, primär weil der `Page_Type` (Ratgeber/Kategorie) oft fehlt und die Logik bei Mehrfach-Logs zu einer URL ("Content angeliefert") jeden Eintrag einzeln berechnet. Zudem gibt es einen Fehler beim Laden der Monitoring-Daten.

## Analyse & Problemlösung
1.  **Fehler "Failed to fetch monitoring data":** Dieser Fehler deutet auf ein Problem in der `/api/monitoring` Route hin (möglicherweise Timeouts oder API-Limits bei Airtable). Wir werden die Fehlerbehandlung verbessern und sicherstellen, dass die Route robuster gegenüber Teilausfällen ist.
2.  **Fehlender Page_Type:** Da das Lookup-Feld in Airtable schwer zu konfigurieren ist, werden wir die Zuordnung programmatisch in der API vornehmen. Jede URL im `Content-Log` ist über `Keyword_ID` mit der `Keyword-Map` verknüpft. Wir ziehen den `Page_Type` direkt aus dem verknüpften Keyword-Objekt.
3.  **Keywordmap Importer:** Der Importer für Keywords wird um das Feld `Page_Type` erweitert, um sicherzustellen, dass dieser beim Import bereits korrekt gesetzt werden kann.
4.  **Deduplizierung von Logs:** Wir verhindern Mehrfachberechnungen, indem wir Logs pro URL gruppieren und nur "echte" Meilensteine zählen (z.B. nur einen Log pro Tag oder nur signifikante Statusänderungen).

## Umsetzungsschritte

### 1. Programmatisches Mapping & Fehlerbehebung (Backend)
*   **API-Update:** In `src/app/api/monitoring/route.ts` wird die Fehlerbehandlung verbessert, um genauere Informationen über Fehlerursachen (z.B. Airtable-Limits) zu erhalten.
*   **Fallbacks:** Wenn kein `Page_Type` im Log steht, wird der `Page_Type` des Keywords genutzt. Fehlt auch dieser, wird anhand der URL-Struktur (z.B. `/ratgeber/` vs. `/kategorie/`) geraten oder "Ratgeber" als sicherster Standard verwendet.

### 2. Keyword-Importer Erweiterung
*   **System-Spalten:** In `src/features/planning/components/keyword-import.tsx` wird `Page_Type` zu den `SYSTEM_COLUMNS` hinzugefügt.
*   **Mapping:** Die `autoMapColumns` Logik wird erweitert, um "Seitentyp" oder "Page Type" automatisch zu erkennen.
*   **Airtable-Integration:** Die `bulkCreateKeywords` Funktion in `src/lib/airtable.ts` wird überprüft, um sicherzustellen, dass der `Page_Type` korrekt an Airtable übergeben wird.

### 3. Kosten-Deduplizierung
*   **Gruppierung:** Logs werden nach URL und Datum (Tag) gruppiert. Mehrere "Content angeliefert" am selben Tag zählen als 1 Event.

## Geänderte Dateien
*   `src/app/api/monitoring/route.ts`
*   `src/features/planning/components/keyword-import.tsx`
*   `src/lib/airtable.ts` (Validierung des Page_Type Feldes beim Erstellen)

## Offene Punkte
*   Der Fehler "Failed to fetch" könnte auch durch zu viele gleichzeitige Anfragen an Airtable entstehen. Sollen wir ein einfaches Caching für die Monitoring-Daten implementieren?

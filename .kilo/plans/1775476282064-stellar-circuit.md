# Plan: Korrektur der Kostenberechnung & Robustes Page_Type Mapping

Die Kostenberechnung ist aktuell ungenau, primär weil der `Page_Type` (Ratgeber/Kategorie) oft fehlt und die Logik bei Mehrfach-Logs zu einer URL ("Content angeliefert") jeden Eintrag einzeln berechnet.

## Analyse & Problemlösung
1.  **Fehlender Page_Type:** Da das Lookup-Feld in Airtable schwer zu konfigurieren ist, werden wir die Zuordnung programmatisch in der API vornehmen. Jede URL im `Content-Log` ist über `Keyword_ID` mit der `Keyword-Map` verknüpft. Wir ziehen den `Page_Type` direkt aus dem verknüpften Keyword-Objekt.
2.  **Deduplizierung von Logs:** Wir verhindern Mehrfachberechnungen, indem wir Logs pro URL gruppieren und nur "echte" Meilensteine zählen (z.B. nur einen Log pro Tag oder nur signifikante Statusänderungen).
3.  **Action-Type Logik:** Wir definieren präzise, wann eine "Erstellung" (meist der erste Log) und wann eine "Optimierung" (Folgelogs nach einer gewissen Zeit) abgerechnet wird.

## Umsetzungsschritte

### 1. Programmatisches Mapping (Backend)
*   **API-Update:** In `src/app/api/monitoring/route.ts` und `detail/route.ts` wird die Logik so angepasst, dass für jeden Log-Eintrag das erste verknüpfte Keyword aus der `Keyword-Map` gesucht wird. 
*   **Fallbacks:** Wenn kein `Page_Type` im Log steht, wird der `Page_Type` des Keywords genutzt. Fehlt auch dieser, wird anhand der URL-Struktur (z.B. `/ratgeber/` vs. `/kategorie/`) geraten oder "Ratgeber" als sicherster Standard verwendet.

### 2. Kosten-Deduplizierung
*   **Gruppierung:** Logs werden nach URL und Datum (Tag) gruppiert. Mehrere "Content angeliefert" am selben Tag zählen als 1 Event.
*   **Validierung:** Administrative Logs ("URL hinzugefügt") werden explizit ignoriert.

### 3. Frontend-Synchronisation
*   Die `UrlDetail`-Komponente erhält die gleiche Logik zur Typerkennung, damit Status ("V1") und Kosten immer übereinstimmen.

## Geänderte Dateien
*   `src/app/api/monitoring/route.ts`
*   `src/app/api/monitoring/detail/route.ts`
*   `src/app/monitoring/url-detail.tsx`

## Offene Punkte
*   Gibt es URLs, die weder "Ratgeber" noch "Kategorie" sind, aber trotzdem abgerechnet werden sollen?
*   Sollen Korrekturen innerhalb von 24h nach der ersten Anlieferung grundsätzlich kostenlos bleiben?

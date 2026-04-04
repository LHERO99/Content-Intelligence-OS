# Projekt-Status (Stand: 04.04.2026)

## Content-Lifecycle & UI-Refactoring
- **Status-Workflow**: Der Workflow wurde finalisiert: `Backlog` -> `Planned` -> `Beauftragt` -> `Angeliefert` -> `Published`.
- **Content-Historie (Nahrungskette)**: Die Historie wurde zur Neukonzeption vorübergehend zurückgesetzt. Das Ziel ist eine robuste, fehlerresistente Erfassung der 6 Kern-Meilensteine:
  1. URL der Keyword-Map hinzugefügt
  2. URL der Vorschlagsliste hinzugefügt
  3. URL der Redaktionsplanung hinzugefügt
  4. Content beauftragt
  5. Content angeliefert
  6. Content veröffentlicht
- **Status-Workflow**: Bestehende Implementierung der Logging-Trigger wurde entfernt, um eine saubere Neukonzeption der Datenbank- und Service-Ebene zu ermöglichen.
- **UI-Refactoring (Pop-up & /history)**: 
  - Radikale Entschlackung: Nur noch Event-Name und Zeitpunkt (rechtsbündig).
  - Versionierung und Ausklapp-Option exklusiv für "Content angeliefert".
  - Timeline-Icons für jeden Meilenstein.
  - Globale Konsistenz zwischen Planungs-Pop-ups und der `/history` Seite.
- **Tab-Struktur (Planung)**:
  - **Redaktions-Planung (Standard)**: Zeigt alle aktiven Planungen (`Planned` bis `Optimierung`), schließt `Published` aus.
  - **Vorschläge**: Neuer Tab für Keywords im `Backlog`. Nur Main-Keywords (`Main_Keyword === 'Y'`).
  - **Keyword-Map**: Jetzt ein reines Daten-Repository ohne Aktions-Buttons.
  - **Blacklist**: Verwaltung ausgeschlossener Begriffe/URLs.
  - *Entfernt*: Der Tab "Trend-Radar" wurde gelöscht.
- **Workflow-Sperren**: Der Button "Als veröffentlicht markieren" im Editor ist nun gesperrt (`disabled`), solange der Content-Status nicht `Angeliefert` ist.

## Priorisierung & Ranking
- **Striking Distance Logic**: Einführung einer neuen Gewichtung basierend auf dem Ranking.
  - Ranking **11-30** erhält die höchste Punktzahl (Striking Distance), während Top-3 Rankings niedriger priorisiert werden.
  - Das Feld `Ranking` wurde systemweit (Airtable, Types, UI, Import) integriert.
- **Aktualitäts-Faktor (Recency)**: Integration eines Zeitfaktors. Frischer Content (`Last_Published`) senkt die Priorität massiv, alte Inhalte steigen über 12 Monate wieder an.
- **Einstellungs-Modal**: Neue Slider für "Ranking" und "Aktualität" in den Priorisierungs-Einstellungen.

## Deployment & Stabilität
- **Zentralisiertes Logging (Airtable Service)**: 
  - Die gesamte History-Logik wurde vom API-Layer in den `Airtable-Service` (`src/lib/airtable.ts`) verschoben.
  - Automatisches Logging bei Status-Übergängen (`Backlog`, `Planned`, `Beauftragt`, `Published`).
  - Fix: `Target_URL` wird nun konsistent in alle Log-Einträge geschrieben, um die Filterung in der UI zu gewährleisten.
  - Performance: Bulk-Logging bei Imports wird nun in optimierten 10er-Batches mit Rate-Limiting verarbeitet.
- **UI-Optimierung (Modals)**:
  - In den Planungs-Modals (`EditKeywordModal`, `EditEditorialModal`) wurde die detaillierte History-Liste durch eine kompakte Anzeige ersetzt: "Zuletzt erstellt/optimiert am [Datum]".
  - Die vollständige Historie bleibt über einen Deep-Link erreichbar.
- **TypeScript & Build-Fixes**: Systemweite Entfernung von `asChild` Props bei `DialogTrigger`, `PopoverTrigger` und `DropdownMenuTrigger`, da die verwendete `@base-ui/react` Bibliothek dieses Prop in der aktuellen Version nicht unterstützt.
- **Airtable-Synchronisation**: Fix für Datumsformate (`YYYY-MM-DD` statt ISO-Timestamp), um 422-Fehler bei der Veröffentlichung zu vermeiden.
- **API-Robustheit**: Der Keywords-PATCH-Handler unterstützt nun flache und verschachtelte Payloads.

## Content-Erstellung (Creation) & Airtable
- **Veröffentlichung**: Beim Markieren als "Veröffentlicht" wird automatisch das Feld `Last_Published` mit dem aktuellen Datum gesetzt und ein History-Log erstellt.
- **Layout**: Filterleisten und Pagination wurden in allen Planungstabs unter die Tabellen verschoben (standardisiertes Layout).
- **Bereinigung**: Der Button "An Pharma senden" wurde entfernt.

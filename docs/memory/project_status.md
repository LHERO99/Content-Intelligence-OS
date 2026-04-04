# Projekt-Status (Stand: 04.04.2026)

## Content-Lifecycle & UI-Refactoring
- **Status-Workflow**: Der Workflow wurde finalisiert: `Backlog` -> `Planned` -> `Beauftragt` -> `Angeliefert` -> `Published`.
- **Content-Historie (Nahrungskette)**: Die Historie wurde auf eine wesentliche Kette von 6 Events reduziert:
  1. URL der Keyword-Map hinzugefügt
  2. URL der Vorschlagsliste hinzugefügt
  3. URL der Redaktionsplanung hinzugefügt
  4. Content beauftragt
  5. Content angeliefert (mit Versionierung V1, V2... und Text-Vorschau)
  6. Content veröffentlicht
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
- **TypeScript & Build-Fixes**: Systemweite Entfernung von `asChild` Props bei `DialogTrigger`, `PopoverTrigger` und `DropdownMenuTrigger`, da die verwendete `@base-ui/react` Bibliothek dieses Prop in der aktuellen Version nicht unterstützt.
- **Airtable-Synchronisation**: Fix für Datumsformate (`YYYY-MM-DD` statt ISO-Timestamp), um 422-Fehler bei der Veröffentlichung zu vermeiden.
- **API-Robustheit**: Der Keywords-PATCH-Handler unterstützt nun flache und verschachtelte Payloads.

## Content-Erstellung (Creation) & Airtable
- **Veröffentlichung**: Beim Markieren als "Veröffentlicht" wird automatisch das Feld `Last_Published` mit dem aktuellen Datum gesetzt und ein History-Log erstellt.
- **Layout**: Filterleisten und Pagination wurden in allen Planungstabs unter die Tabellen verschoben (standardisiertes Layout).
- **Bereinigung**: Der Button "An Pharma senden" wurde entfernt.

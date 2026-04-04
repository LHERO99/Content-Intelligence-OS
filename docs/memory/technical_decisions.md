# Technische Entscheidungen

## 04.04.2026: UI-Architektur und Deployment-Sicherheit
- **UI-Komponenten (@base-ui/react)**: Die Entscheidung gegen die Nutzung von `asChild` bei Triggern wurde fixiert, um Build-Fehler zu vermeiden. Trigger müssen ihre Kinder direkt umschließen (meist via `Button` oder `div`).
- **Priorisierungs-Algorithmus**: Umstellung auf ein nicht-lineares Scoring-Modell für Rankings, um "Striking Distance" Potenziale (Seite 2/3) algorithmisch zu bevorzugen.
- **Airtable Date Format**: Die API erzwingt nun das Format `YYYY-MM-DD` für Datumsfelder, um Inkompatibilitäten mit der Airtable-Validierung (422 Error) bei aktiven Zeitzonen-Strings zu umgehen.
- **Tab-Logik**: Trennung von "Daten-Ansicht" (Keyword-Map) und "Aktions-Ansicht" (Vorschläge/Redaktionsplan) zur Verbesserung der Übersichtlichkeit und Performance durch kleinere Datensets pro View.

## 04.04.2026: Content-History Logik & Next.js 15 Fixes
- **Asynchrone Route Params**: Umstellung von Route-Handlern mit dynamischen Segmenten (z. B. `[id]`) auf asynchrone Params (`Promise<{id: string}>`), um Kompatibilität mit Next.js 15+ sicherzustellen (behebt Deployment-Fehler).
- **Historien-Filterung**: Implementierung einer strikten clientseitigen Filterung in der `HistoryList`-Komponente, die nur vordefinierte `Diff_Summary` Strings zulässt. Dies ermöglicht eine saubere "Nahrungskette" ohne technische Rausch-Logs in der UI.
- **Dynamische Versionierung**: Versionen (V1, V2...) werden nun zur Laufzeit basierend auf der chronologischen Reihenfolge der "Content angeliefert" Events berechnet, statt sie fest in der DB zu verdrahten.
- **Airtable Content-Log**: Erweiterung der `createContentLog` Funktion um einen Retry-Mechanismus für das Feld `Action_Type`, um Fehler bei (fälschlicherweise) als "computed" markierten Feldern in Airtable abzufangen.

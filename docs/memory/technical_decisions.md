# Technische Entscheidungen

## 04.04.2026: UI-Architektur und Deployment-Sicherheit
- **UI-Komponenten (@base-ui/react)**: Die Entscheidung gegen die Nutzung von `asChild` bei Triggern wurde fixiert, um Build-Fehler zu vermeiden. Trigger müssen ihre Kinder direkt umschließen (meist via `Button` oder `div`).
- **Priorisierungs-Algorithmus**: Umstellung auf ein nicht-lineares Scoring-Modell für Rankings, um "Striking Distance" Potenziale (Seite 2/3) algorithmisch zu bevorzugen.
- **Airtable Date Format**: Die API erzwingt nun das Format `YYYY-MM-DD` für Datumsfelder, um Inkompatibilitäten mit der Airtable-Validierung (422 Error) bei aktiven Zeitzonen-Strings zu umgehen.
- **Tab-Logik**: Trennung von "Daten-Ansicht" (Keyword-Map) und "Aktions-Ansicht" (Vorschläge/Redaktionsplan) zur Verbesserung der Übersichtlichkeit und Performance durch kleinere Datensets pro View.

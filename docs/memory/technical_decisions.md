# Technische Entscheidungen (Stand: 04.04.2026)

## Aktuelle Strategien & Patterns
- **Logging-Reset (04.04.2026)**: 
  - Alle automatisierten und manuellen Logging-Trigger wurden aus dem Airtable-Service und den API-Routen entfernt.
  - Grund: Inkonsistenzen bei Bulk-Imports und Status-Übergängen.
  - Neukonzeption erforderlich: Fokus auf Datenbank-Stabilität (Airtable Felder) und garantierte Verknüpfung zwischen Keywords und Logs via Target_URL als Primärschlüssel-Fallback.
- **Kompakte History-Ansicht in Modals**: 
  - In den Planungs-Modals (`EditKeywordModal`, `EditEditorialModal`) wird nur noch die letzte Veröffentlichung (Erstellung/Optimierung) angezeigt, um den visuellen Ballast im Vergleich zur vollständigen Timeline zu reduzieren.

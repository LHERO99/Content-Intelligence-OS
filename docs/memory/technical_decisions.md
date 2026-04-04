# Technische Entscheidungen (Stand: 04.04.2026)

## Aktuelle Strategien & Patterns
- **Zentralisiertes Logging (Airtable Service)**: 
  - Die History-Logik wurde vollständig in den `Airtable-Service` (`src/lib/airtable.ts`) verschoben. Dies stellt sicher, dass jede Statusänderung (egal ob via UI, Import oder n8n-Workflow) konsistent geloggt wird. 
  - Die Performance wurde durch ein Batch-Verfahren (10 Records pro Call) mit manuellem Rate-Limiting (Airtable Limit: 5 Req/s) optimiert.
- **Kompakte History-Ansicht in Modals**: 
  - In den Planungs-Modals (`EditKeywordModal`, `EditEditorialModal`) wird nur noch die letzte Veröffentlichung (Erstellung/Optimierung) angezeigt, um den visuellen Ballast im Vergleich zur vollständigen Timeline zu reduzieren.

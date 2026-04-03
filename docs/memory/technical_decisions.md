# Technische Entscheidungen

## 03.04.2026: UI-Sync, Performance und API-Stabilität
- **API-Stabilität (Airtable)**: Berechnete Felder (Computed Fields) in Airtable, wie `Target_URL` in der Tabelle `Content-Log`, dürfen niemals in `create`- oder `update`-Calls enthalten sein. Die API-Services müssen sicherstellen, dass nur beschreibbare Felder an die Airtable-SDK übergeben werden, um 422-Fehler zu vermeiden.
- **CSS-Strategie**: Um globale Stil-Overrides in dynamisch injiziertem HTML (z. B. im Vorschaubereich) zuverlässig anzuwenden, werden `<style jsx global>` Tags direkt in den Workspace-Komponenten verwendet.
- **Synchronisation**: Einführung des `refresh-planning-data` Events als globaler Trigger, um UI-Aktualisierungen nach Datenbank-Operationen (Speichern, Beauftragen) ohne manuellen Reload zu erzwingen.
- **Status-Logik**: Umstellung der Button-Steuerung von einer reinen Historien-Prüfung auf eine Kombination aus Historien-Prüfung (`Set`) und dem expliziten Status-Feld in Airtable, um Flickering durch Latenzen zu verhindern.
- **Editor-Styling**: Verwendung von `!important` Flags innerhalb von `ProseMirror` globalen CSS-Blöcken, um eine konsistente Corporate-Identity (DocMorris-Design) im Editor zu garantieren, unabhängig von Tailwind-Prose-Defaults.

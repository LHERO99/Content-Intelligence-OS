# Projekt-Status (Stand: 05.04.2026)

## Content-Lifecycle & Logging-Events
- **Status-Workflow**: Der Workflow umfasst nun: `Backlog` -> `Planned` -> `Beauftragt` -> `Angeliefert` -> `Published`.
- **Lückenloses Event-Logging**: Alle Kern-Meilensteine werden nun robust in der `Content-Log` Tabelle erfasst:
  1. **URL dem Tool hinzugefügt**: Automatisches Log beim Import (`import/route.ts`). De-dupliziert pro URL innerhalb eines Batches.
  2. **URL wurde dem Tab 'Vorschläge' hinzugefügt**: Automatisches Log, wenn ein Keyword im `Backlog` landet und `Main_Keyword === 'Y'` ist.
  3. **URL wurde der Redaktionsplanung hinzugefügt**: Log bei Status-Transition zu `Planned`.
  4. **Content wurde beauftragt**: Zentrales Logging im n8n-Trigger-Proxy (`api/n8n/trigger/route.ts`) bei Klick auf "Beauftragen".
  5. **Content angeliefert**: Erfasst via n8n Callback Webhook (`api/n8n/callback/route.ts`).
  6. **Content veröffentlicht**: Log bei Status-Transition zu `Published`.
  7. **URL der Blacklist hinzugefügt**: Automatisches Logging beim Verschieben oder Hinzufügen zur Blacklist.

## Datenbank & API-Stabilität
- **Airtable Service-Härtung**:
  - **Computed Field Fix**: Das Feld `Target_URL` in `Content-Log` wird beim Schreiben explizit ignoriert, da es ein Lookup-Feld in Airtable ist. Dies verhindert 422-Fehler.
  - **ID-Validierung**: Die Funktion `createContentLog` prüft nun zwingend auf gültige Airtable-Record-IDs (`rec...`), um stille Fehlgeschläge zu vermeiden.
  - **Detailliertes Debugging**: Erweitertes Server-side Logging für alle Datenbank-Operationen im Airtable-Service.
- **Blacklist-Persistenz**: Die Tabelle `Blacklist` wurde um das Feld `Target_URL` erweitert (manuelle Airtable-Änderung erforderlich), um die URL-Historie auch nach Löschung aus der Keyword-Map zu erhalten.

## n8n Integration
- **Webhook-Differenzierung**: Die `triggerN8nWorkflow` Funktion unterscheidet nun zwischen Import-Webhook (`.../6706e957...`) und Content-Erstellungs-Webhook (`.../23daa68a...`).
- **Callback-Robustheit**: Der n8n-Callback-Handler filtert nun berechnete Felder aus, bevor er in Airtable schreibt.

## UI & Visualisierung (HistoryList)
- **Erweiterte Nahrungskette**: Die `HistoryList` Komponente zeigt nun auch Events für "Vorschläge" und "Blacklist" an.
- **Icon-System**: Neue Icons für Blacklist (`ShieldAlert` in Rot) und Vorschläge (`Lightbulb` in Amber) integriert.
- **Editor-Tracking**: Der ausführende User (Editor) wird nun bei fast allen Logging-Events automatisch erfasst und in der Historie hinterlegt.

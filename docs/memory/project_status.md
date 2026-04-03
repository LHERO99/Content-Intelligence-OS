# Projekt-Status (Stand: 03.04.2026)

## Content-Erstellung (Creation)
- **Status-Formatierung**: Zeitstempel in der Auftragsliste auf `DD.MM.YYYY, HH:MM` umgestellt. Bei n8n-Beauftragung wird der Zeitpunkt sofort via `COMMISSION_CONTENT` in der Content-Historie fixiert.
- **Editor-Optimierung**:
  - HTML-Umschalter ("Code"-Button) in der Rich-Text-Editor Toolbar integriert.
  - Automatisches "Beautify" (Einrückung) im Code-Modus mittels `js-beautify`.
  - H-Tags (H1, H2, H3) und Absätze (`<p>`) visuell durch DocMorris-Branding (`#00463c`, `Poppins`-Font) abgehoben.
  - Visuelle Toolbar-Aktualisierung (H-Status) in Echtzeit.
  - Headline-Konvertierung in Normaltext via Toolbar-Icon möglich.
- **Vorschau-Tab**: 
  - Konsistente Anwendung von `global` Styling für dynamisch injiziertes HTML.
  - Unterstützung für poppins-Font und korrekte Listenelemente (`<ul>`, `<ol>`, `<li>`).
- **UI/UX**: 
  - Konsistente grüne Markierung der aktiven Tab-Zeile (Auftragsliste) über alle Status-Typen hinweg.
  - Anpassung der Abstände (Padding `p-3`, Headline-Margins).
  - KI-Optimierungs-Workspace nutzt nun volle Bildschirmhöhe (`h-full`) mit internem Scrollen.

## Redaktionsplanung
- **Kommissionierungs-Button**: Button-Persistenz behoben; er verschwindet nun dauerhaft, sobald ein Workflow gestartet wurde, durch Prüfung von Historie und Status.
- **Modals**: Behebung von Overflow-Problemen bei langen URLs in Fehler-Alerts (`break-words`) sowie Fix für das Layout der "Übersprungen"-Box im Importer.
- **Content-Historie**: Design des Historien-Abschnitts in der Keyword-Map auf den Standard der Redaktionsplanung vereinheitlicht.

# Phase 5: Journey Mapping

## Ziel

Die `/journeys` Seite implementieren: Customer Journeys definieren, URLs den vier
Funnel-Phasen (Awareness / Consideration / Decision / Retention) zuordnen und
die Coverage pro Phase visualisieren.

**Voraussetzung:** Phase 1 abgeschlossen (Tabellen `journeys` + `journey_page_mappings` vorhanden)

---

## 1. API Routes

### 1.1 `src/app/api/journeys/route.ts` (neu)

**GET** — Alle Journeys des Tenants mit Phase-Coverage-Stats

```typescript
// Response: JourneyWithStats[]
//
// Query:
//   SELECT j.*,
//     COUNT(jpm.id) AS total_mappings,
//     COUNT(CASE WHEN jpm.funnel_phase = 'awareness'     THEN 1 END) AS awareness_count,
//     COUNT(CASE WHEN jpm.funnel_phase = 'consideration' THEN 1 END) AS consideration_count,
//     COUNT(CASE WHEN jpm.funnel_phase = 'decision'      THEN 1 END) AS decision_count,
//     COUNT(CASE WHEN jpm.funnel_phase = 'retention'     THEN 1 END) AS retention_count
//   FROM journeys j
//   LEFT JOIN journey_page_mappings jpm ON jpm.journey_id = j.id
//   WHERE j.tenant_id = :tenantId
//   GROUP BY j.id
//   ORDER BY j.created_at DESC
```

**POST** — Neue Journey erstellen

```typescript
// Body: { name: string; description?: string }
// Validierung: name nicht leer
// Response: Journey
```

### 1.2 `src/app/api/journeys/[id]/route.ts` (neu)

**GET** — Journey-Detail mit allen URL-Mappings

```typescript
// Response: {
//   journey: Journey,
//   mappings: JourneyPageMapping[]  // mit URL-Daten joined
// }
//
// Query für Mappings:
//   SELECT jpm.*,
//     u.url, u.page_type,
//     uk.keyword AS main_keyword,
//     uk.search_volume,
//     uk.ranking,
//     ps.status AS planning_status,
//     (SELECT SUM(gsc.clicks) FROM url_performance gsc
//      WHERE gsc.url_id = u.id AND gsc.date >= NOW() - INTERVAL '30 days') AS clicks_30d
//   FROM journey_page_mappings jpm
//   JOIN urls u       ON u.id = jpm.url_id
//   LEFT JOIN url_keywords uk ON uk.url_id = u.id AND uk.is_main_keyword = true
//   LEFT JOIN planning_status ps ON ps.url_id = u.id AND ps.tenant_id = jpm.tenant_id
//   WHERE jpm.journey_id = :journeyId
//   ORDER BY jpm.funnel_phase, jpm.created_at
```

**PATCH** — Journey aktualisieren

```typescript
// Body: { name?: string; description?: string }
```

**DELETE** — Journey löschen (kaskadiert journey_page_mappings)

### 1.3 `src/app/api/journeys/[id]/mappings/route.ts` (neu)

**GET** — Alle Mappings einer Journey

**POST** — URL zu Journey und Phase hinzufügen

```typescript
// Body: { urlId: string; funnelPhase: FunnelPhase }
// Validierung:
//   - urlId gehört zum Tenant
//   - URL noch nicht in dieser Journey (unique constraint)
// Response: JourneyPageMapping
```

### 1.4 `src/app/api/journeys/[id]/mappings/[mappingId]/route.ts` (neu)

**DELETE** — URL aus Journey entfernen

**PATCH** — Phase einer URL-Zuordnung ändern

```typescript
// Body: { funnelPhase: FunnelPhase }
// Nützlich wenn User eine URL per Drag & Drop in eine andere Phase verschiebt
```

---

## 2. Frontend — Seitenstruktur

### 2.1 `src/app/journeys/page.tsx` (neu)

```typescript
// Server Component (Metadata) + Client-Teil
// Metadata: title = "Journey Mapping | Plexaro"
// Layout: zwei Spalten
//   - Linke Spalte (300px): JourneyList
//   - Rechte Hauptfläche: JourneyDetail (oder EmptyState wenn keine Journey gewählt)
```

### Haupt-Layout-Skizze

```
┌──────────────────────────────────────────────────────────────────────┐
│ Journey Mapping                                    [+ Journey erstellen] │
├──────────────────┬───────────────────────────────────────────────────┤
│                  │                                                   │
│ MEINE JOURNEYS   │  🛍️ Buying Journey Vitamine                      │
│ ─────────────── │  ─────────────────────────────────────────────── │
│ 🛍️ Buying       │                                                   │
│    Journey       │  [Funnel Coverage Chart: 4 Phasen als Bar]       │
│    Vitamine  ●  │                                                   │
│                  │  ──────────────────────────────────────────────  │
│ 💊 Post-Purchase│  AWARENESS (3)  CONSID. (5)  DECISION (4)  RET.(1)│
│    Follow-up     │  ┌───────┐     ┌───────┐    ┌───────┐    ┌────┐ │
│                  │  │ URL 1 │     │ URL 4 │    │ URL 7 │    │URL9│ │
│ + Journey        │  │ URL 2 │     │ URL 5 │    │ URL 8 │    └────┘ │
│   erstellen      │  │ URL 3 │     │ URL 6 │    + Seite     + Seite │
│                  │  + Seite       + Seite  │    hinzufügen  hinzu. │
│                  │  └───────┘     └───────┘    └───────┘          │
└──────────────────┴───────────────────────────────────────────────────┘
```

---

## 3. Frontend-Komponenten

### 3.1 `src/app/journeys/journey-list.tsx` (neu)

```typescript
// Props: journeys: JourneyWithStats[], selectedId: string | null,
//        onSelect: (id: string) => void, onCreate: () => void
//
// Rendert:
//   - "MEINE JOURNEYS" Section-Header
//   - Je Journey: ein klickbarer List-Item mit:
//       - Journey-Name
//       - Coverage-Indikator: "13 Seiten · 4 Phasen" oder Mini-Dots für jede Phase
//       - Aktiv-State wenn selectedId === journey.id
//   - Am Ende: "+ Journey erstellen" Button
//   - Leer-State: "Noch keine Journeys angelegt."
```

### 3.2 `src/app/journeys/journey-detail.tsx` (neu)

```typescript
// Props: journeyId: string
//
// Daten laden: GET /api/journeys/:id
//
// Rendert:
//   - Header: Journey-Name + Beschreibung + Edit-Button + Delete-Button
//   - JourneyCoverageChart (Balken-Chart, kompakt)
//   - 4-Spalten-Funnel:
//       {FUNNEL_PHASES.map(phase => <FunnelPhaseColumn ... />)}
//
// State:
//   - urlPickerOpen: boolean
//   - urlPickerPhase: FunnelPhase | null
```

### 3.3 `src/app/journeys/journey-coverage-chart.tsx` (neu)

```typescript
// Props: phaseCoverage: { awareness: n, consideration: n, decision: n, retention: n }
//        totalUrls: number
//
// Recharts BarChart (horizontal) oder einfache Progress-Bars mit Labels:
//
//   Awareness     ████████████████ 3
//   Consideration ████████████████████████ 5
//   Decision      ████████████████████ 4
//   Retention     ████ 1
//
// Alternativ: 4 farbige Segmente in einer Leiste (Stacked Bar)
// Farben: Awareness=Blau, Consideration=Indigo, Decision=Grün, Retention=Orange
```

### 3.4 `src/app/journeys/funnel-phase-column.tsx` (neu)

```typescript
// Props:
//   phase: FunnelPhase
//   label: string                  // "Awareness" etc.
//   mappings: JourneyPageMapping[] // URLs in dieser Phase
//   onAddPage: () => void          // öffnet URL-Picker
//   onRemovePage: (mappingId: string) => void
//   onMoveToPhase?: (mappingId: string, newPhase: FunnelPhase) => void
//
// Layout:
//   ┌─────────────────────────────┐
//   │ 🔵 AWARENESS  (3)           │
//   ├─────────────────────────────┤
//   │ ┌───────────────────────┐   │
//   │ │ /ratgeber/vitamin-c   │ × │
//   │ │ vitamin c tabletten   │   │
//   │ │ 🟢 Published · #3    │   │
//   │ │ 8.100 SV · 1.2K Klicks│  │
//   │ └───────────────────────┘   │
//   │ ┌───────────────────────┐   │
//   │ │ ...                   │   │
//   │ └───────────────────────┘   │
//   │                             │
//   │ [+ Seite hinzufügen]        │
//   └─────────────────────────────┘
//
// Jede URL-Karte zeigt:
//   - URL (truncated)
//   - Main Keyword (wenn vorhanden)
//   - Status-Badge (aus planning_status)
//   - Ranking (wenn vorhanden)
//   - Suchvolumen
//   - GSC Clicks (30 Tage, wenn vorhanden)
//   - X-Button zum Entfernen
//
// "Phase wechseln"-Option (optional für V1):
//   Kontext-Menü oder Dropdown auf URL-Karte: "In andere Phase verschieben"
```

### 3.5 `src/app/journeys/url-picker-modal.tsx` (neu)

```typescript
// Props:
//   open: boolean
//   onClose: () => void
//   onSelect: (urlId: string) => void
//   journeyId: string              // für Duplikat-Ausschluss
//   phase: FunnelPhase
//   alreadyMappedUrlIds: string[]  // für Duplikat-Ausschluss
//
// Layout:
//   - Suchfeld: Filtert URLs nach URL-String oder Main Keyword
//   - Filter: Seitentyp (Ratgeber / Kategorie / Marke / Produkt)
//   - Liste (virtualisiert wenn viele URLs):
//       - URL + Main Keyword + Seitentyp-Badge + Status-Badge
//       - Bereits gemappte URLs: ausgegraut + "(Bereits in Journey)"
//   - Klick → onSelect(urlId) → Modal schließt
//
// Datenquelle: GET /api/planning/keywords (bestehende Route)
//              oder dedizierter GET /api/journeys/available-urls?journeyId=...
```

### 3.6 `src/app/journeys/create-journey-modal.tsx` (neu)

```typescript
// Props: open: boolean, onClose: () => void, journey?: Journey (für Edit-Modus)
//
// Felder:
//   - Name (Input, required)
//   - Beschreibung (Textarea, optional)
//
// Submit: POST /api/journeys (create) oder PATCH /api/journeys/:id (edit)
// Nach Erfolg: Toast + Modal schließen + Journeys-Liste refreshen + neu erstellte Journey auswählen
```

---

## 4. Custom Hook

### `src/features/journeys/hooks/use-journeys.ts` (neu)

```typescript
// Exportiert:
//   - journeys: JourneyWithStats[]
//   - isLoading: boolean
//   - createJourney(data): Promise<Journey>
//   - updateJourney(id, data): Promise<void>
//   - deleteJourney(id): Promise<void>
//   - refresh(): void
```

### `src/features/journeys/hooks/use-journey-detail.ts` (neu)

```typescript
// Props: journeyId: string
//
// Exportiert:
//   - journey: Journey | null
//   - mappings: JourneyPageMapping[]
//   - isLoading: boolean
//   - addMapping(urlId, phase): Promise<void>
//   - removeMapping(mappingId): Promise<void>
//   - changeMappingPhase(mappingId, newPhase): Promise<void>
//   - refresh(): void
```

---

## 5. Leer- und Fehlerzustände

```
Keine Journeys vorhanden:
  ┌─────────────────────────────────────┐
  │                                     │
  │  🗺️                                 │
  │  Noch keine Journeys angelegt.      │
  │  Erstelle deine erste Customer      │
  │  Journey um die Funnel-Abdeckung    │
  │  deiner Seiten zu visualisieren.    │
  │                                     │
  │  [Journey erstellen]                │
  └─────────────────────────────────────┘

Journey gewählt, aber noch keine Mappings:
  → Jede Phase zeigt "Keine Seiten. Klicke + um Seiten hinzuzufügen."
```

---

## Checkliste Phase 5

### API
- [ ] `src/app/api/journeys/route.ts` (GET mit Stats, POST)
- [ ] `src/app/api/journeys/[id]/route.ts` (GET Detail, PATCH, DELETE)
- [ ] `src/app/api/journeys/[id]/mappings/route.ts` (GET, POST)
- [ ] `src/app/api/journeys/[id]/mappings/[mappingId]/route.ts` (DELETE, PATCH phase)

### Frontend
- [ ] `src/app/journeys/page.tsx`
- [ ] `src/app/journeys/journey-list.tsx`
- [ ] `src/app/journeys/journey-detail.tsx`
- [ ] `src/app/journeys/journey-coverage-chart.tsx`
- [ ] `src/app/journeys/funnel-phase-column.tsx`
- [ ] `src/app/journeys/url-picker-modal.tsx`
- [ ] `src/app/journeys/create-journey-modal.tsx`
- [ ] `src/features/journeys/hooks/use-journeys.ts`
- [ ] `src/features/journeys/hooks/use-journey-detail.ts`

### Test-Szenarien
- [ ] Journey erstellen, bearbeiten, löschen
- [ ] URL zu Phase hinzufügen (Awareness / Consideration / Decision / Retention)
- [ ] URL aus Phase entfernen
- [ ] URL bereits in Journey → im URL-Picker ausgegraut
- [ ] Coverage-Chart zeigt korrekte Zahlen
- [ ] Leer-State erscheint wenn keine Journeys / keine Mappings
- [ ] Phase wechseln (PATCH mapping)

# Strategische Features: Übersicht & Master-Plan

## Kontext

Erweiterung des SEO-Content-Tools um drei strategische Features:

1. **Topic Map** — Visualisierung und Verwaltung von Topic Clustern und deren URL-Abdeckung
2. **Topic Discovery** — DataForSEO-basierte Erkennung unerschlossener Themen mit Gap-Analyse
3. **Journey Mapping** — Definition von Customer Journeys, URL-Mapping nach Funnel-Phase, Coverage-Analyse

## Entscheidungen (aus Design-Session)

| Thema | Entscheidung |
|---|---|
| Topic Clustering | Manuell per Label |
| Datenquelle Trends | DataForSEO (bereits integriert) |
| Funnel-Phasen | Fest: Awareness / Consideration / Decision / Retention |
| Navigation | Neue Sections in Sidebar: "Strategie" + "Content" |
| Topic Map Visualisierung | Sunburst (Wheel) + Mind Map (Tree) + Tabelle (Toggle) |
| URL-Cluster-Zuordnung | In `/planning` Keyword Map Tabelle (neue Spalte) |
| Discovery → Planning Flow | Flow C: Idee zuerst im Cluster speichern, dann "Jetzt planen" |

## Neue Navigationsstruktur

```
Dashboard

─ STRATEGIE ──────────────────────
  Topic Map          /topic-map
  Journey Mapping    /journeys

─ CONTENT ────────────────────────
  Content-Planung    /planning
  Content-Erstellung /creation
  Content-Monitoring /monitoring
  Content-Historie   /history
```

Admin- und SuperAdmin-Navigation bleiben unverändert.

## Neues Datenmodell (5 Tabellen)

```
topic_clusters
  id (text, PK)
  tenant_id (text, FK → tenants)
  name (text)
  description (text, nullable)
  color (text, default '#6366f1')
  created_at, updated_at

url_topic_clusters          ← Junction: URL ↔ Cluster
  url_id (text, FK → urls)
  topic_cluster_id (text, FK → topic_clusters)
  tenant_id (text, FK → tenants)
  created_at
  PK: (url_id, topic_cluster_id)

topic_ideas                 ← Ungeplanet Themenideen pro Cluster
  id (text, PK)
  tenant_id (text, FK → tenants)
  topic_cluster_id (text, FK → topic_clusters)
  keyword (text)
  search_volume (integer, nullable)
  keyword_difficulty (integer, nullable)
  source (text: 'manual' | 'dataforseo')
  created_at

journeys
  id (text, PK)
  tenant_id (text, FK → tenants)
  name (text)
  description (text, nullable)
  created_at, updated_at

journey_page_mappings       ← URL ↔ Journey-Phase Zuordnung
  id (text, PK)
  tenant_id (text, FK → tenants)
  journey_id (text, FK → journeys)
  url_id (text, FK → urls)
  funnel_phase (text: 'awareness' | 'consideration' | 'decision' | 'retention')
  created_at
  UNIQUE: (journey_id, url_id)
```

## User Flow: Discovery → Planung

```
Topic Discovery Tab
  └─ DataForSEO Vorschlag anzeigen
     └─ "Übernehmen" → Cluster auswählen → topic_ideas Eintrag erstellen

Topic Map → Cluster-Detail
  ├─ ✅ Geplante URLs (url_topic_clusters → urls)
  └─ 💡 Ideen (topic_ideas)
       └─ "Jetzt planen" → Modal
            ├─ URL eingeben/auswählen (isMainKeyword = true, vorbelegt)
            ├─ Seitentyp, Priorität wählen
            └─ → URL-Record + url_keywords (Backlog) erstellen
                  + topic_ideas Eintrag löschen
                  + url_topic_clusters Eintrag erstellen
```

## Implementierungsphasen

| Phase | Plan-Datei | Inhalt | Abhängigkeiten |
|---|---|---|---|
| **1** | `phase-1-db-migration-and-navigation.md` | Drizzle Schema, Migration, Sidebar-Sections, i18n-Keys | Keine |
| **2** | `phase-2-topic-map-core.md` | Topic Map Page, Cluster CRUD, Sunburst/Tree/Tabellen-Views | Phase 1 |
| **3** | `phase-3-topic-discovery.md` | DataForSEO Discovery, topic_ideas Flow, "Jetzt planen" Modal | Phase 1+2 |
| **4** | `phase-4-planning-integration.md` | Topic Cluster Spalte in Keyword Map, Inline-Assignment | Phase 1+2 |
| **5** | `phase-5-journey-mapping.md` | Journey CRUD, Funnel-View, URL-Picker, Coverage-Chart | Phase 1 |

## Neue Abhängigkeiten (npm)

| Paket | Zweck | Wo |
|---|---|---|
| `echarts` + `echarts-for-react` | Sunburst Chart für Topic Map | Phase 2 |

`@xyflow/react` ist bereits installiert und wird für den Tree/Mind-Map View genutzt.

## Neue Dateien (Übersicht)

```
src/
├── app/
│   ├── topic-map/
│   │   ├── page.tsx
│   │   ├── topic-map-tabs.tsx
│   │   ├── my-topics/
│   │   │   ├── cluster-sunburst.tsx
│   │   │   ├── cluster-tree.tsx
│   │   │   ├── cluster-table.tsx
│   │   │   ├── cluster-detail-panel.tsx
│   │   │   ├── create-cluster-modal.tsx
│   │   │   └── plan-idea-modal.tsx
│   │   └── discovery/
│   │       ├── discovery-panel.tsx
│   │       ├── suggestion-card.tsx
│   │       └── adopt-idea-modal.tsx
│   ├── journeys/
│   │   ├── page.tsx
│   │   ├── journey-list.tsx
│   │   ├── journey-detail.tsx
│   │   ├── funnel-phase-column.tsx
│   │   ├── url-picker-modal.tsx
│   │   ├── journey-coverage-chart.tsx
│   │   └── create-journey-modal.tsx
│   └── api/
│       ├── topic-clusters/
│       │   ├── route.ts                    (GET list, POST create)
│       │   └── [id]/
│       │       ├── route.ts                (GET detail+stats, PATCH, DELETE)
│       │       ├── urls/
│       │       │   ├── route.ts            (GET, POST add URL)
│       │       │   └── [urlId]/route.ts    (DELETE remove URL)
│       │       └── ideas/
│       │           ├── route.ts            (GET, POST add idea)
│       │           └── [ideaId]/
│       │               ├── route.ts        (DELETE)
│       │               └── promote/route.ts (POST → "Jetzt planen")
│       ├── topic-clusters/discovery/
│       │   └── route.ts                    (POST → DataForSEO Anfrage)
│       └── journeys/
│           ├── route.ts                    (GET list, POST create)
│           └── [id]/
│               ├── route.ts                (GET detail, PATCH, DELETE)
│               └── mappings/
│                   ├── route.ts            (GET, POST add mapping)
│                   └── [mappingId]/route.ts (DELETE)
├── features/
│   ├── topic-map/
│   │   ├── hooks/
│   │   │   ├── use-topic-clusters.ts
│   │   │   └── use-topic-discovery.ts
│   │   └── services/
│   │       └── topic-cluster-service.ts
│   └── journeys/
│       ├── hooks/
│       │   └── use-journeys.ts
│       └── services/
│           └── journey-service.ts
└── lib/
    └── db/
        └── schema.ts  (5 neue Tabellen ergänzen)
```

## Geänderte Dateien (Übersicht)

```
src/components/app-sidebar.tsx        ← Sidebar-Sections + neue Nav-Items
src/app/planning/keyword-table.tsx    ← Neue Topic Cluster Spalte (Phase 4)
src/i18n/de.json                      ← Neue i18n-Keys
src/i18n/en.json                      ← Neue i18n-Keys
```

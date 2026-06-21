# Phase 2: Topic Map Core

## Ziel

Die Topic Map Seite mit vollständigem Cluster-Management und drei Ansichten (Sunburst/Wheel, Tree/Mind Map, Tabelle) implementieren.

**Voraussetzung:** Phase 1 abgeschlossen (Tabellen vorhanden, i18n-Keys gesetzt)

---

## 1. npm-Abhängigkeit installieren

```bash
npm install echarts echarts-for-react
```

`@xyflow/react` ist bereits installiert.

---

## 2. API Routes

### 2.1 `src/app/api/topic-clusters/route.ts` (neu)

**GET** — Alle Cluster des Tenants mit aggregierten Stats laden

```typescript
// Response: TopicClusterWithStats[]
// Query:
//   SELECT tc.*,
//     COUNT(DISTINCT utc.url_id) AS url_count,
//     COUNT(DISTINCT ti.id)      AS idea_count,
//     SUM(uk.search_volume)      AS total_search_volume   (nur Main Keywords)
//     AVG(uk.ranking)            AS avg_ranking            (nur Main Keywords)
//   FROM topic_clusters tc
//   LEFT JOIN url_topic_clusters utc ON utc.topic_cluster_id = tc.id
//   LEFT JOIN topic_ideas ti         ON ti.topic_cluster_id  = tc.id
//   LEFT JOIN url_keywords uk        ON uk.url_id = utc.url_id AND uk.is_main_keyword = true
//   WHERE tc.tenant_id = :tenantId
//   GROUP BY tc.id
//   ORDER BY total_search_volume DESC
```

**POST** — Neuen Cluster erstellen

```typescript
// Body: { name: string; description?: string; color?: string }
// Validierung: name nicht leer, name eindeutig pro Tenant
// Response: TopicCluster
```

### 2.2 `src/app/api/topic-clusters/[id]/route.ts` (neu)

**GET** — Cluster-Detail mit URLs und Ideen

```typescript
// Response: {
//   cluster: TopicCluster,
//   urls: Array<{
//     id: string; url: string; pageType: string;
//     mainKeyword: string | null; searchVolume: number | null;
//     ranking: number | null; planningStatus: string;
//   }>,
//   ideas: TopicIdea[]
// }
```

**PATCH** — Cluster aktualisieren

```typescript
// Body: { name?: string; description?: string; color?: string }
```

**DELETE** — Cluster löschen (kaskadiert url_topic_clusters + topic_ideas)

### 2.3 `src/app/api/topic-clusters/[id]/urls/route.ts` (neu)

**GET** — Liste der URLs in diesem Cluster

**POST** — URL zum Cluster hinzufügen

```typescript
// Body: { urlId: string }
// Prüft: URL und Cluster gehören zum gleichen Tenant
```

### 2.4 `src/app/api/topic-clusters/[id]/urls/[urlId]/route.ts` (neu)

**DELETE** — URL aus Cluster entfernen (löscht url_topic_clusters Eintrag)

---

## 3. Frontend — Seite und Tabs

### 3.1 `src/app/topic-map/page.tsx` (neu)

```typescript
// Server Component (oder Client mit Suspense)
// Rendert: TopicMapTabs
// Metadata: title = "Topic Map | Plexaro"
```

### 3.2 `src/app/topic-map/topic-map-tabs.tsx` (neu)

```typescript
// Client Component
// Zwei Tabs über shadcn/ui <Tabs>:
//   - "Meine Topics" → <MyTopicsTab />
//   - "Topic Discovery" → <DiscoveryPanel /> (Phase 3)
// State: activeTab (URL-Param oder useState)
```

---

## 4. Frontend — "Meine Topics" Tab

### 4.1 `src/app/topic-map/my-topics/view-toggle.tsx` (neu)

```typescript
// Drei Buttons in einer ToggleGroup:
//   🔵 Wheel (Sunburst)
//   🌿 Tree (Mind Map)
//   📋 Tabelle
// Props: view: 'sunburst' | 'tree' | 'table', onChange
```

### 4.2 `src/app/topic-map/my-topics/cluster-sunburst.tsx` (neu)

Sunburst-Chart via `echarts-for-react`:

```typescript
// Props: clusters: TopicClusterWithStats[], onClusterClick: (id: string) => void
//
// Datenstruktur für ECharts Sunburst:
// {
//   name: 'Topics',
//   children: clusters.map(c => ({
//     name: c.name,
//     value: c.totalSearchVolume || c.urlCount,
//     itemStyle: { color: c.color },
//     children: [
//       ...c.urls.map(u => ({ name: u.mainKeyword || u.url, value: u.searchVolume || 1 }))
//       ...c.ideas.map(i => ({ name: i.keyword, value: i.searchVolume || 0,
//                              itemStyle: { color: '#94a3b8', borderDash: [4,2] } }))
//     ]
//   }))
// }
//
// Ideen werden grau/gestrichelt dargestellt (noch nicht geplant)
// Klick auf Cluster-Ring → onClusterClick(id) → öffnet Detail-Panel
```

### 4.3 `src/app/topic-map/my-topics/cluster-tree.tsx` (neu)

Mind-Map via `@xyflow/react`:

```typescript
// Props: clusters: TopicClusterWithStats[], onClusterClick: (id: string) => void
//
// Node-Struktur:
//   - Root Node: "Topic Map" (center)
//   - Cluster Nodes: je Cluster ein Node (Farbe = cluster.color)
//   - URL Nodes: je URL ein kleinerer Node (Status-Badge)
//   - Idea Nodes: je Idee ein gestrichelter Node (grau)
//
// Layout: radial (Cluster kreisförmig um Root, URLs um Cluster)
// Interaktion:
//   - Klick auf Cluster-Node → onClusterClick(id)
//   - Zoom + Pan via xyflow built-in
//   - MiniMap anzeigen
//
// Hinweis: @xyflow/react hat keinen nativen radialen Layout-Algorithmus.
// Positionen manuell berechnen oder dagre-Layout verwenden:
//   npm install @dagrejs/dagre  (nur falls nötig, sonst manuell)
// Einfachere Alternative: Horizontal-Tree Layout mit xyflow ist out-of-the-box möglich
```

### 4.4 `src/app/topic-map/my-topics/cluster-table.tsx` (neu)

```typescript
// TanStack Table (wie in /planning)
// Spalten:
//   - Cluster-Name (mit Farb-Dot)
//   - Beschreibung
//   - Anzahl URLs
//   - Anzahl Ideen
//   - Gesamt-Suchvolumen
//   - Ø Ranking
//   - Aktionen: Bearbeiten, Löschen
// Klick auf Zeile → öffnet Cluster-Detail-Panel
```

### 4.5 `src/app/topic-map/my-topics/cluster-detail-panel.tsx` (neu)

```typescript
// Slide-in Sheet (shadcn/ui <Sheet side="right">)
// Props: clusterId: string | null, onClose: () => void
//
// Inhalt:
//   Header: Cluster-Name + Farbe + Edit-Button
//   Stats-Row: URLCount, IdeaCount, Suchvolumen, Ø Ranking
//
//   Section "Geplante URLs":
//     Liste der URLs mit:
//       - URL-String
//       - Main Keyword + Suchvolumen
//       - Status-Badge (aus planning_status)
//       - Ranking
//       - X-Button zum Entfernen aus Cluster
//     "+ URL hinzufügen" Button → öffnet URL-Picker (aus bestehender URL-Tabelle)
//
//   Section "Ideen 💡":
//     Liste der topic_ideas mit:
//       - Keyword
//       - Suchvolumen + KD
//       - Source-Badge (manual / dataforseo)
//       - "Jetzt planen" Button → öffnet PlanIdeaModal
//       - X-Button zum Löschen
//     "+ Idee manuell hinzufügen" Button
```

### 4.6 `src/app/topic-map/my-topics/create-cluster-modal.tsx` (neu)

```typescript
// shadcn/ui <Dialog>
// Felder:
//   - Name (Input, required)
//   - Beschreibung (Textarea, optional)
//   - Farbe (Color-Picker oder vordefinierte Farb-Swatches: 8 Farben)
// Modus: Create (leere Felder) oder Edit (vorbelegt)
// Submit: POST /api/topic-clusters oder PATCH /api/topic-clusters/:id
```

### 4.7 `src/app/topic-map/my-topics/plan-idea-modal.tsx` (neu)

```typescript
// shadcn/ui <Dialog>
// Props: idea: TopicIdea, clusterId: string
//
// Felder:
//   - Keyword (Input, vorbelegt aus idea.keyword, readonly oder editierbar)
//   - Suchvolumen-Anzeige (read-only, aus idea.searchVolume)
//   - ☑ Als Main Keyword setzen (Checkbox, default: true)
//   - Ziel-URL:
//       Radio: "Bestehende URL auswählen" → Dropdown/Combobox aller URLs
//              "Neue URL eingeben"        → Text-Input
//   - Seitentyp: Select (Ratgeber / Kategorie / Marke / Produkt)
//   - Priorität: Select (Hoch / Mittel / Niedrig) → wird als priorityScore gesetzt
//
// Submit-Logik (API-Aufruf POST /api/topic-clusters/:id/ideas/:ideaId/promote):
//   1. Falls neue URL: POST /api/planning/keywords (neues URL+Keyword anlegen)
//      Falls bestehende URL: POST /api/topic-clusters/:id/urls (URL dem Cluster zuordnen)
//                           + POST /api/planning/keywords (Keyword zur URL hinzufügen)
//   2. topic_ideas Eintrag löschen (erledigt der promote-Endpoint)
//   3. url_topic_clusters Eintrag anlegen (erledigt der promote-Endpoint)
//   4. Toast: "Thema erfolgreich zur Planung hinzugefügt"
```

---

## 5. API: Promote-Endpoint

### `src/app/api/topic-clusters/[id]/ideas/[ideaId]/promote/route.ts` (neu)

**POST** — Idee in Planung überführen

```typescript
// Body: {
//   keyword: string;
//   isMainKeyword: boolean;
//   urlMode: 'existing' | 'new';
//   urlId?: string;          // wenn urlMode = 'existing'
//   newUrl?: string;          // wenn urlMode = 'new'
//   pageType: 'Ratgeber' | 'Kategorie' | 'Marke' | 'Produkt';
//   priority: 'high' | 'medium' | 'low';
// }
//
// Transaktions-Schritte:
//   1. Falls urlMode = 'new': urls-Eintrag anlegen
//   2. url_keywords-Eintrag anlegen (isMainKeyword aus Body)
//   3. planning_status-Eintrag anlegen (status: 'backlog')
//   4. url_topic_clusters-Eintrag anlegen (URL ↔ Cluster)
//   5. topic_ideas-Eintrag löschen
//   Response: { urlId, keywordId }
```

---

## 6. Custom Hooks

### `src/features/topic-map/hooks/use-topic-clusters.ts` (neu)

```typescript
// useSWR oder React Query oder fetch-basiert (je nach Projektmuster)
// Exportiert:
//   - clusters: TopicClusterWithStats[]
//   - isLoading: boolean
//   - createCluster(data): Promise<void>
//   - updateCluster(id, data): Promise<void>
//   - deleteCluster(id): Promise<void>
//   - addUrlToCluster(clusterId, urlId): Promise<void>
//   - removeUrlFromCluster(clusterId, urlId): Promise<void>
//   - refresh(): void
//
// Hinweis: Bestehende Hooks in /planning als Vorlage nehmen (SWR-Pattern prüfen)
```

---

## 7. Hauptseite zusammensetzen

### `src/app/topic-map/page.tsx` (Zusammenbau)

```
TopicMapPage
└── TopicMapTabs
    ├── Tab "Meine Topics"
    │   ├── Header-Row: Titel + "Cluster erstellen"-Button
    │   ├── ViewToggle (Sunburst / Tree / Tabelle)
    │   ├── {view === 'sunburst' && <ClusterSunburst />}
    │   ├── {view === 'tree'     && <ClusterTree />}
    │   └── {view === 'table'    && <ClusterTable />}
    │   └── ClusterDetailPanel (Sheet, controlled by selectedClusterId state)
    └── Tab "Topic Discovery"
        └── <DiscoveryPanel /> (Phase 3 — Placeholder bis Phase 3)
```

---

## Checkliste Phase 2

### Setup
- [ ] `npm install echarts echarts-for-react`

### API
- [ ] `src/app/api/topic-clusters/route.ts` (GET list mit Stats, POST create)
- [ ] `src/app/api/topic-clusters/[id]/route.ts` (GET detail, PATCH, DELETE)
- [ ] `src/app/api/topic-clusters/[id]/urls/route.ts` (GET, POST)
- [ ] `src/app/api/topic-clusters/[id]/urls/[urlId]/route.ts` (DELETE)
- [ ] `src/app/api/topic-clusters/[id]/ideas/route.ts` (GET, POST)
- [ ] `src/app/api/topic-clusters/[id]/ideas/[ideaId]/route.ts` (DELETE)
- [ ] `src/app/api/topic-clusters/[id]/ideas/[ideaId]/promote/route.ts` (POST)

### Frontend
- [ ] `src/app/topic-map/page.tsx`
- [ ] `src/app/topic-map/topic-map-tabs.tsx`
- [ ] `src/app/topic-map/my-topics/view-toggle.tsx`
- [ ] `src/app/topic-map/my-topics/cluster-sunburst.tsx`
- [ ] `src/app/topic-map/my-topics/cluster-tree.tsx`
- [ ] `src/app/topic-map/my-topics/cluster-table.tsx`
- [ ] `src/app/topic-map/my-topics/cluster-detail-panel.tsx`
- [ ] `src/app/topic-map/my-topics/create-cluster-modal.tsx`
- [ ] `src/app/topic-map/my-topics/plan-idea-modal.tsx`
- [ ] `src/features/topic-map/hooks/use-topic-clusters.ts`

### Test-Szenarien
- [ ] Cluster erstellen, bearbeiten, löschen
- [ ] URL zu Cluster hinzufügen und entfernen
- [ ] Idee manuell hinzufügen und löschen
- [ ] Idee über "Jetzt planen" in Planung überführen → erscheint in `/planning` Keyword Map
- [ ] Alle drei Ansichten wechseln (Sunburst / Tree / Tabelle)
- [ ] Cluster-Detail-Panel öffnen und schließen

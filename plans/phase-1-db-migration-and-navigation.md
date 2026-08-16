# Phase 1: Datenbankmigrationen & Navigation

## Ziel

Alle neuen DB-Tabellen anlegen und die Sidebar-Navigation in zwei benannte Sections aufteilen.
Diese Phase ist Voraussetzung für alle weiteren Phasen.

---

## 1. Drizzle Schema erweitern

**Datei:** `src/lib/db/schema.ts`

Am Ende der Datei (nach den bestehenden Tabellen) folgende 5 Tabellen ergänzen:

```typescript
// ---------------------------------------------------------------------------
// topic_clusters - Manually defined topic clusters
// ---------------------------------------------------------------------------
export const topicClusters = pgTable(
  'topic_clusters',
  {
    id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId:    text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    name:        text('name').notNull(),
    description: text('description'),
    color:       text('color').notNull().default('#6366f1'),
    createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx:   index('topic_clusters_tenant_idx').on(t.tenantId),
    nameUnique:  uniqueIndex('topic_clusters_name_tenant_idx').on(t.name, t.tenantId),
  })
);

// ---------------------------------------------------------------------------
// url_topic_clusters - Junction: URL ↔ Topic Cluster
// ---------------------------------------------------------------------------
export const urlTopicClusters = pgTable(
  'url_topic_clusters',
  {
    urlId:          text('url_id').notNull().references(() => urls.id, { onDelete: 'cascade' }),
    topicClusterId: text('topic_cluster_id').notNull().references(() => topicClusters.id, { onDelete: 'cascade' }),
    tenantId:       text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk:         primaryKey({ columns: [t.urlId, t.topicClusterId] }),
    tenantIdx:  index('url_topic_clusters_tenant_idx').on(t.tenantId),
    clusterIdx: index('url_topic_clusters_cluster_idx').on(t.topicClusterId),
  })
);

// ---------------------------------------------------------------------------
// topic_ideas - Unplanned topic ideas per cluster (from discovery or manual)
// ---------------------------------------------------------------------------
export const topicIdeas = pgTable(
  'topic_ideas',
  {
    id:               text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId:         text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    topicClusterId:   text('topic_cluster_id').notNull().references(() => topicClusters.id, { onDelete: 'cascade' }),
    keyword:          text('keyword').notNull(),
    searchVolume:     integer('search_volume'),
    keywordDifficulty: integer('keyword_difficulty'),
    source:           text('source').$type<'manual' | 'dataforseo'>().notNull().default('manual'),
    createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx:  index('topic_ideas_tenant_idx').on(t.tenantId),
    clusterIdx: index('topic_ideas_cluster_idx').on(t.topicClusterId),
  })
);

// ---------------------------------------------------------------------------
// journeys - Customer journey definitions
// ---------------------------------------------------------------------------
export const journeys = pgTable(
  'journeys',
  {
    id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId:    text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    name:        text('name').notNull(),
    description: text('description'),
    createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index('journeys_tenant_idx').on(t.tenantId),
  })
);

// ---------------------------------------------------------------------------
// journey_page_mappings - URL ↔ Journey phase assignments
// ---------------------------------------------------------------------------
export const journeyPageMappings = pgTable(
  'journey_page_mappings',
  {
    id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId:    text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    journeyId:   text('journey_id').notNull().references(() => journeys.id, { onDelete: 'cascade' }),
    urlId:       text('url_id').notNull().references(() => urls.id, { onDelete: 'cascade' }),
    funnelPhase: text('funnel_phase').$type<'awareness' | 'consideration' | 'decision' | 'retention'>().notNull(),
    createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    journeyUrlUnique: uniqueIndex('journey_page_mappings_journey_url_idx').on(t.journeyId, t.urlId),
    tenantIdx:        index('journey_page_mappings_tenant_idx').on(t.tenantId),
    journeyIdx:       index('journey_page_mappings_journey_idx').on(t.journeyId),
    phaseIdx:         index('journey_page_mappings_phase_idx').on(t.journeyId, t.funnelPhase),
  })
);
```

---

## 2. Drizzle Migration ausführen

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Migrationsdatei landet in `drizzle/` — prüfen ob alle 5 Tabellen korrekt angelegt wurden.

---

## 3. TypeScript-Typen anlegen

**Neue Datei:** `src/lib/db/topic-journey-types.ts`

```typescript
export type TopicCluster = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TopicClusterWithStats = TopicCluster & {
  urlCount: number;
  ideaCount: number;
  totalSearchVolume: number;
  avgRanking: number | null;
  statusBreakdown: {
    backlog: number;
    planned: number;
    inProgress: number;
    published: number;
  };
};

export type TopicIdea = {
  id: string;
  tenantId: string;
  topicClusterId: string;
  keyword: string;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  source: 'manual' | 'dataforseo';
  createdAt: Date;
};

export type Journey = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type JourneyWithStats = Journey & {
  totalMappings: number;
  phaseCoverage: {
    awareness: number;
    consideration: number;
    decision: number;
    retention: number;
  };
};

export type JourneyPageMapping = {
  id: string;
  tenantId: string;
  journeyId: string;
  urlId: string;
  funnelPhase: 'awareness' | 'consideration' | 'decision' | 'retention';
  createdAt: Date;
  // Joined URL data
  url?: string;
  pageType?: string;
  gscClicks?: number;
  planningStatus?: string;
};

export type FunnelPhase = 'awareness' | 'consideration' | 'decision' | 'retention';

export const FUNNEL_PHASES: { key: FunnelPhase; label: string; labelDe: string }[] = [
  { key: 'awareness',     label: 'Awareness',     labelDe: 'Bewusstsein'    },
  { key: 'consideration', label: 'Consideration',  labelDe: 'Überlegung'    },
  { key: 'decision',      label: 'Decision',       labelDe: 'Entscheidung'  },
  { key: 'retention',     label: 'Retention',      labelDe: 'Bindung'       },
];
```

---

## 4. Sidebar-Navigation restrukturieren

**Datei:** `src/components/app-sidebar.tsx`

### Änderung: Neue Section-Gruppen

Die bestehende flache Nav-Liste wird in zwei benannte Gruppen aufgeteilt.

**Neue Nav-Items für "Strategie"-Section:**
```typescript
{
  title: t('nav.topicMap'),      // "Topic Map"
  url: '/topic-map',
  icon: Network,                  // lucide-react: Network
},
{
  title: t('nav.journeys'),      // "Journey Mapping"
  url: '/journeys',
  icon: GitBranch,               // lucide-react: GitBranch
},
```

**Bestehende Items bleiben in "Content"-Section:**
- Content-Planung, Content-Erstellung, Content-Monitoring, Content-Historie

### Implementierungshinweis

Die `app-sidebar.tsx` nutzt bereits `SidebarGroup` / `SidebarGroupLabel` / `SidebarGroupContent` aus `@/components/ui/sidebar`. Die Umsetzung erfolgt durch:
1. Bestehende Nav-Items in zwei `SidebarGroup`-Blöcke aufteilen
2. Jeder Block bekommt ein `SidebarGroupLabel` ("Strategie" / "Content")
3. Neue Items in den Strategie-Block einfügen

---

## 5. i18n-Keys ergänzen

**Dateien:** `src/i18n/de.json` und `src/i18n/en.json`

### de.json — neue Keys:

```json
{
  "nav": {
    "topicMap": "Topic Map",
    "journeys": "Journey Mapping",
    "sectionStrategy": "Strategie",
    "sectionContent": "Content"
  },
  "topicMap": {
    "title": "Topic Map",
    "tabMyTopics": "Meine Topics",
    "tabDiscovery": "Topic Discovery",
    "createCluster": "Cluster erstellen",
    "editCluster": "Cluster bearbeiten",
    "deleteCluster": "Cluster löschen",
    "clusterName": "Cluster-Name",
    "clusterDescription": "Beschreibung",
    "clusterColor": "Farbe",
    "urlCount": "URLs",
    "ideaCount": "Ideen",
    "totalSearchVolume": "Gesamt-Suchvolumen",
    "noMainKeyword": "Kein Main Keyword",
    "viewSunburst": "Wheel",
    "viewTree": "Tree",
    "viewTable": "Tabelle",
    "planIdea": "Jetzt planen",
    "adoptIdea": "Übernehmen",
    "addIdeaManual": "Idee manuell hinzufügen",
    "deleteIdea": "Idee entfernen",
    "empty": "Noch keine Cluster angelegt.",
    "emptyIdeas": "Keine Ideen in diesem Cluster."
  },
  "topicDiscovery": {
    "title": "Topic Discovery",
    "description": "Themenvorschläge auf Basis deiner bestehenden Cluster",
    "loading": "Vorschläge werden geladen...",
    "noSuggestions": "Keine Vorschläge gefunden.",
    "searchVolume": "Suchvolumen",
    "difficulty": "Schwierigkeit",
    "assignToCluster": "Cluster",
    "adopt": "Übernehmen",
    "alreadyCovered": "Bereits abgedeckt",
    "refresh": "Neu laden"
  },
  "planIdeaModal": {
    "title": "Thema zur Planung hinzufügen",
    "keyword": "Keyword",
    "targetUrl": "Ziel-URL",
    "selectExistingUrl": "Bestehende URL auswählen",
    "enterNewUrl": "Neue URL eingeben",
    "pageType": "Seitentyp",
    "priority": "Priorität",
    "isMainKeyword": "Als Main Keyword setzen",
    "submit": "Zur Planung hinzufügen",
    "cancel": "Abbrechen"
  },
  "journeys": {
    "title": "Journey Mapping",
    "createJourney": "Journey erstellen",
    "editJourney": "Journey bearbeiten",
    "deleteJourney": "Journey löschen",
    "journeyName": "Journey-Name",
    "journeyDescription": "Beschreibung",
    "addPage": "Seite hinzufügen",
    "removePage": "Seite entfernen",
    "selectPhase": "Phase wählen",
    "coverage": "Abdeckung",
    "empty": "Noch keine Journeys angelegt.",
    "emptyPhase": "Keine Seiten in dieser Phase.",
    "phases": {
      "awareness": "Awareness",
      "consideration": "Consideration",
      "decision": "Decision",
      "retention": "Retention"
    },
    "urlPickerTitle": "Seite hinzufügen",
    "urlPickerSearch": "URL oder Keyword suchen...",
    "urlPickerEmpty": "Keine passenden Seiten gefunden."
  }
}
```

### en.json — neue Keys (analog, auf Englisch):

```json
{
  "nav": {
    "topicMap": "Topic Map",
    "journeys": "Journey Mapping",
    "sectionStrategy": "Strategy",
    "sectionContent": "Content"
  },
  "topicMap": {
    "title": "Topic Map",
    "tabMyTopics": "My Topics",
    "tabDiscovery": "Topic Discovery",
    "createCluster": "Create cluster",
    "editCluster": "Edit cluster",
    "deleteCluster": "Delete cluster",
    "clusterName": "Cluster name",
    "clusterDescription": "Description",
    "clusterColor": "Color",
    "urlCount": "URLs",
    "ideaCount": "Ideas",
    "totalSearchVolume": "Total search volume",
    "noMainKeyword": "No main keyword",
    "viewSunburst": "Wheel",
    "viewTree": "Tree",
    "viewTable": "Table",
    "planIdea": "Plan now",
    "adoptIdea": "Adopt",
    "addIdeaManual": "Add idea manually",
    "deleteIdea": "Remove idea",
    "empty": "No clusters created yet.",
    "emptyIdeas": "No ideas in this cluster."
  },
  "topicDiscovery": {
    "title": "Topic Discovery",
    "description": "Topic suggestions based on your existing clusters",
    "loading": "Loading suggestions...",
    "noSuggestions": "No suggestions found.",
    "searchVolume": "Search volume",
    "difficulty": "Difficulty",
    "assignToCluster": "Cluster",
    "adopt": "Adopt",
    "alreadyCovered": "Already covered",
    "refresh": "Refresh"
  },
  "planIdeaModal": {
    "title": "Add topic to planning",
    "keyword": "Keyword",
    "targetUrl": "Target URL",
    "selectExistingUrl": "Select existing URL",
    "enterNewUrl": "Enter new URL",
    "pageType": "Page type",
    "priority": "Priority",
    "isMainKeyword": "Set as main keyword",
    "submit": "Add to planning",
    "cancel": "Cancel"
  },
  "journeys": {
    "title": "Journey Mapping",
    "createJourney": "Create journey",
    "editJourney": "Edit journey",
    "deleteJourney": "Delete journey",
    "journeyName": "Journey name",
    "journeyDescription": "Description",
    "addPage": "Add page",
    "removePage": "Remove page",
    "selectPhase": "Select phase",
    "coverage": "Coverage",
    "empty": "No journeys created yet.",
    "emptyPhase": "No pages in this phase.",
    "phases": {
      "awareness": "Awareness",
      "consideration": "Consideration",
      "decision": "Decision",
      "retention": "Retention"
    },
    "urlPickerTitle": "Add page",
    "urlPickerSearch": "Search URL or keyword...",
    "urlPickerEmpty": "No matching pages found."
  }
}
```

---

## Checkliste Phase 1

- [ ] `src/lib/db/schema.ts` — 5 neue Tabellen ergänzen
- [ ] `npx drizzle-kit generate` ausführen und Migration prüfen
- [ ] `npx drizzle-kit migrate` ausführen und Tabellen in DB verifizieren
- [ ] `src/lib/db/topic-journey-types.ts` erstellen
- [ ] `src/components/app-sidebar.tsx` — Sidebar-Sections + neue Icons + neue Nav-Items
- [ ] `src/i18n/de.json` — neue Keys ergänzen
- [ ] `src/i18n/en.json` — neue Keys ergänzen
- [ ] Lokalen Dev-Server starten und Navigation testen (Links führen noch zu 404 — OK in Phase 1)

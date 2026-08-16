# Phase 3: Topic Discovery

## Ziel

Den "Topic Discovery" Tab der Topic Map Seite befüllen: DataForSEO-basierte Keyword-Ideen
auf Basis bestehender Cluster, Gap-Analyse gegen vorhandene URLs, Übernahme als `topic_ideas`.

**Voraussetzung:** Phase 1 + Phase 2 abgeschlossen

---

## 1. DataForSEO-Integration erweitern

**Datei:** `src/lib/dataforseo.ts`

Die bestehende Datei kennt nur den SERP-Endpunkt für Ranking-Checks.
Folgende Funktion ergänzen (am Ende der Datei):

```typescript
export interface KeywordIdeaResult {
  keyword: string;
  searchVolume: number | null;
  keywordDifficulty: number | null;  // 0–100 (DataForSEO Labs Endpoint)
  competition: number | null;        // 0–1
  cpc: number | null;
}

/**
 * Fetches keyword ideas for a list of seed keywords.
 * Uses DataForSEO Labs: Google Keyword Ideas (live).
 *
 * Docs: POST /v3/dataforseo_labs/google/keyword_ideas/live
 *
 * @param seedKeywords - Array of seed keywords (e.g. cluster names)
 * @param username     - DataForSEO username
 * @param password     - DataForSEO password
 * @param languageCode - ISO language code, default "de"
 * @param locationCode - DataForSEO location code, default 2276 (Germany)
 * @param limit        - Max results per request, default 100
 */
export async function fetchKeywordIdeas(
  seedKeywords: string[],
  username: string,
  password: string,
  languageCode = 'de',
  locationCode = 2276,
  limit = 100
): Promise<KeywordIdeaResult[]> {
  if (!seedKeywords.length) return [];
  if (!username || !password) throw new Error('DataForSEO credentials missing');

  const auth = buildAuthHeader(username, password);

  const body = [{
    keywords:      seedKeywords.slice(0, 200), // DataForSEO max: 200 seed keywords
    language_code: languageCode,
    location_code: locationCode,
    limit,
    include_seed_keyword: false,
    filters: [
      ['keyword_info.search_volume', '>', 100], // Mindest-Suchvolumen filtern
    ],
  }];

  const response = await fetch(
    `${DATAFORSEO_BASE}/dataforseo_labs/google/keyword_ideas/live`,
    {
      method: 'POST',
      headers: {
        Authorization:  auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`DataForSEO Keyword Ideas request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const json = await response.json();
  const items: any[] = json?.tasks?.[0]?.result?.[0]?.items ?? [];

  return items.map((item: any) => ({
    keyword:           item.keyword ?? '',
    searchVolume:      item.keyword_info?.search_volume ?? null,
    keywordDifficulty: item.keyword_properties?.keyword_difficulty ?? null,
    competition:       item.keyword_info?.competition ?? null,
    cpc:               item.keyword_info?.cpc ?? null,
  }));
}
```

---

## 2. Discovery API Route

### `src/app/api/topic-clusters/discovery/route.ts` (neu)

**POST** — Discovery-Anfrage starten

```typescript
// Body: {
//   clusterIds?: string[];  // optional: nur bestimmte Cluster; leer = alle
//   limit?: number;          // max Ergebnisse pro Seed, default 50
// }
//
// Logik:
//   1. Session + Tenant prüfen
//   2. DataForSEO-Credentials aus config Tabelle laden (key: 'dataforseo_username' / 'dataforseo_password')
//   3. Cluster-Namen als Seed-Keywords laden:
//        SELECT name FROM topic_clusters WHERE tenant_id = :tenantId [AND id IN :clusterIds]
//   4. fetchKeywordIdeas(clusterNames, username, password, ...) aufrufen
//   5. Bestehende Keywords des Tenants laden (alle url_keywords.keyword):
//        SELECT LOWER(keyword) FROM url_keywords WHERE tenant_id = :tenantId
//   6. Bestehende Ideen des Tenants laden (alle topic_ideas.keyword):
//        SELECT LOWER(keyword) FROM topic_ideas WHERE tenant_id = :tenantId
//   7. Results filtern: Suggestions die bereits in url_keywords ODER topic_ideas sind → markieren als 'alreadyCovered: true'
//   8. Response: {
//        suggestions: Array<KeywordIdeaResult & {
//          alreadyCovered: boolean;
//          suggestedClusterId: string | null;  // best-match Cluster (optional, einfach weglassen in V1)
//        }>
//      }
//
// Response-Caching: Ergebnis 1 Stunde im Speicher cachen (oder via next fetch cache)
// Fehlerfall: DataForSEO nicht konfiguriert → 400 mit Hinweis auf Admin-Einstellungen
```

---

## 3. Frontend — Discovery Panel

### 3.1 `src/app/topic-map/discovery/discovery-panel.tsx` (neu)

```typescript
// Client Component
// State:
//   - suggestions: (KeywordIdeaResult & { alreadyCovered: boolean })[]
//   - isLoading: boolean
//   - selectedClusterId: string | null (für Übernahme)
//   - adoptIdeaModalOpen: boolean
//   - selectedIdea: KeywordIdeaResult | null
//
// Layout:
//   ┌──────────────────────────────────────────────────────────────┐
//   │ Topic Discovery                                              │
//   │ "Themenvorschläge auf Basis deiner bestehenden Cluster"      │
//   │                                    [Neu laden] [Filter ▼]   │
//   ├──────────────────────────────────────────────────────────────┤
//   │ Filter-Bar (optional):                                       │
//   │   Suchvolumen: [>100 ▼]   Schwierigkeit: [<70 ▼]           │
//   │   Zeige: ○ Alle  ○ Nur neue (nicht abgedeckt)               │
//   ├──────────────────────────────────────────────────────────────┤
//   │ Suggestion-Liste (scrollbar):                               │
//   │   <SuggestionCard /> × n                                    │
//   └──────────────────────────────────────────────────────────────┘
//
// Beim ersten Laden: POST /api/topic-clusters/discovery automatisch aufrufen
// "Neu laden" Button: erneuter API-Aufruf
```

### 3.2 `src/app/topic-map/discovery/suggestion-card.tsx` (neu)

```typescript
// Props: suggestion: KeywordIdeaResult & { alreadyCovered: boolean }
//        onAdopt: (suggestion) => void
//        clusters: TopicCluster[]  (für Cluster-Dropdown)
//
// Layout einer Karte:
//   ┌────────────────────────────────────────────────────┐
//   │ [✅ Bereits abgedeckt] ODER [💡 Neue Idee]         │
//   │ "vitamin b12 vegan"                                │
//   │ 12.100 Suchen  ·  KD: 38  ·  CPC: €0.42           │
//   │                                                    │
//   │ Cluster: [Vitamine ▼]              [Übernehmen]   │
//   └────────────────────────────────────────────────────┘
//
// Wenn alreadyCovered = true:
//   - Karte ausgegraut + "Bereits abgedeckt"-Badge
//   - Kein "Übernehmen"-Button
// Wenn alreadyCovered = false:
//   - Cluster-Select vorbelegt mit best-guess (oder leer)
//   - "Übernehmen" Button aktiv wenn Cluster ausgewählt
//   - Klick → onAdopt({ ...suggestion, selectedClusterId })
```

### 3.3 `src/app/topic-map/discovery/adopt-idea-modal.tsx` (neu)

```typescript
// Bestätigung-Modal beim Klick auf "Übernehmen"
// Props: idea: KeywordIdeaResult, clusterId: string, onConfirm, onCancel
//
// Zeigt:
//   - Keyword + Stats
//   - Gewählter Cluster-Name
//   - Hinweis: "Wird als Idee im Cluster gespeichert.
//               Von dort aus kannst du es direkt zur Planung hinzufügen."
//   - [Abbrechen]  [Als Idee speichern]
//
// Beim Bestätigen:
//   POST /api/topic-clusters/:clusterId/ideas
//   Body: { keyword, searchVolume, keywordDifficulty, source: 'dataforseo' }
//   Nach Erfolg: Toast "Idee gespeichert" + Modal schließen + Panel refreshen
```

---

## 4. Custom Hook

### `src/features/topic-map/hooks/use-topic-discovery.ts` (neu)

```typescript
// Exportiert:
//   - suggestions: (KeywordIdeaResult & { alreadyCovered: boolean })[]
//   - isLoading: boolean
//   - error: string | null
//   - refresh(clusterIds?: string[]): Promise<void>
//   - adoptIdea(idea, clusterId): Promise<void>
//
// adoptIdea ruft POST /api/topic-clusters/:clusterId/ideas auf
// und aktualisiert danach den Cluster-Cache aus use-topic-clusters
```

---

## 5. Fehlerfälle behandeln

### DataForSEO nicht konfiguriert

Wenn kein DataForSEO-Credential im Admin hinterlegt ist:

```typescript
// discovery-panel.tsx zeigt:
//   ⚠️ "DataForSEO ist nicht konfiguriert."
//      "Bitte hinterlege deine Zugangsdaten unter Admin → Integrationen."
//      [Zu den Einstellungen →]  (Link zu /admin?tab=integrations)
```

### Keine Cluster vorhanden

```typescript
// Wenn tenant hat 0 Cluster:
//   💡 "Erstelle zunächst Topic Cluster unter 'Meine Topics'."
//      [Zum Tab 'Meine Topics']
```

---

## 6. Ideen-CRUD API Route (aus Phase 2, vervollständigen)

### `src/app/api/topic-clusters/[id]/ideas/route.ts`

**POST** — Idee hinzufügen (manuell oder aus Discovery)

```typescript
// Body: {
//   keyword: string;
//   searchVolume?: number;
//   keywordDifficulty?: number;
//   source: 'manual' | 'dataforseo';
// }
// Validierung: keyword nicht leer, topic_cluster_id muss zum Tenant gehören
// Duplikat-Check: gleicher keyword (case-insensitive) im selben Cluster → 409
```

---

## Checkliste Phase 3

### Backend
- [ ] `src/lib/dataforseo.ts` — `fetchKeywordIdeas` Funktion ergänzen
- [ ] `src/app/api/topic-clusters/discovery/route.ts` — Discovery-Endpunkt
- [ ] `src/app/api/topic-clusters/[id]/ideas/route.ts` — POST (Idee hinzufügen)
- [ ] Duplikat-Check + Fehlerbehandlung in ideas-Route

### Frontend
- [ ] `src/app/topic-map/discovery/discovery-panel.tsx`
- [ ] `src/app/topic-map/discovery/suggestion-card.tsx`
- [ ] `src/app/topic-map/discovery/adopt-idea-modal.tsx`
- [ ] `src/features/topic-map/hooks/use-topic-discovery.ts`
- [ ] Discovery-Panel in `topic-map-tabs.tsx` einbinden (ersetzt Placeholder aus Phase 2)

### Test-Szenarien
- [ ] DataForSEO konfiguriert: Vorschläge erscheinen korrekt
- [ ] DataForSEO nicht konfiguriert: Hinweis-Banner erscheint
- [ ] Bereits abgedeckte Keywords werden korrekt markiert
- [ ] "Übernehmen" → Bestätigungs-Modal → Idee erscheint im Cluster-Detail-Panel
- [ ] Manuelle Idee hinzufügen funktioniert (source: 'manual')
- [ ] Duplikat-Versuch zeigt Fehlermeldung

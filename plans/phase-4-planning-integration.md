# Phase 4: Planning-Integration (Topic Cluster Spalte)

## Ziel

Die bestehende Keyword Map in `/planning` um eine "Topic Cluster"-Spalte erweitern,
über die URLs direkt einem Cluster zugewiesen werden können (Inline-Dropdown).

**Voraussetzung:** Phase 1 + Phase 2 abgeschlossen

---

## 1. `KeywordMap` Typ erweitern

**Datei:** `src/lib/postgres-types.ts`

```typescript
// In KeywordMap interface ergänzen:
export interface KeywordMap {
  // ... bestehende Felder ...

  /** ID des zugeordneten Topic Clusters (null = kein Cluster) */
  topicClusterId?: string | null;
  /** Name des zugeordneten Topic Clusters (für Anzeige) */
  topicClusterName?: string | null;
  /** Farbe des zugeordneten Topic Clusters (für Farb-Dot) */
  topicClusterColor?: string | null;
}
```

---

## 2. Datenbankabfrage erweitern

**Datei:** `src/lib/postgres.ts`

Die Funktion, die `KeywordMap`-Einträge lädt (vermutlich `getKeywordMap` oder äquivalent),
muss einen LEFT JOIN auf `url_topic_clusters` und `topic_clusters` ergänzen:

```sql
-- In der bestehenden Keyword-Map-Query ergänzen:
LEFT JOIN url_topic_clusters utc ON utc.url_id = uk.url_id
                                 AND utc.tenant_id = uk.tenant_id
LEFT JOIN topic_clusters tc      ON tc.id = utc.topic_cluster_id

-- In SELECT ergänzen:
tc.id   AS topic_cluster_id,
tc.name AS topic_cluster_name,
tc.color AS topic_cluster_color
```

Drizzle ORM Variante:

```typescript
// In der bestehenden query chain ergänzen:
.leftJoin(urlTopicClusters, and(
  eq(urlTopicClusters.urlId, urls.id),
  eq(urlTopicClusters.tenantId, tenants.id)
))
.leftJoin(topicClusters, eq(topicClusters.id, urlTopicClusters.topicClusterId))
```

Und im Result-Mapping:
```typescript
topicClusterId:    row.topic_cluster_id ?? null,
topicClusterName:  row.topic_cluster_name ?? null,
topicClusterColor: row.topic_cluster_color ?? null,
```

**Hinweis:** Falls eine URL in mehreren Clustern ist, liefert der LEFT JOIN mehrere Zeilen.
In V1 ist die Annahme: eine URL ↔ ein Cluster. Falls mehrere Cluster pro URL nötig werden,
muss `url_topic_clusters` als Array behandelt werden. Für V1 reicht der LEFT JOIN mit
"erstem Treffer" (kein DISTINCT nötig, da unique constraint auf url_id+topic_cluster_id).

---

## 3. Neue Spalte in keyword-columns.tsx

**Datei:** `src/features/planning/components/keyword-columns.tsx`

```typescript
// Import ergänzen:
import { TopicCluster } from '@/lib/db/topic-journey-types';

// Neue Spalte — nach "Target_URL" Spalte einfügen:
{
  id: 'topicCluster',
  accessorKey: 'topicClusterId',
  header: 'Topic Cluster',
  size: 160,
  enableSorting: true,
  enableColumnFilter: true,
  cell: ({ row, table }) => {
    const clusterId    = row.original.topicClusterId;
    const clusterName  = row.original.topicClusterName;
    const clusterColor = row.original.topicClusterColor;
    const clusters     = (table.options.meta as any)?.clusters ?? [];

    return (
      <TopicClusterCell
        urlId={row.original.id}
        clusterId={clusterId ?? null}
        clusterName={clusterName ?? null}
        clusterColor={clusterColor ?? null}
        clusters={clusters}
        onAssign={(newClusterId) => (table.options.meta as any)?.onClusterAssign?.(row.original.id, newClusterId)}
      />
    );
  },
},
```

---

## 4. `TopicClusterCell` Komponente

**Neue Datei:** `src/features/planning/components/topic-cluster-cell.tsx`

```typescript
// Props:
//   urlId: string
//   clusterId: string | null
//   clusterName: string | null
//   clusterColor: string | null
//   clusters: TopicCluster[]      ← verfügbare Cluster zum Auswählen
//   onAssign: (clusterId: string | null) => void
//
// Render-Logik:
//   Wenn kein Cluster zugewiesen:
//     → Graues "+" Button-Badge: "Cluster zuweisen"
//     → Klick → Popover mit Cluster-Liste
//
//   Wenn Cluster zugewiesen:
//     → Farbiger Dot + Cluster-Name (truncated)
//     → Klick → Popover mit Cluster-Liste + "Entfernen"-Option
//
// Popover-Inhalt:
//   - Suchfeld (filter clusters by name)
//   - Liste aller Cluster (je mit Farb-Dot + Name)
//   - Ganz unten: "Entfernen" (wenn aktuell ein Cluster zugewiesen)
//   - "Neuen Cluster erstellen" Link → öffnet CreateClusterModal
//     (oder navigiert zu /topic-map)
//
// Bei Auswahl:
//   → onAssign(newClusterId) aufrufen
//   → API-Call im Parent (keyword-table.tsx) oder direkt hier:
//       PUT /api/topic-clusters/:clusterId/urls  (add)
//       DELETE /api/topic-clusters/:oldClusterId/urls/:urlId  (remove old)
//
// Wichtig: Klick auf Popover darf nicht die Zeilen-Auswahl triggern
//   → stopPropagation() auf Wrapper-Element
```

---

## 5. Table Meta erweitern

**Datei:** `src/app/planning/keyword-table.tsx`

Das TanStack Table `meta`-Objekt muss die Cluster-Liste und den Assignment-Handler übergeben:

```typescript
// Im useReactTable-Aufruf:
meta: {
  clusters: clusters, // aus useClusters-Hook
  onClusterAssign: async (urlId: string, clusterId: string | null) => {
    await handleClusterAssign(urlId, clusterId);
  },
},
```

```typescript
// handleClusterAssign Logik:
async function handleClusterAssign(urlId: string, newClusterId: string | null) {
  const row = data.find(d => d.id === urlId);
  const oldClusterId = row?.topicClusterId;

  // Optimistic Update in lokaler State
  setData(prev => prev.map(r =>
    r.id === urlId
      ? { ...r, topicClusterId: newClusterId,
               topicClusterName: clusters.find(c => c.id === newClusterId)?.name ?? null,
               topicClusterColor: clusters.find(c => c.id === newClusterId)?.color ?? null }
      : r
  ));

  try {
    // Alten Cluster entfernen (falls vorhanden)
    if (oldClusterId) {
      await fetch(`/api/topic-clusters/${oldClusterId}/urls/${urlId}`, { method: 'DELETE' });
    }
    // Neuen Cluster zuweisen (falls nicht null)
    if (newClusterId) {
      await fetch(`/api/topic-clusters/${newClusterId}/urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlId }),
      });
    }
  } catch {
    // Rollback bei Fehler
    setData(prev => prev.map(r =>
      r.id === urlId
        ? { ...r, topicClusterId: oldClusterId,
                 topicClusterName: row?.topicClusterName ?? null,
                 topicClusterColor: row?.topicClusterColor ?? null }
        : r
    ));
    toast.error('Cluster-Zuweisung fehlgeschlagen');
  }
}
```

---

## 6. Cluster-Daten in Planning-Seite laden

**Datei:** `src/app/planning/page.tsx` (oder dem übergeordneten Client-Component)

```typescript
// Cluster-Daten parallel zu Keyword-Daten laden:
const { clusters } = useTopicClusters(); // Hook aus Phase 2
// An KeywordTable weitergeben über Props oder Context
```

---

## 7. Filter-Option für Topic Cluster

In der `KeywordFilterBar`-Komponente einen optionalen Filter für "Topic Cluster" ergänzen:

```typescript
// Neues Filter-Dropdown: "Topic Cluster"
// Zeigt alle Cluster des Tenants
// Filtert die Tabelle nach topicClusterId
// Sonderfall: "Ohne Cluster" = zeigt nur Rows wo topicClusterId null
```

---

## Checkliste Phase 4

- [ ] `src/lib/postgres-types.ts` — `KeywordMap` um `topicClusterId`, `topicClusterName`, `topicClusterColor` erweitern
- [ ] `src/lib/postgres.ts` — Keyword-Map-Query mit LEFT JOIN auf `url_topic_clusters` + `topic_clusters` erweitern
- [ ] `src/features/planning/components/keyword-columns.tsx` — neue "Topic Cluster"-Spalte einfügen
- [ ] `src/features/planning/components/topic-cluster-cell.tsx` — neue Komponente erstellen
- [ ] `src/app/planning/keyword-table.tsx` — `meta.clusters` + `meta.onClusterAssign` übergeben
- [ ] `src/app/planning/page.tsx` — Cluster-Daten laden und an Keyword-Table weitergeben
- [ ] Optionaler Filter für Topic Cluster in FilterBar

### Test-Szenarien
- [ ] Keyword Map lädt korrekt — neue Spalte erscheint und ist per Drag sortierbar
- [ ] Cluster zuweisen: Popover öffnet, Auswahl speichert korrekt
- [ ] Cluster wechseln: Alter Cluster wird entfernt, neuer gesetzt
- [ ] Cluster entfernen: URL hat wieder keinen Cluster
- [ ] URL die über "Jetzt planen" (Phase 3) angelegt wurde hat korrekt Cluster zugewiesen
- [ ] Filter nach Topic Cluster funktioniert

"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { useTopicClusters } from '@/features/topic-map/hooks/use-topic-clusters';
import { TopicClusterWithStats } from '@/lib/db/topic-journey-types';
import { ViewToggle, ViewType } from './view-toggle';
import { ClusterTable } from './cluster-table';
import { ClusterSunburst } from './cluster-sunburst';
import { ClusterTree } from './cluster-tree';
import { ClusterDetailPanel } from './cluster-detail-panel';
import { CreateClusterModal } from './create-cluster-modal';

export function MyTopicsTab() {
  const { t } = useI18n();
  const { clusters, isLoading, refresh, createCluster, updateCluster, deleteCluster } = useTopicClusters();
  const [view, setView] = useState<ViewType>('table');
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState<TopicClusterWithStats | null>(null);

  useEffect(() => { refresh(); }, [refresh]);

  const handleEdit = (cluster: TopicClusterWithStats) => {
    setEditingCluster(cluster);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Cluster wirklich löschen?')) return;
    await deleteCluster(id);
    if (selectedClusterId === id) setSelectedClusterId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ViewToggle view={view} onChange={setView} />
        <Button onClick={() => { setEditingCluster(null); setModalOpen(true); }} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t('topicMap.createCluster')}
        </Button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">{t('common.loading')}</div>}

      {!isLoading && clusters.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">{t('topicMap.empty')}</div>
      )}

      {!isLoading && clusters.length > 0 && (
        <>
          {view === 'sunburst' && (
            <ClusterSunburst clusters={clusters} onClusterClick={setSelectedClusterId} />
          )}
          {view === 'tree' && (
            <ClusterTree clusters={clusters} onClusterClick={setSelectedClusterId} />
          )}
          {view === 'table' && (
            <ClusterTable
              clusters={clusters}
              onClusterClick={setSelectedClusterId}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </>
      )}

      <ClusterDetailPanel
        clusterId={selectedClusterId}
        onClose={() => setSelectedClusterId(null)}
        onClustersRefresh={refresh}
      />

      <CreateClusterModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        cluster={editingCluster}
        allClusters={clusters}
        onCreate={createCluster}
        onUpdate={(id, data) => updateCluster(id, data)}
      />
    </div>
  );
}

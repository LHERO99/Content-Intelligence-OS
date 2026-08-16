"use client";

import { TopicClusterWithStats } from '@/lib/db/topic-journey-types';
import { useI18n } from '@/i18n/use-i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';

interface Props {
  clusters: TopicClusterWithStats[];
  onClusterClick: (id: string) => void;
  onEdit: (cluster: TopicClusterWithStats) => void;
  onDelete: (id: string) => void;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('de-DE');
}

export function ClusterTable({ clusters, onClusterClick, onEdit, onDelete }: Props) {
  const { t } = useI18n();

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Name</th>
            <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Beschreibung</th>
            <th className="text-right px-4 py-3 font-medium">{t('topicMap.urlCount')}</th>
            <th className="text-right px-4 py-3 font-medium">{t('topicMap.ideaCount')}</th>
            <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">{t('topicMap.totalSearchVolume')}</th>
            <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">Ø Ranking</th>
            <th className="w-20 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {clusters.map((cluster) => (
            <tr
              key={cluster.id}
              className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => onClusterClick(cluster.id)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cluster.color }}
                  />
                  <span className="font-medium">{cluster.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                <span className="truncate max-w-[200px] block">{cluster.description ?? '—'}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <Badge variant="secondary">{cluster.urlCount}</Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <Badge variant="outline">{cluster.ideaCount}</Badge>
              </td>
              <td className="px-4 py-3 text-right hidden lg:table-cell">
                {fmt(cluster.totalSearchVolume)}
              </td>
              <td className="px-4 py-3 text-right hidden lg:table-cell">
                {cluster.avgRanking != null ? `#${Math.round(cluster.avgRanking)}` : '—'}
              </td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(cluster)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(cluster.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

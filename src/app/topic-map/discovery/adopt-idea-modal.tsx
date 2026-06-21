"use client";

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/i18n/use-i18n';
import { SuggestionWithCoverage } from '@/features/topic-map/hooks/use-topic-discovery';
import { TopicClusterWithStats } from '@/lib/db/topic-journey-types';
import { toast } from 'sonner';

interface Props {
  idea: SuggestionWithCoverage & { _selectedClusterId?: string };
  clusters: TopicClusterWithStats[];
  onConfirm: (clusterId: string) => Promise<void>;
  onCancel: () => void;
}

export function AdoptIdeaModal({ idea, clusters, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  const [clusterId, setClusterId] = useState((idea as any)._selectedClusterId ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCluster = clusters.find((c) => c.id === clusterId);

  const handleConfirm = async () => {
    if (!clusterId) return;
    setIsSubmitting(true);
    try {
      await onConfirm(clusterId);
      toast.success('Idee gespeichert');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('topicDiscovery.adopt')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-muted rounded-md">
            <div className="font-medium">{idea.keyword}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {idea.searchVolume != null && `${idea.searchVolume.toLocaleString('de-DE')} Suchen`}
              {idea.keywordDifficulty != null && ` · KD: ${idea.keywordDifficulty}`}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('topicDiscovery.assignToCluster')}</label>
            <Select value={clusterId} onValueChange={setClusterId}>
              <SelectTrigger>
                <SelectValue placeholder="Cluster auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {clusters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCluster && (
            <p className="text-sm text-muted-foreground">
              Wird als Idee im Cluster <strong>{selectedCluster.name}</strong> gespeichert.
              Von dort aus kannst du es direkt zur Planung hinzufügen.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{t('planIdeaModal.cancel')}</Button>
          <Button onClick={handleConfirm} disabled={!clusterId || isSubmitting}>
            {isSubmitting ? 'Speichern...' : 'Als Idee speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

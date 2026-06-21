"use client";

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/i18n/use-i18n';
import { TopicClusterWithStats } from '@/lib/db/topic-journey-types';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster?: TopicClusterWithStats | null;
  allClusters: TopicClusterWithStats[];
  onCreate: (data: { name: string; description?: string; color?: string; parentId?: string | null }) => Promise<any>;
  onUpdate: (id: string, data: { name?: string; description?: string; color?: string; parentId?: string | null }) => Promise<any>;
}

export function CreateClusterModal({ open, onOpenChange, cluster, allClusters, onCreate, onUpdate }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [parentId, setParentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = !!cluster;

  // Eligible parents: all clusters except the cluster being edited and its descendants
  const getDescendantIds = (id: string, flat: TopicClusterWithStats[]): Set<string> => {
    const ids = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift()!;
      ids.add(cur);
      flat.filter(c => c.parentId === cur).forEach(c => queue.push(c.id));
    }
    return ids;
  };

  const eligibleParents = isEdit && cluster
    ? allClusters.filter(c => !getDescendantIds(cluster.id, allClusters).has(c.id))
    : allClusters;

  useEffect(() => {
    if (open) {
      setName(cluster?.name ?? '');
      setDescription(cluster?.description ?? '');
      setColor(cluster?.color ?? PRESET_COLORS[0]);
      setParentId(cluster?.parentId ?? null);
    }
  }, [open, cluster]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      if (isEdit && cluster) {
        await onUpdate(cluster.id, { name: name.trim(), description: description.trim() || undefined, color, parentId });
      } else {
        await onCreate({ name: name.trim(), description: description.trim() || undefined, color, parentId });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('topicMap.editCluster') : t('topicMap.createCluster')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t('topicMap.clusterName')} *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Vitamine & Nahrungsergänzung"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Übergeordnetes Thema <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={parentId ?? '__none__'} onValueChange={(v) => setParentId(v === '__none__' ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Kein übergeordnetes Thema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Kein übergeordnetes Thema</SelectItem>
                {eligibleParents
                  .filter(c => !isEdit || c.id !== cluster?.id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('topicMap.clusterDescription')}</Label>
            <textarea
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="Optionale Beschreibung..."
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('topicMap.clusterColor')}</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-0"
                title="Eigene Farbe wählen"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('planIdeaModal.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting}>
            {isSubmitting ? 'Speichern...' : isEdit ? 'Aktualisieren' : 'Erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

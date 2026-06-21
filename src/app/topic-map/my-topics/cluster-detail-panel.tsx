"use client";

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n/use-i18n';
import { useClusterDetail } from '@/features/topic-map/hooks/use-topic-clusters';
import { TopicIdea } from '@/lib/db/topic-journey-types';
import { X, Plus, Lightbulb, Link2 } from 'lucide-react';
import { PlanIdeaModal } from './plan-idea-modal';
import { toast } from 'sonner';

interface Props {
  clusterId: string | null;
  onClose: () => void;
  onClustersRefresh: () => void;
}

function statusColor(status?: string) {
  if (!status) return 'secondary';
  if (status === 'published') return 'default';
  if (status === 'planned') return 'outline';
  return 'secondary';
}

export function ClusterDetailPanel({ clusterId, onClose, onClustersRefresh }: Props) {
  const { t } = useI18n();
  const { detail, isLoading, refresh, deleteIdea, addIdea } = useClusterDetail(clusterId);
  const [planIdea, setPlanIdea] = useState<TopicIdea | null>(null);
  const [addingIdea, setAddingIdea] = useState(false);
  const [newIdeaKw, setNewIdeaKw] = useState('');

  useEffect(() => { if (clusterId) refresh(); }, [clusterId, refresh]);

  const handleAddIdea = async () => {
    if (!newIdeaKw.trim()) return;
    try {
      await addIdea({ keyword: newIdeaKw.trim(), source: 'manual' });
      setNewIdeaKw('');
      setAddingIdea(false);
      onClustersRefresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <Sheet open={!!clusterId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-[520px] max-w-full overflow-y-auto">
          {isLoading && <div className="p-6 text-muted-foreground">{t('common.loading')}</div>}

          {detail && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: detail.cluster.color }}
                  />
                  {detail.cluster.name}
                </SheetTitle>
                {detail.cluster.description && (
                  <p className="text-sm text-muted-foreground">{detail.cluster.description}</p>
                )}
              </SheetHeader>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="border rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{detail.urls.length}</div>
                  <div className="text-xs text-muted-foreground">{t('topicMap.urlCount')}</div>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{detail.ideas.length}</div>
                  <div className="text-xs text-muted-foreground">{t('topicMap.ideaCount')}</div>
                </div>
              </div>

              {/* URLs */}
              <section className="mb-6">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Geplante URLs
                </h3>
                {detail.urls.length === 0 && (
                  <p className="text-sm text-muted-foreground">Noch keine URLs zugeordnet.</p>
                )}
                <div className="space-y-2">
                  {detail.urls.map((u) => (
                    <div key={u.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium" title={u.url}>{u.url}</div>
                        {u.mainKeyword && (
                          <div className="text-xs text-muted-foreground">
                            {u.mainKeyword}
                            {u.searchVolume ? ` · ${u.searchVolume.toLocaleString('de-DE')} SV` : ''}
                            {u.ranking ? ` · #${u.ranking}` : ''}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {u.planningStatus && (
                          <Badge variant={statusColor(u.planningStatus) as any} className="capitalize">
                            {u.planningStatus}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Ideas */}
              <section>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Ideen
                </h3>
                {detail.ideas.length === 0 && !addingIdea && (
                  <p className="text-sm text-muted-foreground mb-3">{t('topicMap.emptyIdeas')}</p>
                )}
                <div className="space-y-2 mb-3">
                  {detail.ideas.map((idea) => (
                    <div key={idea.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium">{idea.keyword}</div>
                        <div className="text-xs text-muted-foreground">
                          {idea.searchVolume ? `${idea.searchVolume.toLocaleString('de-DE')} SV` : ''}
                          {idea.keywordDifficulty ? ` · KD ${idea.keywordDifficulty}` : ''}
                          {' · '}
                          <Badge variant="outline" className="text-xs py-0">{idea.source}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPlanIdea(idea)}>
                          {t('topicMap.planIdea')}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => { deleteIdea(idea.id); onClustersRefresh(); }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {addingIdea ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      placeholder="Keyword eingeben..."
                      value={newIdeaKw}
                      onChange={(e) => setNewIdeaKw(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddIdea()}
                      className="h-8 text-sm"
                    />
                    <Button size="sm" onClick={handleAddIdea}>Speichern</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setAddingIdea(false); setNewIdeaKw(''); }}>
                      Abbrechen
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setAddingIdea(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {t('topicMap.addIdeaManual')}
                  </Button>
                )}
              </section>
            </>
          )}
        </SheetContent>
      </Sheet>

      {planIdea && clusterId && (
        <PlanIdeaModal
          open={!!planIdea}
          idea={planIdea}
          clusterId={clusterId}
          onClose={() => setPlanIdea(null)}
          onSuccess={() => {
            setPlanIdea(null);
            refresh();
            onClustersRefresh();
            toast.success('Thema erfolgreich zur Planung hinzugefügt');
          }}
        />
      )}
    </>
  );
}

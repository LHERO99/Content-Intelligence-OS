"use client";

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/i18n/use-i18n';
import { SuggestionWithCoverage } from '@/features/topic-map/hooks/use-topic-discovery';
import { TopicClusterWithStats } from '@/lib/db/topic-journey-types';
import { CheckCircle, Lightbulb } from 'lucide-react';

interface Props {
  suggestion: SuggestionWithCoverage;
  clusters: TopicClusterWithStats[];
  onDirectPlan: (suggestion: SuggestionWithCoverage, clusterId: string) => Promise<void>;
}

export function SuggestionCard({ suggestion, clusters, onDirectPlan }: Props) {
  const { t } = useI18n();
  const [clusterId, setClusterId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePlan = async () => {
    if (!clusterId) return;
    setIsLoading(true);
    try {
      await onDirectPlan(suggestion, clusterId);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`border rounded-lg p-4 transition-colors ${suggestion.alreadyCovered ? 'bg-muted/40 opacity-60' : 'hover:bg-muted/20'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {suggestion.alreadyCovered ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {t('topicDiscovery.alreadyCovered')}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Lightbulb className="h-3 w-3" />
                Neue Idee
              </Badge>
            )}
          </div>
          <div className="font-medium">{suggestion.keyword}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {suggestion.searchVolume != null && `${suggestion.searchVolume.toLocaleString('de-DE')} Suchen`}
            {suggestion.keywordDifficulty != null && ` · KD: ${suggestion.keywordDifficulty}`}
            {suggestion.cpc != null && ` · CPC: €${suggestion.cpc.toFixed(2)}`}
          </div>
        </div>

        {!suggestion.alreadyCovered && (
          <div className="flex items-center gap-2 shrink-0">
            <Select value={clusterId} onValueChange={(v) => setClusterId(v ?? '')}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder={t('topicDiscovery.assignToCluster')} />
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
            <Button size="sm" disabled={!clusterId || isLoading} onClick={handlePlan}>
              {isLoading ? 'Wird gespeichert...' : t('topicMap.planIdea')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

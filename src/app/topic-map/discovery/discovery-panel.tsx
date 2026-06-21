"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/use-i18n';
import { useTopicDiscovery, SuggestionWithCoverage } from '@/features/topic-map/hooks/use-topic-discovery';
import { useTopicClusters } from '@/features/topic-map/hooks/use-topic-clusters';
import { SuggestionCard } from './suggestion-card';
import { RefreshCw, AlertTriangle, Lightbulb } from 'lucide-react';
import { PlanIdeaModal } from '../my-topics/plan-idea-modal';
import { TopicIdea } from '@/lib/db/topic-journey-types';
import { toast } from 'sonner';

export function DiscoveryPanel() {
  const { t } = useI18n();
  const router = useRouter();
  const { suggestions, isLoading, error, refresh, adoptIdea } = useTopicDiscovery();
  const { clusters, refresh: refreshClusters } = useTopicClusters();
  const [showCovered, setShowCovered] = useState(false);
  // State for direct-to-planning flow: adopted idea + clusterId
  const [planTarget, setPlanTarget] = useState<{ idea: TopicIdea; clusterId: string } | null>(null);

  useEffect(() => {
    refreshClusters();
    refresh();
  }, [refresh, refreshClusters]);

  const filtered = showCovered ? suggestions : suggestions.filter((s) => !s.alreadyCovered);

  const isNotConfigured = error?.includes('DataForSEO ist nicht konfiguriert');
  const noClusters = !isLoading && !error && clusters.length === 0;

  // Called from SuggestionCard when user clicks "Zur Keywordmap hinzufügen"
  const handleDirectPlan = async (suggestion: SuggestionWithCoverage, clusterId: string) => {
    try {
      const created = await adoptIdea(suggestion, clusterId);
      setPlanTarget({ idea: created, clusterId });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isNotConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h2 className="font-semibold text-lg">DataForSEO nicht konfiguriert</h2>
        <p className="text-muted-foreground max-w-sm">
          Bitte hinterlege deine DataForSEO-Zugangsdaten unter Admin → Integrationen.
        </p>
        <Button variant="outline" onClick={() => router.push('/admin?tab=integrations')}>
          Zu den Einstellungen
        </Button>
      </div>
    );
  }

  if (noClusters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <Lightbulb className="h-10 w-10 text-muted-foreground" />
        <h2 className="font-semibold text-lg">Keine Cluster vorhanden</h2>
        <p className="text-muted-foreground max-w-sm">
          Erstelle zunächst Topic Cluster unter "Meine Topics".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{t('topicDiscovery.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('topicDiscovery.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCovered((v) => !v)}
          >
            {showCovered ? 'Nur neue Ideen' : 'Alle anzeigen'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('topicDiscovery.refresh')}
          </Button>
        </div>
      </div>

      {error && !isNotConfigured && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {isLoading && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          {t('topicDiscovery.loading')}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          {t('topicDiscovery.noSuggestions')}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((suggestion) => (
          <SuggestionCard
            key={suggestion.keyword}
            suggestion={suggestion}
            clusters={clusters}
            onDirectPlan={handleDirectPlan}
          />
        ))}
      </div>

      {planTarget && (
        <PlanIdeaModal
          open={!!planTarget}
          idea={planTarget.idea}
          clusterId={planTarget.clusterId}
          onClose={() => setPlanTarget(null)}
          onSuccess={() => {
            setPlanTarget(null);
            toast.success('Keyword zur Keywordmap hinzugefügt', {
              action: {
                label: 'In Planung ansehen →',
                onClick: () => router.push('/planning?tab=keyword-map'),
              },
            });
          }}
        />
      )}
    </div>
  );
}

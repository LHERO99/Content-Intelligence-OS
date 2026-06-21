"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n/use-i18n';
import { useTopicDiscovery, SuggestionWithCoverage } from '@/features/topic-map/hooks/use-topic-discovery';
import { useTopicClusters } from '@/features/topic-map/hooks/use-topic-clusters';
import { SuggestionCard } from './suggestion-card';
import { AdoptIdeaModal } from './adopt-idea-modal';
import { RefreshCw, AlertTriangle, Lightbulb } from 'lucide-react';

export function DiscoveryPanel() {
  const { t } = useI18n();
  const router = useRouter();
  const { suggestions, isLoading, error, refresh, adoptIdea } = useTopicDiscovery();
  const { clusters, refresh: refreshClusters } = useTopicClusters();
  const [selectedIdea, setSelectedIdea] = useState<SuggestionWithCoverage | null>(null);
  const [showCovered, setShowCovered] = useState(false);

  useEffect(() => {
    refreshClusters();
    refresh();
  }, [refresh, refreshClusters]);

  const filtered = showCovered ? suggestions : suggestions.filter((s) => !s.alreadyCovered);

  const isNotConfigured = error?.includes('DataForSEO ist nicht konfiguriert');
  const noClusters = !isLoading && !error && clusters.length === 0;

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
            onAdopt={setSelectedIdea}
          />
        ))}
      </div>

      {selectedIdea && (
        <AdoptIdeaModal
          idea={selectedIdea}
          clusters={clusters}
          onConfirm={async (clusterId) => {
            await adoptIdea(selectedIdea, clusterId);
            setSelectedIdea(null);
          }}
          onCancel={() => setSelectedIdea(null)}
        />
      )}
    </div>
  );
}

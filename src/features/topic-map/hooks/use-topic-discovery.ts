"use client";

import { useState, useCallback } from 'react';
import { KeywordIdeaResult } from '@/lib/dataforseo';

export type SuggestionWithCoverage = KeywordIdeaResult & { alreadyCovered: boolean };

export function useTopicDiscovery() {
  const [suggestions, setSuggestions] = useState<SuggestionWithCoverage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (clusterIds?: string[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/topic-clusters/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusterIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSuggestions(data.suggestions ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const adoptIdea = useCallback(async (
    idea: SuggestionWithCoverage,
    clusterId: string,
  ) => {
    const res = await fetch(`/api/topic-clusters/${clusterId}/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword:          idea.keyword,
        searchVolume:     idea.searchVolume,
        keywordDifficulty: idea.keywordDifficulty,
        source:           'dataforseo',
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Fehler beim Speichern');
    }
    // Mark as covered locally
    setSuggestions((prev) =>
      prev.map((s) =>
        s.keyword === idea.keyword ? { ...s, alreadyCovered: true } : s
      )
    );
  }, []);

  return { suggestions, isLoading, error, refresh, adoptIdea };
}

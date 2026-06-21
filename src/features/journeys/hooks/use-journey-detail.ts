"use client";

import { useState, useCallback } from 'react';
import { Journey, JourneyPageMapping, FunnelPhase } from '@/lib/db/topic-journey-types';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function useJourneyDetail(journeyId: string | null) {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [mappings, setMappings] = useState<JourneyPageMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!journeyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ journey: Journey; mappings: JourneyPageMapping[] }>(
        `/api/journeys/${journeyId}`
      );
      setJourney(data.journey);
      setMappings(data.mappings);
    } catch (e: any) {
      setError(e.message);
      setJourney(null);
      setMappings([]);
    } finally {
      setIsLoading(false);
    }
  }, [journeyId]);

  const addMapping = useCallback(async (urlId: string, phase: FunnelPhase): Promise<void> => {
    if (!journeyId) return;
    const mapping = await apiFetch<JourneyPageMapping>(`/api/journeys/${journeyId}/mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urlId, funnelPhase: phase }),
    });
    // Re-fetch to get joined URL data
    refresh();
    void mapping;
  }, [journeyId, refresh]);

  const removeMapping = useCallback(async (mappingId: string): Promise<void> => {
    if (!journeyId) return;
    await apiFetch(`/api/journeys/${journeyId}/mappings/${mappingId}`, { method: 'DELETE' });
    setMappings((prev) => prev.filter((m) => m.id !== mappingId));
  }, [journeyId]);

  const changeMappingPhase = useCallback(async (mappingId: string, newPhase: FunnelPhase): Promise<void> => {
    if (!journeyId) return;
    const updated = await apiFetch<JourneyPageMapping>(
      `/api/journeys/${journeyId}/mappings/${mappingId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funnelPhase: newPhase }),
      }
    );
    setMappings((prev) => prev.map((m) => (m.id === mappingId ? { ...m, ...updated } : m)));
  }, [journeyId]);

  return { journey, mappings, isLoading, error, refresh, addMapping, removeMapping, changeMappingPhase };
}

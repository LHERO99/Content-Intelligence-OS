"use client";

import { useState, useCallback } from 'react';
import { Journey, JourneyWithStats } from '@/lib/db/topic-journey-types';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function useJourneys() {
  const [journeys, setJourneys] = useState<JourneyWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<JourneyWithStats[]>('/api/journeys');
      setJourneys(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createJourney = useCallback(async (input: { name: string; description?: string }): Promise<Journey> => {
    const created = await apiFetch<Journey>('/api/journeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    // Re-fetch to get stats
    refresh();
    return created;
  }, [refresh]);

  const updateJourney = useCallback(async (id: string, input: { name?: string; description?: string }): Promise<void> => {
    const updated = await apiFetch<Journey>(`/api/journeys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    setJourneys((prev) => prev.map((j) => (j.id === id ? { ...j, ...updated } : j)));
  }, []);

  const deleteJourney = useCallback(async (id: string): Promise<void> => {
    await apiFetch(`/api/journeys/${id}`, { method: 'DELETE' });
    setJourneys((prev) => prev.filter((j) => j.id !== id));
  }, []);

  return { journeys, isLoading, error, refresh, createJourney, updateJourney, deleteJourney };
}

"use client";

import { useState, useCallback } from 'react';
import { TopicClusterWithStats, ClusterDetail } from '@/lib/db/topic-journey-types';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/** Build an arbitrary-depth tree from a flat list using parentId */
export function buildClusterTree(flat: TopicClusterWithStats[]): TopicClusterWithStats[] {
  const map = new Map<string, TopicClusterWithStats>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: TopicClusterWithStats[] = [];
  map.forEach((c) => {
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(c);
    } else {
      roots.push(c);
    }
  });
  return roots;
}

export function useTopicClusters() {
  const [clusters, setClusters] = useState<TopicClusterWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<TopicClusterWithStats[]>('/api/topic-clusters');
      setClusters(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCluster = useCallback(async (input: { name: string; description?: string; color?: string; parentId?: string | null }) => {
    const created = await apiFetch<TopicClusterWithStats>('/api/topic-clusters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    setClusters((prev) => [{ ...created, urlCount: 0, ideaCount: 0, totalSearchVolume: 0, avgRanking: null, statusBreakdown: { backlog: 0, planned: 0, inProgress: 0, published: 0 }, children: [] }, ...prev]);
    return created;
  }, []);

  const updateCluster = useCallback(async (id: string, input: { name?: string; description?: string; color?: string; parentId?: string | null }) => {
    const updated = await apiFetch<TopicClusterWithStats>(`/api/topic-clusters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    setClusters((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
  }, []);

  const deleteCluster = useCallback(async (id: string) => {
    await apiFetch(`/api/topic-clusters/${id}`, { method: 'DELETE' });
    setClusters((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addUrlToCluster = useCallback(async (clusterId: string, urlId: string) => {
    await apiFetch(`/api/topic-clusters/${clusterId}/urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urlId }),
    });
    setClusters((prev) => prev.map((c) => c.id === clusterId ? { ...c, urlCount: c.urlCount + 1 } : c));
  }, []);

  const removeUrlFromCluster = useCallback(async (clusterId: string, urlId: string) => {
    await apiFetch(`/api/topic-clusters/${clusterId}/urls/${urlId}`, { method: 'DELETE' });
    setClusters((prev) => prev.map((c) => c.id === clusterId ? { ...c, urlCount: Math.max(0, c.urlCount - 1) } : c));
  }, []);

  return { clusters, isLoading, error, refresh, createCluster, updateCluster, deleteCluster, addUrlToCluster, removeUrlFromCluster };
}

export function useClusterDetail(clusterId: string | null) {
  const [detail, setDetail] = useState<ClusterDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!clusterId) return;
    setIsLoading(true);
    try {
      const data = await apiFetch<ClusterDetail>(`/api/topic-clusters/${clusterId}`);
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setIsLoading(false);
    }
  }, [clusterId]);

  const deleteIdea = useCallback(async (ideaId: string) => {
    if (!clusterId) return;
    await apiFetch(`/api/topic-clusters/${clusterId}/ideas/${ideaId}`, { method: 'DELETE' });
    setDetail((prev) => prev ? { ...prev, ideas: prev.ideas.filter((i) => i.id !== ideaId) } : prev);
  }, [clusterId]);

  const addIdea = useCallback(async (input: { keyword: string; searchVolume?: number; keywordDifficulty?: number; source?: 'manual' | 'dataforseo' }) => {
    if (!clusterId) return;
    const idea = await apiFetch(`/api/topic-clusters/${clusterId}/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    setDetail((prev) => prev ? { ...prev, ideas: [...prev.ideas, idea as any] } : prev);
  }, [clusterId]);

  return { detail, isLoading, refresh, deleteIdea, addIdea, setDetail };
}

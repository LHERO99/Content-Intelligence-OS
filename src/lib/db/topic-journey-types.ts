// ---------------------------------------------------------------------------
// topic-journey-types.ts
// TypeScript types for Topic Map & Journey Mapping features
// ---------------------------------------------------------------------------

export type TopicCluster = {
  id: string;
  tenantId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  color: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TopicClusterWithStats = TopicCluster & {
  urlCount: number;
  ideaCount: number;
  totalSearchVolume: number;
  avgRanking: number | null;
  statusBreakdown: {
    backlog: number;
    planned: number;
    inProgress: number;
    published: number;
  };
  children: TopicClusterWithStats[];
};

export type TopicIdea = {
  id: string;
  tenantId: string;
  topicClusterId: string;
  keyword: string;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  source: 'manual' | 'dataforseo';
  createdAt: Date;
};

export type Journey = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type JourneyWithStats = Journey & {
  totalMappings: number;
  phaseCoverage: {
    awareness: number;
    consideration: number;
    decision: number;
    retention: number;
  };
};

export type JourneyPageMapping = {
  id: string;
  tenantId: string;
  journeyId: string;
  urlId: string;
  funnelPhase: 'awareness' | 'consideration' | 'decision' | 'retention';
  createdAt: Date;
  // Joined URL data
  url?: string;
  pageType?: string;
  mainKeyword?: string | null;
  searchVolume?: number | null;
  ranking?: number | null;
  planningStatus?: string;
  clicks30d?: number | null;
};

export type FunnelPhase = 'awareness' | 'consideration' | 'decision' | 'retention';

export const FUNNEL_PHASES: { key: FunnelPhase; label: string; labelDe: string }[] = [
  { key: 'awareness',     label: 'Awareness',     labelDe: 'Awareness'     },
  { key: 'consideration', label: 'Consideration',  labelDe: 'Consideration' },
  { key: 'decision',      label: 'Decision',       labelDe: 'Decision'      },
  { key: 'retention',     label: 'Retention',      labelDe: 'Retention'     },
];

export type ClusterUrlEntry = {
  id: string;
  url: string;
  pageType: string;
  mainKeyword: string | null;
  searchVolume: number | null;
  ranking: number | null;
  planningStatus: string;
};

export type ClusterDetail = {
  cluster: TopicCluster;
  urls: ClusterUrlEntry[];
  ideas: TopicIdea[];
};

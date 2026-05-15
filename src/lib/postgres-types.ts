// ---------------------------------------------------------------------------
// postgres-types.ts
// Drop-in replacement for airtable-types.ts.
// All interfaces are intentionally kept identical to avoid touching any
// component or API route that imports from this file.
// ---------------------------------------------------------------------------

export type KeywordStatus =
  | 'Backlog'
  | 'Planned'
  | 'Beauftragt'
  | 'In Arbeit'
  | 'Angeliefert'
  | 'Review'
  | 'Optimierung'
  | 'Published';

export interface KeywordMap {
  id: string;
  Keyword: string;
  Target_URL?: string;
  Search_Volume?: number;
  Difficulty?: number;
  Status: KeywordStatus;
  Editorial_Deadline?: string;
  Assigned_Editor?: string[]; // user IDs
  Main_Keyword: 'Y' | 'N';
  Article_Count?: number;
  Avg_Product_Value?: number;
  Policy?: number;
  Priority_Score?: number;
  Ranking?: number;
  Action_Type?: 'Erstellung' | 'Optimierung';
  Page_Type?: 'Ratgeber' | 'Kategorie' | 'Marke' | 'Produkt';
  Last_Published?: string; // ISO Date String
}

export interface SkippedKeyword extends Partial<KeywordMap> {
  reason: string;
}

export interface ContentLog {
  id: string;
  ID: number;
  Keyword_ID: string[]; // IDs referencing keyword_map
  Target_URL?: string;
  Logged_URL?: string;
  Action_Type: 'Planung' | 'Erstellung' | 'Optimierung' | 'KI-Chat';
  Page_Type?: 'Ratgeber' | 'Kategorie' | 'Marke' | 'Produkt';
  Version: 'v1' | 'v2';
  Content_Body?: string;
  Event_Label?: string;
  Created_At: string;
  Updated_At?: string;
  Editor?: string[]; // user IDs
}

export interface PerformanceData {
  id: string;
  ID: number;
  Target_URL?: string;
  Keyword_ID?: string[];
  Date: string;
  Ranking?: number;
  GSC_Clicks?: number;
  GSC_Impressions?: number;
  Sistrix_VI?: number;
  Position?: number;
  Source?: 'GSC' | 'Sistrix' | 'Combined';
}

export interface URLPerformance {
  id: string;
  Target_URL: string;
  Date: string;
  GSC_Clicks?: number;
  GSC_Impressions?: number;
  Position?: number;
  Sistrix_VI?: number;
}

export interface KeywordRankingHistory {
  id: string;
  Keyword_ID: string[];
  Date: string;
  Ranking?: number;
  Target_URL?: string;
}

export interface CostConfig {
  id: string;
  Page_Type: 'Ratgeber' | 'Kategorie' | 'Marke' | 'Produkt';
  Action_Type: 'Erstellung' | 'Optimierung';
  Agency_Cost: number;
  Overhead_Cost: number;
}

export interface PotentialTrend {
  id: string;
  Trend_Topic: string;
  Source: 'GSC' | 'Sistrix';
  Gap_Score?: number;
  Status: 'New' | 'Claimed' | 'Blacklisted';
}

export interface AuditLog {
  id: string;
  ID: number;
  Action: string;
  Timestamp: string;
  User_ID?: string[];
  Raw_Payload?: string;
}

export interface BlacklistEntry {
  id: string;
  Keyword: string;
  Target_URL?: string;
  Type: 'Keyword' | 'URL';
  Reason?: string;
  Added_At: string;
}

export interface ConfigRecord {
  id: string;
  Key: string;
  Value: string;
  Description?: string;
  Updated_At?: string;
  File?: any[]; // kept for interface compat; use fileUrl in DB layer
}

export interface UserRecord {
  id: string;
  Name: string;
  Email: string;
  Role: 'SuperAdmin' | 'Admin' | 'Editor' | 'Viewer';
  TenantId?: string;
  Password?: string;
  Password_Changed?: boolean;
  Is_Active?: boolean;
}

export interface OptimizationRuleSettings {
  AGE_DAYS: number;
  TOP_RANK_THRESHOLD: number;
  URL_MISMATCH_ENABLED: boolean;
  DROP_WINDOW_DAYS: number;
  DROP_THRESHOLD_PCT: number;
  PERFORMANCE_WINDOW_DAYS: number;
  MIN_IMPROVEMENT_PCT: number;
}

export interface OptimizationSuggestion {
  keywordId: string;
  keyword: string;
  targetUrl: string;
  actionType: 'Optimierung';
  pageType?: 'Ratgeber' | 'Kategorie' | 'Marke' | 'Produkt';
  currentRanking?: number;
  lastPublished?: string;
  reasons: string[];
  reasonCodes: string[];
}

export type KeywordStatus = 'Backlog' | 'Planned' | 'In Progress' | 'Published';

export interface KeywordMap {
  id: string;
  Keyword: string;
  Target_URL?: string;
  Search_Volume?: number;
  Difficulty?: number;
  Status: KeywordStatus;
  Editorial_Deadline?: string;
  Assigned_Editor?: string[]; // Link to Users
}

export interface ContentLog {
  id: string;
  ID: number;
  Keyword_ID: string[]; // Link to Keyword-Map
  Version: 'v1' | 'v2';
  Content_Body?: string;
  Diff_Summary?: string;
  Reasoning_Chain?: string;
  Created_At: string;
}

export interface PerformanceData {
  id: string;
  ID: number;
  Keyword_ID: string[]; // Link to Keyword-Map
  Date: string;
  GSC_Clicks?: number;
  GSC_Impressions?: number;
  Sistrix_VI?: number;
  Position?: number;
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
  User_ID?: string[]; // Link to Users
  Raw_Payload?: string;
}

export interface UserRecord {
  id: string;
  Name: string;
  Email: string;
  Role: 'Admin' | 'Editor' | 'Viewer';
  Password?: string;
  Password_Changed?: boolean;
}

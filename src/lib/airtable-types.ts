export type KeywordStatus = 'Backlog' | 'Planned' | 'Beauftragt' | 'In Progress' | 'Published';

export interface KeywordMap {
  id: string;
  Keyword: string;
  Target_URL?: string;
  Search_Volume?: number;
  Difficulty?: number;
  Status: KeywordStatus;
  Editorial_Deadline?: string;
  Assigned_Editor?: string[]; // Link to Users
  Main_Keyword: 'Y' | 'N';
  Article_Count?: number;
  Avg_Product_Value?: number;
  Policy?: number;
  Priority_Score?: number;
}

export interface SkippedKeyword extends Partial<KeywordMap> {
  reason: string;
}

export interface ContentLog {
  id: string;
  ID: number;
  Keyword_ID: string[]; // Link to Keyword-Map
  Target_URL?: string; // New field for URL-based history
  Action_Type: 'Planung' | 'Erstellung' | 'Optimierung';
  Version: 'v1' | 'v2';
  Content_Body?: string;
  Diff_Summary?: string;
  Reasoning_Chain?: string;
  Created_At: string;
  Editor?: string[]; // Link to Users
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

export interface BlacklistEntry {
  id: string;
  Keyword: string;
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
}

export interface UserRecord {
  id: string;
  Name: string;
  Email: string;
  Role: 'Admin' | 'Editor' | 'Viewer';
  Password?: string;
  Password_Changed?: boolean;
}

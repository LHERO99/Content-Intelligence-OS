import Airtable from 'airtable';

if (!process.env.AIRTABLE_API_KEY) {
  throw new Error('AIRTABLE_API_KEY is not defined');
}

if (!process.env.AIRTABLE_BASE_ID) {
  throw new Error('AIRTABLE_BASE_ID is not defined');
}

export const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
export const base = airtable.base(process.env.AIRTABLE_BASE_ID);

// --- Types ---

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
}

// --- Fetchers ---

export async function getKeywordMap(): Promise<KeywordMap[]> {
  const records = await base('Keyword-Map').select().all();
  return records.map((record) => ({
    id: record.id,
    Keyword: record.get('Keyword') as string,
    Target_URL: record.get('Target_URL') as string,
    Search_Volume: record.get('Search_Volume') as number,
    Difficulty: record.get('Difficulty') as number,
    Status: record.get('Status') as KeywordStatus,
    Editorial_Deadline: record.get('Editorial_Deadline') as string,
    Assigned_Editor: record.get('Assigned_Editor') as string[],
  }));
}

export async function getContentLogs(): Promise<ContentLog[]> {
  const records = await base('Content-Log').select().all();
  return records.map((record) => ({
    id: record.id,
    ID: record.get('ID') as number,
    Keyword_ID: record.get('Keyword_ID') as string[],
    Version: record.get('Version') as 'v1' | 'v2',
    Content_Body: record.get('Content_Body') as string,
    Diff_Summary: record.get('Diff_Summary') as string,
    Reasoning_Chain: record.get('Reasoning_Chain') as string,
    Created_At: record.get('Created_At') as string,
  }));
}

export async function getPerformanceData(): Promise<PerformanceData[]> {
  const records = await base('Performance_Data').select().all();
  return records.map((record) => ({
    id: record.id,
    ID: record.get('ID') as number,
    Keyword_ID: record.get('Keyword_ID') as string[],
    Date: record.get('Date') as string,
    GSC_Clicks: record.get('GSC_Clicks') as number,
    GSC_Impressions: record.get('GSC_Impressions') as number,
    Sistrix_VI: record.get('Sistrix_VI') as number,
    Position: record.get('Position') as number,
  }));
}

export async function getPotentialTrends(): Promise<PotentialTrend[]> {
  const records = await base('Potential_Trends').select().all();
  return records.map((record) => ({
    id: record.id,
    Trend_Topic: record.get('Trend_Topic') as string,
    Source: record.get('Source') as 'GSC' | 'Sistrix',
    Gap_Score: record.get('Gap_Score') as number,
    Status: record.get('Status') as 'New' | 'Claimed' | 'Blacklisted',
  }));
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const records = await base('Audit_Logs').select().all();
  return records.map((record) => ({
    id: record.id,
    ID: record.get('ID') as number,
    Action: record.get('Action') as string,
    Timestamp: record.get('Timestamp') as string,
    User_ID: record.get('User_ID') as string[],
    Raw_Payload: record.get('Raw_Payload') as string,
  }));
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  try {
    const records = await base('Users')
      .select({
        filterByFormula: `{Email} = '${email}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    return {
      id: record.id,
      Name: record.get('Name') as string,
      Email: record.get('Email') as string,
      Role: record.get('Role') as 'Admin' | 'Editor' | 'Viewer',
      Password: record.get('Password') as string,
    };
  } catch (error) {
    console.error('Error fetching user from Airtable:', error);
    return null;
  }
}

export async function countUsers(): Promise<number> {
  try {
    const records = await base('Users').select({ maxRecords: 1 }).firstPage();
    return records.length;
  } catch (error) {
    console.error('Error counting users in Airtable:', error);
    return 0;
  }
}

export async function createUser(userData: Partial<UserRecord>): Promise<UserRecord | null> {
  try {
    const records = await base('Users').create([
      {
        fields: {
          Name: userData.Name,
          Email: userData.Email,
          Role: userData.Role || 'Editor',
          Password: userData.Password,
        },
      },
    ]);

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    return {
      id: record.id,
      Name: record.get('Name') as string,
      Email: record.get('Email') as string,
      Role: record.get('Role') as 'Admin' | 'Editor' | 'Viewer',
      Password: record.get('Password') as string,
    };
  } catch (error) {
    console.error('Error creating user in Airtable:', error);
    return null;
  }
}

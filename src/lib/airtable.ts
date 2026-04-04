import Airtable from 'airtable';
import 'server-only';
import { 
  KeywordStatus, 
  KeywordMap, 
  ContentLog, 
  PerformanceData, 
  PotentialTrend, 
  AuditLog, 
  UserRecord,
  BlacklistEntry,
  ConfigRecord,
  SkippedKeyword,
  CostConfig
} from './airtable-types';

export * from './airtable-types';

if (!process.env.AIRTABLE_API_KEY) {
  throw new Error('AIRTABLE_API_KEY is not defined');
}

if (!process.env.AIRTABLE_BASE_ID) {
  throw new Error('AIRTABLE_BASE_ID is not defined');
}

export const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
export const base = airtable.base(process.env.AIRTABLE_BASE_ID);

// --- Table Names ---
export const TABLES = {
  KEYWORD_MAP: 'Keyword-Map',
  CONTENT_LOG: 'Content-Log',
  PERFORMANCE_DATA: 'Performance_Data',
  POTENTIAL_TRENDS: 'Potential_Trends',
  AUDIT_LOGS: 'Audit_Logs',
  USERS: 'Users',
  BLACKLIST: 'Blacklist',
  CONFIG: 'Config',
  COST_CONFIG: 'Cost_Config',
} as const;

// --- Error Handling ---

export class AirtableValidationError extends Error {
  constructor(public message: string, public status: number = 400) {
    super(message);
    this.name = 'AirtableValidationError';
  }
}

async function handleAirtableError(error: any, operation: string): Promise<never> {
  if (error instanceof AirtableValidationError) {
    throw error;
  }
  const status = error.statusCode || error.status;
  const message = error.message || '';
  
  console.error(`[Airtable] Error in ${operation}:`, {
    status,
    message,
    error
  });

  if (status === 403) {
    if (message.includes('NOT_AUTHORIZED')) {
      throw new Error(`Airtable Authorization Error (403): The API key may not have permissions for this operation or the Base ID is incorrect. Operation: ${operation}`);
    }
    throw new Error(`Airtable Forbidden (403): Access denied for ${operation}. Check your Personal Access Token scopes.`);
  }
  
  if (status === 401) {
    throw new Error(`Airtable Unauthorized (401): Invalid API key. Please check your AIRTABLE_API_KEY.`);
  }

  if (status === 404) {
    throw new Error(`Airtable Not Found (404): The table or record was not found. Check your table names and Base ID.`);
  }

  throw error;
}

export async function getKeywordMap(): Promise<KeywordMap[]> {
  try {
    // Fetch both Keyword-Map and Blacklist to filter out blacklisted keywords and URLs
    // We use a defensive approach for the Blacklist table because the 'Type' field might be missing
    let blacklistRecords: readonly any[] = [];
    try {
      // Try fetching with 'Type' field first
      blacklistRecords = await base(TABLES.BLACKLIST).select({ fields: ['Keyword', 'Type'] }).all();
    } catch (error: any) {
      // If 422 error (Unknown field name), try fetching without 'Type' field
      if (error.statusCode === 422 && error.message?.includes('Type')) {
        console.warn('[Airtable] "Type" field missing in Blacklist table, falling back to "Keyword" only');
        blacklistRecords = await base(TABLES.BLACKLIST).select({ fields: ['Keyword'] }).all();
      } else {
        // For other errors, log and continue with empty blacklist to avoid crashing the whole app
        console.error('[Airtable] Error fetching blacklist, continuing without filtering:', error);
        blacklistRecords = [];
      }
    }

    const keywordRecords = await base(TABLES.KEYWORD_MAP).select().all();

    const blacklistedKeywords = new Set(
      blacklistRecords
        .filter(r => {
          const type = r.get('Type');
          return type === 'Keyword' || !type;
        })
        .map(r => (r.get('Keyword') as string)?.toLowerCase())
    );

    const blacklistedURLs = new Set(
      blacklistRecords
        .filter(r => r.get('Type') === 'URL')
        .map(r => (r.get('Keyword') as string)?.toLowerCase())
    );

    return keywordRecords
      .filter(record => {
        const kw = (record.get('Keyword') as string)?.toLowerCase();
        const url = (record.get('Target_URL') as string)?.toLowerCase();
        
        if (kw && blacklistedKeywords.has(kw)) return false;
        if (url && blacklistedURLs.has(url)) return false;
        
        return true;
      })
      .map((record) => ({
      id: record.id,
      Keyword: record.get('Keyword') as string,
      Target_URL: record.get('Target_URL') as string,
      Search_Volume: record.get('Search_Volume') as number,
      Difficulty: record.get('Difficulty') as number,
      Status: record.get('Status') as KeywordStatus,
      Editorial_Deadline: record.get('Editorial_Deadline') as string,
      Assigned_Editor: record.get('Assigned_Editor') as string[],
      Main_Keyword: (record.get('Main_Keyword') as 'Y' | 'N') || 'N',
      Article_Count: record.get('Article_Count') as number,
      Avg_Product_Value: record.get('Avg_Product_Value') as number,
      Policy: record.get('Policy') as number,
      Priority_Score: record.get('Priority_Score') as number,
      Action_Type: (record.get('Action_Type') as 'Erstellung' | 'Optimierung') || 'Erstellung',
      Ranking: record.get('Ranking') as number,
      Last_Published: record.get('Last_Published') as string,
    }));
  } catch (error) {
    return handleAirtableError(error,'getKeywordMap');
  }
}

export async function getContentLogs(): Promise<ContentLog[]> {
  try {
    const records = await base(TABLES.CONTENT_LOG).select({
      sort: [{ field: 'Time_Created', direction: 'desc' }],
      maxRecords: 100
    }).all();
    return records.map((record) => ({
      id: record.id,
      ID: record.get('ID') as number,
      Keyword_ID: record.get('Keyword_ID') as string[],
      Target_URL: Array.isArray(record.get('Target_URL')) ? (record.get('Target_URL') as string[])[0] : (record.get('Target_URL') as string),
      Action_Type: record.get('Action_Type') as any,
      Version: record.get('Content_Body') ? 'v2' : 'v1', // Derived from content presence
      Content_Body: record.get('Content_Body') as string,
      Diff_Summary: record.get('Diff_Summary') as string,
      Reasoning_Chain: record.get('Reasoning_Chain') as string,
      Created_At: (record.get('Time_Created') || new Date().toISOString()) as string,
      Updated_At: (record.get('Time_Changed') || record.get('Time_Created') || new Date().toISOString()) as string,
      Editor: record.get('Editor') as string[],
    }));
  } catch (error) {
    return handleAirtableError(error,'getContentLogs');
  }
}

export async function getContentHistoryByUrl(targetUrl: string): Promise<ContentLog[]> {
  try {
    const records = await base(TABLES.CONTENT_LOG).select({
      filterByFormula: `{Target_URL} = '${targetUrl}'`,
      sort: [{ field: 'Time_Created', direction: 'desc' }]
    }).all();
    
    return records.map((record) => ({
      id: record.id,
      ID: record.get('ID') as number,
      Keyword_ID: record.get('Keyword_ID') as string[],
      Target_URL: record.get('Target_URL') as string,
      Action_Type: record.get('Action_Type') as any,
      Version: record.get('Content_Body') ? 'v2' : 'v1',
      Content_Body: record.get('Content_Body') as string,
      Diff_Summary: record.get('Diff_Summary') as string,
      Reasoning_Chain: record.get('Reasoning_Chain') as string,
      Created_At: (record.get('Time_Created') || new Date().toISOString()) as string,
      Editor: record.get('Editor') as string[],
    }));
  } catch (error) {
    return handleAirtableError(error,'getContentHistoryByUrl');
  }
}

export async function getContentHistoryByKeyword(keywordId: string): Promise<ContentLog[]> {
  try {
    const records = await base(TABLES.CONTENT_LOG).select({
      filterByFormula: `SEARCH('${keywordId}', ARRAYJOIN({Keyword_ID}))`,
      sort: [{ field: 'Time_Created', direction: 'desc' }]
    }).all();
    
    return records.map((record) => ({
      id: record.id,
      ID: record.get('ID') as number,
      Keyword_ID: record.get('Keyword_ID') as string[],
      Target_URL: record.get('Target_URL') as string,
      Action_Type: record.get('Action_Type') as any,
      Version: record.get('Content_Body') ? 'v2' : 'v1',
      Content_Body: record.get('Content_Body') as string,
      Diff_Summary: record.get('Diff_Summary') as string,
      Reasoning_Chain: record.get('Reasoning_Chain') as string,
      Created_At: (record.get('Time_Created') || new Date().toISOString()) as string,
      Editor: record.get('Editor') as string[],
    }));
  } catch (error) {
    return handleAirtableError(error,'getContentHistoryByKeyword');
  }
}

export async function createContentLog(log: Partial<ContentLog>): Promise<ContentLog | null> {
  try {
    // 1. Validation: Ensure Keyword_ID consists of valid Airtable record IDs
    if (!log.Keyword_ID || !Array.isArray(log.Keyword_ID) || log.Keyword_ID.length === 0) {
      console.error('[Airtable createContentLog] Validation failed: Keyword_ID missing or empty');
      return null;
    }

    const validKeywordIds = log.Keyword_ID.filter(id => id && id.startsWith('rec'));
    if (validKeywordIds.length === 0) {
      console.error('[Airtable createContentLog] Validation failed: No valid Airtable record IDs found in Keyword_ID', log.Keyword_ID);
      return null;
    }

    // 2. Prepare fields
    // IMPORTANT: Target_URL is a computed/lookup field in Content-Log table
    // Sending a value for a computed field causes Airtable to error (422)
    const fields: any = {
      Keyword_ID: validKeywordIds,
      Content_Body: log.Content_Body,
      Diff_Summary: log.Diff_Summary,
      Reasoning_Chain: log.Reasoning_Chain,
      Action_Type: log.Action_Type, 
    };

    // Clean undefined fields to avoid Airtable validation errors
    Object.keys(fields).forEach(key => fields[key] === undefined && delete fields[key]);

    console.log('[Airtable createContentLog] Attempting to create log entry with fields:', JSON.stringify(fields, null, 2));

    const records = await base(TABLES.CONTENT_LOG).create([{ fields }]);

    if (records.length === 0) {
      console.error('[Airtable createContentLog] No record returned from Airtable create call');
      return null;
    }
    
    const record = records[0];
    console.log('[Airtable createContentLog] Successfully created log entry:', record.id);
    
    return {
      id: record.id,
      ID: record.get('ID') as number,
      Keyword_ID: record.get('Keyword_ID') as string[],
      Target_URL: record.get('Target_URL') as string,
      Action_Type: record.get('Action_Type') as any,
      Version: record.get('Content_Body') ? 'v2' : 'v1',
      Content_Body: record.get('Content_Body') as string,
      Diff_Summary: record.get('Diff_Summary') as string,
      Reasoning_Chain: record.get('Reasoning_Chain') as string,
      Created_At: (record.get('Time_Created') || new Date().toISOString()) as string,
      Editor: record.get('Editor') as string[],
    };
  } catch (error: any) {
    console.error('[Airtable createContentLog] Error occurred:', {
      status: error.statusCode || error.status,
      message: error.message,
      error
    });
    
    // Retry without Action_Type if Airtable rejects it as a computed field
    if (error.statusCode === 422 && error.message?.includes('Action_Type')) {
      console.warn('[Airtable createContentLog] "Action_Type" field rejected as computed, retrying without it');
      const retryFields: any = {
        Keyword_ID: log.Keyword_ID,
        Content_Body: log.Content_Body,
        Diff_Summary: log.Diff_Summary,
        Reasoning_Chain: log.Reasoning_Chain,
      };
      
      try {
        const records = await base(TABLES.CONTENT_LOG).create([{ fields: retryFields }]);
        if (records.length === 0) return null;
        const record = records[0];
        return {
          id: record.id,
          ID: record.get('ID') as number,
          Keyword_ID: record.get('Keyword_ID') as string[],
          Target_URL: record.get('Target_URL') as string,
          Action_Type: record.get('Action_Type') as any,
          Version: record.get('Content_Body') ? 'v2' : 'v1',
          Content_Body: record.get('Content_Body') as string,
          Diff_Summary: record.get('Diff_Summary') as string,
          Reasoning_Chain: record.get('Reasoning_Chain') as string,
          Created_At: (record.get('Time_Created') || new Date().toISOString()) as string,
          Editor: record.get('Editor') as string[],
        };
      } catch (retryError) {
        console.error('[Airtable createContentLog] Retry also failed:', retryError);
      }
    }
    return handleAirtableError(error,'createContentLog');
  }
}

export async function getAllContentHistory(): Promise<ContentLog[]> {
  try {
    const records = await base(TABLES.CONTENT_LOG)
      .select({
        sort: [{ field: 'Time_Created', direction: 'desc' }],
        maxRecords: 100,
      })
      .all();

    return records.map((record) => ({
      id: record.id,
      ID: record.get('ID') as number,
      Keyword_ID: record.get('Keyword_ID') as string[],
      Target_URL: record.get('Target_URL') as string,
      Action_Type: record.get('Action_Type') as any,
      Version: record.get('Content_Body') ? 'v2' : 'v1',
      Content_Body: record.get('Content_Body') as string,
      Diff_Summary: record.get('Diff_Summary') as string,
      Reasoning_Chain: record.get('Reasoning_Chain') as string,
      Created_At: (record.get('Time_Created') || new Date().toISOString()) as string,
      Editor: record.get('Editor') as string[],
    }));
  } catch (error) {
    return handleAirtableError(error, 'getAllContentHistory');
  }
}

export async function getPerformanceData(): Promise<PerformanceData[]> {
  try {
    const records = await base(TABLES.PERFORMANCE_DATA).select({
      sort: [{ field: 'Date', direction: 'desc' }]
    }).all();
    return records.map((record) => ({
      id: record.id,
      ID: record.get('ID') as number,
      Keyword_ID: record.get('Keyword_ID') as string[],
      Target_URL: record.get('Target_URL') as string,
      Date: record.get('Date') as string,
      GSC_Clicks: record.get('GSC_Clicks') as number,
      GSC_Impressions: record.get('GSC_Impressions') as number,
      Sistrix_VI: record.get('Sistrix_VI') as number,
      Position: record.get('Position') as number,
      Source: record.get('Source') as any,
    }));
  } catch (error) {
    return handleAirtableError(error,'getPerformanceData');
  }
}

export async function getPerformanceDataByUrl(targetUrl: string): Promise<PerformanceData[]> {
  try {
    const records = await base(TABLES.PERFORMANCE_DATA).select({
      filterByFormula: `{Target_URL} = '${targetUrl}'`,
      sort: [{ field: 'Date', direction: 'asc' }]
    }).all();
    return records.map((record) => ({
      id: record.id,
      ID: record.get('ID') as number,
      Keyword_ID: record.get('Keyword_ID') as string[],
      Target_URL: record.get('Target_URL') as string,
      Date: record.get('Date') as string,
      GSC_Clicks: record.get('GSC_Clicks') as number,
      GSC_Impressions: record.get('GSC_Impressions') as number,
      Sistrix_VI: record.get('Sistrix_VI') as number,
      Position: record.get('Position') as number,
      Source: record.get('Source') as any,
    }));
  } catch (error) {
    return handleAirtableError(error,'getPerformanceDataByUrl');
  }
}

export async function getCostConfigs(): Promise<CostConfig[]> {
  try {
    const records = await base(TABLES.COST_CONFIG).select().all();
    return records.map((record) => ({
      id: record.id,
      Page_Type: record.get('Page_Type') as any,
      Action_Type: record.get('Action_Type') as any,
      Agency_Cost: record.get('Agency_Cost') as number,
      Overhead_Cost: record.get('Overhead_Cost') as number,
    }));
  } catch (error) {
    return handleAirtableError(error,'getCostConfigs');
  }
}

export async function updateCostConfig(id: string, config: Partial<CostConfig>): Promise<CostConfig | null> {
  try {
    const fields: any = {};
    if (config.Page_Type) fields.Page_Type = config.Page_Type;
    if (config.Action_Type) fields.Action_Type = config.Action_Type;
    if (config.Agency_Cost !== undefined) fields.Agency_Cost = config.Agency_Cost;
    if (config.Overhead_Cost !== undefined) fields.Overhead_Cost = config.Overhead_Cost;

    const records = await base(TABLES.COST_CONFIG).update([{ id, fields }]);
    if (records.length === 0) return null;
    const record = records[0];
    return {
      id: record.id,
      Page_Type: record.get('Page_Type') as any,
      Action_Type: record.get('Action_Type') as any,
      Agency_Cost: record.get('Agency_Cost') as number,
      Overhead_Cost: record.get('Overhead_Cost') as number,
    };
  } catch (error) {
    return handleAirtableError(error,'updateCostConfig');
  }
}

export async function getPotentialTrends(): Promise<PotentialTrend[]> {
  try {
    console.log(`[Airtable] Fetching from table: "${TABLES.POTENTIAL_TRENDS}"`);
    const records = await base(TABLES.POTENTIAL_TRENDS).select().all();
    console.log(`[Airtable] Successfully fetched ${records.length} records from "${TABLES.POTENTIAL_TRENDS}"`);
    
    return records.map((record) => ({
      id: record.id,
      Trend_Topic: record.get('Trend_Topic') as string,
      Source: record.get('Source') as 'GSC' | 'Sistrix',
      Gap_Score: record.get('Gap_Score') as number,
      Status: record.get('Status') as 'New' | 'Claimed' | 'Blacklisted',
    }));
  } catch (error) {
    return handleAirtableError(error,'getPotentialTrends');
  }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  try {
    const records = await base(TABLES.AUDIT_LOGS).select().all();
    return records.map((record) => ({
      id: record.id,
      ID: record.get('ID') as number,
      Action: record.get('Action') as string,
      Timestamp: record.get('Timestamp') as string,
      User_ID: record.get('User_ID') as string[],
      Raw_Payload: record.get('Raw_Payload') as string,
    }));
  } catch (error) {
    return handleAirtableError(error,'getAuditLogs');
  }
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 10000; // Increased to 10s

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Airtable] Fetching user by email: ${email} (Attempt ${attempt}/${MAX_RETRIES})`);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Airtable request timed out')), TIMEOUT_MS)
      );

      const fetchPromise = base(TABLES.USERS)
        .select({
          filterByFormula: `{Email} = '${email}'`,
          maxRecords: 1,
        })
        .firstPage();

      const records = await Promise.race([fetchPromise, timeoutPromise]) as any[];

      if (records.length === 0) {
        console.log(`[Airtable] No user found for email: ${email}`);
        return null;
      }

      const record = records[0];
      console.log(`[Airtable] User found: ${record.id}`);
      return {
        id: record.id,
        Name: record.get('Name') as string,
        Email: record.get('Email') as string,
        Role: record.get('Role') as 'Admin' | 'Editor' | 'Viewer',
        Password: record.get('Password') as string,
        Password_Changed: record.get('Password_Changed') as boolean,
      };
    } catch (error: any) {
      const status = error.statusCode || error.status;
      if (status === 403 || status === 401) {
    return handleAirtableError(error,'getUserByEmail');
      }

      console.error(`[Airtable] Error fetching user (Attempt ${attempt}):`, error.message || error);
      
      if (attempt === MAX_RETRIES) {
        console.error('[Airtable] Max retries reached for getUserByEmail');
        return null;
      }
      
      // Exponential backoff: 500ms, 1000ms
      const delay = attempt * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return null;
}

export async function countUsers(): Promise<number> {
  try {
    console.log('[Airtable] Counting users...');
    const records = await base(TABLES.USERS).select({
      fields: ['Email'],
    }).all();
    
    console.log(`[Airtable] User count check returned ${records.length} records`);
    return records.length;
  } catch (error) {
    return handleAirtableError(error,'countUsers');
  }
}

export async function getAllUsers(): Promise<UserRecord[]> {
  try {
    console.log('[Airtable] Fetching all users...');
    const records = await base(TABLES.USERS).select().all();
    
    return records.map((record) => ({
      id: record.id,
      Name: record.get('Name') as string,
      Email: record.get('Email') as string,
      Role: record.get('Role') as 'Admin' | 'Editor' | 'Viewer',
      Password: record.get('Password') as string,
      Password_Changed: record.get('Password_Changed') as boolean,
    }));
  } catch (error) {
    return handleAirtableError(error,'getAllUsers');
  }
}

export async function createUser(userData: Partial<UserRecord>): Promise<UserRecord | null> {
  try {
    console.log(`[Airtable] Creating user: ${userData.Email}`);
    const records = await base(TABLES.USERS).create([
      {
        fields: {
          Name: userData.Name,
          Email: userData.Email,
          Role: userData.Role || 'Editor',
          Password: userData.Password,
          Password_Changed: userData.Password_Changed || false,
        },
      },
    ]);

    if (records.length === 0) {
      console.error('[Airtable] No records returned after creation');
      return null;
    }

    const record = records[0];
    console.log(`[Airtable] User created successfully: ${record.id}`);
    return {
      id: record.id,
      Name: record.get('Name') as string,
      Email: record.get('Email') as string,
      Role: record.get('Role') as 'Admin' | 'Editor' | 'Viewer',
      Password: record.get('Password') as string,
      Password_Changed: record.get('Password_Changed') as boolean,
    };
  } catch (error) {
    return handleAirtableError(error,'createUser');
  }
}

export async function updateUser(id: string, userData: Partial<UserRecord>): Promise<UserRecord | null> {
  try {
    console.log(`[Airtable] Updating user: ${id}`);
    const fields: any = {};
    if (userData.Name) fields.Name = userData.Name;
    if (userData.Email) fields.Email = userData.Email;
    if (userData.Role) fields.Role = userData.Role;
    if (userData.Password) fields.Password = userData.Password;
    if (userData.Password_Changed !== undefined) fields.Password_Changed = userData.Password_Changed;

    const records = await base(TABLES.USERS).update([
      {
        id,
        fields,
      },
    ]);

    if (records.length === 0) {
      console.error('[Airtable] No records returned after update');
      return null;
    }

    const record = records[0];
    console.log(`[Airtable] User updated successfully: ${record.id}`);
    return {
      id: record.id,
      Name: record.get('Name') as string,
      Email: record.get('Email') as string,
      Role: record.get('Role') as 'Admin' | 'Editor' | 'Viewer',
      Password: record.get('Password') as string,
      Password_Changed: record.get('Password_Changed') as boolean,
    };
  } catch (error) {
    return handleAirtableError(error,'updateUser');
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    console.log(`[Airtable] Deleting user: ${id}`);
    await base(TABLES.USERS).destroy([id]);
    console.log(`[Airtable] User deleted successfully: ${id}`);
    return true;
  } catch (error) {
    return handleAirtableError(error,'deleteUser');
  }
}

export async function bulkCreateKeywords(keywords: Partial<KeywordMap>[]): Promise<{ created: KeywordMap[], skipped: SkippedKeyword[] }> {
  try {
    console.log(`[Airtable] Bulk creating ${keywords.length} keywords`);
    
    const createdRecords: KeywordMap[] = [];
    const skippedRecords: SkippedKeyword[] = [];
    const validKeywords: Partial<KeywordMap>[] = [];

    // Pre-validation: Check for duplicates and skip them
    for (const kw of keywords) {
      if (kw.Target_URL && kw.Keyword) {
        // Check for Keyword + URL uniqueness
        const existingKeywordUrl = await base(TABLES.KEYWORD_MAP).select({
          filterByFormula: `AND({Target_URL} = '${kw.Target_URL}', {Keyword} = '${kw.Keyword.replace(/'/g, "\\'")}')`,
          maxRecords: 1,
        }).firstPage();

        if (existingKeywordUrl.length > 0) {
          console.log(`[Airtable] Skipping duplicate: ${kw.Keyword} for ${kw.Target_URL}`);
          skippedRecords.push({
            ...kw,
            reason: `Die Kombination aus Keyword "${kw.Keyword}" und URL "${kw.Target_URL}" existiert bereits.`
          });
          continue;
        }
      }
      validKeywords.push(kw);
    }

    // Airtable allows max 10 records per create call
    const chunks = [];
    for (let i = 0; i < validKeywords.length; i += 10) {
      chunks.push(validKeywords.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      const currentChunkValid: Partial<KeywordMap>[] = [];

      // Validation for bulk: Check if any of the keywords being imported as 'Y' already exist for that URL
      for (const kw of chunk) {
        try {
          // 1. Check if URL already has a Main Keyword
          if (kw.Target_URL && kw.Main_Keyword === 'Y') {
            const existingMainKeywords = await base(TABLES.KEYWORD_MAP).select({
              filterByFormula: `AND({Target_URL} = '${kw.Target_URL}', {Main_Keyword} = 'Y')`,
              maxRecords: 1,
            }).firstPage();

            if (existingMainKeywords.length > 0) {
              throw new AirtableValidationError(`Die URL ${kw.Target_URL} hat bereits ein Main Keyword.`, 409);
            }
          }

          // 2. Check if this Keyword is already a Main Keyword for ANY URL
          if (kw.Keyword && kw.Main_Keyword === 'Y') {
            const existingGlobalMain = await base(TABLES.KEYWORD_MAP).select({
              filterByFormula: `AND({Keyword} = '${kw.Keyword.replace(/'/g, "\\'")}', {Main_Keyword} = 'Y')`,
              maxRecords: 1,
            }).firstPage();

            if (existingGlobalMain.length > 0) {
              throw new AirtableValidationError(`Das Keyword "${kw.Keyword}" ist bereits als Main Keyword für eine andere URL registriert.`, 409);
            }
          }
          
          currentChunkValid.push(kw);
        } catch (error: any) {
          console.log(`[Airtable] Skipping keyword due to validation error: ${kw.Keyword}`, error.message);
          skippedRecords.push({
            ...kw,
            reason: error.message || 'Unbekannter Validierungsfehler'
          });
        }
      }

      if (currentChunkValid.length === 0) continue;

      try {
        const records = await base(TABLES.KEYWORD_MAP).create(
          currentChunkValid.map((kw) => ({
            fields: {
              Keyword: kw.Keyword,
              Target_URL: kw.Target_URL,
              Search_Volume: kw.Search_Volume,
              Difficulty: kw.Difficulty,
              Status: kw.Status || 'Backlog',
              Editorial_Deadline: kw.Editorial_Deadline,
              // Assigned_Editor is an array of record IDs
              Assigned_Editor: kw.Assigned_Editor,
              Main_Keyword: kw.Main_Keyword || 'N',
              Article_Count: kw.Article_Count,
              Avg_Product_Value: kw.Avg_Product_Value,
              Action_Type: kw.Action_Type || 'Erstellung',
              Ranking: kw.Ranking,
            },
          }))
        );
        records.forEach((record) => {
          createdRecords.push({
            id: record.id,
            Keyword: record.get('Keyword') as string,
            Target_URL: record.get('Target_URL') as string,
            Search_Volume: record.get('Search_Volume') as number,
            Difficulty: record.get('Difficulty') as number,
            Status: record.get('Status') as KeywordStatus,
            Editorial_Deadline: record.get('Editorial_Deadline') as string,
            Assigned_Editor: record.get('Assigned_Editor') as string[],
            Main_Keyword: (record.get('Main_Keyword') as 'Y' | 'N') || 'N',
            Article_Count: record.get('Article_Count') as number,
            Avg_Product_Value: record.get('Avg_Product_Value') as number,
            Action_Type: (record.get('Action_Type') as 'Erstellung' | 'Optimierung') || 'Erstellung',
            Ranking: record.get('Ranking') as number,
          });
        });
      } catch (error: any) {
        // If Action_Type is missing, retry this chunk without it
        if (error.statusCode === 422 && error.message?.includes('Action_Type')) {
          console.warn('[Airtable] "Action_Type" field missing in bulk creation, retrying chunk without it');
          const retryRecords = await base(TABLES.KEYWORD_MAP).create(
            currentChunkValid.map((kw) => ({
              fields: {
                Keyword: kw.Keyword,
                Target_URL: kw.Target_URL,
                Search_Volume: kw.Search_Volume,
                Difficulty: kw.Difficulty,
                Status: kw.Status || 'Backlog',
                Editorial_Deadline: kw.Editorial_Deadline,
                Assigned_Editor: kw.Assigned_Editor,
                Main_Keyword: kw.Main_Keyword || 'N',
                Article_Count: kw.Article_Count,
                Avg_Product_Value: kw.Avg_Product_Value,
                Ranking: kw.Ranking,
              },
            }))
          );
          retryRecords.forEach((record) => {
            createdRecords.push({
              id: record.id,
              Keyword: record.get('Keyword') as string,
              Target_URL: record.get('Target_URL') as string,
              Search_Volume: record.get('Search_Volume') as number,
              Difficulty: record.get('Difficulty') as number,
              Status: record.get('Status') as KeywordStatus,
              Editorial_Deadline: record.get('Editorial_Deadline') as string,
              Assigned_Editor: record.get('Assigned_Editor') as string[],
              Main_Keyword: (record.get('Main_Keyword') as 'Y' | 'N') || 'N',
              Article_Count: record.get('Article_Count') as number,
              Avg_Product_Value: record.get('Avg_Product_Value') as number,
              Action_Type: 'Erstellung',
              Ranking: record.get('Ranking') as number,
            });
          });
        } else {
          throw error;
        }
      }
    }

    console.log(`[Airtable] Successfully created ${createdRecords.length} keywords, skipped ${skippedRecords.length}`);
    return { created: createdRecords, skipped: skippedRecords };
  } catch (error) {
    return handleAirtableError(error,'bulkCreateKeywords');
  }
}

export async function createKeyword(kw: Partial<KeywordMap>): Promise<KeywordMap | null> {
  try {
    console.log(`[Airtable] Creating single keyword: ${kw.Keyword}`);

    if (!kw.Keyword || !kw.Target_URL) {
      throw new AirtableValidationError('Keyword und Target_URL sind Pflichtfelder.');
    }

    // Validation: Keyword + URL uniqueness
    const existingKeywordUrl = await base(TABLES.KEYWORD_MAP).select({
      filterByFormula: `AND({Target_URL} = '${kw.Target_URL}', {Keyword} = '${kw.Keyword.replace(/'/g, "\\'")}')`,
      maxRecords: 1,
    }).firstPage();

    if (existingKeywordUrl.length > 0) {
      throw new AirtableValidationError(`Die Kombination aus Keyword "${kw.Keyword}" und URL "${kw.Target_URL}" existiert bereits.`, 409);
    }

    // Validation: A URL can only have ONE "Main Keyword" (Y)
    // AND a Keyword can only be a "Main Keyword" (Y) ONCE globally
    if (kw.Main_Keyword === 'Y') {
      // 1. URL check
      const existingMainKeywords = await base(TABLES.KEYWORD_MAP).select({
        filterByFormula: `AND({Target_URL} = '${kw.Target_URL}', {Main_Keyword} = 'Y')`,
        maxRecords: 1,
      }).firstPage();

      if (existingMainKeywords.length > 0) {
        throw new AirtableValidationError(`Die URL ${kw.Target_URL} hat bereits ein Main Keyword.`, 409);
      }

      // 2. Global Keyword check
      const existingGlobalMain = await base(TABLES.KEYWORD_MAP).select({
        filterByFormula: `AND({Keyword} = '${kw.Keyword.replace(/'/g, "\\'")}', {Main_Keyword} = 'Y')`,
        maxRecords: 1,
      }).firstPage();

      if (existingGlobalMain.length > 0) {
        throw new AirtableValidationError(`Das Keyword "${kw.Keyword}" ist bereits als Main Keyword für eine andere URL registriert.`, 409);
      }
    }

    const records = await base(TABLES.KEYWORD_MAP).create([
      {
        fields: {
          Keyword: kw.Keyword,
          Target_URL: kw.Target_URL,
          Search_Volume: kw.Search_Volume,
          Difficulty: kw.Difficulty,
          Status: kw.Status || 'Backlog',
          Editorial_Deadline: kw.Editorial_Deadline,
          Assigned_Editor: kw.Assigned_Editor,
          Main_Keyword: kw.Main_Keyword || 'N',
          Article_Count: kw.Article_Count,
          Avg_Product_Value: kw.Avg_Product_Value,
          Policy: kw.Policy,
          Priority_Score: kw.Priority_Score,
          Action_Type: kw.Action_Type || 'Erstellung',
          Ranking: kw.Ranking,
        },
      },
    ]);

    if (records.length === 0) return null;

    const record = records[0];
    const createdKeyword = {
      id: record.id,
      Keyword: record.get('Keyword') as string,
      Target_URL: record.get('Target_URL') as string,
      Search_Volume: record.get('Search_Volume') as number,
      Difficulty: record.get('Difficulty') as number,
      Status: record.get('Status') as KeywordStatus,
      Editorial_Deadline: record.get('Editorial_Deadline') as string,
      Assigned_Editor: record.get('Assigned_Editor') as string[],
      Main_Keyword: (record.get('Main_Keyword') as 'Y' | 'N') || 'N',
      Article_Count: record.get('Article_Count') as number,
      Avg_Product_Value: record.get('Avg_Product_Value') as number,
      Policy: record.get('Policy') as number,
      Priority_Score: record.get('Priority_Score') as number,
      Action_Type: (record.get('Action_Type') as 'Erstellung' | 'Optimierung') || 'Erstellung',
      Ranking: record.get('Ranking') as number,
    };

    return createdKeyword;
  } catch (error: any) {
    // Retry without Action_Type if missing in Airtable
    if (error.statusCode === 422 && error.message?.includes('Action_Type')) {
      console.warn('[Airtable] "Action_Type" field missing in Keyword-Map, retrying creation without it');
      const fields: any = {
        Keyword: kw.Keyword,
        Target_URL: kw.Target_URL,
        Search_Volume: kw.Search_Volume,
        Difficulty: kw.Difficulty,
        Status: kw.Status || 'Backlog',
        Editorial_Deadline: kw.Editorial_Deadline,
        Assigned_Editor: kw.Assigned_Editor,
        Main_Keyword: kw.Main_Keyword || 'N',
        Article_Count: kw.Article_Count,
        Avg_Product_Value: kw.Avg_Product_Value,
        Policy: kw.Policy,
        Priority_Score: kw.Priority_Score,
        Ranking: kw.Ranking,
      };
      const retryRecords = await base(TABLES.KEYWORD_MAP).create([{ fields }]);
      if (retryRecords.length === 0) return null;
      const retryRecord = retryRecords[0];
      const createdKeyword = {
        id: retryRecord.id,
        Keyword: retryRecord.get('Keyword') as string,
        Target_URL: retryRecord.get('Target_URL') as string,
        Search_Volume: retryRecord.get('Search_Volume') as number,
        Difficulty: retryRecord.get('Difficulty') as number,
        Status: retryRecord.get('Status') as KeywordStatus,
        Editorial_Deadline: retryRecord.get('Editorial_Deadline') as string,
        Assigned_Editor: retryRecord.get('Assigned_Editor') as string[],
        Main_Keyword: (retryRecord.get('Main_Keyword') as 'Y' | 'N') || 'N',
        Article_Count: retryRecord.get('Article_Count') as number,
        Avg_Product_Value: retryRecord.get('Avg_Product_Value') as number,
        Policy: retryRecord.get('Policy') as number,
        Priority_Score: retryRecord.get('Priority_Score') as number,
        Action_Type: 'Erstellung' as any,
        Ranking: retryRecord.get('Ranking') as number,
      };

      return createdKeyword;
    }
    return handleAirtableError(error,'createKeyword');
  }
}

export async function updateKeyword(id: string, kw: Partial<KeywordMap>): Promise<KeywordMap | null> {
  try {
    console.log(`[Airtable] Updating keyword: ${id}`);

    // Fetch current record to have full context for validation
    const currentRecord = await base(TABLES.KEYWORD_MAP).find(id);

    // If Keyword or Target_URL or Main_Keyword is being updated, we need to re-validate
    if (kw.Keyword !== undefined || kw.Target_URL !== undefined || kw.Main_Keyword !== undefined) {
      const currentKeyword = currentRecord.get('Keyword') as string;
      const currentURL = currentRecord.get('Target_URL') as string;
      const currentMain = currentRecord.get('Main_Keyword') as string;

      const nextKeyword = kw.Keyword !== undefined ? kw.Keyword : currentKeyword;
      const nextURL = kw.Target_URL !== undefined ? kw.Target_URL : currentURL;
      const nextMain = kw.Main_Keyword !== undefined ? kw.Main_Keyword : currentMain;

      // 1. Check Keyword + URL uniqueness if either changed
      if (kw.Keyword !== undefined || kw.Target_URL !== undefined) {
        const existingKeywordUrl = await base(TABLES.KEYWORD_MAP).select({
          filterByFormula: `AND({Target_URL} = '${nextURL}', {Keyword} = '${nextKeyword.replace(/'/g, "\\'")}', RECORD_ID() != '${id}')`,
          maxRecords: 1,
        }).firstPage();

        if (existingKeywordUrl.length > 0) {
          throw new AirtableValidationError(`Die Kombination aus Keyword "${nextKeyword}" und URL "${nextURL}" existiert bereits.`, 409);
        }
      }

      // 2. Check Main Keyword uniqueness if Main_Keyword became 'Y' or URL/Keyword changed while it is 'Y'
      if (nextMain === 'Y' && (kw.Main_Keyword === 'Y' || kw.Target_URL !== undefined || kw.Keyword !== undefined)) {
        // 2a. URL check
        const existingMainKeywords = await base(TABLES.KEYWORD_MAP).select({
          filterByFormula: `AND({Target_URL} = '${nextURL}', {Main_Keyword} = 'Y', RECORD_ID() != '${id}')`,
          maxRecords: 1,
        }).firstPage();

        if (existingMainKeywords.length > 0) {
          throw new AirtableValidationError(`Die URL ${nextURL} hat bereits ein Main Keyword.`, 409);
        }

        // 2b. Global Keyword check
        const existingGlobalMain = await base(TABLES.KEYWORD_MAP).select({
          filterByFormula: `AND({Keyword} = '${nextKeyword.replace(/'/g, "\\'")}', {Main_Keyword} = 'Y', RECORD_ID() != '${id}')`,
          maxRecords: 1,
        }).firstPage();

        if (existingGlobalMain.length > 0) {
          throw new AirtableValidationError(`Das Keyword "${nextKeyword}" ist bereits als Main Keyword für eine andere URL registriert.`, 409);
        }
      }
    }

    const fields: any = {};
    if (kw.Keyword !== undefined) fields.Keyword = kw.Keyword;
    if (kw.Target_URL !== undefined) fields.Target_URL = kw.Target_URL;
    if (kw.Search_Volume !== undefined) fields.Search_Volume = kw.Search_Volume;
    if (kw.Difficulty !== undefined) fields.Difficulty = kw.Difficulty;
    if (kw.Status !== undefined) fields.Status = kw.Status;
    if (kw.Editorial_Deadline !== undefined) fields.Editorial_Deadline = kw.Editorial_Deadline;
    if (kw.Assigned_Editor !== undefined) fields.Assigned_Editor = kw.Assigned_Editor;
    if (kw.Main_Keyword !== undefined) fields.Main_Keyword = kw.Main_Keyword;
    if (kw.Article_Count !== undefined) fields.Article_Count = kw.Article_Count;
    if (kw.Avg_Product_Value !== undefined) fields.Avg_Product_Value = kw.Avg_Product_Value;
    if (kw.Policy !== undefined) fields.Policy = kw.Policy;
    if (kw.Priority_Score !== undefined) fields.Priority_Score = kw.Priority_Score;
    if (kw.Action_Type !== undefined) fields.Action_Type = kw.Action_Type;
    if (kw.Last_Published !== undefined) fields.Last_Published = kw.Last_Published;
    if (kw.Ranking !== undefined) fields.Ranking = kw.Ranking;

    let records;
    try {
      records = await base(TABLES.KEYWORD_MAP).update([
        {
          id,
          fields,
        },
      ]);
    } catch (error: any) {
      // If Action_Type field is missing in Airtable, retry without it
      if (error.statusCode === 422 && error.message?.includes('Action_Type')) {
        console.warn(`[Airtable] "Action_Type" field missing in Keyword-Map, retrying update without it for record ${id}`);
        delete fields.Action_Type;
        records = await base(TABLES.KEYWORD_MAP).update([
          {
            id,
            fields,
          },
        ]);
      } else {
        throw error;
      }
    }

    if (!records || records.length === 0) return null;

    const record = records[0];
    return {
      id: record.id,
      Keyword: record.get('Keyword') as string,
      Target_URL: record.get('Target_URL') as string,
      Search_Volume: record.get('Search_Volume') as number,
      Difficulty: record.get('Difficulty') as number,
      Status: record.get('Status') as KeywordStatus,
      Editorial_Deadline: record.get('Editorial_Deadline') as string,
      Assigned_Editor: record.get('Assigned_Editor') as string[],
      Main_Keyword: (record.get('Main_Keyword') as 'Y' | 'N') || 'N',
      Article_Count: record.get('Article_Count') as number,
      Avg_Product_Value: record.get('Avg_Product_Value') as number,
      Policy: record.get('Policy') as number,
      Priority_Score: record.get('Priority_Score') as number,
      Action_Type: (record.get('Action_Type') as 'Erstellung' | 'Optimierung') || 'Erstellung',
      Ranking: record.get('Ranking') as number,
      Last_Published: record.get('Last_Published') as string,
    };
  } catch (error) {
    return handleAirtableError(error,'updateKeyword');
  }
}

export async function createTrend(trend: Partial<PotentialTrend>): Promise<PotentialTrend | null> {
  try {
    console.log(`[Airtable] Creating single trend: ${trend.Trend_Topic}`);
    const records = await base(TABLES.POTENTIAL_TRENDS).create([
      {
        fields: {
          Trend_Topic: trend.Trend_Topic,
          Source: trend.Source || 'GSC',
          Gap_Score: trend.Gap_Score || 0,
          Status: trend.Status || 'New',
        },
      },
    ]);

    if (records.length === 0) return null;

    const record = records[0];
    return {
      id: record.id,
      Trend_Topic: record.get('Trend_Topic') as string,
      Source: record.get('Source') as 'GSC' | 'Sistrix',
      Gap_Score: record.get('Gap_Score') as number,
      Status: record.get('Status') as 'New' | 'Claimed' | 'Blacklisted',
    };
  } catch (error) {
    return handleAirtableError(error,'createTrend');
  }
}

export async function addToBlacklist(entry: Partial<BlacklistEntry>): Promise<BlacklistEntry | null> {
  try {
    console.log(`[Airtable] Adding to blacklist: ${entry.Keyword} (Type: ${entry.Type})`);
    const records = await base(TABLES.BLACKLIST).create([
      {
        fields: {
          Keyword: entry.Keyword,
          Type: entry.Type || 'Keyword',
          Reason: entry.Reason,
          Added_At: new Date().toISOString(),
        },
      },
    ]);

    if (records.length === 0) return null;

    const record = records[0];
    return {
      id: record.id,
      Keyword: record.get('Keyword') as string,
      Type: record.get('Type') as 'Keyword' | 'URL',
      Reason: record.get('Reason') as string,
      Added_At: record.get('Added_At') as string,
    };
  } catch (error) {
    return handleAirtableError(error,'addToBlacklist');
  }
}

export async function getBlacklist(): Promise<BlacklistEntry[]> {
  try {
    let records: readonly any[] = [];
    try {
      records = await base(TABLES.BLACKLIST).select().all();
    } catch (error: any) {
      // If 422 error (Unknown field name), try fetching without 'Type' field
      if (error.statusCode === 422 && error.message?.includes('Type')) {
        console.warn('[Airtable] "Type" field missing in Blacklist table, falling back to "Keyword" only');
        records = await base(TABLES.BLACKLIST).select({ fields: ['Keyword', 'Reason', 'Added_At'] }).all();
      } else {
        throw error;
      }
    }
    return records.map((record) => ({
      id: record.id,
      Keyword: record.get('Keyword') as string,
      Type: (record.get('Type') as 'Keyword' | 'URL') || 'Keyword',
      Reason: record.get('Reason') as string,
      Added_At: record.get('Added_At') as string,
    }));
  } catch (error) {
    return handleAirtableError(error,'getBlacklist');
  }
}

export async function getConfig(): Promise<ConfigRecord[]> {
  try {
    const records = await base(TABLES.CONFIG).select().all();
    return records.map((record) => ({
      id: record.id,
      Key: record.get('Key') as string,
      Value: record.get('Value') as string,
      Description: record.get('Description') as string,
      Updated_At: record.get('Updated_At') as string,
    }));
  } catch (error) {
    return handleAirtableError(error,'getConfig');
  }
}

export async function updateConfig(key: string, value: string): Promise<ConfigRecord | null> {
  try {
    console.log(`[Airtable] Updating config: ${key}`);
    
    // Find the record first
    const records = await base(TABLES.CONFIG).select({
      filterByFormula: `{Key} = '${key}'`,
      maxRecords: 1,
    }).firstPage();

    if (records.length === 0) {
      // Create if not exists
      const newRecords = await base(TABLES.CONFIG).create([
        {
          fields: {
            Key: key,
            Value: value,
            Updated_At: new Date().toISOString(),
          },
        },
      ]);
      const record = newRecords[0];
      return {
        id: record.id,
        Key: record.get('Key') as string,
        Value: record.get('Value') as string,
        Description: record.get('Description') as string,
        Updated_At: record.get('Updated_At') as string,
      };
    }

    const recordId = records[0].id;
    const updatedRecords = await base(TABLES.CONFIG).update([
      {
        id: recordId,
        fields: {
          Value: value,
          Updated_At: new Date().toISOString(),
        },
      },
    ]);

    const record = updatedRecords[0];
    return {
      id: record.id,
      Key: record.get('Key') as string,
      Value: record.get('Value') as string,
      Description: record.get('Description') as string,
      Updated_At: record.get('Updated_At') as string,
    };
  } catch (error) {
    return handleAirtableError(error,'updateConfig');
  }
}

export async function updateBlacklist(id: string, entry: Partial<BlacklistEntry>): Promise<BlacklistEntry | null> {
  try {
    console.log(`[Airtable] Updating blacklist entry: ${id}`);
    const fields: any = {};
    if (entry.Keyword !== undefined) fields.Keyword = entry.Keyword;
    if (entry.Type !== undefined) fields.Type = entry.Type;
    if (entry.Reason !== undefined) fields.Reason = entry.Reason;

    const records = await base(TABLES.BLACKLIST).update([
      {
        id,
        fields,
      },
    ]);

    if (records.length === 0) return null;

    const record = records[0];
    return {
      id: record.id,
      Keyword: record.get('Keyword') as string,
      Type: record.get('Type') as 'Keyword' | 'URL',
      Reason: record.get('Reason') as string,
      Added_At: record.get('Added_At') as string,
    };
  } catch (error) {
    return handleAirtableError(error,'updateBlacklist');
  }
}

export async function deleteFromBlacklist(id: string): Promise<boolean> {
  try {
    console.log(`[Airtable] Deleting from blacklist: ${id}`);
    await base(TABLES.BLACKLIST).destroy([id]);
    return true;
  } catch (error) {
    return handleAirtableError(error,'deleteFromBlacklist');
  }
}

export async function deleteKeyword(id: string): Promise<boolean> {
  try {
    console.log(`[Airtable] Deleting keyword: ${id}`);
    await base(TABLES.KEYWORD_MAP).destroy([id]);
    return true;
  } catch (error) {
    return handleAirtableError(error,'deleteKeyword');
  }
}

export async function bulkDeleteKeywords(ids: string[]): Promise<boolean> {
  try {
    console.log(`[Airtable] Bulk deleting ${ids.length} keywords`);
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) {
      chunks.push(ids.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      await base(TABLES.KEYWORD_MAP).destroy(chunk);
    }
    return true;
  } catch (error) {
    return handleAirtableError(error,'bulkDeleteKeywords');
  }
}

export async function bulkDeleteFromBlacklist(ids: string[]): Promise<boolean> {
  try {
    console.log(`[Airtable] Bulk deleting ${ids.length} from blacklist`);
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) {
      chunks.push(ids.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      await base(TABLES.BLACKLIST).destroy(chunk);
    }
    return true;
  } catch (error) {
    return handleAirtableError(error,'bulkDeleteFromBlacklist');
  }
}

/**
 * Performs an upsert operation on Performance_Data.
 * It checks for existing records with the same Target_URL, Date, and Source.
 */
export async function upsertPerformanceData(data: Partial<PerformanceData>[]): Promise<{ created: number, updated: number, errors: any[] }> {
  try {
    console.log(`[Airtable] Upserting ${data.length} performance data records`);
    let created = 0;
    let updated = 0;
    const errors: any[] = [];

    // Process in chunks of 10 for Airtable API limits
    const chunks = [];
    for (let i = 0; i < data.length; i += 10) {
      chunks.push(data.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      const updates: { id: string, fields: any }[] = [];
      const creations: { fields: any }[] = [];

      for (const item of chunk) {
        if (!item.Target_URL || !item.Date || !item.Source) {
          errors.push({ item, error: 'Missing required fields: Target_URL, Date, or Source' });
          continue;
        }

        try {
          // Check for existing record with same URL, Date, and Source
          const formula = `AND({Target_URL} = '${item.Target_URL}', {Date} = '${item.Date}', {Source} = '${item.Source}')`;
          const existing = await base(TABLES.PERFORMANCE_DATA).select({
            filterByFormula: formula,
            maxRecords: 1
          }).firstPage();

          const fields: any = {
            Target_URL: item.Target_URL,
            Date: item.Date,
            Source: item.Source,
            GSC_Clicks: item.GSC_Clicks,
            GSC_Impressions: item.GSC_Impressions,
            Sistrix_VI: item.Sistrix_VI,
            Position: item.Position,
            Keyword_ID: item.Keyword_ID,
          };

          if (existing.length > 0) {
            updates.push({ id: existing[0].id, fields });
          } else {
            creations.push({ fields });
          }
        } catch (err: any) {
          console.error(`[Airtable] Error checking existing record for ${item.Target_URL} on ${item.Date}:`, err);
          errors.push({ item, error: err.message });
        }
      }

      // Perform Batch Update
      if (updates.length > 0) {
        try {
          await base(TABLES.PERFORMANCE_DATA).update(updates);
          updated += updates.length;
        } catch (err: any) {
          console.error('[Airtable] Batch update failed:', err);
          errors.push({ type: 'update', count: updates.length, error: err.message });
        }
      }

      // Perform Batch Creation
      if (creations.length > 0) {
        try {
          await base(TABLES.PERFORMANCE_DATA).create(creations);
          created += creations.length;
        } catch (err: any) {
          console.error('[Airtable] Batch creation failed:', err);
          errors.push({ type: 'create', count: creations.length, error: err.message });
        }
      }
      
      // Rate limiting: 5 requests per second
      if (chunks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    return { created, updated, errors };
  } catch (error) {
    return handleAirtableError(error, 'upsertPerformanceData');
  }
}

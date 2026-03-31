import Airtable from 'airtable';
import 'server-only';
import { 
  KeywordStatus, 
  KeywordMap, 
  ContentLog, 
  PerformanceData, 
  PotentialTrend, 
  AuditLog, 
  UserRecord 
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

// --- Fetchers ---

async function handleAirtableError(error: any, operation: string): Promise<never> {
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
  } catch (error) {
    return handleAirtableError(error, 'getKeywordMap');
  }
}

export async function getContentLogs(): Promise<ContentLog[]> {
  try {
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
  } catch (error) {
    return handleAirtableError(error, 'getContentLogs');
  }
}

export async function getPerformanceData(): Promise<PerformanceData[]> {
  try {
    const records = await base('Performance-Data').select().all();
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
  } catch (error) {
    return handleAirtableError(error, 'getPerformanceData');
  }
}

export async function getPotentialTrends(): Promise<PotentialTrend[]> {
  try {
    // Try 'Potential-Trends' first, then 'Potential Trends' if it fails with 403/404
    const tableNames = ['Potential-Trends', 'Potential Trends'];
    let lastError: any;

    for (const tableName of tableNames) {
      try {
        console.log(`[Airtable] Attempting fetch from table: "${tableName}"`);
        const records = await base(tableName).select().all();
        console.log(`[Airtable] Successfully fetched ${records.length} records from "${tableName}"`);
        
        return records.map((record) => ({
          id: record.id,
          Trend_Topic: record.get('Trend_Topic') as string,
          Source: record.get('Source') as 'GSC' | 'Sistrix',
          Gap_Score: record.get('Gap_Score') as number,
          Status: record.get('Status') as 'New' | 'Claimed' | 'Blacklisted',
        }));
      } catch (error: any) {
        lastError = error;
        const status = error.statusCode || error.status;
        console.warn(`[Airtable] Failed to fetch from "${tableName}" (Status: ${status})`);
        // If it's not a 403 or 404, it might be a network/auth issue that won't be fixed by changing table name
        if (status !== 403 && status !== 404) {
          break;
        }
      }
    }
    
    return handleAirtableError(lastError, 'getPotentialTrends');
  } catch (error) {
    return handleAirtableError(error, 'getPotentialTrends');
  }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  try {
    const records = await base('Audit-Logs').select().all();
    return records.map((record) => ({
      id: record.id,
      ID: record.get('ID') as number,
      Action: record.get('Action') as string,
      Timestamp: record.get('Timestamp') as string,
      User_ID: record.get('User_ID') as string[],
      Raw_Payload: record.get('Raw_Payload') as string,
    }));
  } catch (error) {
    return handleAirtableError(error, 'getAuditLogs');
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

      const fetchPromise = base('Users')
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
      };
    } catch (error: any) {
      const status = error.statusCode || error.status;
      if (status === 403 || status === 401) {
        return handleAirtableError(error, 'getUserByEmail');
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
    const records = await base('Users').select({
      fields: ['Email'],
    }).all();
    
    console.log(`[Airtable] User count check returned ${records.length} records`);
    return records.length;
  } catch (error) {
    return handleAirtableError(error, 'countUsers');
  }
}

export async function createUser(userData: Partial<UserRecord>): Promise<UserRecord | null> {
  try {
    console.log(`[Airtable] Creating user: ${userData.Email}`);
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
    };
  } catch (error) {
    return handleAirtableError(error, 'createUser');
  }
}

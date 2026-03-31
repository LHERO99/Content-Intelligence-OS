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

// --- Table Names ---
export const TABLES = {
  KEYWORD_MAP: 'Keyword-Map',
  CONTENT_LOG: 'Content-Log',
  PERFORMANCE_DATA: 'Performance_Data',
  POTENTIAL_TRENDS: 'Potential_Trends',
  AUDIT_LOGS: 'Audit_Logs',
  USERS: 'Users',
} as const;

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
    const records = await base(TABLES.KEYWORD_MAP).select().all();
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
    const records = await base(TABLES.CONTENT_LOG).select().all();
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
    const records = await base(TABLES.PERFORMANCE_DATA).select().all();
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
    return handleAirtableError(error, 'getPotentialTrends');
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
    const records = await base(TABLES.USERS).select({
      fields: ['Email'],
    }).all();
    
    console.log(`[Airtable] User count check returned ${records.length} records`);
    return records.length;
  } catch (error) {
    return handleAirtableError(error, 'countUsers');
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
    return handleAirtableError(error, 'getAllUsers');
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
    return handleAirtableError(error, 'createUser');
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
    return handleAirtableError(error, 'updateUser');
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    console.log(`[Airtable] Deleting user: ${id}`);
    await base(TABLES.USERS).destroy([id]);
    console.log(`[Airtable] User deleted successfully: ${id}`);
    return true;
  } catch (error) {
    return handleAirtableError(error, 'deleteUser');
  }
}

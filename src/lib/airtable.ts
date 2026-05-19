import Airtable from 'airtable';
import 'server-only';
import { 
  KeywordStatus, 
  KeywordMap, 
  ContentLog, 
  PerformanceData, 
  URLPerformance,
  KeywordRankingHistory,
  PotentialTrend, 
  AuditLog, 
  UserRecord,
  BlacklistEntry,
  ConfigRecord,
  SkippedKeyword,
  CostConfig
} from './airtable-types';

export * from './airtable-types';

// Initialise at module load using env vars. If a var is missing the Airtable
// client will throw on the first actual network request — all API route handlers
// already wrap calls in try/catch, so the error surfaces as a proper 500 JSON
// response instead of a serverless function crash.
export const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY ?? '' });
export const base = airtable.base(process.env.AIRTABLE_BASE_ID ?? '');

// ---------------------------------------------------------------------------
// Config-Cache
// getConfig() is called on every agent step (loadStore) and for every API-key
// lookup. A short-lived in-process cache eliminates the redundant Airtable
// reads without staling user-facing config changes for more than 30 seconds.
// updateConfig() always invalidates the cache immediately.
// ---------------------------------------------------------------------------
const CONFIG_CACHE_TTL_MS = 30_000;
let _configCache: Record<string, string> | null = null;
let _configCacheAt = 0;

export function invalidateConfigCache(): void {
  _configCache = null;
  _configCacheAt = 0;
}


// --- Table Names ---
export const TABLES = {
  KEYWORD_MAP: 'Keyword-Map',
  CONTENT_LOG: 'Content-Log',
  AUDIT_LOGS: 'Audit_Logs',
  USERS: 'Users',
  BLACKLIST: 'Blacklist',
  CONFIG: 'Config',
  COST_CONFIG: 'Cost_Config',
  URL_PERFORMANCE: 'URL_Performance',
  KEYWORD_RANKING_HISTORY: 'Keyword_Ranking_History',
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
  
  // Log full error details to help debug Base64 length issues
  console.error(`[Airtable] Error in ${operation}:`, JSON.stringify({
    status,
    message,
    details: error.details,
    errorType: error.error
  }, null, 2));

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
    let blacklistRecords: readonly any[] = [];
    try {
      blacklistRecords = await base(TABLES.BLACKLIST).select({ fields: ['Keyword', 'Type'] }).all();
    } catch (error: any) {
      if (error.statusCode === 422 && error.message?.includes('Type')) {
        console.warn('[Airtable] "Type" field missing in Blacklist table, falling back to "Keyword" only');
        blacklistRecords = await base(TABLES.BLACKLIST).select({ fields: ['Keyword'] }).all();
      } else {
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
      Page_Type: record.get('Page_Type') as any,
      Ranking: record.get('Ranking') as number,
      Last_Published: record.get('Last_Published') as string,
    }));
  } catch (error) {
    return handleAirtableError(error,'getKeywordMap');
  }
}

export async function getKeywordsByUrl(targetUrl: string): Promise<KeywordMap[]> {
  try {
    const escaped = targetUrl.replace(/'/g, "\\'");
    const records = await base(TABLES.KEYWORD_MAP).select({
      filterByFormula: `{Target_URL} = '${escaped}'`,
    }).all();
    return records.map((record) => ({
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
      Page_Type: record.get('Page_Type') as any,
      Ranking: record.get('Ranking') as number,
      Last_Published: record.get('Last_Published') as string,
    }));
  } catch (error) {
    return handleAirtableError(error, 'getKeywordsByUrl');
  }
}

export async function getContentLogs(): Promise<ContentLog[]> {
  try {
    const records = await base(TABLES.CONTENT_LOG).select({
      sort: [{ field: 'Time_Created', direction: 'desc' }],
      maxRecords: 100
    }).all();
    return records.map((record) => {
      const rawTargetUrl = record.get('Target_URL');
      const targetUrl = Array.isArray(rawTargetUrl) ? rawTargetUrl[0] : rawTargetUrl;
      const loggedUrl = record.get('Logged_URL') as string;
      
      return {
        id: record.id,
        ID: record.get('ID') as number,
        Keyword_ID: record.get('Keyword_ID') as string[],
        Target_URL: (targetUrl || loggedUrl) as string,
        Logged_URL: loggedUrl,
        Action_Type: record.get('Action_Type') as any,
        Page_Type: record.get('Page_Type') as any,
        Version: record.get('Content_Body') ? 'v2' : 'v1',
        Content_Body: record.get('Content_Body') as string,
        Event_Label: record.get('Event_Label') as string,
        Created_At: (record.get('Time_Created') || new Date().toISOString()) as string,
        Editor: record.get('Editor') as string[],
      };
    });
  } catch (error) {
    return handleAirtableError(error,'getContentLogs');
  }
}

export async function getContentHistoryByUrl(targetUrl: string): Promise<ContentLog[]> {
  try {
    const records = await base(TABLES.CONTENT_LOG).select({
      filterByFormula: `OR({Target_URL} = '${targetUrl}', {Logged_URL} = '${targetUrl}')`,
      sort: [{ field: 'Time_Created', direction: 'desc' }]
    }).all();
    
    return records.map((record) => {
      const rawUrl = record.get('Target_URL');
      const resolvedTargetUrl = Array.isArray(rawUrl) ? rawUrl[0] : rawUrl;
      const loggedUrl = record.get('Logged_URL') as string;

      return {
        id: record.id,
        ID: record.get('ID') as number,
        Keyword_ID: record.get('Keyword_ID') as string[],
        Target_URL: (resolvedTargetUrl || loggedUrl) as string,
        Logged_URL: loggedUrl,
        Action_Type: record.get('Action_Type') as any,
        Page_Type: record.get('Page_Type') as any,
        Version: record.get('Content_Body') ? 'v2' : 'v1',
        Content_Body: record.get('Content_Body') as string,
        Event_Label: record.get('Event_Label') as string,
        Created_At: (record.get('Time_Created') || new Date().toISOString()) as string,
        Editor: record.get('Editor') as string[],
      };
    });
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
    
    return records.map((record) => {
      const rawUrl = record.get('Target_URL');
      const targetUrl = Array.isArray(rawUrl) ? rawUrl[0] : rawUrl;
      const loggedUrl = record.get('Logged_URL') as string;

      return {
        id: record.id,
        ID: record.get('ID') as number,
        Keyword_ID: record.get('Keyword_ID') as string[],
        Target_URL: (targetUrl || loggedUrl) as string,
        Logged_URL: loggedUrl,
        Action_Type: record.get('Action_Type') as any,
        Page_Type: record.get('Page_Type') as any,
        Version: record.get('Content_Body') ? 'v2' : 'v1',
        Content_Body: record.get('Content_Body') as string,
        Event_Label: record.get('Event_Label') as string,
        Created_At: (record.get('Time_Created') || new Date().toISOString()) as string,
        Editor: record.get('Editor') as string[],
      };
    });
  } catch (error) {
    return handleAirtableError(error,'getContentHistoryByKeyword');
  }
}

export async function createContentLog(log: Partial<ContentLog>): Promise<ContentLog | null> {
  try {
    if (!log.Keyword_ID || !Array.isArray(log.Keyword_ID) || log.Keyword_ID.length === 0) {
      console.error('[Airtable createContentLog] Validation failed: Keyword_ID missing or empty');
      return null;
    }

    const validKeywordIds = log.Keyword_ID.filter(id => id && id.startsWith('rec'));
    if (validKeywordIds.length === 0) {
      console.error('[Airtable createContentLog] Validation failed: No valid record IDs');
      return null;
    }

    const fields: any = {
      Keyword_ID: validKeywordIds,
      Logged_URL: log.Logged_URL,
      Content_Body: log.Content_Body,
      Event_Label: log.Event_Label,
      Action_Type: log.Action_Type, 
      Page_Type: log.Page_Type,
    };

    Object.keys(fields).forEach(key => fields[key] === undefined && delete fields[key]);

    console.log('[Airtable createContentLog] Creating log with fields:', JSON.stringify(fields));

    try {
      const records = await base(TABLES.CONTENT_LOG).create([{ fields }]);
      if (records.length === 0) return null;
      const record = records[0];
      
      const rawTarget = record.get('Target_URL');
      const resolvedTarget = Array.isArray(rawTarget) ? String(rawTarget[0]) : (rawTarget ? String(rawTarget) : undefined);
      
      return {
        id: record.id,
        ID: record.get('ID') as number,
        Keyword_ID: record.get('Keyword_ID') as string[],
        Target_URL: (resolvedTarget || record.get('Logged_URL')) as string,
        Logged_URL: record.get('Logged_URL') as string,
        Action_Type: record.get('Action_Type') as any,
        Page_Type: record.get('Page_Type') as any,
        Version: record.get('Content_Body') ? 'v2' : 'v1',
        Content_Body: record.get('Content_Body') as string,
        Event_Label: record.get('Event_Label') as string,
        Created_At: (record.get('Time_Created') || new Date().toISOString()) as string,
        Editor: record.get('Editor') as string[],
      };
    } catch (innerError: any) {
      if (
        innerError.statusCode === 422 &&
        (innerError.message?.includes('Action_Type') ||
          innerError.message?.includes('Target_URL') ||
          innerError.message?.includes('Page_Type'))
      ) {
        console.warn('[Airtable createContentLog] Computed field error, retrying without Action_Type/Target_URL/Page_Type');
        delete fields.Action_Type;
        delete fields.Page_Type;
        const retryRecords = await base(TABLES.CONTENT_LOG).create([{ fields }]);
        if (retryRecords.length === 0) return null;
        const retryRecord = retryRecords[0];
        const retryRawTarget = retryRecord.get('Target_URL');
        const retryResolvedTarget = Array.isArray(retryRawTarget) ? String(retryRawTarget[0]) : (retryRawTarget ? String(retryRawTarget) : undefined);
        
        return {
          id: retryRecord.id,
          ID: retryRecord.get('ID') as number,
          Keyword_ID: retryRecord.get('Keyword_ID') as string[],
          Target_URL: (retryResolvedTarget || retryRecord.get('Logged_URL')) as string,
          Logged_URL: retryRecord.get('Logged_URL') as string,
          Action_Type: retryRecord.get('Action_Type') as any,
          Version: retryRecord.get('Content_Body') ? 'v2' : 'v1',
          Content_Body: retryRecord.get('Content_Body') as string,
          Event_Label: retryRecord.get('Event_Label') as string,
          Created_At: (retryRecord.get('Time_Created') || new Date().toISOString()) as string,
          Editor: retryRecord.get('Editor') as string[],
        };
      }
      throw innerError;
    }
  } catch (error: any) {
    console.error('[Airtable createContentLog] Final Error:', error);
    return handleAirtableError(error,'createContentLog');
  }
}

export async function getAllContentHistory(): Promise<ContentLog[]> {
  try {
    const records = await base(TABLES.CONTENT_LOG).select({
      sort: [{ field: 'Time_Created', direction: 'desc' }],
      maxRecords: 100,
    }).all();

    return records.map((record) => {
      const rawTargetUrl = record.get('Target_URL');
      const targetUrl = Array.isArray(rawTargetUrl) ? rawTargetUrl[0] : rawTargetUrl;
      const loggedUrl = record.get('Logged_URL') as string;

      return {
        id: record.id,
        ID: record.get('ID') as number,
        Keyword_ID: record.get('Keyword_ID') as string[],
        Target_URL: (targetUrl || loggedUrl) as string,
        Logged_URL: loggedUrl,
        Action_Type: record.get('Action_Type') as any,
        Page_Type: record.get('Page_Type') as any,
        Version: record.get('Content_Body') ? 'v2' : 'v1',
        Content_Body: record.get('Content_Body') as string,
        Event_Label: record.get('Event_Label') as string,
        Created_At: (record.get('Time_Created') || new Date().toISOString()) as string,
        Updated_At: (record.get('Time_Changed') || record.get('Time_Created') || new Date().toISOString()) as string,
        Editor: record.get('Editor') as string[],
      };
    });
  } catch (error) {
    return handleAirtableError(error,'getContentLogs');
  }
}

export async function getPerformanceData(): Promise<PerformanceData[]> {
  try {
    const records = await base(TABLES.URL_PERFORMANCE).select({
      sort: [{ field: 'Date', direction: 'desc' }]
    }).all();
    return records.map((record) => ({
      id: record.id,
      ID: 0,
      Keyword_ID: [],
      Target_URL: record.get('Target_URL') as string,
      Date: record.get('Date') as string,
      Ranking: undefined,
      GSC_Clicks: record.get('GSC_Clicks') as number,
      GSC_Impressions: record.get('GSC_Impressions') as number,
      Sistrix_VI: record.get('Sistrix_VI') as number,
      Position: record.get('Position') as number,
      Source: 'Combined',
    }));
  } catch (error: any) {
    console.warn(`[Airtable] Error in getPerformanceData (using ${TABLES.URL_PERFORMANCE}):`, error.message);
    return [];
  }
}

export async function getPerformanceDataByUrl(targetUrl: string): Promise<PerformanceData[]> {
  try {
    const records = await base(TABLES.URL_PERFORMANCE).select({
      filterByFormula: `{Target_URL} = '${targetUrl}'`,
      sort: [{ field: 'Date', direction: 'asc' }]
    }).all();
    return records.map((record) => ({
      id: record.id,
      ID: 0,
      Keyword_ID: [],
      Target_URL: record.get('Target_URL') as string,
      Date: record.get('Date') as string,
      Ranking: undefined,
      GSC_Clicks: record.get('GSC_Clicks') as number,
      GSC_Impressions: record.get('GSC_Impressions') as number,
      Sistrix_VI: record.get('Sistrix_VI') as number,
      Position: record.get('Position') as number,
      Source: 'Combined',
    }));
  } catch (error: any) {
    console.warn(`[Airtable] Error in getPerformanceDataByUrl (using ${TABLES.URL_PERFORMANCE}):`, error.message);
    return [];
  }
}

export async function getURLPerformanceHistory(targetUrl: string): Promise<URLPerformance[]> {
  try {
    const records = await base(TABLES.URL_PERFORMANCE).select({
      filterByFormula: `{Target_URL} = '${targetUrl}'`,
      sort: [{ field: 'Date', direction: 'asc' }]
    }).all();
    return records.map((record) => ({
      id: record.id,
      Target_URL: record.get('Target_URL') as string,
      Date: record.get('Date') as string,
      GSC_Clicks: record.get('GSC_Clicks') as number,
      GSC_Impressions: record.get('GSC_Impressions') as number,
      Position: record.get('Position') as number,
      Sistrix_VI: record.get('Sistrix_VI') as number,
    }));
  } catch (error) {
    return handleAirtableError(error, 'getURLPerformanceHistory');
  }
}

export async function getKeywordRankingHistory(keywordIds: string[]): Promise<KeywordRankingHistory[]> {
  try {
    if (keywordIds.length === 0) return [];
    const formula = `OR(${keywordIds.map(id => `SEARCH('${id}', ARRAYJOIN({Keyword_ID}))`).join(', ')})`;
    const records = await base(TABLES.KEYWORD_RANKING_HISTORY).select({
      filterByFormula: formula,
      sort: [{ field: 'Date', direction: 'asc' }]
    }).all();
    return records.map((record) => ({
      id: record.id,
      Keyword_ID: record.get('Keyword_ID') as string[],
      Date: record.get('Date') as string,
      Ranking: record.get('Ranking') as number,
      Target_URL: record.get('Target_URL') as string,
    }));
  } catch (error) {
    return handleAirtableError(error, 'getKeywordRankingHistory');
  }
}

export async function deleteKeyword(id: string): Promise<boolean> {
  try {
    await base(TABLES.KEYWORD_MAP).destroy([id]);
    return true;
  } catch (error) {
    return handleAirtableError(error,'deleteKeyword');
  }
}

export async function bulkDeleteKeywords(ids: string[]): Promise<boolean> {
  try {
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    for (const chunk of chunks) await base(TABLES.KEYWORD_MAP).destroy(chunk);
    return true;
  } catch (error) {
    return handleAirtableError(error,'bulkDeleteKeywords');
  }
}

export async function bulkDeleteFromBlacklist(ids: string[]): Promise<boolean> {
  try {
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    for (const chunk of chunks) await base(TABLES.BLACKLIST).destroy(chunk);
    return true;
  } catch (error) {
    return handleAirtableError(error,'bulkDeleteFromBlacklist');
  }
}

export async function upsertURLPerformance(data: Partial<URLPerformance>[]): Promise<{ created: number, updated: number, errors: any[] }> {
  try {
    const errors: any[] = [];
    const valid = data.filter(item => item.Target_URL && item.Date);
    if (!valid.length) return { created: 0, updated: 0, errors };

    // ── 1. Bulk-read all existing records for these URLs ──────────────────────
    // Filter only by Target_URL (reliable string match) and do Date matching
    // client-side after normalising the date string. This avoids Airtable Date
    // field comparison issues where {Date} = 'YYYY-MM-DD' can fail for Date-type
    // fields that store a full ISO datetime internally.
    const uniqueUrls = Array.from(new Set(valid.map(item => item.Target_URL!)));
    const urlClauses = uniqueUrls.map(url => `{Target_URL} = '${url.replace(/'/g, "\\'")}'`);
    const LOOKUP_CHUNK = 50;
    const existingMap = new Map<string, string>(); // key: "URL|Date" → record id

    for (let i = 0; i < urlClauses.length; i += LOOKUP_CHUNK) {
      const slice = urlClauses.slice(i, i + LOOKUP_CHUNK);
      const formula = slice.length === 1 ? slice[0] : `OR(${slice.join(',')})`;
      const page = await base(TABLES.URL_PERFORMANCE).select({
        filterByFormula: formula,
        fields: ['Target_URL', 'Date'],
      }).all();
      page.forEach(record => {
        const url = record.get('Target_URL') as string;
        const date = ((record.get('Date') as string) ?? '').split('T')[0];
        if (url && date) existingMap.set(`${url}|${date}`, record.id);
      });
    }

    // ── 2. Split into create / update buckets ─────────────────────────────────
    const toCreate: Partial<URLPerformance>[] = [];
    const toUpdate: { id: string; fields: Record<string, any> }[] = [];

    for (const item of valid) {
      const fields: Record<string, any> = {
        Target_URL: item.Target_URL,
        Date: item.Date,
        GSC_Clicks: item.GSC_Clicks,
        GSC_Impressions: item.GSC_Impressions,
        Position: item.Position,
        Sistrix_VI: item.Sistrix_VI,
      };
      Object.keys(fields).forEach(k => fields[k] === undefined && delete fields[k]);

      const existingId = existingMap.get(`${item.Target_URL}|${item.Date}`);
      if (existingId) {
        toUpdate.push({ id: existingId, fields });
      } else {
        toCreate.push(item);
      }
    }

    // ── 3. Batch-create (10 per call) ─────────────────────────────────────────
    let created = 0;
    for (let i = 0; i < toCreate.length; i += 10) {
      const chunk = toCreate.slice(i, i + 10);
      try {
        await base(TABLES.URL_PERFORMANCE).create(
          chunk.map(item => ({
            fields: {
              Target_URL: item.Target_URL,
              Date: item.Date,
              GSC_Clicks: item.GSC_Clicks,
              GSC_Impressions: item.GSC_Impressions,
              Position: item.Position,
              ...(item.Sistrix_VI !== undefined ? { Sistrix_VI: item.Sistrix_VI } : {}),
            },
          }))
        );
        created += chunk.length;
      } catch (err: any) {
        errors.push({ chunk: i, error: err.message });
      }
    }

    // ── 4. Batch-update (10 per call) ─────────────────────────────────────────
    let updated = 0;
    for (let i = 0; i < toUpdate.length; i += 10) {
      const chunk = toUpdate.slice(i, i + 10);
      try {
        await base(TABLES.URL_PERFORMANCE).update(
          chunk.map(({ id, fields }) => ({ id, fields }))
        );
        updated += chunk.length;
      } catch (err: any) {
        errors.push({ chunk: i, error: err.message });
      }
    }

    return { created, updated, errors };
  } catch (error) {
    return handleAirtableError(error, 'upsertURLPerformance');
  }
}

export async function upsertKeywordRankingHistory(data: Partial<KeywordRankingHistory>[]): Promise<{ created: number, updated: number, errors: any[] }> {
  try {
    const errors: any[] = [];
    const valid = data.filter(item => item.Keyword_ID && item.Date);
    if (!valid.length) return { created: 0, updated: 0, errors };

    // Normalise Keyword_ID to plain string for each item and validate it's an Airtable record ID
    const normalised = valid.map(item => ({
      ...item,
      _kwId: Array.isArray(item.Keyword_ID) ? item.Keyword_ID[0] : (item.Keyword_ID as unknown as string),
    })).filter(item => typeof item._kwId === 'string' && item._kwId.startsWith('rec'));

    // ── 1. Bulk-read existing records ─────────────────────────────────────────
    // Filter by Keyword_ID only (SEARCH is reliable); Date matching is done
    // client-side after normalising the date string to avoid Airtable Date-field
    // comparison issues.
    const LOOKUP_CHUNK = 50;
    const existingMap = new Map<string, string>(); // "kwId|Date" → record id
    const uniqueKwIds = Array.from(new Set(normalised.map(item => item._kwId)));

    for (let i = 0; i < uniqueKwIds.length; i += LOOKUP_CHUNK) {
      const slice = uniqueKwIds.slice(i, i + LOOKUP_CHUNK);
      const orClauses = slice.map(id => `SEARCH('${id}', ARRAYJOIN({Keyword_ID}))`);
      const formula = orClauses.length === 1 ? orClauses[0] : `OR(${orClauses.join(',')})`;
      const page = await base(TABLES.KEYWORD_RANKING_HISTORY).select({
        filterByFormula: formula,
        fields: ['Keyword_ID', 'Date'],
      }).all();
      page.forEach(record => {
        const ids = record.get('Keyword_ID') as string[] | undefined;
        const date = ((record.get('Date') as string) ?? '').split('T')[0];
        if (ids && date) ids.forEach(id => existingMap.set(`${id}|${date}`, record.id));
      });
    }

    // ── 2. Split into create / update buckets ─────────────────────────────────
    const toCreate: typeof normalised = [];
    const toUpdate: { id: string; kwId: string; date: string; ranking: number | undefined }[] = [];

    for (const item of normalised) {
      const existingId = existingMap.get(`${item._kwId}|${item.Date}`);
      if (existingId) {
        toUpdate.push({ id: existingId, kwId: item._kwId, date: item.Date!, ranking: item.Ranking });
      } else {
        toCreate.push(item);
      }
    }

    // ── 3. Batch-create (10 per call) ─────────────────────────────────────────
    let created = 0;
    for (let i = 0; i < toCreate.length; i += 10) {
      const chunk = toCreate.slice(i, i + 10);
      try {
        await base(TABLES.KEYWORD_RANKING_HISTORY).create(
          chunk.map(item => ({
            fields: {
              Keyword_ID: item._kwId,
              Date: item.Date,
              Ranking: item.Ranking,
            },
          }))
        );
        created += chunk.length;
      } catch (err: any) {
        errors.push({ chunk: i, error: err.message });
      }
    }

    // ── 4. Batch-update (10 per call) ─────────────────────────────────────────
    let updated = 0;
    for (let i = 0; i < toUpdate.length; i += 10) {
      const chunk = toUpdate.slice(i, i + 10);
      try {
        await base(TABLES.KEYWORD_RANKING_HISTORY).update(
          chunk.map(({ id, kwId, date, ranking }) => ({
            id,
            fields: { Keyword_ID: kwId, Date: date, Ranking: ranking },
          }))
        );
        updated += chunk.length;
      } catch (err: any) {
        errors.push({ chunk: i, error: err.message });
      }
    }

    return { created, updated, errors };
  } catch (error) {
    return handleAirtableError(error, 'upsertKeywordRankingHistory');
  }
}

/**
 * Returns the set of keyword IDs that already have a ranking record for the
 * given ISO-week date (format: YYYY-MM-DD, Monday of the week).
 * Used as a pre-flight check before calling DataForSEO to avoid redundant API costs.
 */
export async function getExistingRankingDates(
  keywordIds: string[],
  weekDate: string
): Promise<Set<string>> {
  const found = new Set<string>();
  if (!keywordIds.length) return found;

  const CHUNK = 50;
  for (let i = 0; i < keywordIds.length; i += CHUNK) {
    const slice = keywordIds.slice(i, i + CHUNK);
    const orClauses = slice.map(id => `SEARCH('${id}', ARRAYJOIN({Keyword_ID}))`);
    const formula = `AND(OR(${orClauses.join(',')}), {Date} = '${weekDate}')`;
    try {
      const records = await base(TABLES.KEYWORD_RANKING_HISTORY)
        .select({ filterByFormula: formula, fields: ['Keyword_ID', 'Date'] })
        .all();
      records.forEach(record => {
        const ids = record.get('Keyword_ID') as string[] | undefined;
        if (ids) ids.forEach(id => found.add(id));
      });
    } catch (err: any) {
      console.error('[Airtable] getExistingRankingDates chunk error:', err.message);
    }
  }
  return found;
}

/**
 * Reads a numeric sync cursor from the Config table.
 * Returns 0 if the key does not exist yet (start of a new cycle).
 */
export async function getSyncCursor(key: string): Promise<number> {
  try {
    const records = await base(TABLES.CONFIG)
      .select({ filterByFormula: `{Key} = '${key}'`, maxRecords: 1 })
      .firstPage();
    if (!records.length) return 0;
    const val = parseInt(records[0].get('Value') as string, 10);
    return isNaN(val) ? 0 : val;
  } catch (err: any) {
    console.error(`[Airtable] getSyncCursor(${key}) error:`, err.message);
    return 0;
  }
}

/**
 * Writes (upserts) a numeric sync cursor into the Config table.
 */
export async function setSyncCursor(key: string, value: number): Promise<void> {
  try {
    const records = await base(TABLES.CONFIG)
      .select({ filterByFormula: `{Key} = '${key}'`, maxRecords: 1 })
      .firstPage();
    if (records.length > 0) {
      await base(TABLES.CONFIG).update(records[0].id, { Value: String(value) });
    } else {
      await base(TABLES.CONFIG).create([{
        fields: { Key: key, Value: String(value), Description: 'Auto-managed sync cursor — do not edit manually' },
      }]);
    }
  } catch (err: any) {
    console.error(`[Airtable] setSyncCursor(${key}) error:`, err.message);
  }
}

export async function bulkUpdateKeywordRankings(rankings: { keywordId: string, rank: number }[]): Promise<void> {
  try {
    const chunks = [];
    for (let i = 0; i < rankings.length; i += 10) chunks.push(rankings.slice(i, i + 10));
    for (const chunk of chunks) {
      await base(TABLES.KEYWORD_MAP).update(chunk.map(r => ({ id: r.keywordId, fields: { Ranking: r.rank } })));
    }
  } catch (error) {
    await handleAirtableError(error, 'bulkUpdateKeywordRankings');
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

export async function createCostConfig(config: Partial<CostConfig>): Promise<CostConfig | null> {
  try {
    const fields: any = {
      Page_Type: config.Page_Type,
      Action_Type: config.Action_Type,
      Agency_Cost: config.Agency_Cost || 0,
      Overhead_Cost: config.Overhead_Cost || 0,
    };
    const records = await base(TABLES.COST_CONFIG).create([{ fields }]);
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
    return handleAirtableError(error,'createCostConfig');
  }
}

export async function deleteCostConfig(id: string): Promise<boolean> {
  try {
    await base(TABLES.COST_CONFIG).destroy([id]);
    return true;
  } catch (error) {
    return handleAirtableError(error,'deleteCostConfig');
  }
}

export async function getPotentialTrends(): Promise<PotentialTrend[]> {
  return [];
}

export async function createTrend(trend: Partial<PotentialTrend>): Promise<PotentialTrend | null> {
  return null;
}

export async function upsertPerformanceData(data: Partial<PerformanceData>[]): Promise<{ created: number, updated: number, errors: any[] }> {
  try {
    return { created: 0, updated: 0, errors: [] };
  } catch (error) {
    return { created: 0, updated: 0, errors: [String(error)] };
  }
}

export async function getBlacklist(): Promise<BlacklistEntry[]> {
  try {
    const records = await base(TABLES.BLACKLIST).select().all();
    return records.map(record => ({
      id: record.id,
      Keyword: record.get('Keyword') as string,
      Target_URL: record.get('Target_URL') as string,
      Type: record.get('Type') as 'Keyword' | 'URL',
      Reason: record.get('Reason') as string,
      Added_At: (record.get('Added_At') || record.get('Time_Created') || new Date().toISOString()) as string,
    }));
  } catch (error) {
    return handleAirtableError(error, 'getBlacklist');
  }
}

export async function addToBlacklist(entry: Partial<BlacklistEntry>): Promise<BlacklistEntry | null> {
  try {
    const fields: any = {
      Keyword: entry.Keyword,
      Target_URL: entry.Target_URL,
      Type: entry.Type,
      Reason: entry.Reason,
    };
    const records = await base(TABLES.BLACKLIST).create([{ fields }]);
    if (records.length === 0) return null;
    const record = records[0];
    return {
      id: record.id,
      Keyword: record.get('Keyword') as string,
      Target_URL: record.get('Target_URL') as string,
      Type: record.get('Type') as 'Keyword' | 'URL',
      Reason: record.get('Reason') as string,
      Added_At: (record.get('Added_At') || record.get('Time_Created') || new Date().toISOString()) as string,
    };
  } catch (error) {
    return handleAirtableError(error, 'addToBlacklist');
  }
}

export async function updateBlacklist(id: string, entry: Partial<BlacklistEntry>): Promise<BlacklistEntry | null> {
  try {
    const fields: any = {};
    if (entry.Keyword) fields.Keyword = entry.Keyword;
    if (entry.Target_URL) fields.Target_URL = entry.Target_URL;
    if (entry.Type) fields.Type = entry.Type;
    if (entry.Reason) fields.Reason = entry.Reason;
    
    const records = await base(TABLES.BLACKLIST).update([{ id, fields }]);
    if (records.length === 0) return null;
    const record = records[0];
    return {
      id: record.id,
      Keyword: record.get('Keyword') as string,
      Target_URL: record.get('Target_URL') as string,
      Type: record.get('Type') as 'Keyword' | 'URL',
      Reason: record.get('Reason') as string,
      Added_At: (record.get('Added_At') || record.get('Time_Created') || new Date().toISOString()) as string,
    };
  } catch (error) {
    return handleAirtableError(error, 'updateBlacklist');
  }
}

export async function deleteFromBlacklist(id: string): Promise<boolean> {
  try {
    await base(TABLES.BLACKLIST).destroy([id]);
    return true;
  } catch (error) {
    return handleAirtableError(error, 'deleteFromBlacklist');
  }
}

export async function createAuditLog(action: string, rawPayload?: Record<string, unknown>): Promise<void> {
  try {
    await base(TABLES.AUDIT_LOGS).create([
      {
        fields: {
          Action: action,
          Timestamp: new Date().toISOString(),
          ...(rawPayload ? { Raw_Payload: JSON.stringify(rawPayload) } : {}),
        },
      },
    ]);
  } catch (error) {
    // Log but don't throw — audit log writes should never block critical paths
    console.error('[Airtable] createAuditLog failed:', error);
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
  const TIMEOUT_MS = 10000;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Airtable request timed out')), TIMEOUT_MS));
      const fetchPromise = base(TABLES.USERS).select({ filterByFormula: `{Email} = '${email}'`, maxRecords: 1 }).firstPage();
      const records = await Promise.race([fetchPromise, timeoutPromise]) as any[];
      if (records.length === 0) return null;
      const record = records[0];
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
      if (status === 403 || status === 401) return handleAirtableError(error,'getUserByEmail');
      if (attempt === MAX_RETRIES) return null;
      await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }
  return null;
}

export async function countUsers(): Promise<number> {
  try {
    const records = await base(TABLES.USERS).select({ fields: ['Email'] }).all();
    return records.length;
  } catch (error) {
    return handleAirtableError(error,'countUsers');
  }
}

export async function getAllUsers(): Promise<UserRecord[]> {
  try {
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
    const records = await base(TABLES.USERS).create([{ fields: { Name: userData.Name, Email: userData.Email, Role: userData.Role || 'Editor', Password: userData.Password, Password_Changed: userData.Password_Changed || false } }]);
    if (records.length === 0) return null;
    const record = records[0];
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
    const fields: any = {};
    if (userData.Name) fields.Name = userData.Name;
    if (userData.Email) fields.Email = userData.Email;
    if (userData.Role) fields.Role = userData.Role;
    if (userData.Password) fields.Password = userData.Password;
    if (userData.Password_Changed !== undefined) fields.Password_Changed = userData.Password_Changed;
    const records = await base(TABLES.USERS).update([{ id, fields }]);
    if (records.length === 0) return null;
    const record = records[0];
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
    await base(TABLES.USERS).destroy([id]);
    return true;
  } catch (error) {
    return handleAirtableError(error,'deleteUser');
  }
}

export async function bulkCreateKeywords(keywords: Partial<KeywordMap>[]): Promise<{ created: KeywordMap[], skipped: SkippedKeyword[] }> {
  try {
    const createdRecords: KeywordMap[] = [];
    const skippedRecords: SkippedKeyword[] = [];

    if (keywords.length === 0) return { created: createdRecords, skipped: skippedRecords };

    // ── 1. Batch-Lookup: fetch all existing records for the relevant URLs in one pass
    //       instead of one Airtable call per keyword (N+1 → O(urls/50) calls).
    const uniqueUrls = Array.from(new Set(keywords.map(kw => kw.Target_URL).filter(Boolean))) as string[];
    const LOOKUP_CHUNK = 50;

    // existingSet: "keyword_lower|url_lower" → true  (duplicate detection)
    // mainKeywordByUrl: url_lower → true  (Main_Keyword = 'Y' already exists for that URL)
    // mainKeywordGlobal: keyword_lower → true  (keyword is already a Main Keyword somewhere)
    const existingSet = new Set<string>();
    const mainKeywordByUrl = new Set<string>();
    const mainKeywordGlobal = new Set<string>();

    for (let i = 0; i < uniqueUrls.length; i += LOOKUP_CHUNK) {
      const slice = uniqueUrls.slice(i, i + LOOKUP_CHUNK);
      const urlClauses = slice.map(url => `{Target_URL} = '${url.replace(/'/g, "\\'")}'`);
      const formula = urlClauses.length === 1 ? urlClauses[0] : `OR(${urlClauses.join(',')})`;
      const existing = await base(TABLES.KEYWORD_MAP).select({
        filterByFormula: formula,
        fields: ['Keyword', 'Target_URL', 'Main_Keyword'],
      }).all();

      existing.forEach(record => {
        const kw = (record.get('Keyword') as string)?.toLowerCase();
        const url = (record.get('Target_URL') as string)?.toLowerCase();
        const isMain = record.get('Main_Keyword') === 'Y';

        if (kw && url) existingSet.add(`${kw}|${url}`);
        if (isMain && url) mainKeywordByUrl.add(url);
        if (isMain && kw) mainKeywordGlobal.add(kw);
      });
    }

    // ── 2. Validate each keyword against the in-memory sets ──────────────────
    const validKeywords: Partial<KeywordMap>[] = [];

    for (const kw of keywords) {
      if (!kw.Keyword || !kw.Target_URL) {
        skippedRecords.push({ ...kw, reason: 'Keyword und Target_URL sind Pflichtfelder.' });
        continue;
      }

      const kwLower = kw.Keyword.toLowerCase();
      const urlLower = kw.Target_URL.toLowerCase();

      if (existingSet.has(`${kwLower}|${urlLower}`)) {
        skippedRecords.push({ ...kw, reason: `Die Kombination aus Keyword "${kw.Keyword}" und URL "${kw.Target_URL}" existiert bereits.` });
        continue;
      }

      if (kw.Main_Keyword === 'Y') {
        if (mainKeywordByUrl.has(urlLower)) {
          skippedRecords.push({ ...kw, reason: `Die URL ${kw.Target_URL} hat bereits ein Main Keyword.` });
          continue;
        }
        if (mainKeywordGlobal.has(kwLower)) {
          skippedRecords.push({ ...kw, reason: `Das Keyword "${kw.Keyword}" ist bereits als Main Keyword für eine andere URL registriert.` });
          continue;
        }
        // Claim this slot so subsequent keywords in the same batch don't conflict
        mainKeywordByUrl.add(urlLower);
        mainKeywordGlobal.add(kwLower);
      }

      // Mark as seen so later entries in the same import batch are deduplicated
      existingSet.add(`${kwLower}|${urlLower}`);
      validKeywords.push(kw);
    }

    // ── 3. Batch-create (10 per call) ─────────────────────────────────────────
    for (let i = 0; i < validKeywords.length; i += 10) {
      const chunk = validKeywords.slice(i, i + 10);
      try {
        const records = await base(TABLES.KEYWORD_MAP).create(chunk.map((kw) => ({
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
            Action_Type: kw.Action_Type || 'Erstellung',
            Page_Type: kw.Page_Type,
          },
        })));
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
            Policy: record.get('Policy') as number,
            Priority_Score: record.get('Priority_Score') as number,
            Action_Type: (record.get('Action_Type') as 'Erstellung' | 'Optimierung') || 'Erstellung',
            Page_Type: record.get('Page_Type') as any,
            Ranking: record.get('Ranking') as number,
            Last_Published: record.get('Last_Published') as string,
          });
        });
      } catch (error: any) {
        if (error.statusCode === 422 && error.message?.includes('Action_Type')) {
          // Retry without Action_Type if the field is not yet set up in Airtable
          const retryRecords = await base(TABLES.KEYWORD_MAP).create(chunk.map((kw) => ({
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
              Page_Type: kw.Page_Type,
            },
          })));
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
              Page_Type: record.get('Page_Type') as any,
              Ranking: record.get('Ranking') as number,
              Last_Published: record.get('Last_Published') as string,
            });
          });
        } else {
          // Mark the whole chunk as skipped on unexpected errors
          chunk.forEach(kw => skippedRecords.push({ ...kw, reason: error.message || 'Unbekannter Fehler beim Erstellen' }));
        }
      }
    }

    return { created: createdRecords, skipped: skippedRecords };
  } catch (error) {
    return handleAirtableError(error, 'bulkCreateKeywords');
  }
}

export async function createKeyword(kw: Partial<KeywordMap>): Promise<KeywordMap | null> {
  try {
    if (!kw.Keyword || !kw.Target_URL) throw new AirtableValidationError('Keyword und Target_URL are mandatory fields.');
    const existingKeywordUrl = await base(TABLES.KEYWORD_MAP).select({ filterByFormula: `AND({Target_URL} = '${kw.Target_URL}', {Keyword} = '${kw.Keyword.replace(/'/g, "\\'")}')`, maxRecords: 1 }).firstPage();
    if (existingKeywordUrl.length > 0) throw new AirtableValidationError(`The combination of Keyword "${kw.Keyword}" and URL "${kw.Target_URL}" already exists.`, 409);
    if (kw.Main_Keyword === 'Y') {
      const existingMainKeywords = await base(TABLES.KEYWORD_MAP).select({ filterByFormula: `AND({Target_URL} = '${kw.Target_URL}', {Main_Keyword} = 'Y')`, maxRecords: 1 }).firstPage();
      if (existingMainKeywords.length > 0) throw new AirtableValidationError(`The URL ${kw.Target_URL} already has a Main Keyword.`, 409);
      const existingGlobalMain = await base(TABLES.KEYWORD_MAP).select({ filterByFormula: `AND({Keyword} = '${kw.Keyword.replace(/'/g, "\\'")}', {Main_Keyword} = 'Y')`, maxRecords: 1 }).firstPage();
      if (existingGlobalMain.length > 0) throw new AirtableValidationError(`The Keyword "${kw.Keyword}" is already registered as a Main Keyword for another URL.`, 409);
    }
    const records = await base(TABLES.KEYWORD_MAP).create([{ fields: { Keyword: kw.Keyword, Target_URL: kw.Target_URL, Search_Volume: kw.Search_Volume, Difficulty: kw.Difficulty, Status: kw.Status || 'Backlog', Editorial_Deadline: kw.Editorial_Deadline, Assigned_Editor: kw.Assigned_Editor, Main_Keyword: kw.Main_Keyword || 'N', Article_Count: kw.Article_Count, Avg_Product_Value: kw.Avg_Product_Value, Policy: kw.Policy, Priority_Score: kw.Priority_Score, Action_Type: 'Erstellung', Page_Type: kw.Page_Type } }]);
    if (records.length === 0) return null;
    const record = records[0];
    return { id: record.id, Keyword: record.get('Keyword') as string, Target_URL: record.get('Target_URL') as string, Search_Volume: record.get('Search_Volume') as number, Difficulty: record.get('Difficulty') as number, Status: record.get('Status') as KeywordStatus, Editorial_Deadline: record.get('Editorial_Deadline') as string, Assigned_Editor: record.get('Assigned_Editor') as string[], Main_Keyword: (record.get('Main_Keyword') as 'Y' | 'N') || 'N', Article_Count: record.get('Article_Count') as number, Avg_Product_Value: record.get('Avg_Product_Value') as number, Policy: record.get('Policy') as number, Priority_Score: record.get('Priority_Score') as number, Action_Type: (record.get('Action_Type') as 'Erstellung' | 'Optimierung') || 'Erstellung', Ranking: record.get('Ranking') as number, Last_Published: record.get('Last_Published') as string };
  } catch (error: any) {
    if (error.statusCode === 422 && error.message?.includes('Action_Type')) {
      const fields: any = { Keyword: kw.Keyword, Target_URL: kw.Target_URL, Search_Volume: kw.Search_Volume, Difficulty: kw.Difficulty, Status: kw.Status || 'Backlog', Editorial_Deadline: kw.Editorial_Deadline, Assigned_Editor: kw.Assigned_Editor, Main_Keyword: kw.Main_Keyword || 'N', Article_Count: kw.Article_Count, Avg_Product_Value: kw.Avg_Product_Value, Policy: kw.Policy, Priority_Score: kw.Priority_Score };
      const retryRecords = await base(TABLES.KEYWORD_MAP).create([{ fields }]);
      if (retryRecords.length === 0) return null;
      const retryRecord = retryRecords[0];
      return { id: retryRecord.id, Keyword: retryRecord.get('Keyword') as string, Target_URL: retryRecord.get('Target_URL') as string, Search_Volume: retryRecord.get('Search_Volume') as number, Difficulty: retryRecord.get('Difficulty') as number, Status: retryRecord.get('Status') as KeywordStatus, Editorial_Deadline: retryRecord.get('Editorial_Deadline') as string, Assigned_Editor: retryRecord.get('Assigned_Editor') as string[], Main_Keyword: (retryRecord.get('Main_Keyword') as 'Y' | 'N') || 'N', Article_Count: retryRecord.get('Article_Count') as number, Avg_Product_Value: retryRecord.get('Avg_Product_Value') as number, Policy: retryRecord.get('Policy') as number, Priority_Score: retryRecord.get('Policy') as number, Action_Type: 'Erstellung' as any, Ranking: retryRecord.get('Ranking') as number, Last_Published: retryRecord.get('Last_Published') as string };
    }
    return handleAirtableError(error,'createKeyword');
  }
}

export async function updateKeyword(id: string, kw: Partial<KeywordMap>): Promise<KeywordMap | null> {
  try {
    const currentRecord = await base(TABLES.KEYWORD_MAP).find(id);
    if (kw.Keyword !== undefined || kw.Target_URL !== undefined || kw.Main_Keyword !== undefined) {
      const nextKeyword = kw.Keyword !== undefined ? kw.Keyword : currentRecord.get('Keyword') as string;
      const nextURL = kw.Target_URL !== undefined ? kw.Target_URL : currentRecord.get('Target_URL') as string;
      const nextMain = kw.Main_Keyword !== undefined ? kw.Main_Keyword : currentRecord.get('Main_Keyword') as string;
      if (kw.Keyword !== undefined || kw.Target_URL !== undefined) {
        const existingKeywordUrl = await base(TABLES.KEYWORD_MAP).select({ filterByFormula: `AND({Target_URL} = '${nextURL}', {Keyword} = '${nextKeyword.replace(/'/g, "\\'")}', RECORD_ID() != '${id}')`, maxRecords: 1 }).firstPage();
        if (existingKeywordUrl.length > 0) throw new AirtableValidationError(`The combination of Keyword "${nextKeyword}" and URL "${nextURL}" already exists.`, 409);
      }
      if (nextMain === 'Y' && (kw.Main_Keyword === 'Y' || kw.Target_URL !== undefined || kw.Keyword !== undefined)) {
        const existingMainKeywords = await base(TABLES.KEYWORD_MAP).select({ filterByFormula: `AND({Target_URL} = '${nextURL}', {Main_Keyword} = 'Y', RECORD_ID() != '${id}')`, maxRecords: 1 }).firstPage();
        if (existingMainKeywords.length > 0) throw new AirtableValidationError(`The URL ${nextURL} already has a Main Keyword.`, 409);
        const existingGlobalMain = await base(TABLES.KEYWORD_MAP).select({ filterByFormula: `AND({Keyword} = '${nextKeyword.replace(/'/g, "\\'")}', {Main_Keyword} = 'Y', RECORD_ID() != '${id}')`, maxRecords: 1 }).firstPage();
        if (existingGlobalMain.length > 0) throw new AirtableValidationError(`The Keyword "${nextKeyword}" is already registered as a Main Keyword for another URL.`, 409);
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
    let records;
    try {
      records = await base(TABLES.KEYWORD_MAP).update([{ id, fields }]);
    } catch (error: any) {
      if (error.statusCode === 422 && error.message?.includes('Action_Type')) {
        delete fields.Action_Type;
        records = await base(TABLES.KEYWORD_MAP).update([{ id, fields }]);
      } else throw error;
    }
    if (!records || records.length === 0) return null;
    const record = records[0];
    return { id: record.id, Keyword: record.get('Keyword') as string, Target_URL: record.get('Target_URL') as string, Search_Volume: record.get('Search_Volume') as number, Difficulty: record.get('Difficulty') as number, Status: record.get('Status') as KeywordStatus, Editorial_Deadline: record.get('Editorial_Deadline') as string, Assigned_Editor: record.get('Assigned_Editor') as string[], Main_Keyword: (record.get('Main_Keyword') as 'Y' | 'N') || 'N', Article_Count: record.get('Article_Count') as number, Avg_Product_Value: record.get('Avg_Product_Value') as number, Policy: record.get('Policy') as number, Priority_Score: record.get('Priority_Score') as number, Action_Type: (record.get('Action_Type') as 'Erstellung' | 'Optimierung') || 'Erstellung', Ranking: record.get('Ranking') as number, Last_Published: record.get('Last_Published') as string };
  } catch (error) {
    return handleAirtableError(error,'updateKeyword');
  }
}

export async function getConfig(): Promise<Record<string, string>> {
  const now = Date.now();
  if (_configCache && now - _configCacheAt < CONFIG_CACHE_TTL_MS) {
    return _configCache;
  }

  try {
    const records = await base(TABLES.CONFIG).select().all();
    const config: Record<string, string> = {};
    records.forEach(record => {
      const key = record.get('Key') as string;
      const value = record.get('Value') as string;
      const file = record.get('File') as any[];
      
      if (key) {
        if ((key === 'BRAND_LOGO_URL' || key === 'BRAND_FAVICON_URL') && file && file.length > 0) {
          config[key] = file[0].url;
        } else {
          config[key] = value;
        }
      }
    });

    _configCache = config;
    _configCacheAt = now;
    return config;
  } catch (error) {
    return handleAirtableError(error, 'getConfig');
  }
}

export async function updateConfig(key: string, value: string, fileUrl?: string): Promise<ConfigRecord | null> {
  try {
    const records = await base(TABLES.CONFIG).select({
      filterByFormula: `{Key} = '${key}'`,
      maxRecords: 1
    }).firstPage();

    const isBrandAssetKey = key === 'BRAND_LOGO_URL' || key === 'BRAND_FAVICON_URL';
    const fields: any = {};

    if (isBrandAssetKey && fileUrl) {
      fields.File = [{ url: fileUrl }];
      fields.Value = fileUrl;
    } else {
      fields.Value = value;
    }

    let result: ConfigRecord | null = null;

    if (records.length === 0) {
      console.log(`[Airtable] Creating new config record for key: ${key}`);
      const newRecords = await base(TABLES.CONFIG).create([{
        fields: { Key: key, ...fields }
      }]);
      const record = newRecords[0];
      result = {
        id: record.id,
        Key: record.get('Key') as string,
        Value: record.get('Value') as string,
        Description: record.get('Description') as string,
        File: record.get('File') as any[],
      };
    } else {
      const recordId = records[0].id;
      const updatedRecords = await base(TABLES.CONFIG).update([{
        id: recordId,
        fields
      }]);

      const updatedRecord = updatedRecords[0];
      result = {
        id: updatedRecord.id,
        Key: updatedRecord.get('Key') as string,
        Value: updatedRecord.get('Value') as string,
        Description: updatedRecord.get('Description') as string,
        File: updatedRecord.get('File') as any[],
      };
    }

    // Invalidate cache so the next read reflects the new value immediately.
    invalidateConfigCache();

    return result;
  } catch (error) {
    return handleAirtableError(error, 'updateConfig');
  }
}

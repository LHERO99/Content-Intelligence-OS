/**
 * migrate-from-airtable.ts
 * ------------------------
 * One-time Big Bang migration script.
 * Reads ALL data from Airtable and inserts it into the PostgreSQL database.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... \
 *   npx tsx scripts/migrate-from-airtable.ts [--tenant <id>]
 *
 * The --tenant flag sets the tenant_id for all migrated records.
 * Defaults to "default".
 *
 * Airtable rec-IDs are preserved as primary keys so that any existing
 * references in serialised JSON blobs (Config table) remain valid.
 *
 * Run order respects FK constraints:
 *   tenants → users → keyword_map → keyword_map_editors →
 *   content_log → url_performance → keyword_ranking_history →
 *   blacklist → cost_config → config → audit_logs
 */

import Airtable from 'airtable';
import postgres from 'postgres';

// ── Config ───────────────────────────────────────────────────────────────────

const TENANT_ID = (() => {
  const idx = process.argv.indexOf('--tenant');
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : 'default';
})();

const DB_URL = process.env.DATABASE_URL;
const AT_KEY = process.env.AIRTABLE_API_KEY;
const AT_BASE = process.env.AIRTABLE_BASE_ID;

if (!DB_URL) { console.error('❌  DATABASE_URL is required'); process.exit(1); }
if (!AT_KEY) { console.error('❌  AIRTABLE_API_KEY is required'); process.exit(1); }
if (!AT_BASE) { console.error('❌  AIRTABLE_BASE_ID is required'); process.exit(1); }

const sql = postgres(DB_URL, { max: 5 });
const base = new Airtable({ apiKey: AT_KEY }).base(AT_BASE);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchAll(table: string): Promise<Airtable.Record<Airtable.FieldSet>[]> {
  const rows: Airtable.Record<Airtable.FieldSet>[] = [];
  await base(table).select().eachPage((records, next) => {
    rows.push(...records);
    next();
  });
  return rows;
}

function toDate(val: unknown): string | null {
  if (!val) return null;
  const s = String(val).split('T')[0];
  return s || null;
}

function g<T>(record: Airtable.Record<Airtable.FieldSet>, field: string): T | null {
  const v = record.get(field);
  if (v === undefined || v === null || v === '') return null;
  return v as T;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

let ok = 0;
let warn = 0;
let fail = 0;

function log(label: string, n: number) {
  console.log(`  ✓ ${label}: ${n} rows inserted`);
  ok += n;
}

// ── Migration steps ───────────────────────────────────────────────────────────

async function migrateTenant() {
  await sql`
    INSERT INTO tenants (id, name, created_at)
    VALUES (${TENANT_ID}, ${TENANT_ID}, NOW())
    ON CONFLICT (id) DO NOTHING
  `;
  console.log(`  ✓ Tenant "${TENANT_ID}" ensured`);
}

async function migrateUsers() {
  const rows = await fetchAll('Users');
  let n = 0;
  for (const ch of chunk(rows, 50)) {
    for (const r of ch) {
      await sql`
        INSERT INTO users (id, tenant_id, name, email, role, password, password_changed)
        VALUES (
          ${r.id},
          ${TENANT_ID},
          ${g<string>(r, 'Name')},
          ${g<string>(r, 'Email') ?? r.id + '@unknown'},
          ${g<string>(r, 'Role') ?? 'Editor'},
          ${g<string>(r, 'Password')},
          ${g<boolean>(r, 'Password_Changed') ?? false}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      n++;
    }
  }
  log('users', n);
}

async function migrateKeywordMap(): Promise<string[]> {
  const rows = await fetchAll('Keyword-Map');
  let n = 0;
  const allIds: string[] = [];
  for (const ch of chunk(rows, 50)) {
    for (const r of ch) {
      const editorIds = (g<string[]>(r, 'Assigned_Editor') ?? []);
      await sql`
        INSERT INTO keyword_map (
          id, tenant_id, keyword, target_url, search_volume, difficulty, status,
          editorial_deadline, main_keyword, article_count, avg_product_value,
          policy, priority_score, ranking, action_type, page_type, last_published
        )
        VALUES (
          ${r.id}, ${TENANT_ID},
          ${g<string>(r, 'Keyword') ?? ''},
          ${g<string>(r, 'Target_URL') ?? ''},
          ${g<number>(r, 'Search_Volume')},
          ${g<number>(r, 'Difficulty')},
          ${g<string>(r, 'Status') ?? 'Backlog'},
          ${toDate(g<string>(r, 'Editorial_Deadline'))},
          ${g<string>(r, 'Main_Keyword') ?? 'N'},
          ${g<number>(r, 'Article_Count')},
          ${g<number>(r, 'Avg_Product_Value')?.toString() ?? null},
          ${g<number>(r, 'Policy')?.toString() ?? null},
          ${g<number>(r, 'Priority_Score')?.toString() ?? null},
          ${g<number>(r, 'Ranking')},
          ${g<string>(r, 'Action_Type') ?? 'Erstellung'},
          ${g<string>(r, 'Page_Type')},
          ${toDate(g<string>(r, 'Last_Published'))}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      // keyword_map_editors
      for (const userId of editorIds) {
        try {
          await sql`
            INSERT INTO keyword_map_editors (keyword_id, user_id)
            VALUES (${r.id}, ${userId})
            ON CONFLICT DO NOTHING
          `;
        } catch {
          // user might not exist if users table is incomplete
          warn++;
        }
      }
      allIds.push(r.id);
      n++;
    }
  }
  log('keyword_map', n);
  return allIds;
}

async function migrateContentLog() {
  const rows = await fetchAll('Content-Log');
  let n = 0;
  for (const ch of chunk(rows, 50)) {
    for (const r of ch) {
      const kwIds = g<string[]>(r, 'Keyword_ID') ?? [];
      const keywordId = kwIds[0] ?? null;
      const rawTarget = r.get('Target_URL');
      const resolvedUrl = Array.isArray(rawTarget) ? String(rawTarget[0]) : (rawTarget ? String(rawTarget) : null);
      const loggedUrl = g<string>(r, 'Logged_URL') ?? resolvedUrl;
      const editorIds = g<string[]>(r, 'Editor') ?? [];
      try {
        await sql`
          INSERT INTO content_log (
            tenant_id, keyword_id, logged_url, action_type, page_type,
            content_body, diff_summary, editor_id, time_created, time_changed
          )
          VALUES (
            ${TENANT_ID},
            ${keywordId},
            ${loggedUrl},
            ${g<string>(r, 'Action_Type')},
            ${g<string>(r, 'Page_Type')},
            ${g<string>(r, 'Content_Body')},
            ${g<string>(r, 'Diff_Summary')},
            ${editorIds[0] ?? null},
            ${g<string>(r, 'Time_Created') ?? new Date().toISOString()},
            ${g<string>(r, 'Time_Changed') ?? new Date().toISOString()}
          )
        `;
        n++;
      } catch (err: any) {
        console.warn(`  ⚠  content_log ${r.id} skipped: ${err.message}`);
        warn++;
      }
    }
  }
  log('content_log', n);
}

async function migrateUrlPerformance() {
  const rows = await fetchAll('URL_Performance');
  let n = 0;
  for (const ch of chunk(rows, 50)) {
    for (const r of ch) {
      const date = toDate(g<string>(r, 'Date'));
      if (!date) { warn++; continue; }
      try {
        await sql`
          INSERT INTO url_performance (
            tenant_id, target_url, date, gsc_clicks, gsc_impressions, position, sistrix_vi
          )
          VALUES (
            ${TENANT_ID},
            ${g<string>(r, 'Target_URL') ?? ''},
            ${date},
            ${g<number>(r, 'GSC_Clicks')},
            ${g<number>(r, 'GSC_Impressions')},
            ${g<number>(r, 'Position')?.toString() ?? null},
            ${g<number>(r, 'Sistrix_VI')?.toString() ?? null}
          )
          ON CONFLICT (target_url, date, tenant_id) DO UPDATE
            SET gsc_clicks = EXCLUDED.gsc_clicks,
                gsc_impressions = EXCLUDED.gsc_impressions,
                position = EXCLUDED.position,
                sistrix_vi = EXCLUDED.sistrix_vi
        `;
        n++;
      } catch (err: any) {
        console.warn(`  ⚠  url_performance ${r.id} skipped: ${err.message}`);
        warn++;
      }
    }
  }
  log('url_performance', n);
}

async function migrateKeywordRankingHistory() {
  const rows = await fetchAll('Keyword_Ranking_History');
  let n = 0;
  for (const ch of chunk(rows, 50)) {
    for (const r of ch) {
      const kwIds = g<string[]>(r, 'Keyword_ID') ?? [];
      const keywordId = kwIds[0] ?? null;
      const date = toDate(g<string>(r, 'Date'));
      if (!keywordId || !date) { warn++; continue; }
      try {
        await sql`
          INSERT INTO keyword_ranking_history (tenant_id, keyword_id, date, ranking)
          VALUES (${TENANT_ID}, ${keywordId}, ${date}, ${g<number>(r, 'Ranking')})
          ON CONFLICT (keyword_id, date, tenant_id) DO UPDATE SET ranking = EXCLUDED.ranking
        `;
        n++;
      } catch (err: any) {
        console.warn(`  ⚠  keyword_ranking_history ${r.id} skipped: ${err.message}`);
        warn++;
      }
    }
  }
  log('keyword_ranking_history', n);
}

async function migrateBlacklist() {
  const rows = await fetchAll('Blacklist');
  let n = 0;
  for (const ch of chunk(rows, 50)) {
    for (const r of ch) {
      await sql`
        INSERT INTO blacklist (tenant_id, keyword, target_url, type, reason, added_at)
        VALUES (
          ${TENANT_ID},
          ${g<string>(r, 'Keyword')},
          ${g<string>(r, 'Target_URL')},
          ${g<string>(r, 'Type') ?? 'Keyword'},
          ${g<string>(r, 'Reason')},
          ${g<string>(r, 'Added_At') ?? g<string>(r, 'Time_Created') ?? new Date().toISOString()}
        )
      `;
      n++;
    }
  }
  log('blacklist', n);
}

async function migrateCostConfig() {
  const rows = await fetchAll('Cost_Config');
  let n = 0;
  for (const r of rows) {
    await sql`
      INSERT INTO cost_config (tenant_id, page_type, action_type, agency_cost, overhead_cost)
      VALUES (
        ${TENANT_ID},
        ${g<string>(r, 'Page_Type') ?? 'Ratgeber'},
        ${g<string>(r, 'Action_Type') ?? 'Erstellung'},
        ${g<number>(r, 'Agency_Cost')?.toString() ?? '0'},
        ${g<number>(r, 'Overhead_Cost')?.toString() ?? '0'}
      )
    `;
    n++;
  }
  log('cost_config', n);
}

async function migrateConfig() {
  const rows = await fetchAll('Config');
  let n = 0;
  for (const r of rows) {
    const key = g<string>(r, 'Key');
    if (!key) { warn++; continue; }
    const fileAttachments = r.get('File') as any[] | undefined;
    const isBrandAsset = key === 'BRAND_LOGO_URL' || key === 'BRAND_FAVICON_URL';
    const fileUrl = isBrandAsset && fileAttachments?.length ? fileAttachments[0].url : null;
    const value = isBrandAsset && fileUrl ? fileUrl : g<string>(r, 'Value') ?? '';
    await sql`
      INSERT INTO config (tenant_id, key, value, description, file_url, updated_at)
      VALUES (
        ${TENANT_ID}, ${key}, ${value},
        ${g<string>(r, 'Description')},
        ${fileUrl},
        NOW()
      )
      ON CONFLICT (tenant_id, key) DO UPDATE
        SET value = EXCLUDED.value,
            file_url = EXCLUDED.file_url,
            updated_at = NOW()
    `;
    n++;
  }
  log('config', n);
}

async function migrateAuditLogs() {
  const rows = await fetchAll('Audit_Logs');
  let n = 0;
  for (const ch of chunk(rows, 50)) {
    for (const r of ch) {
      const userIds = g<string[]>(r, 'User_ID') ?? [];
      const rawPayload = g<string>(r, 'Raw_Payload');
      let jsonPayload: any = null;
      if (rawPayload) {
        try { jsonPayload = JSON.parse(rawPayload); } catch { jsonPayload = { _raw: rawPayload }; }
      }
      try {
        await sql`
          INSERT INTO audit_logs (tenant_id, action, timestamp, user_id, raw_payload)
          VALUES (
            ${TENANT_ID},
            ${g<string>(r, 'Action') ?? ''},
            ${g<string>(r, 'Timestamp') ?? new Date().toISOString()},
            ${userIds[0] ?? null},
            ${jsonPayload ? sql.json(jsonPayload) : null}
          )
        `;
        n++;
      } catch (err: any) {
        console.warn(`  ⚠  audit_log ${r.id} skipped: ${err.message}`);
        warn++;
      }
    }
  }
  log('audit_logs', n);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀  Starting Airtable → PostgreSQL migration`);
  console.log(`   Tenant:  ${TENANT_ID}`);
  console.log(`   DB:      ${DB_URL!.replace(/:[^:@]+@/, ':***@')}\n`);

  try {
    await migrateTenant();
    await migrateUsers();
    await migrateKeywordMap();
    await migrateContentLog();
    await migrateUrlPerformance();
    await migrateKeywordRankingHistory();
    await migrateBlacklist();
    await migrateCostConfig();
    await migrateConfig();
    await migrateAuditLogs();

    console.log(`\n✅  Migration complete`);
    console.log(`   Inserted: ${ok} rows`);
    if (warn > 0) console.log(`   Warnings: ${warn}`);
    if (fail > 0) console.log(`   Failures: ${fail}`);
  } catch (err: any) {
    console.error('\n❌  Migration failed:', err.message);
    fail++;
  } finally {
    await sql.end();
  }

  if (fail > 0) process.exit(1);
}

main();

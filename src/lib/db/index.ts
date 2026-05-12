import postgres from 'postgres';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql as drizzleSql } from 'drizzle-orm';
import * as schema from './schema';

// ---------------------------------------------------------------------------
// Connection pool
// ---------------------------------------------------------------------------
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

const globalForDb = globalThis as unknown as { _pgClient?: postgres.Sql };

const pgSql = globalForDb._pgClient ?? postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb._pgClient = pgSql;
}

export type AppDb = PostgresJsDatabase<typeof schema>;

export const db: AppDb = drizzle(pgSql, { schema });

// ---------------------------------------------------------------------------
// Tenant-Context helper
// ---------------------------------------------------------------------------
export async function withTenant<T>(
  tenantId: string,
  fn: (db: AppDb) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // set_config(key, value, is_local=true) — scoped to this transaction
    await tx.execute(
      drizzleSql`SELECT set_config('app.tenant_id', ${tenantId}, true)`
    );
    return fn(tx as unknown as AppDb);
  });
}

// ---------------------------------------------------------------------------
// Default tenant ID helper
// ---------------------------------------------------------------------------
export function getDefaultTenantId(): string {
  return process.env.TENANT_ID ?? 'default';
}

export { pgSql as pgClient };
export * from './schema';

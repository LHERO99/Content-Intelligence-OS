import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getKeywordMap, getAllUsers, getAuditLogs, getBlacklist, getCostConfigs, getConfig } from '@/lib/postgres';

const TABLE_MAP: Record<string, () => Promise<any[]>> = {
  users:                   () => getAllUsers(),
  keyword_map:             () => getKeywordMap(),
  audit_logs:              () => getAuditLogs(),
  blacklist:               () => getBlacklist(),
  cost_config:             () => getCostConfigs(),
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SuperAdmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requestedTable = (searchParams.get('table') ?? 'users').toLowerCase().replace(/[-\s]/g, '_');

  try {
    console.log(`[Debug] Testing PostgreSQL connection — table "${requestedTable}"…`);

    let records: any[];
    if (requestedTable === 'config') {
      const cfg = await getConfig();
      records = Object.entries(cfg).map(([key, value]) => ({ key, value }));
    } else {
      const fn = TABLE_MAP[requestedTable];
      if (!fn) {
        return NextResponse.json({ status: 'error', message: `Unknown table "${requestedTable}". Available: ${Object.keys(TABLE_MAP).join(', ')}, config` }, { status: 400 });
      }
      records = await fn();
    }

    console.log(`[Debug] PostgreSQL OK — ${records.length} records in "${requestedTable}".`);
    return NextResponse.json({
      status: 'success',
      message: `PostgreSQL connection verified for ${requestedTable}`,
      recordCount: records.length,
      records,
    });
  } catch (error: any) {
    console.error(`[Debug] PostgreSQL connection failed for ${requestedTable}:`, error);
    return NextResponse.json({
      status: 'error',
      message: `PostgreSQL connection failed for ${requestedTable}`,
      error: error.message,
    }, { status: 500 });
  }
}

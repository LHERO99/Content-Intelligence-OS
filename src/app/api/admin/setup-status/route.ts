import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getCostConfigs } from '@/lib/postgres';
import { getIntegrationsState } from '@/lib/admin-integrations';
import { db } from '@/lib/db';
import { keywordMap } from '@/lib/db/schema';
import { eq, count } from 'drizzle-orm';

export interface SetupStatus {
  costConfig: { ok: boolean; count: number };
  integrations: { gsc: boolean; sistrix: boolean; dataforseo: boolean };
  keywordMap: { ok: boolean; count: number };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId;

    const [costs, integrations, kwCountResult] = await Promise.all([
      getCostConfigs(tenantId),
      getIntegrationsState(tenantId),
      db
        .select({ count: count() })
        .from(keywordMap)
        .where(eq(keywordMap.tenantId, tenantId as string)),
    ]);

    const kwCount = kwCountResult[0]?.count ?? 0;

    const gsc = integrations.find((i) => i.provider === 'google_search_console');
    const sistrix = integrations.find((i) => i.provider === 'sistrix');
    const dataforseo = integrations.find((i) => i.provider === 'dataforseo');

    const status: SetupStatus = {
      costConfig: { ok: costs.length > 0, count: costs.length },
      integrations: {
        gsc: gsc?.configured ?? false,
        sistrix: sistrix?.configured ?? false,
        dataforseo: dataforseo?.configured ?? false,
      },
      keywordMap: { ok: kwCount > 0, count: kwCount },
    };

    return NextResponse.json(status);
  } catch (error: any) {
    console.error('[API] setup-status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

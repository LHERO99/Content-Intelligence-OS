import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getIntegrationsState } from '@/lib/admin-integrations';
import { db } from '@/lib/db';
import { keywordMap, costConfig, alertRules, config as configTable } from '@/lib/db/schema';
import { eq, count, gt, sql } from 'drizzle-orm';

export interface SetupStatus {
  // Pflichtfelder
  keywordMap: { ok: boolean; count: number };
  integrations: { gsc: boolean; sistrix: boolean; dataforseo: boolean };
  // Optionale Bereiche
  optional: {
    costConfig:        { ok: boolean; count: number };
    branding:          { ok: boolean };
    agentType:         { ok: boolean };
    alerts:            { ok: boolean; count: number };
    optimizationRules: { ok: boolean };
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId as string;

    const [integrations, kwCountResult, costCountResult, alertCountResult, configRows] =
      await Promise.all([
        getIntegrationsState(tenantId),
        db.select({ count: count() }).from(keywordMap).where(eq(keywordMap.tenantId, tenantId)),
        // costConfig ok = at least one entry with agency_cost > 0
        db.select({ count: count() })
          .from(costConfig)
          .where(sql`${costConfig.tenantId} = ${tenantId} AND ${costConfig.agencyCost}::numeric > 0`),
        db.select({ count: count() }).from(alertRules).where(eq(alertRules.tenantId, tenantId)),
        db.select({ key: configTable.key, value: configTable.value })
          .from(configTable)
          .where(eq(configTable.tenantId, tenantId)),
      ]);

    const cfg: Record<string, string> = {};
    for (const row of configRows) {
      if (row.value?.trim()) cfg[row.key] = row.value;
    }

    const kwCount    = kwCountResult[0]?.count   ?? 0;
    const ccCount    = costCountResult[0]?.count  ?? 0;
    const altCount   = alertCountResult[0]?.count ?? 0;

    const gsc        = integrations.find((i) => i.provider === 'google_search_console');
    const sistrix    = integrations.find((i) => i.provider === 'sistrix');
    const dataforseo = integrations.find((i) => i.provider === 'dataforseo');

    const brandingOk = Boolean(cfg['LOGO_URL'] || cfg['BRAND_COLOR'] || cfg['BRAND_NAME']);
    const agentOk    = Boolean(cfg['EXTERNAL_AGENT_ENABLED'] || cfg['EXTERNAL_AGENT_WEBHOOK_URL'] || cfg['N8N_WEBHOOK_URL']);
    const optRulesOk = Object.keys(cfg).some((k) => k.startsWith('OPT_RULE_'));

    const status: SetupStatus = {
      keywordMap:   { ok: kwCount > 0, count: kwCount },
      integrations: {
        gsc:        gsc?.configured        ?? false,
        sistrix:    sistrix?.configured    ?? false,
        dataforseo: dataforseo?.configured ?? false,
      },
      optional: {
        costConfig:        { ok: ccCount > 0, count: ccCount },
        branding:          { ok: brandingOk },
        agentType:         { ok: agentOk },
        alerts:            { ok: altCount > 0, count: altCount },
        optimizationRules: { ok: optRulesOk },
      },
    };

    return NextResponse.json(status);
  } catch (error: any) {
    console.error('[API] setup-status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

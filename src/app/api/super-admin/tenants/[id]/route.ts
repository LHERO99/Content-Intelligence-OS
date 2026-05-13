import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import {
  tenants,
  keywordMap,
  contentLog,
  config,
  tenantSubscriptions,
  pricingTiers,
} from "@/lib/db/schema";
import { eq, count, sql, and, gte } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: tenantId } = await params;

    // Check tenant exists
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Keyword count
    const [kwRow] = await db
      .select({ total: count() })
      .from(keywordMap)
      .where(eq(keywordMap.tenantId, tenantId));

    // URL count (distinct target_url)
    const [urlRow] = await db
      .select({ total: sql<number>`count(distinct ${keywordMap.targetUrl})` })
      .from(keywordMap)
      .where(eq(keywordMap.tenantId, tenantId));

    // Content log stats (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const contentStats = await db
      .select({
        actionType: contentLog.actionType,
        total: count(),
      })
      .from(contentLog)
      .where(
        and(
          eq(contentLog.tenantId, tenantId),
          gte(contentLog.timeCreated, thirtyDaysAgo)
        )
      )
      .groupBy(contentLog.actionType);

    const erstellungen = contentStats.find((s) => s.actionType === "Erstellung")?.total ?? 0;
    const optimierungen = contentStats.find((s) => s.actionType === "Optimierung")?.total ?? 0;

    // All-time content counts
    const [allTimeRow] = await db
      .select({ total: count() })
      .from(contentLog)
      .where(eq(contentLog.tenantId, tenantId));

    // Config: integrations & agent type
    const configRows = await db
      .select({ key: config.key, value: config.value })
      .from(config)
      .where(eq(config.tenantId, tenantId));

    const configMap: Record<string, string> = {};
    for (const row of configRows) {
      if (row.value) configMap[row.key] = row.value;
    }

    // Determine connected integrations
    const integrations: string[] = [];
    if (configMap["gsc_connected"] === "true" || configMap["gsc_site_url"]) {
      integrations.push("Google Search Console");
    }
    if (configMap["sistrix_api_key"]) {
      integrations.push("Sistrix");
    }
    if (configMap["dataforseo_login"]) {
      integrations.push("DataForSEO");
    }
    if (configMap["n8n_webhook_url"] || configMap["agent_webhook_url"]) {
      integrations.push("n8n Webhook");
    }

    // Agent type: internal (n8n) vs external
    const agentType = configMap["agent_type"] ?? (configMap["n8n_webhook_url"] ? "internal" : "none");

    // Health score calculation
    let healthScore = 0;
    if (integrations.length > 0) healthScore += 25;
    if ((kwRow?.total ?? 0) > 0) healthScore += 25;
    if ((urlRow?.total ?? 0) > 0) healthScore += 25;
    if ((erstellungen + optimierungen) > 0) healthScore += 25;

    const healthStatus =
      healthScore >= 100 ? "healthy" :
      healthScore >= 50  ? "warning" :
                           "critical";

    // Subscription
    const [sub] = await db
      .select({
        tierId:       tenantSubscriptions.tierId,
        billingCycle: tenantSubscriptions.billingCycle,
        status:       tenantSubscriptions.status,
        tierName:     pricingTiers.name,
        monthlyPrice: pricingTiers.monthlyPrice,
        yearlyPrice:  pricingTiers.yearlyPrice,
      })
      .from(tenantSubscriptions)
      .leftJoin(pricingTiers, eq(pricingTiers.id, tenantSubscriptions.tierId))
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .limit(1);

    return NextResponse.json({
      tenant,
      health: {
        score: healthScore,
        status: healthStatus,
      },
      stats: {
        keywordCount:    kwRow?.total ?? 0,
        urlCount:        urlRow?.total ?? 0,
        erstellungen30d: erstellungen,
        optimierungen30d: optimierungen,
        totalContentLogs: allTimeRow?.total ?? 0,
      },
      integrations,
      agentType,
      subscription: sub ?? null,
    });
  } catch (error) {
    console.error("[SuperAdmin] Error fetching tenant health:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

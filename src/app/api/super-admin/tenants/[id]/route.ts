import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import {
  tenants,
  keywordMap,
  urls,
  executionCycles,
  processEvents,
  config,
  costConfig,
  tenantSubscriptions,
  pricingTiers,
  users,
  auditLogs,
} from "@/lib/db/schema";
import { eq, count, sql, and, gte, max, desc, like } from "drizzle-orm";

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

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // ── User count ────────────────────────────────────────────────────────────
    const [userCountRow] = await db
      .select({ total: count() })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    // ── Keyword stats ─────────────────────────────────────────────────────────
    const [kwTotalRow] = await db
      .select({ total: count() })
      .from(keywordMap)
      .where(eq(keywordMap.tenantId, tenantId));

    // Status is now aggregated from planning/execution/publishing tables
    const kwByStatus = [
      { status: 'Backlog', total: 0 },
      { status: 'Planned', total: 0 },
      { status: 'Beauftragt', total: 0 },
      { status: 'In Arbeit', total: 0 },
      { status: 'Angeliefert', total: 0 },
      { status: 'Published', total: 0 },
    ]; // Simplified for now - detailed stats can be added later

    // ── URL count ──────────────────────────────────────────────────────────────
    const [urlRow] = await db
      .select({ total: count() })
      .from(urls)
      .where(eq(urls.tenantId, tenantId));

    // ── Cost config count ─────────────────────────────────────────────────────
    const [costConfigRow] = await db
      .select({ total: count() })
      .from(costConfig)
      .where(eq(costConfig.tenantId, tenantId));

    // ── Execution stats (last 30 days) ────────────────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const cycleStats = await db
      .select({ actionType: executionCycles.actionType, total: count() })
      .from(executionCycles)
      .where(and(
        eq(executionCycles.tenantId, tenantId),
        gte(executionCycles.createdAt, thirtyDaysAgo)
      ))
      .groupBy(executionCycles.actionType);

    const erstellungen30d  = cycleStats.find((s) => s.actionType === "creation")?.total  ?? 0;
    const optimierungen30d = cycleStats.find((s) => s.actionType === "optimization")?.total ?? 0;

    // ── All-time content count + last activity ────────────────────────────────
    const [allTimeRow] = await db
      .select({ total: count(), lastActivity: max(processEvents.eventTimestamp) })
      .from(processEvents)
      .where(eq(processEvents.tenantId, tenantId));

    const lastActivityDate  = allTimeRow?.lastActivity ?? null;
    const daysSinceActivity = lastActivityDate
      ? Math.floor((Date.now() - new Date(lastActivityDate).getTime()) / 86_400_000)
      : null;

    // ── Config ────────────────────────────────────────────────────────────────
    // Keys are stored UPPERCASE — match exactly as written by the app
    const configRows = await db
      .select({ key: config.key, value: config.value })
      .from(config)
      .where(eq(config.tenantId, tenantId));

    const cfg: Record<string, string> = {};
    for (const row of configRows) {
      if (row.value) cfg[row.key] = row.value;
    }

    // ── Integration details ───────────────────────────────────────────────────
    // Key names match exactly what the app writes (UPPERCASE, see admin-integrations.ts)
    const integrationDetails: Array<{
      name: string;
      connected: boolean;
      detail: string;
    }> = [
      {
        name:      "Google Search Console",
        connected: !!(cfg["GSC_SITE_URL"] || cfg["GSC_REFRESH_TOKEN"]),
        detail:    cfg["GSC_SITE_URL"]
          ? `Site: ${cfg["GSC_SITE_URL"]}${cfg["GSC_CONNECTED_EMAIL"] ? ` (${cfg["GSC_CONNECTED_EMAIL"]})` : ""}`
          : "Nicht verbunden",
      },
      {
        name:      "Sistrix",
        connected: !!cfg["SISTRIX_API_KEY"],
        detail:    cfg["SISTRIX_API_KEY"] ? "API Key hinterlegt" : "Nicht verbunden",
      },
      {
        name:      "DataForSEO",
        connected: !!cfg["DATAFORSEO_USERNAME"],
        detail:    cfg["DATAFORSEO_USERNAME"]
          ? `Nutzer: ${cfg["DATAFORSEO_USERNAME"]}`
          : "Nicht verbunden",
      },
      {
        name:      "Externer Agent (Webhook)",
        connected: !!(cfg["EXTERNAL_AGENT_WEBHOOK_URL"] && cfg["EXTERNAL_AGENT_ENABLED"] === "true"),
        detail:    cfg["EXTERNAL_AGENT_WEBHOOK_URL"]
          ? cfg["EXTERNAL_AGENT_ENABLED"] === "true"
            ? "Webhook aktiv"
            : "Webhook konfiguriert, aber deaktiviert"
          : "Nicht konfiguriert",
      },
    ];

    const connectedIntegrations = integrationDetails.filter((i) => i.connected);

    // ── Agent type ────────────────────────────────────────────────────────────
    // EXTERNAL_AGENT_ENABLED = "true" → external; webhook URL present → internal (n8n); else none
    const agentType =
      cfg["EXTERNAL_AGENT_ENABLED"] === "true"  ? "external" :
      cfg["EXTERNAL_AGENT_WEBHOOK_URL"]          ? "internal" :
                                                   "none";

    // ── Health criteria breakdown ─────────────────────────────────────────────
    const rankingIntegrationOk = Boolean(cfg["GSC_REFRESH_TOKEN"]?.trim() || cfg["SISTRIX_API_KEY"]?.trim() || cfg["DATAFORSEO_USERNAME"]?.trim());
    const costConfigOk = (costConfigRow?.total ?? 0) > 0;

    const criteria = [
      {
        key:       "integrations",
        label:     "Integrationen",
        passed:    connectedIntegrations.length > 0,
        points:    connectedIntegrations.length > 0 ? 20 : 0,
        maxPoints: 20,
        detail:    connectedIntegrations.length > 0
          ? `${connectedIntegrations.map((i) => i.name).join(", ")} verbunden`
          : "Keine Integration verbunden",
      },
      {
        key:       "keywords",
        label:     "Keywords",
        passed:    (kwTotalRow?.total ?? 0) > 0,
        points:    (kwTotalRow?.total ?? 0) > 0 ? 20 : 0,
        maxPoints: 20,
        detail:    (kwTotalRow?.total ?? 0) > 0
          ? `${(kwTotalRow?.total ?? 0).toLocaleString("de-DE")} Keywords in der Datenbank`
          : "Keine Keywords vorhanden",
      },
      {
        key:       "urls",
        label:     "URLs",
        passed:    (urlRow?.total ?? 0) > 0,
        points:    (urlRow?.total ?? 0) > 0 ? 20 : 0,
        maxPoints: 20,
        detail:    (urlRow?.total ?? 0) > 0
          ? `${(urlRow?.total ?? 0).toLocaleString("de-DE")} distinct URLs vorhanden`
          : "Keine URLs vorhanden",
      },
      {
        key:       "activity",
        label:     "Aktivität (30 Tage)",
        passed:    (erstellungen30d + optimierungen30d) > 0,
        points:    (erstellungen30d + optimierungen30d) > 0 ? 20 : 0,
        maxPoints: 20,
        detail:    (erstellungen30d + optimierungen30d) > 0
          ? `${erstellungen30d} Erstellung(en), ${optimierungen30d} Optimierung(en)`
          : lastActivityDate
            ? `0 Aktionen — letzter Log vor ${daysSinceActivity} Tagen (${new Date(lastActivityDate).toLocaleDateString("de-DE")})`
            : "Noch keine Content-Aktivität",
      },
      {
        key:       "costConfig",
        label:     "Kostenkonfiguration",
        passed:    costConfigOk,
        points:    costConfigOk ? 10 : 0,
        maxPoints: 10,
        detail:    costConfigOk
          ? `${(costConfigRow?.total ?? 0)} Konfigurationen hinterlegt`
          : "Keine Kostenkonfiguration — ROI & Einsparungen werden nicht berechnet",
      },
      {
        key:       "rankingIntegration",
        label:     "Ranking-Integration",
        passed:    rankingIntegrationOk,
        points:    rankingIntegrationOk ? 10 : 0,
        maxPoints: 10,
        detail:    rankingIntegrationOk
          ? "GSC, Sistrix oder DataForSEO verbunden"
          : "Keine Ranking-Integration verbunden (GSC, Sistrix oder DataForSEO)",
      },
    ];

    const healthScore  = criteria.reduce((sum, c) => sum + c.points, 0);
    const healthStatus =
      healthScore >= 100 ? "healthy" :
      healthScore >= 50  ? "warning" :
                           "critical";

    // ── Subscription ──────────────────────────────────────────────────────────
    const [sub] = await db
      .select({
        tierId:       tenantSubscriptions.tierId,
        billingCycle: tenantSubscriptions.billingCycle,
        status:       tenantSubscriptions.status,
        startDate:    tenantSubscriptions.startDate,
        tierName:     pricingTiers.name,
        monthlyPrice: pricingTiers.monthlyPrice,
        yearlyPrice:  pricingTiers.yearlyPrice,
      })
      .from(tenantSubscriptions)
      .leftJoin(pricingTiers, eq(pricingTiers.id, tenantSubscriptions.tierId))
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .limit(1);

    // ── Cron status ───────────────────────────────────────────────────────────
    // Read the most recent audit log entry per cron job prefix for this tenant
    const CRON_JOBS = [
      { key: "cron:sync-gsc",        label: "GSC Sync" },
      { key: "cron:sync-dataforseo", label: "DataForSEO Sync" },
      { key: "cron:sync-sistrix",    label: "Sistrix Sync" },
    ] as const;

    const cronStatus = await Promise.all(
      CRON_JOBS.map(async ({ key, label }) => {
        const [latest] = await db
          .select({ action: auditLogs.action, timestamp: auditLogs.timestamp, rawPayload: auditLogs.rawPayload })
          .from(auditLogs)
          .where(and(
            eq(auditLogs.tenantId, tenantId),
            like(auditLogs.action, `${key}:%`),
          ))
          .orderBy(desc(auditLogs.timestamp))
          .limit(1);

        if (!latest) {
          return { key, label, status: "unknown" as const, timestamp: null, detail: "Noch kein Lauf protokolliert" };
        }

        const suffix    = latest.action.replace(`${key}:`, "");
        const ts        = latest.timestamp instanceof Date ? latest.timestamp.toISOString() : String(latest.timestamp);
        const ageMs     = Date.now() - new Date(ts).getTime();
        const ageDays   = ageMs / 86_400_000;

        if (suffix === "error") {
          let errMsg = "Letzter Lauf fehlgeschlagen";
          try {
            const p = latest.rawPayload as Record<string, unknown> | null;
            if (p?.error && typeof p.error === "string") errMsg = p.error;
          } catch {}
          return { key, label, status: "error" as const, timestamp: ts, detail: errMsg };
        }
        if (suffix === "skipped") {
          return { key, label, status: "warning" as const, timestamp: ts, detail: "Integration nicht konfiguriert — Sync übersprungen" };
        }
        if (ageDays > 8) {
          return { key, label, status: "warning" as const, timestamp: ts, detail: `Letzter Lauf vor ${Math.floor(ageDays)} Tagen` };
        }
        return { key, label, status: "ok" as const, timestamp: ts, detail: "Erfolgreich synchronisiert" };
      })
    );

    return NextResponse.json({
      tenant,
      health: { score: healthScore, status: healthStatus, criteria },
      stats: {
        keywordCount:      kwTotalRow?.total   ?? 0,
        urlCount:          urlRow?.total       ?? 0,
        erstellungen30d,
        optimierungen30d,
        totalContentLogs:  allTimeRow?.total   ?? 0,
        lastActivityDate,
        daysSinceActivity,
        userCount:         userCountRow?.total ?? 0,
        keywordsByStatus:  kwByStatus.map((r) => ({ status: r.status, count: r.total })),
      },
      integrationDetails,
      agentType,
      subscription: sub ?? null,
      cronStatus,
    });
  } catch (error) {
    console.error("[SuperAdmin] Error fetching tenant health:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

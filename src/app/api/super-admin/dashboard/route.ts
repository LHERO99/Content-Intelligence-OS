import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import {
  tenants,
  users,
  tenantSubscriptions,
  pricingTiers,
  featureRequests,
} from "@/lib/db/schema";
import { eq, count, sql, desc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // ── 1. Tenants + subscriptions ─────────────────────────────────────────
    const tenantRows = await db
      .select({
        id:           tenants.id,
        name:         tenants.name,
        createdAt:    tenants.createdAt,
        tierId:       tenantSubscriptions.tierId,
        billingCycle: tenantSubscriptions.billingCycle,
        subStatus:    tenantSubscriptions.status,
      })
      .from(tenants)
      .leftJoin(tenantSubscriptions, eq(tenantSubscriptions.tenantId, tenants.id))
      .orderBy(desc(tenants.createdAt));

    // ── 2. Pricing tiers ───────────────────────────────────────────────────
    const tiers = await db.select().from(pricingTiers);
    const tierMap: Record<string, { name: string; monthlyPrice: string; yearlyPrice: string }> = {};
    for (const t of tiers) {
      tierMap[t.id] = { name: t.name, monthlyPrice: t.monthlyPrice, yearlyPrice: t.yearlyPrice };
    }

    // ── 3. Tenant stats ────────────────────────────────────────────────────
    const totalTenants   = tenantRows.length;
    const activeTenants  = tenantRows.filter((r) => r.subStatus === "active").length;
    const inactiveTenants= tenantRows.filter((r) => r.subStatus === "inactive").length;
    const trialTenants   = tenantRows.filter((r) => r.subStatus === "trial").length;

    // ── 4. Revenue calculation (MRR) ───────────────────────────────────────
    // Only count active tenants
    let mrrMonthly = 0; // contribution from monthly-billing tenants
    let mrrYearly  = 0; // contribution from yearly-billing tenants (yearlyPrice / 12)
    let monthlyBillingCount = 0;
    let yearlyBillingCount  = 0;

    for (const r of tenantRows) {
      if (r.subStatus !== "active" || !r.tierId) continue;
      const tier = tierMap[r.tierId];
      if (!tier) continue;

      if (r.billingCycle === "yearly") {
        const contribution = parseFloat(tier.yearlyPrice) / 12;
        mrrYearly += contribution;
        yearlyBillingCount++;
      } else {
        const contribution = parseFloat(tier.monthlyPrice);
        mrrMonthly += contribution;
        monthlyBillingCount++;
      }
    }

    const mrr = mrrMonthly + mrrYearly;
    const arr = mrr * 12;
    const avgRevenuePerTenant = activeTenants > 0 ? mrr / activeTenants : 0;

    // ── 5. Subscription distribution ──────────────────────────────────────
    const subDistribution: Record<string, { tierName: string; count: number }> = {};
    for (const r of tenantRows) {
      if (r.subStatus !== "active") continue;
      const key = r.tierId ?? "none";
      const name = r.tierId ? (tierMap[r.tierId]?.name ?? "Unbekannt") : "Kein Tier";
      if (!subDistribution[key]) {
        subDistribution[key] = { tierName: name, count: 0 };
      }
      subDistribution[key].count++;
    }

    const subscriptionDistribution = Object.entries(subDistribution).map(([tierId, data]) => ({
      tierId,
      tierName: data.tierName,
      count: data.count,
    }));

    // ── 6. Feedback stats ──────────────────────────────────────────────────
    const feedbackRows = await db
      .select({
        type:   featureRequests.type,
        status: featureRequests.status,
        cnt:    count(),
      })
      .from(featureRequests)
      .groupBy(featureRequests.type, featureRequests.status);

    const feedbackStats = {
      features: {
        Open: 0, InValidation: 0, Planned: 0, InDevelopment: 0, Released: 0, Cancelled: 0,
      },
      bugs: {
        Open: 0, InValidation: 0, Planned: 0, InDevelopment: 0, Released: 0, Cancelled: 0,
      },
    };

    for (const row of feedbackRows) {
      const target = row.type === "bug" ? feedbackStats.bugs : feedbackStats.features;
      const key = row.status as keyof typeof target;
      if (key in target) {
        target[key] = Number(row.cnt);
      }
    }

    // ── 7. Recent tenants (last 5) ─────────────────────────────────────────
    const recentTenants = tenantRows.slice(0, 5).map((r) => ({
      id:          r.id,
      name:        r.name,
      createdAt:   r.createdAt,
      subStatus:   r.subStatus,
      tierName:    r.tierId ? (tierMap[r.tierId]?.name ?? null) : null,
      billingCycle: r.billingCycle,
    }));

    return NextResponse.json({
      tenants: {
        total:    totalTenants,
        active:   activeTenants,
        inactive: inactiveTenants,
        trial:    trialTenants,
      },
      revenue: {
        mrr,
        arr,
        avgRevenuePerTenant,
        mrrFromMonthly:       mrrMonthly,
        mrrFromYearly:        mrrYearly,
        monthlyBillingCount,
        yearlyBillingCount,
      },
      subscriptionDistribution,
      feedbackStats,
      recentTenants,
    });
  } catch (error) {
    console.error("[SuperAdmin] Dashboard error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

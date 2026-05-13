import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import {
  tenants,
  users,
  tenantSubscriptions,
  pricingTiers,
  keywordMap,
  contentLog,
  config,
} from "@/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch all tenants with user count, subscription, and tier
    const rows = await db
      .select({
        id:           tenants.id,
        name:         tenants.name,
        createdAt:    tenants.createdAt,
        userCount:    count(users.id),
        tierId:       tenantSubscriptions.tierId,
        billingCycle: tenantSubscriptions.billingCycle,
        subStatus:    tenantSubscriptions.status,
        startDate:    tenantSubscriptions.startDate,
        tierName:     pricingTiers.name,
        monthlyPrice: pricingTiers.monthlyPrice,
        yearlyPrice:  pricingTiers.yearlyPrice,
      })
      .from(tenants)
      .leftJoin(users, eq(users.tenantId, tenants.id))
      .leftJoin(tenantSubscriptions, eq(tenantSubscriptions.tenantId, tenants.id))
      .leftJoin(pricingTiers, eq(pricingTiers.id, tenantSubscriptions.tierId))
      .groupBy(
        tenants.id,
        tenants.name,
        tenants.createdAt,
        tenantSubscriptions.tierId,
        tenantSubscriptions.billingCycle,
        tenantSubscriptions.status,
        tenantSubscriptions.startDate,
        pricingTiers.name,
        pricingTiers.monthlyPrice,
        pricingTiers.yearlyPrice,
      );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[SuperAdmin] Error fetching tenants:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

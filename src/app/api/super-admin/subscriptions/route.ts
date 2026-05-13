import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { tenantSubscriptions, pricingTiers, tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH: assign or update a tenant's subscription
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { tenantId, tierId, billingCycle, status } = body;

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }

    // Upsert
    const [sub] = await db
      .insert(tenantSubscriptions)
      .values({
        tenantId,
        tierId: tierId ?? null,
        billingCycle: billingCycle ?? "monthly",
        status: status ?? "active",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: tenantSubscriptions.tenantId,
        set: {
          tierId: tierId ?? null,
          billingCycle: billingCycle ?? "monthly",
          status: status ?? "active",
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json(sub);
  } catch (error) {
    console.error("[SuperAdmin] Error updating subscription:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

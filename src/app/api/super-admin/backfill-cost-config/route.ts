import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { tenants, costConfig } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { seedDefaultCostConfig } from "@/lib/postgres";

/**
 * POST /api/super-admin/backfill-cost-config
 * Seeds default cost config for every tenant that has no entries yet.
 * SuperAdmin only.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Find all tenants
    const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);

    // Find which tenants already have cost config entries
    const existing = await db
      .select({ tenantId: costConfig.tenantId, count: count() })
      .from(costConfig)
      .groupBy(costConfig.tenantId);

    const configuredTenantIds = new Set(existing.map((r) => r.tenantId));

    const toSeed = allTenants.filter((t) => !configuredTenantIds.has(t.id));

    const results: { tenantId: string; name: string; status: "seeded" | "error"; error?: string }[] = [];

    for (const tenant of toSeed) {
      try {
        await seedDefaultCostConfig(tenant.id);
        results.push({ tenantId: tenant.id, name: tenant.name, status: "seeded" });
      } catch (err: any) {
        results.push({ tenantId: tenant.id, name: tenant.name, status: "error", error: err.message });
      }
    }

    return NextResponse.json({
      seeded: results.filter((r) => r.status === "seeded").length,
      skipped: configuredTenantIds.size,
      errors: results.filter((r) => r.status === "error").length,
      results,
    });
  } catch (error: any) {
    console.error("[SuperAdmin] backfill-cost-config error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

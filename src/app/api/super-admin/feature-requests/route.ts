import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { featureRequests, tenants, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const typeFilter   = searchParams.get("type");
    const tenantFilter = searchParams.get("tenantId");

    let query = db
      .select({
        id:          featureRequests.id,
        type:        featureRequests.type,
        title:       featureRequests.title,
        description: featureRequests.description,
        status:      featureRequests.status,
        priority:    featureRequests.priority,
        createdAt:   featureRequests.createdAt,
        updatedAt:   featureRequests.updatedAt,
        tenantId:    featureRequests.tenantId,
        userId:      featureRequests.userId,
        tenantName:  tenants.name,
      })
      .from(featureRequests)
      .leftJoin(tenants, eq(tenants.id, featureRequests.tenantId))
      .orderBy(desc(featureRequests.createdAt))
      .$dynamic();

    const rows = await query;

    // Filter in JS (simple approach for now)
    let filtered = rows;
    if (statusFilter) filtered = filtered.filter((r) => r.status === statusFilter);
    if (typeFilter)   filtered = filtered.filter((r) => r.type === typeFilter);
    if (tenantFilter) filtered = filtered.filter((r) => r.tenantId === tenantFilter);

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("[SuperAdmin] Error fetching feature requests:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

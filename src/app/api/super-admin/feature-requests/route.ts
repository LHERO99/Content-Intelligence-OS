import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { featureRequests, tenants, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter  = searchParams.get("status");
    const typeFilter    = searchParams.get("type");
    const tenantFilter  = searchParams.get("tenantId");
    const quarterFilter = searchParams.get("quarter");

    const rows = await db
      .select({
        id:             featureRequests.id,
        type:           featureRequests.type,
        title:          featureRequests.title,
        description:    featureRequests.description,
        status:         featureRequests.status,
        priority:       featureRequests.priority,
        plannedQuarter: featureRequests.plannedQuarter,
        createdAt:      featureRequests.createdAt,
        updatedAt:      featureRequests.updatedAt,
        tenantId:       featureRequests.tenantId,
        userId:         featureRequests.userId,
        tenantName:     tenants.name,
      })
      .from(featureRequests)
      .leftJoin(tenants, eq(tenants.id, featureRequests.tenantId))
      .orderBy(desc(featureRequests.createdAt));

    let filtered = rows;
    if (statusFilter)  filtered = filtered.filter((r) => r.status === statusFilter);
    if (typeFilter)    filtered = filtered.filter((r) => r.type === typeFilter);
    if (tenantFilter)  filtered = filtered.filter((r) => r.tenantId === tenantFilter);
    if (quarterFilter) filtered = filtered.filter((r) => r.plannedQuarter === quarterFilter);

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("[SuperAdmin] Error fetching feature requests:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: SuperAdmin creates a feature request for any tenant
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { tenantId, type, title, description, priority, plannedQuarter } = body;

    if (!tenantId || !title || !type) {
      return NextResponse.json({ error: "tenantId, type and title are required" }, { status: 400 });
    }

    const [created] = await db
      .insert(featureRequests)
      .values({
        id:             randomUUID(),
        tenantId,
        userId:         session.user.id,
        type:           type as "feature" | "bug",
        title,
        description:    description ?? null,
        priority:       priority ?? "medium",
        plannedQuarter: plannedQuarter ?? null,
        status:         "Open",
        updatedAt:      new Date(),
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[SuperAdmin] Error creating feature request:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

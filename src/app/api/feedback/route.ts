import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { featureRequests } from "@/lib/db/schema";
import { eq, desc, or, and, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
// POST: submit a new feature request or bug report (tenant-side)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId ?? 'default';
    const body = await req.json();
    const { type, title, description, priority } = body;

    if (!title || !type) {
      return NextResponse.json({ error: "type and title are required" }, { status: 400 });
    }

    const [created] = await db
      .insert(featureRequests)
      .values({
        id:          randomUUID(),
        tenantId,
        userId:      session.user.id,
        type:        type as "feature" | "bug",
        title,
        description: description ?? null,
        priority:    priority ?? "medium",
        status:      "Open",
        updatedAt:   new Date(),
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[Feedback] Error creating feedback:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// GET: list own tenant's feature requests + public entries from other tenants
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId ?? 'default';

    // Own entries
    const ownRows = await db
      .select()
      .from(featureRequests)
      .where(eq(featureRequests.tenantId, tenantId))
      .orderBy(desc(featureRequests.createdAt));

    // Public entries from other tenants
    const publicRows = await db
      .select()
      .from(featureRequests)
      .where(
        and(
          eq(featureRequests.isPublic, true),
          ne(featureRequests.tenantId, tenantId)
        )
      )
      .orderBy(desc(featureRequests.createdAt));

    return NextResponse.json({
      own: ownRows,
      plexaro: publicRows,
    });
  } catch (error) {
    console.error("[Feedback] Error fetching feedback:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

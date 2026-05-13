import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { featureRequests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH: update status/priority of a feature request
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, priority } = body;

    const [updated] = await db
      .update(featureRequests)
      .set({
        status:    status ?? undefined,
        priority:  priority ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(featureRequests.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[SuperAdmin] Error updating feature request:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

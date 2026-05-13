import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

    const rows = await db
      .select({
        id:              users.id,
        name:            users.name,
        email:           users.email,
        role:            users.role,
        passwordChanged: users.passwordChanged,
        isActive:        users.isActive,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(users.email);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[SuperAdmin] Error fetching tenant users:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

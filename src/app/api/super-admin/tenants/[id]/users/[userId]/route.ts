import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: tenantId, userId } = await params;

    // Verify the user belongs to this tenant
    const [existing] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Protect SuperAdmin accounts from being locked
    if (existing.role === "SuperAdmin") {
      return NextResponse.json(
        { error: "SuperAdmin-Accounts können nicht bearbeitet werden." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, email, role, isActive } = body;

    // Validate role if provided
    const allowedRoles = ["Admin", "Editor", "Viewer"];
    if (role !== undefined && !allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Ungültige Rolle." }, { status: 400 });
    }

    const updateValues: Partial<typeof users.$inferInsert> = {};
    if (name     !== undefined) updateValues.name     = name.trim() || null;
    if (email    !== undefined) updateValues.email    = email.trim().toLowerCase();
    if (role     !== undefined) updateValues.role     = role;
    if (isActive !== undefined) updateValues.isActive = Boolean(isActive);

    if (Object.keys(updateValues).length === 0) {
      return NextResponse.json({ error: "Keine Felder zum Aktualisieren." }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set(updateValues)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .returning({
        id:              users.id,
        name:            users.name,
        email:           users.email,
        role:            users.role,
        passwordChanged: users.passwordChanged,
        isActive:        users.isActive,
      });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse wird bereits verwendet." },
        { status: 409 }
      );
    }
    console.error("[SuperAdmin] Error updating user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

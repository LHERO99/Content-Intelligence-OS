import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateUser, deleteUser } from "@/lib/postgres";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "Admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;
    const body = await request.json();

    // Allowlist: only permit safe fields — Role and Password_Changed are blocked
    // to prevent privilege escalation and auth bypass.
    const ALLOWED_FIELDS = ['Name', 'Email'] as const;
    type AllowedField = typeof ALLOWED_FIELDS[number];
    const sanitizedBody: Partial<Record<AllowedField, string>> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in body && typeof body[field] === 'string') {
        sanitizedBody[field] = body[field];
      }
    }
    if (Object.keys(sanitizedBody).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updatedUser = await updateUser(id, sanitizedBody, tenantId);

    if (!updatedUser) {
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    return NextResponse.json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("[API] Error updating user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "Admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;
    const success = await deleteUser(id, tenantId);

    if (!success) {
      return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
    }

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("[API] Error deleting user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

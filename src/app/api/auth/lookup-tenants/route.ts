import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/lookup-tenants
 *
 * Accepts { email, password } and returns the list of tenants this user
 * belongs to — but only after the password has been verified.
 *
 * This lookup intentionally bypasses withTenant / RLS context because at
 * login time we don't yet know which tenant the user belongs to.
 * No tenant-scoped data is read — only the user's own rows plus tenant names.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-Mail und Passwort sind erforderlich." },
        { status: 400 }
      );
    }

    // Find all user rows for this email across all tenants (no RLS context needed)
    const rows = await db
      .select({
        userId:     users.id,
        password:   users.password,
        isActive:   users.isActive,
        tenantId:   tenants.id,
        tenantName: tenants.name,
      })
      .from(users)
      .innerJoin(tenants, eq(tenants.id, users.tenantId))
      .where(eq(users.email, email.trim().toLowerCase()));

    if (rows.length === 0) {
      // Don't reveal whether the email exists
      return NextResponse.json({ error: "Ungültige E-Mail oder Passwort." }, { status: 401 });
    }

    // Verify password individually per tenant row.
    // A tenant is only included if its own user record has a matching password hash.
    // This prevents a user from accessing Tenant B just because Tenant A's password matched.
    const verifiedTenants: { tenantId: string; tenantName: string }[] = [];
    for (const row of rows) {
      if (row.isActive === false) continue;
      if (!row.password) continue;
      const isValid = await bcrypt.compare(password, row.password);
      if (isValid) {
        verifiedTenants.push({ tenantId: row.tenantId, tenantName: row.tenantName });
      }
    }

    if (verifiedTenants.length === 0) {
      return NextResponse.json({ error: "Ungültige E-Mail oder Passwort." }, { status: 401 });
    }

    const activeTenants = verifiedTenants;

    return NextResponse.json({ tenants: activeTenants });
  } catch (error) {
    console.error("[Auth] lookup-tenants error:", error);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}

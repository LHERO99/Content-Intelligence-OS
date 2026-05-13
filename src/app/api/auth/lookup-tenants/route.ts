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

    // Verify password against the first row (all rows for the same email share the same hash
    // because the password is set per-user, but we verify once and apply to all matches)
    const firstWithPassword = rows.find((r) => r.password);
    if (!firstWithPassword?.password) {
      return NextResponse.json({ error: "Ungültige E-Mail oder Passwort." }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, firstWithPassword.password);
    if (!isValid) {
      return NextResponse.json({ error: "Ungültige E-Mail oder Passwort." }, { status: 401 });
    }

    // Filter out inactive accounts
    const activeTenants = rows
      .filter((r) => r.isActive !== false)
      .map((r) => ({ tenantId: r.tenantId, tenantName: r.tenantName }));

    if (activeTenants.length === 0) {
      return NextResponse.json(
        { error: "Dein Account ist deaktiviert. Bitte wende dich an deinen Administrator." },
        { status: 403 }
      );
    }

    return NextResponse.json({ tenants: activeTenants });
  } catch (error) {
    console.error("[Auth] lookup-tenants error:", error);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}

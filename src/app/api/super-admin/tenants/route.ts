import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import {
  tenants,
  users,
  tenantSubscriptions,
} from "@/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const rows = await db
      .select({
        id:           tenants.id,
        name:         tenants.name,
        createdAt:    tenants.createdAt,
        userCount:    count(users.id),
        tierId:       tenantSubscriptions.tierId,
        billingCycle: tenantSubscriptions.billingCycle,
        subStatus:    tenantSubscriptions.status,
        startDate:    tenantSubscriptions.startDate,
      })
      .from(tenants)
      .leftJoin(users, eq(users.tenantId, tenants.id))
      .leftJoin(tenantSubscriptions, eq(tenantSubscriptions.tenantId, tenants.id))
      .groupBy(
        tenants.id,
        tenants.name,
        tenants.createdAt,
        tenantSubscriptions.tierId,
        tenantSubscriptions.billingCycle,
        tenantSubscriptions.status,
        tenantSubscriptions.startDate,
      );

    // Fetch tier info separately to avoid complex join
    const { pricingTiers } = await import("@/lib/db/schema");
    const tiers = await db.select().from(pricingTiers);
    const tierMap: Record<string, { name: string; monthlyPrice: string; yearlyPrice: string }> = {};
    for (const t of tiers) {
      tierMap[t.id] = { name: t.name, monthlyPrice: t.monthlyPrice, yearlyPrice: t.yearlyPrice };
    }

    const result = rows.map((r) => ({
      ...r,
      tierName:     r.tierId ? (tierMap[r.tierId]?.name ?? null)         : null,
      monthlyPrice: r.tierId ? (tierMap[r.tierId]?.monthlyPrice ?? null)  : null,
      yearlyPrice:  r.tierId ? (tierMap[r.tierId]?.yearlyPrice ?? null)   : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[SuperAdmin] Error fetching tenants:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const {
      tenantName,
      adminName,
      adminEmail,
      adminPassword,
      tierId,
      billingCycle,
    } = body;

    if (!tenantName || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: "tenantName, adminEmail und adminPassword sind erforderlich." },
        { status: 400 }
      );
    }

    if (adminPassword.length < 8) {
      return NextResponse.json(
        { error: "Das Passwort muss mindestens 8 Zeichen lang sein." },
        { status: 400 }
      );
    }

    const tenantId      = randomUUID();
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Atomic transaction: create tenant + admin user (+ optional subscription)
    await db.transaction(async (tx) => {
      // 1. Insert tenant
      await tx.insert(tenants).values({
        id:        tenantId,
        name:      tenantName.trim(),
        createdAt: new Date(),
      });

      // 2. Insert admin user — passwordChanged = false forces password change on first login
      await tx.insert(users).values({
        id:              randomUUID(),
        tenantId,
        name:            adminName?.trim() || adminEmail.split("@")[0],
        email:           adminEmail.trim().toLowerCase(),
        role:            "Admin",
        password:        hashedPassword,
        passwordChanged: false,
      });

      // 3. Optional: create subscription
      if (tierId) {
        await tx.insert(tenantSubscriptions).values({
          tenantId,
          tierId,
          billingCycle: billingCycle ?? "monthly",
          status:       "active",
          updatedAt:    new Date(),
        });
      }
    });

    return NextResponse.json({ success: true, tenantId }, { status: 201 });
  } catch (error: any) {
    // Unique constraint violation on email
    if (error?.message?.includes("duplicate key") || error?.code === "23505") {
      return NextResponse.json(
        { error: "Ein Nutzer mit dieser E-Mail-Adresse existiert bereits." },
        { status: 409 }
      );
    }
    console.error("[SuperAdmin] Error creating tenant:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

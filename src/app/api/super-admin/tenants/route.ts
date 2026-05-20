import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import {
  tenants,
  users,
  tenantSubscriptions,
  costConfig,
  config as configTable,
  urlKeywords,
} from "@/lib/db/schema";
import { eq, count, sql, and } from "drizzle-orm";
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

    // Setup status per tenant — cost configs, keyword count, integration keys
    const tenantIds = rows.map((r) => r.id);

    const [costCounts, keywordCounts, integrationConfigs] = await Promise.all([
      tenantIds.length
        ? db.select({ tenantId: costConfig.tenantId, count: count() })
            .from(costConfig)
            .groupBy(costConfig.tenantId)
        : Promise.resolve([]),
      tenantIds.length
        ? db.select({ tenantId: urlKeywords.tenantId, count: count() })
            .from(urlKeywords)
            .groupBy(urlKeywords.tenantId)
        : Promise.resolve([]),
      tenantIds.length
        ? db.select({ tenantId: configTable.tenantId, key: configTable.key, value: configTable.value })
            .from(configTable)
            .where(sql`${configTable.key} IN ('GSC_REFRESH_TOKEN','SISTRIX_API_KEY','DATAFORSEO_USERNAME')`)
        : Promise.resolve([]),
    ]);

    const costCountMap: Record<string, number> = {};
    for (const c of costCounts) costCountMap[c.tenantId] = c.count;

    const keywordCountMap: Record<string, number> = {};
    for (const k of keywordCounts) keywordCountMap[k.tenantId] = k.count;

    const integrationMap: Record<string, { gsc: boolean; sistrix: boolean; dataforseo: boolean }> = {};
    for (const cfg of integrationConfigs) {
      if (!integrationMap[cfg.tenantId]) {
        integrationMap[cfg.tenantId] = { gsc: false, sistrix: false, dataforseo: false };
      }
      if (cfg.key === 'GSC_REFRESH_TOKEN' && cfg.value?.trim()) integrationMap[cfg.tenantId].gsc = true;
      if (cfg.key === 'SISTRIX_API_KEY' && cfg.value?.trim()) integrationMap[cfg.tenantId].sistrix = true;
      if (cfg.key === 'DATAFORSEO_USERNAME' && cfg.value?.trim()) integrationMap[cfg.tenantId].dataforseo = true;
    }

    const result = rows.map((r) => {
      const integ = integrationMap[r.id] ?? { gsc: false, sistrix: false, dataforseo: false };
      const kwCount = keywordCountMap[r.id] ?? 0;
      const ccCount = costCountMap[r.id] ?? 0;
      const integOk = integ.gsc || integ.sistrix || integ.dataforseo;
      const setupComplete = ccCount > 0 && kwCount > 0 && integOk;
      const setupScore = (ccCount > 0 ? 1 : 0) + (kwCount > 0 ? 1 : 0) + (integOk ? 1 : 0);

      return {
        ...r,
        tierName:       r.tierId ? (tierMap[r.tierId]?.name ?? null)        : null,
        monthlyPrice:   r.tierId ? (tierMap[r.tierId]?.monthlyPrice ?? null) : null,
        yearlyPrice:    r.tierId ? (tierMap[r.tierId]?.yearlyPrice ?? null)  : null,
        setup: {
          costConfigCount: ccCount,
          keywordCount:    kwCount,
          integrations:    integ,
          complete:        setupComplete,
          score:           setupScore, // 0–3
        },
      };
    });

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

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { pricingTiers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const tiers = await db.select().from(pricingTiers).orderBy(pricingTiers.monthlyPrice);
    return NextResponse.json(tiers);
  } catch (error) {
    console.error("[SuperAdmin] Error fetching pricing tiers:", error);
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
    const { name, monthlyPrice, yearlyPrice, features } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [tier] = await db
      .insert(pricingTiers)
      .values({
        id:           randomUUID(),
        name,
        monthlyPrice: String(monthlyPrice ?? 0),
        yearlyPrice:  String(yearlyPrice ?? 0),
        features:     features ?? [],
        updatedAt:    new Date(),
      })
      .returning();

    return NextResponse.json(tier, { status: 201 });
  } catch (error) {
    console.error("[SuperAdmin] Error creating pricing tier:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

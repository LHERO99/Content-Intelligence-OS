import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { pricingTiers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
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
    const { name, monthlyPrice, yearlyPrice, features } = body;

    const [updated] = await db
      .update(pricingTiers)
      .set({
        name,
        monthlyPrice: monthlyPrice !== undefined ? String(monthlyPrice) : undefined,
        yearlyPrice:  yearlyPrice !== undefined ? String(yearlyPrice) : undefined,
        features:     features ?? undefined,
        updatedAt:    new Date(),
      })
      .where(eq(pricingTiers.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[SuperAdmin] Error updating pricing tier:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SuperAdmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await db.delete(pricingTiers).where(eq(pricingTiers.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SuperAdmin] Error deleting pricing tier:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

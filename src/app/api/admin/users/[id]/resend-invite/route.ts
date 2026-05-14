import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateUser } from "@/lib/postgres";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email/send-email";
import { renderInvitationEmail } from "@/lib/email/templates/invitation";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "Admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    // Load user – must belong to same tenant
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate new temporary password
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Persist new password + reset passwordChanged flag
    await updateUser(id, { Password: hashedPassword, Password_Changed: false }, tenantId);

    const baseUrl = process.env.NEXTAUTH_URL ?? "https://content-intelligence-os-sigma.vercel.app";
    const inviteLink = `${baseUrl}/auth/signin?email=${encodeURIComponent(user.email)}&temp=${tempPassword}`;

    // Send invitation email
    let emailSent = false;
    try {
      const tenantName = (session.user as any)?.tenantName ?? "Plexaro";
      const invitedByName = session.user?.name ?? undefined;
      const { subject, html, text } = renderInvitationEmail({
        recipientName: user.name ?? user.email,
        recipientEmail: user.email,
        tenantName,
        tempPassword,
        loginUrl: inviteLink,
        invitedByName,
      });
      const result = await sendEmail({ to: user.email, subject, html, text }, tenantId);
      emailSent = result.success;
      if (!result.success) {
        console.warn("[API] Resend invite email failed:", result.error);
      }
    } catch (emailErr) {
      console.error("[API] Unexpected error sending resend invite:", emailErr);
    }

    return NextResponse.json({ inviteLink, tempPassword, emailSent });
  } catch (error) {
    console.error("[API] Error resending invite:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

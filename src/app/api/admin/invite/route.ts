import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createUser, getUserByEmail } from "@/lib/postgres";
import { sendEmail } from "@/lib/email/send-email";
import { renderInvitationEmail } from "@/lib/email/templates/invitation";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "Admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, name, role } = await request.json();

    if (!email || !name || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const tenantId = (session.user as any)?.tenantId;

    // Check if user already exists
    const existingUser = await getUserByEmail(email, tenantId);
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    // Generate a temporary password
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const newUser = await createUser({
      Email: email,
      Name: name,
      Role: role,
      Password: hashedPassword,
    }, tenantId);

    if (!newUser) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? "https://content-intelligence-os-sigma.vercel.app";
    const inviteLink = `${baseUrl}/auth/signin?email=${encodeURIComponent(email)}&temp=${tempPassword}`;

    // Einladungsmail versenden – Fehler blockieren nicht die User-Anlage
    let emailSent = false;
    try {
      const tenantName = (session.user as any)?.tenantName ?? "Plexaro";
      const invitedByName = session.user?.name ?? undefined;
      const { subject, html, text } = renderInvitationEmail({
        recipientName: name,
        recipientEmail: email,
        tenantName,
        tempPassword,
        loginUrl: inviteLink,
        invitedByName,
      });
      const result = await sendEmail({ to: email, subject, html, text }, tenantId);
      emailSent = result.success;
      if (!result.success) {
        console.warn("[API] Einladungsmail konnte nicht gesendet werden:", result.error);
      }
    } catch (emailErr) {
      console.error("[API] Unerwarteter Fehler beim E-Mail-Versand:", emailErr);
    }

    return NextResponse.json({ 
      message: "User invited successfully", 
      inviteLink,
      tempPassword,
      emailSent,
    });
  } catch (error) {
    console.error("[API] Error inviting user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

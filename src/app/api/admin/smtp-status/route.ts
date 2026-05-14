/**
 * GET /api/admin/smtp-status
 *
 * Leichtgewichtiger Check ob SMTP konfiguriert ist.
 * Wird von der Invite-UI genutzt um den E-Mail-Button zu aktivieren/deaktivieren.
 * Testet keine Live-Verbindung – prüft nur ob die Pflicht-Env-Variablen gesetzt sind.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isSmtpConfigured } from "@/lib/email/smtp-client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ configured: isSmtpConfigured() });
}

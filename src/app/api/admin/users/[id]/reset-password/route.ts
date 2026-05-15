import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db/index';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/send-email';
import { renderPasswordResetEmail } from '@/lib/email/templates/password-reset';
import crypto from 'crypto';

const TOKEN_TTL_MINUTES = 60;

// Rollenreihenfolge – Admin darf nur Rollen unterhalb seiner eigenen zurücksetzen
const ROLE_RANK: Record<string, number> = {
  SuperAdmin: 4,
  Admin: 3,
  Editor: 2,
  Viewer: 1,
};

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = session.user.role as string;
    // Nur Admin und SuperAdmin dürfen diese Route nutzen
    if (!['Admin', 'SuperAdmin'].includes(callerRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    // Ziel-User laden – muss zum selben Tenant gehören
    const [targetUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Caller darf nur Rollen zurücksetzen, die unter seiner eigenen liegen
    const callerRank = ROLE_RANK[callerRole] ?? 0;
    const targetRank = ROLE_RANK[targetUser.role] ?? 0;

    if (targetRank >= callerRank) {
      return NextResponse.json(
        { error: 'Du kannst nur Benutzer mit niedrigerer Rolle zurücksetzen.' },
        { status: 403 }
      );
    }

    // SuperAdmins können nie zurückgesetzt werden (Sicherheits-Hardstop)
    if (targetUser.role === 'SuperAdmin') {
      return NextResponse.json({ error: 'SuperAdmin-Accounts können nicht zurückgesetzt werden.' }, { status: 403 });
    }

    // Token generieren
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    await db.insert(passwordResetTokens).values({
      token,
      userId: targetUser.id,
      tenantId,
      expiresAt,
      used: false,
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.APP_BASE_URL ?? '';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    // E-Mail senden
    let emailSent = false;
    try {
      const { subject, html, text } = renderPasswordResetEmail({
        recipientName: targetUser.name ?? targetUser.email,
        recipientEmail: targetUser.email,
        resetUrl,
        expiresInMinutes: TOKEN_TTL_MINUTES,
        initiatedByAdmin: true,
      });
      const result = await sendEmail({ to: targetUser.email, subject, html, text }, tenantId);
      emailSent = result.success;
      if (!result.success) {
        console.warn('[admin/reset-password] E-Mail konnte nicht gesendet werden:', result.error);
      }
    } catch (emailErr) {
      console.error('[admin/reset-password] Unerwarteter Fehler beim E-Mail-Versand:', emailErr);
    }

    return NextResponse.json({ ok: true, resetUrl, emailSent });
  } catch (error) {
    console.error('[admin/reset-password] Fehler:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

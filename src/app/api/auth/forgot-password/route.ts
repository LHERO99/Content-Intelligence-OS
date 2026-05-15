import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db/index';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/send-email';
import { renderPasswordResetEmail } from '@/lib/email/templates/password-reset';

const TOKEN_TTL_MINUTES = 60;

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'E-Mail fehlt.' }, { status: 400 });
    }

    // Alle aktiven, nicht-SuperAdmin User mit dieser E-Mail finden (über alle Tenants)
    const matchingUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase().trim()), eq(users.isActive, true)));

    // SuperAdmins ausschließen – kein Self-Service Reset
    const eligible = matchingUsers.filter((u) => u.role !== 'SuperAdmin');

    // Security: immer gleiche Antwort, unabhängig ob User existiert
    if (eligible.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.APP_BASE_URL ?? '';

    // Für jeden Tenant einen eigenen Token ausstellen
    for (const user of eligible) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

      await db.insert(passwordResetTokens).values({
        token,
        userId: user.id,
        tenantId: user.tenantId,
        expiresAt,
        used: false,
      });

      const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

      try {
        const { subject, html, text } = renderPasswordResetEmail({
          recipientName: user.name ?? user.email,
          recipientEmail: user.email,
          resetUrl,
          expiresInMinutes: TOKEN_TTL_MINUTES,
          initiatedByAdmin: false,
        });
        await sendEmail({ to: user.email, subject, html, text }, user.tenantId);
      } catch (emailErr) {
        console.error('[forgot-password] E-Mail konnte nicht gesendet werden:', emailErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[forgot-password] Fehler:', error);
    return NextResponse.json({ error: 'Interner Serverfehler.' }, { status: 500 });
  }
}

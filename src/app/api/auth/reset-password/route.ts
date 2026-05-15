import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db/index';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';

// ─── GET: Token validieren ────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token fehlt.' }, { status: 400 });
    }

    const [record] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date()),
        )
      )
      .limit(1);

    if (!record) {
      return NextResponse.json({ valid: false, error: 'Token ungültig oder abgelaufen.' });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('[reset-password GET] Fehler:', error);
    return NextResponse.json({ valid: false, error: 'Interner Serverfehler.' }, { status: 500 });
  }
}

// ─── POST: Neues Passwort setzen ─────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token und Passwort erforderlich.' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' }, { status: 400 });
    }

    // Token laden und verifizieren
    const [record] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date()),
        )
      )
      .limit(1);

    if (!record) {
      return NextResponse.json({ error: 'Token ungültig oder abgelaufen.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Passwort updaten + password_changed auf true setzen
    await db
      .update(users)
      .set({ password: hashedPassword, passwordChanged: true })
      .where(eq(users.id, record.userId));

    // Token als verwendet markieren
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[reset-password POST] Fehler:', error);
    return NextResponse.json({ error: 'Interner Serverfehler.' }, { status: 500 });
  }
}

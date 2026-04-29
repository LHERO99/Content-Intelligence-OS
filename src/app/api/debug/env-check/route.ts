import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

/**
 * GET /api/debug/env-check
 *
 * TEMPORARY debug endpoint — delete after diagnosis.
 * Returns boolean presence of critical env vars (never the actual values).
 * Requires Admin session.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'Admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    GOOGLE_OAUTH_CLIENT_ID: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
  });
}

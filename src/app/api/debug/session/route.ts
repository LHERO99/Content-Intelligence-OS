import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SuperAdmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    session: {
      user: session.user,
      expires: session.expires,
    },
    hasSession: true,
  });
}

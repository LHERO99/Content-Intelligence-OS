import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getConfig } from '@/lib/postgres';
import { normalizeHexColor } from '@/lib/branding';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    const config = await getConfig(tenantId);
    return NextResponse.json({
      BRAND_PRIMARY_COLOR: normalizeHexColor(config.BRAND_PRIMARY_COLOR),
      BRAND_LOGO_URL: config.BRAND_LOGO_URL || '/docmorris-logo.png',
      BRAND_FAVICON_URL: config.BRAND_FAVICON_URL || '/favicon.ico',
    });
  } catch (error: any) {
    console.error('[API Branding] Error fetching branding config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

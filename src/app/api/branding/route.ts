import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/postgres';
import { normalizeHexColor } from '@/lib/branding';

export async function GET() {
  try {
    const config = await getConfig();
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

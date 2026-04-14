import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getConfig, updateConfig } from '@/lib/airtable';
import { normalizeHexColor } from '@/lib/branding';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error: any) {
    console.error('[API] Error fetching config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Handle bulk weights update
    if (body.weights) {
      const results = [];
      for (const [key, value] of Object.entries(body.weights)) {
        const updated = await updateConfig(key, String(value));
        results.push(updated);
      }
      return NextResponse.json({ success: true, results });
    }

    // Handle single key update (legacy/other)
    const { key, value } = body;
    if (!key) {
      return NextResponse.json({ error: 'Key or weights is required' }, { status: 400 });
    }

    let fileUrl = undefined;
    let textValue = value;

    if (key === 'BRAND_PRIMARY_COLOR') {
      textValue = normalizeHexColor(value);
    }

    if ((key === 'BRAND_LOGO_URL' || key === 'BRAND_FAVICON_URL') && typeof value === 'string' && /^https?:\/\//.test(value)) {
      fileUrl = value;
    }

    const updated = await updateConfig(key, textValue, fileUrl);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('[API] Error updating config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

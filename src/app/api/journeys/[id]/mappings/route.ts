import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { journeys, journeyPageMappings, urls } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// GET /api/journeys/[id]/mappings — All mappings for a journey
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    const mappings = await db
      .select()
      .from(journeyPageMappings)
      .where(and(
        eq(journeyPageMappings.journeyId, id),
        eq(journeyPageMappings.tenantId, tenantId),
      ));

    return NextResponse.json(mappings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/journeys/[id]/mappings — Add URL to journey phase
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    const body = await request.json();
    const { urlId, funnelPhase } = body;

    if (!urlId) return NextResponse.json({ error: 'urlId ist erforderlich' }, { status: 400 });
    const validPhases = ['awareness', 'consideration', 'decision', 'retention'];
    if (!funnelPhase || !validPhases.includes(funnelPhase)) {
      return NextResponse.json({ error: `funnelPhase muss einer sein von: ${validPhases.join(', ')}` }, { status: 400 });
    }

    // Verify journey belongs to tenant
    const [journey] = await db.select({ id: journeys.id })
      .from(journeys)
      .where(and(eq(journeys.id, id), eq(journeys.tenantId, tenantId)));
    if (!journey) return NextResponse.json({ error: 'Journey nicht gefunden' }, { status: 404 });

    // Verify URL belongs to tenant
    const [url] = await db.select({ id: urls.id })
      .from(urls)
      .where(and(eq(urls.id, urlId), eq(urls.tenantId, tenantId)));
    if (!url) return NextResponse.json({ error: 'URL nicht gefunden' }, { status: 404 });

    const [mapping] = await db
      .insert(journeyPageMappings)
      .values({ tenantId, journeyId: id, urlId, funnelPhase })
      .returning();

    return NextResponse.json(mapping, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('journey_page_mappings_journey_url_idx')) {
      return NextResponse.json({ error: 'Diese URL ist bereits in der Journey' }, { status: 409 });
    }
    console.error('[journeys/[id]/mappings] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

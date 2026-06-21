import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { journeyPageMappings, journeys } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; mappingId: string }> };

// DELETE /api/journeys/[id]/mappings/[mappingId] — Remove URL from journey
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id, mappingId } = await params;

    // Verify journey belongs to tenant
    const [journey] = await db.select({ id: journeys.id })
      .from(journeys)
      .where(and(eq(journeys.id, id), eq(journeys.tenantId, tenantId)));
    if (!journey) return NextResponse.json({ error: 'Journey nicht gefunden' }, { status: 404 });

    const [deleted] = await db
      .delete(journeyPageMappings)
      .where(and(
        eq(journeyPageMappings.id, mappingId),
        eq(journeyPageMappings.journeyId, id),
        eq(journeyPageMappings.tenantId, tenantId),
      ))
      .returning({ id: journeyPageMappings.id });

    if (!deleted) return NextResponse.json({ error: 'Mapping nicht gefunden' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[journeys/[id]/mappings/[mappingId]] DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/journeys/[id]/mappings/[mappingId] — Change funnel phase of a mapping
export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id, mappingId } = await params;

    const body = await request.json();
    const { funnelPhase } = body;

    const validPhases = ['awareness', 'consideration', 'decision', 'retention'];
    if (!funnelPhase || !validPhases.includes(funnelPhase)) {
      return NextResponse.json({ error: `funnelPhase muss einer sein von: ${validPhases.join(', ')}` }, { status: 400 });
    }

    // Verify journey belongs to tenant
    const [journey] = await db.select({ id: journeys.id })
      .from(journeys)
      .where(and(eq(journeys.id, id), eq(journeys.tenantId, tenantId)));
    if (!journey) return NextResponse.json({ error: 'Journey nicht gefunden' }, { status: 404 });

    const [updated] = await db
      .update(journeyPageMappings)
      .set({ funnelPhase })
      .where(and(
        eq(journeyPageMappings.id, mappingId),
        eq(journeyPageMappings.journeyId, id),
        eq(journeyPageMappings.tenantId, tenantId),
      ))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Mapping nicht gefunden' }, { status: 404 });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('[journeys/[id]/mappings/[mappingId]] PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

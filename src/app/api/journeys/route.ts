import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { journeys, journeyPageMappings } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/journeys — List all journeys with phase-coverage stats
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;

    const rows = await db
      .select({
        id:                 journeys.id,
        tenantId:           journeys.tenantId,
        name:               journeys.name,
        description:        journeys.description,
        createdAt:          journeys.createdAt,
        updatedAt:          journeys.updatedAt,
        totalMappings:      sql<number>`count(${journeyPageMappings.id})::int`,
        awarenessCount:     sql<number>`count(case when ${journeyPageMappings.funnelPhase} = 'awareness' then 1 end)::int`,
        considerationCount: sql<number>`count(case when ${journeyPageMappings.funnelPhase} = 'consideration' then 1 end)::int`,
        decisionCount:      sql<number>`count(case when ${journeyPageMappings.funnelPhase} = 'decision' then 1 end)::int`,
        retentionCount:     sql<number>`count(case when ${journeyPageMappings.funnelPhase} = 'retention' then 1 end)::int`,
      })
      .from(journeys)
      .leftJoin(journeyPageMappings, eq(journeyPageMappings.journeyId, journeys.id))
      .where(eq(journeys.tenantId, tenantId))
      .groupBy(journeys.id)
      .orderBy(desc(journeys.createdAt));

    const result = rows.map((r) => ({
      id:          r.id,
      tenantId:    r.tenantId,
      name:        r.name,
      description: r.description,
      createdAt:   r.createdAt,
      updatedAt:   r.updatedAt,
      totalMappings: r.totalMappings,
      phaseCoverage: {
        awareness:     r.awarenessCount,
        consideration: r.considerationCount,
        decision:      r.decisionCount,
        retention:     r.retentionCount,
      },
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[journeys] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/journeys — Create a new journey
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;

    const body = await request.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
    }

    const [journey] = await db
      .insert(journeys)
      .values({ tenantId, name: name.trim(), description: description ?? null })
      .returning();

    return NextResponse.json(journey, { status: 201 });
  } catch (error: any) {
    console.error('[journeys] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

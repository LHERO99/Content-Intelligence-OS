import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { journeys, journeyPageMappings, urls, urlKeywords, planningStatus } from '@/lib/db/schema';
import { eq, and, sql, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// GET /api/journeys/[id] — Journey detail with all URL mappings
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    const [journey] = await db
      .select()
      .from(journeys)
      .where(and(eq(journeys.id, id), eq(journeys.tenantId, tenantId)))
      .limit(1);

    if (!journey) return NextResponse.json({ error: 'Journey nicht gefunden' }, { status: 404 });

    const mappings = await db
      .select({
        id:             journeyPageMappings.id,
        tenantId:       journeyPageMappings.tenantId,
        journeyId:      journeyPageMappings.journeyId,
        urlId:          journeyPageMappings.urlId,
        funnelPhase:    journeyPageMappings.funnelPhase,
        createdAt:      journeyPageMappings.createdAt,
        url:            urls.url,
        pageType:       urls.pageType,
        mainKeyword:    urlKeywords.keyword,
        searchVolume:   urlKeywords.searchVolume,
        ranking:        urlKeywords.ranking,
        planningStatus: planningStatus.status,
        clicks30d: sql<number | null>`(
          SELECT SUM(up.gsc_clicks)
          FROM url_performance up
          WHERE up.target_url = ${urls.url}
            AND up.tenant_id = ${tenantId}
            AND up.date >= NOW() - INTERVAL '30 days'
        )`,
      })
      .from(journeyPageMappings)
      .innerJoin(urls, eq(urls.id, journeyPageMappings.urlId))
      .leftJoin(urlKeywords, and(
        eq(urlKeywords.urlId, urls.id),
        eq(urlKeywords.isMainKeyword, true),
      ))
      .leftJoin(planningStatus, and(
        eq(planningStatus.urlId, urls.id),
        eq(planningStatus.tenantId, tenantId),
      ))
      .where(and(
        eq(journeyPageMappings.journeyId, id),
        eq(journeyPageMappings.tenantId, tenantId),
      ))
      .orderBy(asc(journeyPageMappings.funnelPhase), asc(journeyPageMappings.createdAt));

    return NextResponse.json({ journey, mappings });
  } catch (error: any) {
    console.error('[journeys/[id]] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/journeys/[id] — Update journey
export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    const body = await request.json();
    const { name, description } = body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: 'Name darf nicht leer sein' }, { status: 400 });
      updates.name = name.trim();
    }
    if (description !== undefined) updates.description = description ?? null;

    const [updated] = await db
      .update(journeys)
      .set(updates)
      .where(and(eq(journeys.id, id), eq(journeys.tenantId, tenantId)))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Journey nicht gefunden' }, { status: 404 });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('[journeys/[id]] PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/journeys/[id] — Delete journey (cascades to mappings)
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    const [deleted] = await db
      .delete(journeys)
      .where(and(eq(journeys.id, id), eq(journeys.tenantId, tenantId)))
      .returning({ id: journeys.id });

    if (!deleted) return NextResponse.json({ error: 'Journey nicht gefunden' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[journeys/[id]] DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/super-admin/tenants/[id]/sync
 *
 * Manueller Sync-Trigger für einen spezifischen Tenant (SuperAdmin only).
 * Body: { source: 'gsc' | 'dataforseo' | 'sistrix' | 'all' }
 *
 * Rate-Limit: 5 Minuten pro Tenant+Source (via audit_logs Cooldown-Check).
 * Schreibt Audit-Log mit userId.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { tenants, auditLogs } from '@/lib/db/schema';
import { eq, desc, gte, and } from 'drizzle-orm';
import { syncGscChunk, syncDataForSeoChunk } from '@/lib/sync-performance';
import { createAuditLog } from '@/lib/postgres';

const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

type SyncSource = 'gsc' | 'dataforseo' | 'sistrix' | 'all';

async function isRateLimited(tenantId: string, source: SyncSource): Promise<boolean> {
  const cutoff = new Date(Date.now() - RATE_LIMIT_MS);
  const action = `superadmin:manual-sync:${source}`;

  const [recent] = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, tenantId),
        eq(auditLogs.action, action),
        gte(auditLogs.timestamp, cutoff)
      )
    )
    .limit(1);

  return !!recent;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'SuperAdmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: tenantId } = await params;

    // Verify tenant exists
    const [tenant] = await db
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const source: SyncSource = body.source ?? 'all';

    if (!['gsc', 'dataforseo', 'sistrix', 'all'].includes(source)) {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
    }

    // Rate limit check
    const limited = await isRateLimited(tenantId, source);
    if (limited) {
      return NextResponse.json(
        { error: `Rate-Limit: Bitte 5 Minuten warten bevor du erneut synchronisierst.` },
        { status: 429 }
      );
    }

    const userId = session.user.id ?? session.user.email ?? 'unknown';
    const results: Record<string, any> = {};
    const errors: string[] = [];

    // GSC sync
    if (source === 'gsc' || source === 'all') {
      try {
        const result = await syncGscChunk(tenantId);
        results.gsc = {
          urlsProcessed: result.urlsProcessed,
          gscRowsUpserted: result.gscRowsUpserted,
          errors: result.errors,
        };
        if (result.errors.length > 0) errors.push(...result.errors);
      } catch (err: any) {
        results.gsc = { error: err.message };
        errors.push(`GSC: ${err.message}`);
      }
    }

    // DataForSEO sync
    if (source === 'dataforseo' || source === 'all') {
      try {
        const result = await syncDataForSeoChunk(tenantId);
        results.dataforseo = {
          keywordsProcessed: result.keywordsProcessed,
          rankingRowsUpserted: result.rankingRowsUpserted,
          errors: result.errors,
        };
        if (result.errors.length > 0) errors.push(...result.errors);
      } catch (err: any) {
        results.dataforseo = { error: err.message };
        errors.push(`DataForSEO: ${err.message}`);
      }
    }

    // Note: Sistrix is handled within GSC chunk (skippedSistrix flag)
    // For explicit sistrix source, we run the GSC chunk which includes Sistrix
    if (source === 'sistrix') {
      try {
        const result = await syncGscChunk(tenantId);
        results.sistrix = {
          sistrixRowsUpserted: result.sistrixRowsUpserted ?? 0,
          skipped: result.skippedSistrix ?? false,
          errors: result.errors.filter(e => e.toLowerCase().includes('sistrix')),
        };
      } catch (err: any) {
        results.sistrix = { error: err.message };
        errors.push(`Sistrix: ${err.message}`);
      }
    }

    // Audit log
    const action = `superadmin:manual-sync:${source}`;
    await createAuditLog(action, { userId, results, errors }, tenantId);

    return NextResponse.json({
      success: errors.length === 0,
      tenantId,
      tenantName: tenant.name,
      source,
      results,
      errors,
      triggeredAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[SuperAdmin] sync trigger error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * API Route: /api/admin/alert-rules
 *
 * GET  – Alle Alert-Regeln des eigenen Tenants abrufen
 * POST – Neue Alert-Regel anlegen
 *
 * Zugriff: Admin-Rolle erforderlich
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAlertRules, createAlertRule } from '@/lib/db/queries/alert-rules';
import type { AlertMetric, AlertOperator } from '@/lib/email/templates/alert';

const VALID_METRICS: AlertMetric[] = ['gsc_clicks_drop', 'keyword_rank_drop'];
const VALID_OPERATORS: AlertOperator[] = ['lt', 'gt', 'pct_drop'];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    const rules = await getAlertRules(tenantId);
    return NextResponse.json(rules);
  } catch (error) {
    console.error('[API] GET /api/admin/alert-rules:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    const body = await request.json();
    const { name, metric, operator, threshold, windowDays, notifyEmails, enabled } = body;

    // Validierung
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'name ist erforderlich' }, { status: 400 });
    }
    if (!VALID_METRICS.includes(metric)) {
      return NextResponse.json(
        { error: `metric muss eines von: ${VALID_METRICS.join(', ')} sein` },
        { status: 400 }
      );
    }
    if (!VALID_OPERATORS.includes(operator)) {
      return NextResponse.json(
        { error: `operator muss eines von: ${VALID_OPERATORS.join(', ')} sein` },
        { status: 400 }
      );
    }
    if (typeof threshold !== 'number' || threshold < 0) {
      return NextResponse.json({ error: 'threshold muss eine positive Zahl sein' }, { status: 400 });
    }
    if (!Array.isArray(notifyEmails) || notifyEmails.length === 0) {
      return NextResponse.json({ error: 'notifyEmails muss mindestens eine Adresse enthalten' }, { status: 400 });
    }

    const rule = await createAlertRule(
      {
        name: name.trim(),
        metric,
        operator,
        threshold,
        windowDays: typeof windowDays === 'number' ? windowDays : 7,
        notifyEmails,
        enabled: enabled !== false,
      },
      tenantId
    );

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/admin/alert-rules:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

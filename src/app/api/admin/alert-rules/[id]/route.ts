import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { updateAlertRule, deleteAlertRule, getAlertRuleById } from '@/lib/db/queries/alert-rules';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    const { id } = await params;
    const existing = await getAlertRuleById(id, tenantId);
    if (!existing) {
      return NextResponse.json({ error: 'Alert-Regel nicht gefunden' }, { status: 404 });
    }

    const body = await request.json();
    const updated = await updateAlertRule(id, body, tenantId);

    if (!updated) {
      return NextResponse.json({ error: 'Aktualisierung fehlgeschlagen' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[API] PATCH /api/admin/alert-rules/[id]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    const { id } = await params;
    const existing = await getAlertRuleById(id, tenantId);
    if (!existing) {
      return NextResponse.json({ error: 'Alert-Regel nicht gefunden' }, { status: 404 });
    }

    await deleteAlertRule(id, tenantId);
    return NextResponse.json({ message: 'Alert-Regel gelöscht' });
  } catch (error) {
    console.error('[API] DELETE /api/admin/alert-rules/[id]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

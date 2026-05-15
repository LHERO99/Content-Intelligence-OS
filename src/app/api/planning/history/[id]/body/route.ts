import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getContentLogBody } from '@/lib/postgres';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const tenantId = session.user?.tenantId;
    const body = await getContentLogBody(numericId, tenantId);

    if (!body) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(body);
  } catch (error: any) {
    console.error('[API] Error fetching content log body:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

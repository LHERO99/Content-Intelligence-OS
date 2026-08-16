import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getKpiByYear } from '@/lib/postgres';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = session.user?.tenantId;

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
  }

  try {
    const kpi = await getKpiByYear(year, tenantId);
    return NextResponse.json(kpi);
  } catch (error: any) {
    console.error('[API Monitoring KPI] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

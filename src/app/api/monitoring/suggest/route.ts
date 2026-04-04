import { NextRequest, NextResponse } from 'next/server';
import { createTrend } from '@/lib/airtable';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { urls, reason } = await request.json();

  if (!urls || !Array.isArray(urls)) {
    return NextResponse.json({ error: 'URLs array required' }, { status: 400 });
  }

  try {
    const results = await Promise.all(
      urls.map(url => createTrend({
        Trend_Topic: `Optimierung: ${url}`,
        Source: 'GSC', // Originating from monitoring
        Gap_Score: 0,
        Status: 'New'
      }))
    );

    return NextResponse.json({ success: true, count: results.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

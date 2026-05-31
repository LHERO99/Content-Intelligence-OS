import { NextRequest, NextResponse } from 'next/server';
import { getKeywordsByUrl } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const tenantId = session.user?.tenantId;
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
    }
    
    const keywords = await getKeywordsByUrl(url, tenantId);
    return NextResponse.json(keywords);
  } catch (error) {
    console.error('Error fetching keywords by URL:', error);
    return NextResponse.json({ error: 'Failed to fetch keywords' }, { status: 500 });
  }
}

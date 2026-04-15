import { NextRequest, NextResponse } from 'next/server';
import { createContentLog, getKeywordMap, updateKeyword } from '@/lib/airtable';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

function normalizeUrl(value: string): string {
  return value.trim().toLowerCase().replace(/\/$/, '');
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { urls } = await request.json();

  if (!urls || !Array.isArray(urls)) {
    return NextResponse.json({ error: 'URLs array required' }, { status: 400 });
  }

  try {
    const keywords = await getKeywordMap();
    const editor = session?.user?.email ? [session.user.email] : undefined;

    const results = await Promise.all(
      urls.map(async (url) => {
        const normalizedUrl = normalizeUrl(String(url || ''));
        const keyword = keywords.find((entry) => entry.Main_Keyword === 'Y' && normalizeUrl(String(entry.Target_URL || '')) === normalizedUrl)
          || keywords.find((entry) => normalizeUrl(String(entry.Target_URL || '')) === normalizedUrl);

        if (!keyword) {
          return { url, logged: false, reason: 'Kein passendes Keyword gefunden' };
        }

        await createContentLog({
          Keyword_ID: [keyword.id],
          Target_URL: keyword.Target_URL,
          Logged_URL: keyword.Target_URL || url,
          Action_Type: 'Optimierung',
          Page_Type: keyword.Page_Type,
          Diff_Summary: "URL wurde dem Tab 'Vorschläge' hinzugefügt (manuell)",
          Editor: editor,
        });

        await updateKeyword(keyword.id, {
          Action_Type: 'Optimierung',
        });

        return { url, logged: true, keywordId: keyword.id };
      })
    );

    return NextResponse.json({
      success: true,
      count: results.filter((item) => item.logged).length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

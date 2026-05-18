import { NextRequest, NextResponse } from 'next/server';
import { createContentLog, getKeywordMap, updateKeyword } from '@/lib/postgres';
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
  const tenantId = session.user?.tenantId;

  const { urls } = await request.json();

  if (!urls || !Array.isArray(urls)) {
    return NextResponse.json({ error: 'URLs array required' }, { status: 400 });
  }

  try {
    const keywords = await getKeywordMap(tenantId);
    const editor = session?.user?.id ? [session.user.id] : undefined;

    const results = await Promise.all(
      urls.map(async (url) => {
        const normalizedUrl = normalizeUrl(String(url || ''));
        const keyword = keywords.find((entry) => entry.Main_Keyword === 'Y' && normalizeUrl(String(entry.Target_URL || '')) === normalizedUrl)
          || keywords.find((entry) => normalizeUrl(String(entry.Target_URL || '')) === normalizedUrl);

        if (!keyword) {
          console.warn(`[suggest] No keyword found for URL: ${normalizedUrl}`);
          return { url, logged: false, reason: 'Kein passendes Keyword gefunden' };
        }

        console.log(`[suggest] Found keyword id=${keyword.id} mainKeyword=${keyword.Main_Keyword} for URL: ${normalizedUrl}`);

        await createContentLog({
          Keyword_ID: [keyword.id],
          Target_URL: keyword.Target_URL || url,
          Action_Type: 'Optimierung',
          Page_Type: keyword.Page_Type,
          Event_Label: "URL wurde dem Tab 'Vorschläge' hinzugefügt (manuell)",
          Editor: editor,
        }, tenantId);

        await updateKeyword(keyword.id, {
          Action_Type: 'Optimierung',
        }, tenantId);

        console.log(`[suggest] updateKeyword done for id=${keyword.id}`);

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

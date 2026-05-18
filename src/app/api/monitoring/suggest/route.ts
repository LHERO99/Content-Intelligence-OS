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
        // Prefer main keyword; fall back to any keyword for the URL
        const keyword =
          keywords.find((entry) => entry.Main_Keyword === 'Y' && normalizeUrl(String(entry.Target_URL || '')) === normalizedUrl) ||
          keywords.find((entry) => normalizeUrl(String(entry.Target_URL || '')) === normalizedUrl);

        if (!keyword) {
          console.warn(`[suggest] No keyword found for URL: ${normalizedUrl}`);
          return { url, logged: false, reason: 'Kein passendes Keyword gefunden' };
        }

        // Set optimizationRequestedAt and plannedActionType via updateKeyword
        await updateKeyword(keyword.id, { Action_Type: 'Optimierung' }, tenantId);

        // Create a content log entry for audit trail and hasOpenManualMonitoringRequest detection
        await createContentLog({
          Keyword_ID: [keyword.id],
          Target_URL: keyword.Target_URL || url,
          Action_Type: 'Optimierung',
          Page_Type: keyword.Page_Type,
          Event_Label: "URL wurde dem Tab 'Vorschläge' hinzugefügt (manuell)",
          Editor: editor,
        }, tenantId);

        return { url, logged: true, keywordId: keyword.id };
      })
    );

    const successCount = results.filter((item) => item.logged).length;
    const failedUrls = results.filter((item) => !item.logged).map((item) => item.url);

    if (successCount === 0) {
      return NextResponse.json(
        { error: 'Kein passendes Keyword für die angegebenen URLs gefunden.', failedUrls },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, count: successCount, results });
  } catch (error: any) {
    console.error('[suggest] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

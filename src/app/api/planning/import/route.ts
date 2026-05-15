import { NextRequest, NextResponse } from 'next/server';
import { bulkCreateKeywords, createContentLog } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { syncPerformanceForUrls } from '@/lib/sync-performance';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user?.tenantId;

    const body = await req.json();
    const { keywords } = body;

    if (!keywords || !Array.isArray(keywords)) {
      return NextResponse.json({ error: 'Invalid keywords data' }, { status: 400 });
    }

    const result = await bulkCreateKeywords(keywords, tenantId);

    if (result.created.length > 0) {
      const loggedUrls = new Set<string>();

      const keywordsByUrl: Record<string, typeof result.created> = {};
      result.created.forEach(kw => {
        if (kw.Target_URL) {
          if (!keywordsByUrl[kw.Target_URL]) keywordsByUrl[kw.Target_URL] = [];
          keywordsByUrl[kw.Target_URL].push(kw);
        }
      });

      try {
        // 1. Database Logging
        await Promise.all(
          result.created.map(async (kw) => {
            if (kw.Target_URL && !loggedUrls.has(kw.Target_URL)) {
              loggedUrls.add(kw.Target_URL);

              await createContentLog({
                Keyword_ID: [kw.id],
                Target_URL: kw.Target_URL,
                Action_Type: kw.Action_Type || 'Erstellung',
                Event_Label: 'URL wurde dem Tool hinzugefügt',
              }, tenantId);

              if (kw.Status === 'Backlog' && kw.Main_Keyword === 'Y') {
                await createContentLog({
                  Keyword_ID: [kw.id],
                  Target_URL: kw.Target_URL,
                  Action_Type: kw.Action_Type || 'Erstellung',
                  Event_Label: "URL wurde dem Tab 'Vorschläge' hinzugefügt",
                }, tenantId);
              }
            }
          })
        );

        // 2. Trigger performance sync in background (fire & forget)
        const uniqueUrls = Object.keys(keywordsByUrl);
        if (uniqueUrls.length > 0) {
          syncPerformanceForUrls(uniqueUrls, tenantId).catch((err) => {
            console.error('[Import] Background performance sync failed:', err);
          });
        }

      } catch (logError) {
        console.error('[API Import] Error in post-creation tasks:', logError);
      }
    }

    return NextResponse.json({
      success: true,
      count: result.created.length,
      skippedCount: result.skipped.length,
      records: result.created,
      skipped: result.skipped,
    });
  } catch (error: any) {
    console.error('[API Import] Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to import keywords',
    }, { status: 500 });
  }
}

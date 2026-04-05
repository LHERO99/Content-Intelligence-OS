import { NextRequest, NextResponse } from 'next/server';
import { bulkCreateKeywords, createContentLog } from '@/lib/airtable';
import { triggerN8nWorkflow } from '@/lib/n8n';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { keywords } = body;

    if (!keywords || !Array.isArray(keywords)) {
      return NextResponse.json({ error: 'Invalid keywords data' }, { status: 400 });
    }

    const result = await bulkCreateKeywords(keywords);

    // Create initial history logs and trigger n8n for successfully created keywords
    if (result.created.length > 0) {
      const loggedUrls = new Set<string>();
      
      // Group created keywords by URL for n8n trigger
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
                Diff_Summary: 'URL wurde dem Tool hinzugefügt',
              });

              if (kw.Status === 'Backlog' && kw.Main_Keyword === 'Y') {
                await createContentLog({
                  Keyword_ID: [kw.id],
                  Target_URL: kw.Target_URL,
                  Action_Type: kw.Action_Type || 'Erstellung',
                  Diff_Summary: "URL wurde dem Tab 'Vorschläge' hinzugefügt",
                });
              }
            }
          })
        );

        // 2. Trigger n8n Import Webhook in background (grouped by URL)
        Object.entries(keywordsByUrl).forEach(([url, kws]) => {
          const mainKw = kws.find(k => k.Main_Keyword === 'Y') || kws[0];
          const secondaryKws = kws.filter(k => k.id !== mainKw.id);

          const n8nData: Record<string, any> = {
            keywordId: mainKw.id,
            MainKeyword: mainKw.Keyword,
            targetUrl: url,
          };

          secondaryKws.forEach((skw, index) => {
            n8nData[`SecondaryKeyword${index + 1}`] = skw.Keyword;
          });

          triggerN8nWorkflow({
            action: 'IMPORT_DATA',
            data: n8nData,
            userId: session.user?.email || 'unknown',
            timestamp: new Date().toISOString()
          }).catch(err => {
            console.error('[Background Trigger Import] Error calling n8n for URL:', url, err);
          });
        });

      } catch (logError) {
        console.error('[API Import] Error in post-creation tasks:', logError);
      }
    }

    return NextResponse.json({
      success: true,
      count: result.created.length,
      skippedCount: result.skipped.length,
      records: result.created,
      skipped: result.skipped
    });
  } catch (error: any) {
    console.error('[API Import] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to import keywords' 
    }, { status: 500 });
  }
}

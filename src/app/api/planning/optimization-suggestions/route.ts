import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createContentLog, getAllContentHistory, updateKeyword } from '@/lib/postgres';
import { evaluateOptimizationSuggestions, getOptimizationRuleSettings } from '@/lib/optimization-rules';

function toDateOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

async function logAutomaticSuggestionEvents(
  suggestions: Array<{ keywordId: string; targetUrl: string; reasons: string[]; reasonCodes: string[] }>,
  tenantId?: string
) {
  const automaticSuggestions = suggestions.filter((item) =>
    item.reasonCodes.some((code) => code !== 'MANUAL_REQUEST')
  );

  if (!automaticSuggestions.length) return;

  const existingLogs = await getAllContentHistory(tenantId);
  const today = new Date().toISOString().split('T')[0];

  for (const suggestion of automaticSuggestions) {
    const automaticReasons = suggestion.reasons.filter((_, index) => suggestion.reasonCodes[index] !== 'MANUAL_REQUEST');
    const summary = `Automatisch als Optimierungsvorschlag hinzugefügt: ${automaticReasons.join(' | ')}`;

    const alreadyLoggedToday = existingLogs.some((log) => {
      const sameKeyword = Array.isArray(log.Keyword_ID) && log.Keyword_ID.includes(suggestion.keywordId);
      const sameUrl = String(log.Target_URL || log.Logged_URL || '') === suggestion.targetUrl;
      const sameSummary = String(log.Event_Label || '') === summary;
      return (sameKeyword || sameUrl) && sameSummary && toDateOnly(String(log.Created_At || '')) === today;
    });

    if (!alreadyLoggedToday) {
      try {
        await createContentLog({
          Keyword_ID: [suggestion.keywordId],
          Target_URL: suggestion.targetUrl,
          Action_Type: 'Optimierung',
          Event_Label: summary,
        }, tenantId);
      } catch (error) {
        console.error('[API Optimization Suggestions] Failed to create auto-suggestion log:', error);
      }
    }

    // Always ensure Action_Type is set to 'Optimierung' on the keyword — idempotent.
    try {
      await updateKeyword(suggestion.keywordId, { Action_Type: 'Optimierung' }, tenantId);
    } catch (error) {
      console.error('[API Optimization Suggestions] Failed to update keyword Action_Type:', error);
    }
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId;

    const [settings, suggestions] = await Promise.all([
      getOptimizationRuleSettings(tenantId),
      evaluateOptimizationSuggestions(tenantId),
    ]);

    await logAutomaticSuggestionEvents(
      suggestions.map((item) => ({
        keywordId: item.keywordId,
        targetUrl: item.targetUrl,
        reasons: item.reasons || [],
        reasonCodes: item.reasonCodes || [],
      })),
      tenantId
    );

    return NextResponse.json({
      settings,
      suggestions,
    });
  } catch (error: any) {
    console.error('[API Optimization Suggestions] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Fehler beim Berechnen der Optimierungsvorschlage' },
      { status: 500 }
    );
  }
}

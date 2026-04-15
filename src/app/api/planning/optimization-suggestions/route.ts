import { NextResponse } from 'next/server';
import { createContentLog, getAllContentHistory } from '@/lib/airtable';
import { evaluateOptimizationSuggestions, getOptimizationRuleSettings } from '@/lib/optimization-rules';

function toDateOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

async function logAutomaticSuggestionEvents(suggestions: Array<{ keywordId: string; targetUrl: string; reasons: string[]; reasonCodes: string[] }>) {
  const automaticSuggestions = suggestions.filter((item) =>
    item.reasonCodes.some((code) => code !== 'MANUAL_REQUEST')
  );

  if (!automaticSuggestions.length) return;

  const existingLogs = await getAllContentHistory();
  const today = new Date().toISOString().split('T')[0];

  for (const suggestion of automaticSuggestions) {
    const automaticReasons = suggestion.reasons.filter((_, index) => suggestion.reasonCodes[index] !== 'MANUAL_REQUEST');
    const summary = `Automatisch als Optimierungsvorschlag hinzugefügt: ${automaticReasons.join(' | ')}`;

    const alreadyLoggedToday = existingLogs.some((log) => {
      const sameKeyword = Array.isArray(log.Keyword_ID) && log.Keyword_ID.includes(suggestion.keywordId);
      const sameUrl = String(log.Target_URL || log.Logged_URL || '') === suggestion.targetUrl;
      const sameSummary = String(log.Diff_Summary || '') === summary;
      return (sameKeyword || sameUrl) && sameSummary && toDateOnly(String(log.Created_At || '')) === today;
    });

    if (alreadyLoggedToday) continue;

    try {
      await createContentLog({
        Keyword_ID: [suggestion.keywordId],
        Target_URL: suggestion.targetUrl,
        Logged_URL: suggestion.targetUrl,
        Action_Type: 'Optimierung',
        Diff_Summary: summary,
      });
    } catch (error) {
      console.error('[API Optimization Suggestions] Failed to create auto-suggestion log:', error);
    }
  }
}

export async function GET() {
  try {
    const [settings, suggestions] = await Promise.all([
      getOptimizationRuleSettings(),
      evaluateOptimizationSuggestions(),
    ]);

    await logAutomaticSuggestionEvents(
      suggestions.map((item) => ({
        keywordId: item.keywordId,
        targetUrl: item.targetUrl,
        reasons: item.reasons || [],
        reasonCodes: item.reasonCodes || [],
      }))
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

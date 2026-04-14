import { NextResponse } from 'next/server';
import { evaluateOptimizationSuggestions, getOptimizationRuleSettings } from '@/lib/optimization-rules';

export async function GET() {
  try {
    const [settings, suggestions] = await Promise.all([
      getOptimizationRuleSettings(),
      evaluateOptimizationSuggestions(),
    ]);

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

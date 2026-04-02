import { KeywordMap } from "./airtable-types";

export interface PrioritizationWeights {
  weight_search_volume: number;
  weight_difficulty: number;
  weight_article_count: number;
  weight_avg_value: number;
  weight_policy: number;
}

/**
 * Calculates a priority score for a keyword based on weighted metrics.
 * All metrics are normalized to a 0-100 scale before applying weights.
 */
export function calculatePriorityScore(
  keyword: KeywordMap,
  weights: PrioritizationWeights
): number {
  // 1. Search Volume (Normalized: 0 to 100,000+)
  const sv = Math.min((keyword.Search_Volume || 0) / 1000, 100);
  
  // 2. Difficulty (Normalized: 0-100, Inverted because lower is better)
  const diff = 100 - (keyword.Difficulty || 0);
  
  // 3. Article Count (Normalized: 0 to 10+)
  const ac = Math.min((keyword.Article_Count || 0) * 10, 100);
  
  // 4. Average Article Value (Normalized: 0 to 1000+)
  const av = Math.min((keyword.Avg_Product_Value || 0) / 10, 100);
  
  // 5. Policy (Already 0-100)
  const p = keyword.Policy || 0;

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  
  if (totalWeight === 0) return 0;

  const score = (
    (sv * weights.weight_search_volume) +
    (diff * weights.weight_difficulty) +
    (ac * weights.weight_article_count) +
    (av * weights.weight_avg_value) +
    (p * weights.weight_policy)
  ) / totalWeight;

  return Math.round(score * 10) / 10; // Round to 1 decimal place
}

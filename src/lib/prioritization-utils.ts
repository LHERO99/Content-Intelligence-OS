import { KeywordMap } from "./airtable-types";

export interface PrioritizationWeights {
  weight_search_volume: number;
  weight_difficulty: number;
  weight_article_count: number;
  weight_avg_value: number;
  weight_policy: number;
  weight_recency: number;
  weight_ranking: number;
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

  // 6. Recency (Aktualität)
  // Logic: Never published = 100 (High priority). 
  // If published: 0 priority for fresh content, climbing to 100 over 12 months.
  let r = 100;
  if (keyword.Last_Published) {
    const lastPublishedDate = new Date(keyword.Last_Published);
    const now = new Date();
    const diffMs = now.getTime() - lastPublishedDate.getTime();
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30); // Approx. months
    
    // Scale: 0 priority if < 1 month, 100 priority if >= 12 months
    r = Math.min(Math.max((diffMonths - 1) * (100 / 11), 0), 100);
    
    // If published less than a month ago, drastically reduce score
    if (diffMonths < 1) r = 0;
  }

  // 7. Ranking (Striking Distance)
  // Logic: 
  // 1-3: 10 (Already ranking)
  // 4-10: 40 (Good, but could be better)
  // 11-30: 100 (Striking distance - High Priority for Optimization)
  // 31-100: 60 (Moderate)
  // > 100 or 0: 30 (Far away or New)
  let rankScore = 30;
  if (keyword.Ranking && keyword.Ranking > 0) {
    if (keyword.Ranking <= 3) rankScore = 10;
    else if (keyword.Ranking <= 10) rankScore = 40;
    else if (keyword.Ranking <= 30) rankScore = 100;
    else if (keyword.Ranking <= 100) rankScore = 60;
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  
  if (totalWeight === 0) return 0;

  const score = (
    (sv * weights.weight_search_volume) +
    (diff * weights.weight_difficulty) +
    (ac * weights.weight_article_count) +
    (av * weights.weight_avg_value) +
    (p * weights.weight_policy) +
    (r * weights.weight_recency) +
    (rankScore * weights.weight_ranking)
  ) / totalWeight;

  return Math.round(score * 10) / 10; // Round to 1 decimal place
}

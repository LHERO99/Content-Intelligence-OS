import { KeywordMap, ContentLog } from "@/lib/airtable-types";

/**
 * Service for handling planning-related API interactions.
 * Centralizes Airtable and API logic to keep UI components clean.
 */
export const PlanningService = {
  /**
   * Fetches all keywords for the planning module.
   */
  async getKeywords(): Promise<KeywordMap[]> {
    const response = await fetch('/api/planning/keywords');
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch keywords");
    }
    return response.json();
  },

  /**
   * Updates a specific keyword.
   */
  async updateKeyword(id: string, updates: Partial<KeywordMap>): Promise<KeywordMap> {
    const response = await fetch(`/api/planning/keywords?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Update failed");
    }

    this.refreshData();
    return response.json();
  },

  /**
   * Deletes one or more keywords.
   * @param ids Array of keyword IDs to delete.
   * @param soft If true, only removes from planning (sets status back to Backlog/removes deadline), but keeps in Keyword-Map.
   */
  async deleteKeywords(ids: string[], soft: boolean = false): Promise<void> {
    const queryParams = new URLSearchParams({
      ids: ids.join(','),
      soft: soft.toString(),
    });

    const response = await fetch(`/api/planning/keywords?${queryParams.toString()}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Delete failed");
    }

    this.refreshData();
  },

  /**
   * Fetches content history for a keyword or URL.
   */
  async getHistory(params: { keywordId?: string; url?: string }): Promise<ContentLog[]> {
    const queryParams = new URLSearchParams();
    if (params.url) queryParams.set('url', params.url);
    if (params.keywordId) queryParams.set('keywordId', params.keywordId);

    const response = await fetch(`/api/planning/history?${queryParams.toString()}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch history");
    }
    return response.json();
  },

  /**
   * Triggers the refresh event for cross-tab UI synchronization.
   */
  refreshData(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent("refresh-planning-data"));
    }
  }
};

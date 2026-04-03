import * as React from "react";
import { ContentLog } from "@/lib/airtable-types";

export const useContentHistory = (keywordId?: string, targetUrl?: string) => {
  const [history, setHistory] = React.useState<ContentLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchHistory = React.useCallback(async () => {
    if (!keywordId && !targetUrl) {
      setHistory([]);
      return;
    }

    setIsLoading(true);
    try {
      const queryParam = targetUrl 
        ? `url=${encodeURIComponent(targetUrl)}` 
        : `keywordId=${keywordId}`;
      const response = await fetch(`/api/planning/history?${queryParam}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setIsLoading(false);
    }
  }, [keywordId, targetUrl]);

  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, isLoading, refreshHistory: fetchHistory };
};

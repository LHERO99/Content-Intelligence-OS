import * as React from "react";
import { Loader2, CheckCircle, Clock } from "lucide-react";
import { ContentLog } from "@/lib/airtable-types";

interface LastActionHistoryProps {
  history: ContentLog[];
  isLoading: boolean;
}

export const LastActionHistory = ({ history, isLoading }: LastActionHistoryProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-3 w-3 animate-spin text-[#00463c]/40" />
        <span className="text-xs text-muted-foreground italic">Historie wird geladen...</span>
      </div>
    );
  }

  // Find the last "Content veröffentlicht" action
  const lastPublishedLog = history.find(log => log.Diff_Summary === "Content veröffentlicht");

  if (!lastPublishedLog) {
    return (
      <div className="flex items-center gap-2 py-2 text-muted-foreground italic">
        <Clock className="h-3 w-3" />
        <span className="text-xs">Noch kein Content veröffentlicht</span>
      </div>
    );
  }

  const date = new Date(lastPublishedLog.Created_At).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });

  const label = lastPublishedLog.Action_Type === 'Optimierung' ? 'Zuletzt optimiert' : 'Zuletzt erstellt';

  return (
    <div className="flex items-center gap-2 py-2 text-[#00463c]">
      <CheckCircle className="h-3.5 w-3.5" />
      <span className="text-xs font-bold uppercase tracking-tight">
        {label} am {date}
      </span>
    </div>
  );
};

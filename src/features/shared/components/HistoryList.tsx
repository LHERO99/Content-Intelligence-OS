import * as React from "react";
import { Loader2 } from "lucide-react";
import { ContentLog } from "@/lib/airtable-types";

interface HistoryListProps {
  history: ContentLog[];
  isLoading: boolean;
}

export const HistoryList = ({ history, isLoading }: HistoryListProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-[#00463c]/40" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed border-border">
        <p className="text-xs text-muted-foreground">Keine Historie vorhanden</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Latest Action Highlight */}
      <div className="p-3 rounded-lg bg-[#00463c]/5 border border-[#00463c]/10">
        <p className="text-xs font-medium text-[#00463c]">
          Zuletzt {history[0].Action_Type === 'Erstellung' ? 'erstellt' : 'optimiert'} am{" "}
          {new Date(history[0].Created_At).toLocaleDateString('de-DE', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </p>
      </div>
      {/* If more history items are added later, they can be rendered here */}
    </div>
  );
};

import * as React from "react";
import { Loader2, PlusCircle, Lightbulb, Calendar, Send, CheckCircle, Zap, RefreshCw, FileText, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { ContentLog } from "@/lib/airtable-types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HistoryListProps {
  history: ContentLog[];
  isLoading: boolean;
}

const HistoryItem = ({ log, isLast, version }: { log: ContentLog; isLast: boolean; version?: string }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const summary = log.Diff_Summary || "";
  const isDelivery = summary === "Content angeliefert";
  const isCommissioned = summary === "Content beauftragt";

  const getIcon = () => {
    const s = summary.toLowerCase();
    if (s.includes("keyword-map")) return <PlusCircle className="h-3 w-3 text-blue-500" />;
    if (s.includes("tool hinzugefügt")) return <PlusCircle className="h-3 w-3 text-blue-500" />;
    if (s.includes("vorschlägen hinzugefügt")) return <Lightbulb className="h-3 w-3 text-amber-500" />;
    if (s.includes("vorschlagsliste")) return <Lightbulb className="h-3 w-3 text-amber-500" />;
    if (s.includes("redaktionsplanung")) return <Calendar className="h-3 w-3 text-indigo-500" />;
    if (s.includes("beauftragt")) return <Send className="h-3 w-3 text-orange-500" />;
    if (s.includes("angeliefert")) return <Zap className="h-3 w-3 text-[#00463c]" />;
    if (s.includes("veröffentlicht")) return <CheckCircle className="h-3 w-3 text-emerald-500" />;
    if (s.includes("blacklist")) return <ShieldAlert className="h-3 w-3 text-red-500" />;
    
    return <FileText className="h-3 w-3 text-[#00463c]" />;
  };

  return (
    <div className="relative pl-8 pb-4 last:pb-0">
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-[#00463c]/10" />
      )}
      
      <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-white border-2 border-[#00463c]/20 flex items-center justify-center z-10 shadow-sm">
        {getIcon()}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-sm font-bold text-[#00463c] truncate">
              {summary}
            </span>
            {version && (
              <Badge variant="outline" className="text-[10px] h-4 bg-[#00463c]/5 border-[#00463c]/10 px-1 font-bold">
                {version}
              </Badge>
            )}
          </div>
          <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
            {new Date(log.Created_At).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>

        {isDelivery && log.Content_Body && (
          <div className="space-y-2">
            <button 
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-[11px] font-bold text-[#00463c] hover:underline"
            >
              {isExpanded ? (
                <>Content einklappen <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Content anzeigen <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
            
            {isExpanded && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto animate-in fade-in slide-in-from-top-1">
                {log.Content_Body}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const HistoryList = ({ history, isLoading }: HistoryListProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-[#00463c]/40" />
      </div>
    );
  }

  // Define the exact "Nahrungskette" events to show
  const nahrungskette = [
    "URL der Keyword-Map hinzugefügt",
    "URL wurde dem Tool hinzugefügt",
    "URL wurde dem Tab 'Vorschläge' hinzugefügt",
    "URL der Vorschlagsliste hinzugefügt",
    "URL der Redaktionsplanung hinzugefügt",
    "Content beauftragt",
    "Content wurde beauftragt",
    "Content angeliefert",
    "Content veröffentlicht",
    "URL der Blacklist hinzugefügt"
  ];

  // Filter history to only include these specific events
  // We use includes and a fallback to empty string to ensure type safety
  const filteredHistory = history.filter(log => {
    const summary = log.Diff_Summary || "";
    return nahrungskette.includes(summary);
  });

  if (filteredHistory.length === 0) {
    return (
      <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed border-border">
        <p className="text-xs text-muted-foreground">Keine Historie vorhanden</p>
      </div>
    );
  }

  // Calculate versions ONLY for "Content angeliefert"
  // We sort by date ascending to assign V1, V2 etc.
  const sortedHistoryForVersioning = [...filteredHistory].sort((a, b) => 
    new Date(a.Created_At).getTime() - new Date(b.Created_At).getTime()
  );
  
  let deliveryCount = 0;
  const versionMap = new Map<string, string>();

  sortedHistoryForVersioning.forEach(log => {
    if (log.Diff_Summary === "Content angeliefert") {
      deliveryCount++;
      versionMap.set(log.id, `V${deliveryCount}`);
    }
  });

  // Display newest first in the UI
  const displayHistory = [...filteredHistory].sort((a, b) => 
    new Date(b.Created_At).getTime() - new Date(a.Created_At).getTime()
  );

  const lastUpdate = displayHistory[0];

  return (
    <div className="space-y-4">
      {/* Latest Action Highlight */}
      <div className="p-3 rounded-lg bg-[#00463c]/5 border border-[#00463c]/10">
        <p className="text-xs font-bold text-[#00463c]">
          {lastUpdate ? (
            <>
              Status: {lastUpdate.Diff_Summary} am{" "}
              {new Date(lastUpdate.Created_At).toLocaleDateString('de-DE', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
              })}
            </>
          ) : (
            <>Historie verfügbar</>
          )}
        </p>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="pt-2">
          {displayHistory.map((log, index) => (
            <HistoryItem 
              key={log.id} 
              log={log} 
              isLast={index === displayHistory.length - 1} 
              version={versionMap.get(log.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

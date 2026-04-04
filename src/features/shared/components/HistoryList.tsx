import * as React from "react";
import { Loader2, PlusCircle, Lightbulb, Calendar, Send, CheckCircle, Zap, RefreshCw, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { ContentLog } from "@/lib/airtable-types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HistoryListProps {
  history: ContentLog[];
  isLoading: boolean;
}

const HistoryItem = ({ log, isLast, version }: { log: ContentLog; isLast: boolean; version?: string }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const isDelivery = log.Diff_Summary?.toLowerCase().includes("angeliefert") || !!log.Content_Body;

  const getIcon = () => {
    const summary = log.Diff_Summary?.toLowerCase() || "";
    if (summary.includes("hinzugefügt")) return <PlusCircle className="h-3 w-3 text-blue-500" />;
    if (summary.includes("vorschläge")) return <Lightbulb className="h-3 w-3 text-amber-500" />;
    if (summary.includes("planung")) return <Calendar className="h-3 w-3 text-indigo-500" />;
    if (summary.includes("beauftragt")) return <Send className="h-3 w-3 text-orange-500" />;
    if (summary.includes("veröffentlicht")) return <CheckCircle className="h-3 w-3 text-emerald-500" />;
    
    if (log.Action_Type === 'Erstellung') return <Zap className="h-3 w-3 text-[#00463c]" />;
    if (log.Action_Type === 'Optimierung') return <RefreshCw className="h-3 w-3 text-[#00463c]" />;
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
              {log.Diff_Summary || (log.Action_Type === 'Erstellung' ? 'Content Erstellung' : log.Action_Type === 'Optimierung' ? 'Content Optimierung' : 'Planung')}
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

  if (history.length === 0) {
    return (
      <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed border-border">
        <p className="text-xs text-muted-foreground">Keine Historie vorhanden</p>
      </div>
    );
  }

  // Calculate versions only for delivery events
  // We sort chronologically to assign versions, then reverse for display
  const sortedHistory = [...history].sort((a, b) => new Date(a.Created_At).getTime() - new Date(b.Created_At).getTime());
  let deliveryCount = 0;
  const versionMap = new Map<string, string>();

  sortedHistory.forEach(log => {
    const isDelivery = log.Diff_Summary?.toLowerCase().includes("angeliefert") || !!log.Content_Body;
    if (isDelivery) {
      deliveryCount++;
      versionMap.set(log.id, `V${deliveryCount}`);
    }
  });

  // Find last delivery or optimization for header
  const lastUpdate = history.find(log => 
    log.Action_Type === 'Erstellung' || log.Action_Type === 'Optimierung'
  );

  return (
    <div className="space-y-4">
      {/* Latest Action Highlight */}
      <div className="p-3 rounded-lg bg-[#00463c]/5 border border-[#00463c]/10">
        <p className="text-xs font-bold text-[#00463c]">
          {lastUpdate ? (
            <>
              Zuletzt {lastUpdate.Action_Type === 'Erstellung' ? 'erstellt' : 'optimiert'} am{" "}
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
          {history.map((log, index) => (
            <HistoryItem 
              key={log.id} 
              log={log} 
              isLast={index === history.length - 1} 
              version={versionMap.get(log.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

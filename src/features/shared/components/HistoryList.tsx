import * as React from "react";
import { Loader2, Clock, Zap, FileText, CheckCircle, PlusCircle, Lightbulb, Calendar, Send, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { ContentLog } from "@/lib/airtable-types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface HistoryListProps {
  history: ContentLog[];
  isLoading: boolean;
}

const HistoryItem = ({ log, index, isLast }: { log: ContentLog; index: number; isLast: boolean }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

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

  const hasContent = !!log.Content_Body;

  return (
    <div className="relative pl-8 pb-6 last:pb-0">
      {/* Timeline Line */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-[#00463c]/10" />
      )}
      
      {/* Timeline Dot */}
      <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-white border-2 border-[#00463c]/20 flex items-center justify-center z-10 shadow-sm">
        {getIcon()}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-[#00463c]">
              {log.Diff_Summary || (log.Action_Type === 'Erstellung' ? 'Content Erstellung' : log.Action_Type === 'Optimierung' ? 'Content Optimierung' : 'Planung')}
            </span>
            {log.Version && (
              <Badge variant="outline" className="text-[10px] h-4 bg-[#00463c]/5 border-[#00463c]/10 px-1">
                {log.Version}
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

        {hasContent && (
          <div className="space-y-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[#00463c] hover:underline"
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

        {log.Reasoning_Chain && !hasContent && (
          <div className="p-2 rounded bg-[#00463c]/5 border border-[#00463c]/10 text-[11px] italic text-[#00463c]/70">
            {log.Reasoning_Chain}
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

  return (
    <div className="space-y-4">
      {/* Latest Action Highlight */}
      <div className="p-3 rounded-lg bg-[#00463c]/5 border border-[#00463c]/10 flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[#00463c]/60">Letztes Ereignis</p>
          <p className="text-xs font-bold text-[#00463c]">
            {history[0].Diff_Summary || (history[0].Action_Type === 'Erstellung' ? 'Content erstellt' : 'In Planung')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">
            {new Date(history[0].Created_At).toLocaleDateString('de-DE')}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground">
            {new Date(history[0].Created_At).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="pt-2">
          {history.map((log, index) => (
            <HistoryItem 
              key={log.id} 
              log={log} 
              index={index} 
              isLast={index === history.length - 1} 
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

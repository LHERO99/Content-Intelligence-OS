import * as React from "react";
import { Loader2, PlusCircle, Lightbulb, Calendar, Send, CheckCircle, Zap, RefreshCw, FileText, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { ContentLog } from "@/lib/postgres-types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/i18n/use-i18n";
import { toLocaleTag } from "@/i18n/locale-utils";

interface HistoryListProps {
  history: ContentLog[];
  isLoading: boolean;
}

const HistoryItem = ({ log, isLast, version }: { log: ContentLog; isLast: boolean; version?: string }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { locale, t } = useI18n();
  const summary = log.Diff_Summary || "";
  const isDelivery = summary === "Content angeliefert";
  const isCommissioned = summary === "Content beauftragt";

  const getIcon = () => {
    const s = summary.toLowerCase();
    if (s.includes("keyword-map")) return <PlusCircle className="h-3 w-3 text-primary" />;
    if (s.includes("tool hinzugefügt")) return <PlusCircle className="h-3 w-3 text-primary" />;
    if (s.includes("vorschlägen hinzugefügt")) return <Lightbulb className="h-3 w-3 text-primary" />;
    if (s.includes("vorschlagsliste")) return <Lightbulb className="h-3 w-3 text-primary" />;
    if (s.includes("redaktionsplanung")) return <Calendar className="h-3 w-3 text-primary" />;
    if (s.includes("beauftragt")) return <Send className="h-3 w-3 text-primary" />;
    if (s.includes("angeliefert")) return <Zap className="h-3 w-3 text-primary" />;
    if (s.includes("veröffentlicht")) return <CheckCircle className="h-3 w-3 text-primary" />;
    if (s.includes("blacklist")) return <ShieldAlert className="h-3 w-3 text-primary" />;
    
    return <FileText className="h-3 w-3 text-primary" />;
  };

  return (
    <div className="relative pl-8 pb-4 last:pb-0">
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-primary/10" />
      )}
      
      <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-white border-2 border-primary/20 flex items-center justify-center z-10 shadow-sm">
        {getIcon()}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-sm font-bold text-primary truncate">
              {summary}
            </span>
            {version && (
              <Badge variant="outline" className="text-[10px] h-4 bg-primary/5 border-primary/10 px-1 font-bold">
                {version}
              </Badge>
            )}
          </div>
          <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
            {new Date(log.Created_At).toLocaleString(toLocaleTag(locale), {
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
              className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
            >
              {isExpanded ? (
                <>{t('historyList.hideContent')} <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>{t('historyList.showContent')} <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
            
            {isExpanded && (
              <div 
                className="p-3 rounded-lg bg-muted/30 border border-border text-xs leading-relaxed max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-1 html-content"
                dangerouslySetInnerHTML={{ __html: log.Content_Body }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const HistoryList = ({ history, isLoading }: HistoryListProps) => {
  const { locale, t } = useI18n();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
      </div>
    );
  }

  // Display all history events directly. No filtering by nahrungskette here.
  // We sort by date descending to display newest first in the UI
  const displayHistory = [...history].sort((a, b) => 
    new Date(b.Created_At).getTime() - new Date(a.Created_At).getTime()
  );

  if (displayHistory.length === 0) {
    return (
        <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed border-border">
        <p className="text-xs text-muted-foreground">{t('historyList.noHistory')}</p>
        </div>
      );
  }

  // Calculate versions ONLY for "Content angeliefert"
  // We sort by date ascending to assign V1, V2 etc.
  const sortedHistoryForVersioning = [...displayHistory].sort((a, b) => 
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

  const lastUpdate = displayHistory[0];

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: `
        .html-content h1 { font-size: 1.25rem; font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: var(--primary); }
        .html-content h2 { font-size: 1.1rem; font-weight: bold; margin-top: 0.8rem; margin-bottom: 0.4rem; color: var(--primary); }
        .html-content h3 { font-size: 1rem; font-weight: bold; margin-top: 0.6rem; margin-bottom: 0.3rem; }
        .html-content p { margin-bottom: 0.75rem; }
        .html-content a { color: var(--primary); text-decoration: underline; font-weight: 500; }
        .html-content ul { list-style-type: disc; padding-left: 1.25rem; margin-bottom: 0.75rem; }
        .html-content ol { list-style-type: decimal; padding-left: 1.25rem; margin-bottom: 0.75rem; }
        .html-content li { margin-bottom: 0.25rem; }
        .html-content img { max-width: 100%; height: auto; border-radius: 0.375rem; }
        .html-content strong { font-weight: bold; }
        .html-content em { font-style: italic; }
      `}} />
      {/* Latest Action Highlight */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
        <p className="text-xs font-bold text-primary">
          {lastUpdate ? (
            <>
              {t('historyList.status')}: {lastUpdate.Diff_Summary} {locale === 'de' ? 'am' : 'on'}{" "}
              {new Date(lastUpdate.Created_At).toLocaleDateString(toLocaleTag(locale), { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
              })}
            </>
          ) : (
            <>{t('historyList.available')}</>
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

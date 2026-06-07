'use client';

import React, { useState, useEffect } from 'react';
import { RichTextEditor } from './rich-text-editor';
import { AIChatPanel } from './ai-chat-panel';
import { 
  Eye, 
  Edit3, 
  Sparkles, 
  Send, 
  FileText,
  CheckCircle2,
  Map as MapIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { sanitizeHtml } from '@/lib/sanitize';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { KeywordStatus, KeywordMap } from '@/lib/postgres-types';
import { useI18n } from '@/i18n/use-i18n';

import { PlanningService } from "@/features/planning/services/planning-service";
interface AIEditorWorkspaceProps {
  v1Content: string;
  v2Content: string;
  mode?: 'Erstellung' | 'Optimierung' | 'Planung';
  keywordId: string;
  keyword: string;
  targetUrl?: string;
  currentStatus: KeywordStatus;
  /** ID of the "Content wurde beauftragt" log row — anchors saves/publish to this cycle */
  commissionLogId: number;
}

type WorkspaceMode = 'preview' | 'edit' | 'ai-chat';

export function AIEditorWorkspace({ 
  v1Content, 
  v2Content, 
  mode = 'Optimierung',
  keywordId,
  keyword,
  targetUrl,
  currentStatus,
  commissionLogId,
}: AIEditorWorkspaceProps) {
  const [activeMode, setActiveMode] = useState<WorkspaceMode>('preview');
  const [workingContent, setWorkingContent] = useState(v2Content);
  const [isSaving, setIsSaving] = useState(false);
  // previewContent holds the latest AI proposal (not yet saved). null = no active proposal.
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(currentStatus === 'Published');
  const [allKeywords, setAllKeywords] = useState<string[]>([]);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === 'de' ? de : en);

  // Sync isPublished when currentStatus changes via polling (e.g. while page stays open).
  useEffect(() => {
    if (currentStatus === 'Published') setIsPublished(true);
  }, [currentStatus]);

  // Derived: cycle is read-only once it has been published (prop-driven, server-authoritative).
  // This also handles page reloads correctly — no reliance on local isPublished state alone.
  const isReadOnly = currentStatus === 'Published';

  // Sync workingContent when the server delivers new content (polling / refresh).
  // Only blocked during active editing so Tiptap changes aren't lost.
  // activeMode is intentionally NOT a dependency — tab switches must not reset content
  // to stale v2Content (e.g. right after an AI save before polling catches up).
  useEffect(() => {
    if (activeMode !== 'edit') {
      setWorkingContent(v2Content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v2Content]);

  // When a cycle becomes read-only (published), force the user back to preview so
  // they never see a locked editor or AI-chat tab with stale/disabled state.
  useEffect(() => {
    if (isReadOnly) setActiveMode('preview');
  }, [isReadOnly]);

  // Load all keywords for this URL
  useEffect(() => {
    if (!targetUrl) {
      setAllKeywords([keyword]); // fallback to just the main keyword
      return;
    }
    
    setIsLoadingKeywords(true);
    fetch(`/api/planning/keywords/by-url?url=${encodeURIComponent(targetUrl)}`)
      .then(res => res.json())
      .then((keywords: KeywordMap[]) => {
        // Sort: main keyword first, then by keyword name
        const sorted = keywords.sort((a, b) => {
          if (a.Main_Keyword === 'Y' && b.Main_Keyword !== 'Y') return -1;
          if (a.Main_Keyword !== 'Y' && b.Main_Keyword === 'Y') return 1;
          return a.Keyword.localeCompare(b.Keyword);
        });
        setAllKeywords(sorted.map(k => k.Keyword));
      })
      .catch(() => {
        setAllKeywords([keyword]); // fallback on error
      })
      .finally(() => {
        setIsLoadingKeywords(false);
      });
  }, [targetUrl, keyword]);

  const handleSaveContent = async (html: string) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/planning/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywordId,
          commissionLogId,
          actionType: 'Optimierung',
          contentBody: html,
          Event_Label: 'Manuelle Textanpassung im Editor',
          version: 'v2' // We keep it as v2 for the workspace or could increment
        })
      });

      if (!response.ok) throw new Error('Speichern fehlgeschlagen');
      
      setWorkingContent(html);
      toast.success(tr('Änderungen erfolgreich gespeichert', 'Changes saved successfully'));
      
      // Trigger a global refresh to update polling/parent data
      window.dispatchEvent(new CustomEvent('refresh-planning-data'));
    } catch (error) {
      toast.error(tr('Fehler beim Speichern des Contents', 'Error saving content'));
    } finally {
      setIsSaving(false);
    }
  };
  const handleSaveFromAI = async (content: string): Promise<boolean> => {
    if (!content) return false;
    setIsSaving(true);
    try {
      const response = await fetch('/api/planning/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywordId,
          commissionLogId,
          contentBody: content,
          Event_Label: 'KI-Chat: KI-Optimierung übernommen',
          version: 'v2',
        }),
      });

      if (!response.ok) throw new Error('Speichern fehlgeschlagen');

      setWorkingContent(content);
      setPreviewContent(null);
      toast.success(tr('KI-Änderungen erfolgreich gespeichert', 'AI changes saved successfully'));
      window.dispatchEvent(new CustomEvent('refresh-planning-data'));
      return true;
    } catch {
      toast.error(tr('Fehler beim Speichern der KI-Änderungen', 'Error saving AI changes'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsSaving(true);
    try {
      await PlanningService.updateKeyword(keywordId, {
        Status: "Published",
        Last_Published: new Date().toISOString().split('T')[0],
        commissionLogId,
      });

      setIsPublished(true);
      toast.success(tr("Content erfolgreich veröffentlicht", "Content published successfully"));
      
      // Explicitly trigger refresh
      window.dispatchEvent(new CustomEvent('refresh-planning-data'));
    } catch (error) {
      toast.error(tr("Fehler bei der Veröffentlichung", "Error publishing content"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-lg border border-primary/20 shadow-sm shrink-0">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveMode('preview')}
            className={cn(
              "h-8 gap-2 text-xs font-bold px-3",
              activeMode === 'preview' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            {tr('Vorschau', 'Preview')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => !isReadOnly && setActiveMode('edit')}
            disabled={isReadOnly}
            className={cn(
              "h-8 gap-2 text-xs font-bold px-3",
              activeMode === 'edit' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700",
              isReadOnly && "opacity-40 cursor-not-allowed pointer-events-none"
            )}
          >
            <Edit3 className="h-3.5 w-3.5" />
            {tr('Bearbeiten', 'Edit')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => !isReadOnly && setActiveMode('ai-chat')}
            disabled={isReadOnly}
            className={cn(
              "h-8 gap-2 text-xs font-bold px-3",
              activeMode === 'ai-chat' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700",
              isReadOnly && "opacity-40 cursor-not-allowed pointer-events-none"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {tr('KI-Optimierung', 'AI Optimization')}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                onClick={handlePublish}
                disabled={isSaving || isPublished || currentStatus !== 'Angeliefert'}
                className={cn(
                  "gap-2 h-9 px-4 font-bold text-xs uppercase tracking-wider transition-all inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                  isPublished
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : currentStatus === 'Angeliefert'
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                    : "bg-slate-300 text-slate-500 cursor-not-allowed border-slate-200"
                )}
              >
                {isPublished ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {tr('Veröffentlicht', 'Published')}
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    {tr('Als veröffentlicht markieren', 'Mark as published')}
                  </>
                )}
              </TooltipTrigger>
              {isReadOnly ? ( // If read-only, show published message
                <TooltipContent>
                  {tr('Veröffentlichter Content kann nicht mehr bearbeitet werden.', 'Published content cannot be edited anymore.')}
                </TooltipContent>
              ) : currentStatus !== 'Angeliefert' ? ( // If not read-only but status is wrong, show that message
                <TooltipContent>
                  {tr('Status muss "Angeliefert" sein', 'Status must be "Delivered"')} ({tr('Aktuell', 'Current')}: {currentStatus})
                </TooltipContent>
              ) : null}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Content Info Section */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-3 flex flex-col gap-2 shrink-0">
        {/* Target URL Info */}
        {targetUrl && (
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-primary/20 shadow-sm">
            <div className="flex items-center gap-1.5 shrink-0">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-slate-600">
                {tr('Ziel-URL', 'Target URL')}:
              </span>
            </div>
            <span className="text-xs text-slate-700 truncate flex-1">
              {targetUrl}
            </span>
          </div>
        )}

        {/* Keywords Info */}
        <div className="flex items-start gap-2 bg-white px-3 py-2 rounded-md border border-primary/20 shadow-sm">
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <MapIcon className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-slate-600">
              {tr('Keywords', 'Keywords')}:
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 flex-1">
            {isLoadingKeywords ? (
              <span className="text-xs text-slate-400 italic">
                {tr('Lade Keywords...', 'Loading keywords...')}
              </span>
            ) : (
              allKeywords.map((kw, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                    idx === 0 
                      ? "bg-primary/10 text-primary border border-primary/30" // Main keyword
                      : "bg-slate-100 text-slate-700 border border-slate-200" // Secondary keywords
                  )}
                >
                  {kw}
                  {idx === 0 && (
                    <span className="ml-1 text-[10px] opacity-70">
                      ({tr('Haupt', 'Main')})
                    </span>
                  )}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 min-h-0">
        {activeMode === 'preview' && (
          <div className="rounded-md border bg-white overflow-hidden animate-in fade-in duration-300 h-full flex flex-col">
            <style jsx global>{`
              @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
              
              .preview-content {
                all: initial;
                display: block;
                font-family: 'Poppins', sans-serif !important;
                color: #334155;
              }
              /* Grouped selectors for h1, h2, h3 */
              .preview-content h1,
              .preview-content h2,
              .preview-content h3 {
                color: var(--primary) !important;
                font-family: 'Poppins', sans-serif !important;
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
              }
              .preview-content h1 {
                font-size: 2.25rem !important;
                line-height: 1.2 !important;
                font-weight: 800 !important;
                margin-top: 0 !important;
                margin-bottom: 0.5rem !important;
              }
              .preview-content h2 {
                font-size: 1.875rem !important;
                line-height: 1.2 !important;
                font-weight: 700 !important;
                margin-top: 1.25rem !important;
                margin-bottom: 0.5rem !important;
              }
              .preview-content h3 {
                font-size: 1.5rem !important;
                line-height: 1.2 !important;
                font-weight: 600 !important;
                margin-top: 1.25rem !important;
                margin-bottom: 0.5rem !important;
              }
              .preview-content p {
                margin-top: 0.5rem !important;
                margin-bottom: 0.5rem !important;
                line-height: 1.2 !important;
                color: #334155 !important;
                display: block !important;
                font-size: 0.875rem !important;
                font-family: 'Poppins', sans-serif !important;
              }
              .preview-content ul {
                list-style-type: disc !important;
                margin-top: 0.5rem !important;
                margin-bottom: 0.5rem !important;
                padding-left: 1.5rem !important;
                display: block !important;
              }
              .preview-content ol {
                list-style-type: decimal !important;
                margin-top: 0.5rem !important;
                margin-bottom: 0.5rem !important;
                padding-left: 1.5rem !important;
                display: block !important;
              }
              .preview-content li {
                margin-top: 0.25rem !important;
                margin-bottom: 0.25rem !important;
                line-height: 1.2 !important;
                display: list-item !important;
                font-size: 0.875rem !important;
                font-family: 'Poppins', sans-serif !important;
              }
              .preview-content strong {
                font-weight: 700 !important;
              }
              .preview-content em {
                font-style: italic !important;
              }
              .preview-content a {
                color: var(--primary) !important;
                text-decoration: underline !important;
              }
            `}</style>
            {mode === 'Erstellung' ? (
              <>
                <div className="border-b bg-primary/10 p-3 text-sm font-bold text-primary flex items-center gap-2 shrink-0">
                  <FileText className="h-4 w-4" />
                  {tr('Neu erstellter Content', 'Newly created content')}
                </div>
                <div className="p-3 overflow-auto bg-white flex-1 min-h-0">
                  <div 
                    className="preview-content"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(workingContent) }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="border-b bg-primary/10 p-3 text-sm font-bold text-primary flex items-center gap-2 shrink-0">
                  <FileText className="h-4 w-4" />
                  {tr('Vorschau', 'Preview')}
                </div>
                <div className="p-3 overflow-auto bg-white flex-1 min-h-0">
                  <div 
                    className="preview-content"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(workingContent) }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeMode === 'edit' && (
          <div className="animate-in slide-in-from-bottom-2 duration-300 h-full">
            <RichTextEditor 
              content={workingContent} 
              onSave={handleSaveContent} 
              isSaving={isSaving} 
            />
          </div>
        )}

        {/* AI-Chat panel is always mounted to preserve chat state across tab switches */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 h-full ${activeMode === 'ai-chat' ? 'animate-in zoom-in-95 duration-300' : 'hidden'}`}>
            <div className="lg:col-span-2 rounded-md border bg-slate-50/50 flex flex-col overflow-hidden border-dashed h-full">
              <div className="p-3 border-b bg-white/50 flex items-center gap-2 font-bold text-slate-500 text-xs uppercase tracking-widest shrink-0">
                <FileText className="h-3.5 w-3.5" />
                {previewContent
                  ? tr('KI-Vorschlag (Vorschau)', 'AI Proposal (Preview)')
                  : tr('Aktueller Arbeitsstand', 'Current working state')}
                {previewContent && (
                  <span className="ml-auto normal-case tracking-normal font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                    {tr('Nicht gespeichert', 'Unsaved')}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-8 prose max-w-none prose-sm sm:prose-base custom-scrollbar min-h-0">
                <style jsx global>{`
                  .ai-chat-preview h1 {
                    font-size: 2.25rem !important;
                    line-height: 1.2 !important;
                    font-weight: 800 !important;
                    margin-top: 0 !important;
                    margin-bottom: 0.5rem !important;
                    color: var(--primary) !important;
                    display: block !important;
                  }
                  .ai-chat-preview h2 {
                    font-size: 1.875rem !important;
                    line-height: 1.2 !important;
                    font-weight: 700 !important;
                    margin-top: 1.25rem !important;
                    margin-bottom: 0.5rem !important;
                    color: var(--primary) !important;
                    display: block !important;
                  }
                  .ai-chat-preview h3 {
                    font-size: 1.5rem !important;
                    line-height: 1.2 !important;
                    font-weight: 600 !important;
                    margin-top: 1.25rem !important;
                    margin-bottom: 0.5rem !important;
                    color: var(--primary) !important;
                    display: block !important;
                  }
                  .ai-chat-preview p {
                    margin-top: 0.5rem !important;
                    margin-bottom: 0.5rem !important;
                    line-height: 1.2 !important;
                    color: #334155 !important;
                    display: block !important;
                  }
                  .ai-chat-preview ul {
                    list-style-type: disc !important;
                    margin-top: 0.5rem !important;
                    margin-bottom: 0.5rem !important;
                    padding-left: 1.5rem !important;
                    display: block !important;
                  }
                  .ai-chat-preview ol {
                    list-style-type: decimal !important;
                    margin-top: 0.5rem !important;
                    margin-bottom: 0.5rem !important;
                    padding-left: 1.5rem !important;
                    display: block !important;
                  }
                  .ai-chat-preview li {
                    margin-top: 0.25rem !important;
                    margin-bottom: 0.25rem !important;
                    line-height: 1.2 !important;
                    display: list-item !important;
                  }
                `}</style>
                <div 
                  className="ai-chat-preview font-sans"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewContent ?? workingContent) }}
                />
              </div>
            </div>
            <div className="lg:col-span-1 h-full overflow-hidden">
              <AIChatPanel 
                currentContent={workingContent} 
                onPreviewChange={(content) => setPreviewContent(content)}
                onApplyChanges={handleSaveFromAI}
                keywordId={keywordId}
                keyword={keyword}
              />
            </div>
        </div>
      </div>
    </div>
  );
}

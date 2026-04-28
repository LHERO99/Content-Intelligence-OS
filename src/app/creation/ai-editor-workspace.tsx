'use client';

import React, { useState, useEffect } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { RichTextEditor } from './rich-text-editor';
import { AIChatPanel } from './ai-chat-panel';
import { 
  Eye, 
  Edit3, 
  Sparkles, 
  Send, 
  Layout, 
  ArrowLeftRight,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { KeywordStatus } from '@/lib/airtable-types';
import { useI18n } from '@/i18n/use-i18n';

import { PlanningService } from "@/features/planning/services/planning-service";
interface AIEditorWorkspaceProps {
  v1Content: string;
  v2Content: string;
  mode?: 'Erstellung' | 'Optimierung' | 'Planung';
  keywordId: string;
  keyword: string;
  currentStatus: KeywordStatus;
}

type WorkspaceMode = 'preview' | 'edit' | 'ai-chat';

export function AIEditorWorkspace({ 
  v1Content, 
  v2Content, 
  mode = 'Optimierung',
  keywordId,
  keyword,
  currentStatus
}: AIEditorWorkspaceProps) {
  const [activeMode, setActiveMode] = useState<WorkspaceMode>('preview');
  const [workingContent, setWorkingContent] = useState(v2Content);
  const [isSaving, setIsSaving] = useState(false);
  // previewContent holds the latest AI proposal (not yet saved). null = no active proposal.
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === 'de' ? de : en);

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

  const handleSaveContent = async (html: string) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/planning/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywordId,
          actionType: 'Optimierung',
          contentBody: html,
          Diff_Summary: 'Manuelle Textanpassung im Editor',
          version: 'v2' // We keep it as v2 for the workspace or could increment
        })
      });

      if (!response.ok) throw new Error('Speichern fehlgeschlagen');
      
      setWorkingContent(html);
      toast.success(tr('Änderungen erfolgreich gespeichert', 'Changes saved successfully'));
      
      // Trigger a global refresh to update polling/parent data
      window.dispatchEvent(new CustomEvent('refresh-planning-data'));
      
      setActiveMode('preview');
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
          contentBody: content,
          Diff_Summary: 'KI-Chat: KI-Optimierung übernommen',
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
        Last_Published: new Date().toISOString().split('T')[0]
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
            onClick={() => setActiveMode('edit')}
            className={cn(
              "h-8 gap-2 text-xs font-bold px-3",
              activeMode === 'edit' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Edit3 className="h-3.5 w-3.5" />
            {tr('Bearbeiten', 'Edit')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveMode('ai-chat')}
            className={cn(
              "h-8 gap-2 text-xs font-bold px-3",
              activeMode === 'ai-chat' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {tr('KI-Optimierung', 'AI Optimization')}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="inline-block">
                  <Button
                    onClick={handlePublish}
                    disabled={isSaving || isPublished || currentStatus !== 'Angeliefert'}
                    className={cn(
                      "gap-2 h-9 px-4 font-bold text-xs uppercase tracking-wider transition-all",
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
                  </Button>
                </div>
              </TooltipTrigger>
              {currentStatus !== 'Angeliefert' && !isPublished && (
                <TooltipContent>
                  {tr('Status muss "Angeliefert" sein', 'Status must be "Delivered"')} ({tr('Aktuell', 'Current')}: {currentStatus})
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 min-h-0">
        {activeMode === 'preview' && (
          <div className="rounded-md border bg-white overflow-hidden animate-in fade-in duration-300 h-full flex flex-col">
            {mode === 'Erstellung' ? (
              <>
                <div className="border-b bg-primary/10 p-3 text-sm font-bold text-primary flex items-center gap-2 shrink-0">
                  <FileText className="h-4 w-4" />
                  {tr('Neu erstellter Content', 'Newly created content')}
                </div>
                <div className="p-3 overflow-auto bg-white flex-1 min-h-0">
                  <style jsx global>{`
                    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
                    
                    .preview-content {
                      all: initial;
                      display: block;
                      font-family: 'Poppins', sans-serif !important;
                      color: #334155;
                    }
                    .preview-content h1, .preview-content h2, .preview-content h3 {
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
                  <div 
                    className="preview-content"
                    dangerouslySetInnerHTML={{ __html: workingContent }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 border-b bg-muted/50 text-sm font-bold text-slate-600 shrink-0">
                  <div className="p-3 border-r flex items-center gap-2">
                    <Layout className="h-4 w-4" />
                    {tr('v1 (Aktuell)', 'v1 (Current)')}
                  </div>
                  <div className="p-3 flex items-center gap-2 text-primary">
                    <ArrowLeftRight className="h-4 w-4" />
                    {tr('v2 (KI Vorschlag / Edit)', 'v2 (AI Suggestion / Edit)')}
                  </div>
                </div>
                <div className="overflow-auto flex-1 min-h-0">
                  <ReactDiffViewer
                    oldValue={v1Content}
                    newValue={workingContent}
                    splitView={true}
                    useDarkTheme={false}
                    styles={{
                      variables: {
                        light: {
                          diffViewerBackground: '#fff',
                          diffViewerColor: '#212529',
                          addedBackground: '#e6ffed',
                          wordAddedBackground: '#acf2bd',
                          addedGutterBackground: '#cdffd8',
                        },
                      },
                    }}
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
                  dangerouslySetInnerHTML={{ __html: previewContent ?? workingContent }}
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

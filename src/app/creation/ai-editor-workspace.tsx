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
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AIEditorWorkspaceProps {
  v1Content: string;
  v2Content: string;
  mode?: 'Erstellung' | 'Optimierung' | 'Planung';
  keywordId: string;
  keyword: string;
}

type WorkspaceMode = 'preview' | 'edit' | 'ai-chat';

export function AIEditorWorkspace({ 
  v1Content, 
  v2Content, 
  mode = 'Optimierung',
  keywordId,
  keyword
}: AIEditorWorkspaceProps) {
  const [activeMode, setActiveMode] = useState<WorkspaceMode>('preview');
  const [workingContent, setWorkingContent] = useState(v2Content);
  const [isSaving, setIsSaving] = useState(false);

  // Sync working content if v2Content changes (e.g. from polling), but only if not in edit mode
  useEffect(() => {
    if (activeMode !== 'edit') {
      setWorkingContent(v2Content);
    }
  }, [v2Content, activeMode]);

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
      toast.success('Änderungen erfolgreich gespeichert');
      
      // Trigger a global refresh to update polling/parent data
      window.dispatchEvent(new CustomEvent('refresh-planning-data'));
      
      setActiveMode('preview');
    } catch (error) {
      toast.error('Fehler beim Speichern des Contents');
    } finally {
      setIsSaving(false);
    }
  };

  const handleForwardToPharma = () => {
    toast.info('Schnittstelle zu Pharma wird in einer späteren Phase implementiert.', {
      description: 'Der aktuelle Content wurde für den Export vorgemerkt.',
      duration: 5000,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-lg border border-emerald-100 shadow-sm">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveMode('preview')}
            className={cn(
              "h-8 gap-2 text-xs font-bold px-3",
              activeMode === 'preview' ? "bg-white text-[#00463c] shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Vorschau
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveMode('edit')}
            className={cn(
              "h-8 gap-2 text-xs font-bold px-3",
              activeMode === 'edit' ? "bg-white text-[#00463c] shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Bearbeiten
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveMode('ai-chat')}
            className={cn(
              "h-8 gap-2 text-xs font-bold px-3",
              activeMode === 'ai-chat' ? "bg-white text-[#00463c] shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            KI-Optimierung
          </Button>
        </div>

        <Button
          onClick={handleForwardToPharma}
          className="bg-[#00463c] hover:bg-[#00332c] text-white gap-2 h-9 px-4 font-bold text-xs uppercase tracking-wider"
        >
          <Send className="h-3.5 w-3.5" />
          An Pharma senden
        </Button>
      </div>

      {/* Main Workspace Area */}
      <div className="min-h-[500px]">
        {activeMode === 'preview' && (
          <div className="rounded-md border bg-white overflow-hidden animate-in fade-in duration-300">
            {mode === 'Erstellung' ? (
              <>
                <div className="border-b bg-emerald-50/50 p-3 text-sm font-bold text-[#00463c] flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Neu erstellter Content
                </div>
                <div className="p-8 overflow-auto max-h-[600px] bg-white">
                  <style jsx>{`
                    .preview-content h1, .preview-content h2, .preview-content h3 {
                      color: #00463c !important;
                      font-weight: 800 !important;
                      display: block !important;
                      visibility: visible !important;
                      opacity: 1 !important;
                      font-family: sans-serif !important;
                    }
                    .preview-content h1 {
                      font-size: 2.25rem;
                      line-height: 1.2;
                      margin-top: 1.25rem;
                      margin-bottom: 0.5rem;
                    }
                    .preview-content h2 {
                      font-size: 1.875rem;
                      line-height: 1.2;
                      margin-top: 1.25rem;
                      margin-bottom: 0.5rem;
                    }
                    .preview-content h3 {
                      font-size: 1.5rem;
                      line-height: 1.2;
                      margin-top: 1.25rem;
                      margin-bottom: 0.5rem;
                    }
                    .preview-content p {
                      margin-top: 0.5rem;
                      margin-bottom: 0.5rem;
                      line-height: 1.2;
                      color: #334155;
                      display: block;
                    }
                  `}</style>
                  <div 
                    className="preview-content font-sans"
                    dangerouslySetInnerHTML={{ __html: workingContent }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 border-b bg-muted/50 text-sm font-bold text-slate-600">
                  <div className="p-3 border-r flex items-center gap-2">
                    <Layout className="h-4 w-4" />
                    v1 (Aktuell)
                  </div>
                  <div className="p-3 flex items-center gap-2 text-emerald-700">
                    <ArrowLeftRight className="h-4 w-4" />
                    v2 (KI Vorschlag / Edit)
                  </div>
                </div>
                <div className="overflow-auto max-h-[600px]">
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
          <div className="animate-in slide-in-from-bottom-2 duration-300">
            <RichTextEditor 
              content={workingContent} 
              onSave={handleSaveContent} 
              isSaving={isSaving} 
            />
          </div>
        )}

        {activeMode === 'ai-chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[650px] animate-in zoom-in-95 duration-300">
            <div className="lg:col-span-2 rounded-md border bg-slate-50/50 flex flex-col overflow-hidden border-dashed">
              <div className="p-3 border-b bg-white/50 flex items-center gap-2 font-bold text-slate-500 text-xs uppercase tracking-widest shrink-0">
                <FileText className="h-3.5 w-3.5" />
                Aktueller Arbeitsstand
              </div>
              <div className="flex-1 overflow-auto p-8 prose prose-emerald max-w-none prose-sm sm:prose-base custom-scrollbar">
                <div 
                  className="prose prose-sm sm:prose-base lg:prose-lg max-w-none prose-headings:text-[#00463c] prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-slate-600 prose-a:text-emerald-600 prose-emerald"
                  dangerouslySetInnerHTML={{ __html: workingContent }}
                />
              </div>
            </div>
            <div className="lg:col-span-1 h-full">
              <AIChatPanel 
                currentContent={workingContent} 
                onApplyChanges={(newContent) => setWorkingContent(newContent)}
                keywordId={keywordId}
                keyword={keyword}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

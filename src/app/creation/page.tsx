'use client';

import React, { useState, useEffect } from 'react';
import { KeywordMap, ContentLog } from '@/lib/airtable-types';
import { AIEditorWorkspace } from './ai-editor-workspace';
import { cn } from '@/lib/utils';
import { Loader2, Send, Zap, Clock, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/i18n/use-i18n';
import { toLocaleTag } from '@/i18n/locale-utils';

export default function CreationPage() {
  const { locale, t } = useI18n();
  const localeTag = toLocaleTag(locale);
  const tr = (de: string, en: string) => (locale === 'de' ? de : en);
  const [keywords, setKeywords] = useState<KeywordMap[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string>('');
  const [contentLogs, setContentLogs] = useState<ContentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [kwRes, logRes] = await Promise.all([
          fetch('/api/planning/keywords'),
          fetch('/api/planning/history')
        ]);
        
        const kwData = await kwRes.json();
        const logData = await logRes.json();
        
        const keywordsArray = Array.isArray(kwData) ? kwData : (kwData?.sampleRecords || []);
        setKeywords(keywordsArray);
        setContentLogs(Array.isArray(logData) ? logData : []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error(t('creation.loadError'));
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    const interval = setInterval(fetchData, 5000);
    const handleRefresh = () => fetchData();
    window.addEventListener("refresh-planning-data", handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("refresh-planning-data", handleRefresh);
    };
  }, []);

  const selectedKeyword = keywords.find((k) => k.id === selectedKeywordId);
  
  const commissionedKeywords = keywords.filter(kw => {
    // Only show records that have been commissioned (Beauftragt, In Arbeit, Angeliefert, Review, Optimierung)
    // EXCLUDE Planned, Backlog from this view.
    const pipelineStatuses = ['Beauftragt', 'In Arbeit', 'Angeliefert', 'Review', 'Optimierung', 'Published'];
    const hasCorrectStatus = pipelineStatuses.includes(kw.Status);
    
    // Explicitly exclude statuses that shouldn't be in the commissioned list
    // Records that are just 'Planned' stay in the Editorial Plan
    if (['Planned', 'Backlog'].includes(kw.Status)) {
      return false;
    }

    const hasAnyHistory = contentLogs.some(l => 
      Array.isArray(l.Keyword_ID) && 
      l.Keyword_ID.includes(kw.id)
    );
    return hasCorrectStatus || hasAnyHistory;
  });

  const relevantLogs = contentLogs.filter((log) => 
    Array.isArray(log.Keyword_ID) && log.Keyword_ID.includes(selectedKeywordId)
  );
  
  const v1Content = relevantLogs.find((log) => log.Version === 'v1')?.Content_Body || '';
  const v2Log = relevantLogs.find((log) => log.Version === 'v2');
  const v2Content = v2Log?.Content_Body || '';
  
  const statusLabelMap: Record<string, string> = {
    'Beauftragt': tr('Beauftragt', 'Commissioned'),
    'In Arbeit': tr('In Arbeit', 'In progress'),
    'Angeliefert': tr('Angeliefert', 'Delivered'),
    'Review': tr('Review', 'Review'),
    'Optimierung': tr('Optimierung', 'Optimization'),
    'Published': tr('Veröffentlicht', 'Published'),
    'Erstellung': tr('Erstellung', 'Creation'),
  };

  const latestLogWithAction = [...relevantLogs].sort((a, b) => 
    new Date(b.Created_At).getTime() - new Date(a.Created_At).getTime()
  ).find(log => log.Action_Type === 'Erstellung' || log.Action_Type === 'Optimierung');
  
  const creationMode = latestLogWithAction?.Action_Type || 'Erstellung';

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] space-y-6 text-primary">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('creation.title')}</h1>
          <p className="text-muted-foreground">{t('creation.subtitle')}</p>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          {/* Left Side: Aufträge List */}
          <Card className="lg:col-span-4 flex flex-col overflow-hidden border-primary/20 h-full">
            <CardHeader className="bg-primary/10 border-b border-primary/20 py-4 shrink-0">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
                <Zap className="h-5 w-5 fill-primary text-primary" />
                {t('creation.jobs')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <Table>
                  <TableHeader className="bg-primary/5 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-primary font-bold">{tr('Keyword', 'Keyword')}</TableHead>
                      <TableHead className="text-primary font-bold text-right">{tr('Status', 'Status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionedKeywords.length > 0 ? (
                      commissionedKeywords.map((kw) => (
                        <TableRow 
                          key={kw.id} 
                          className={cn(
                            "cursor-pointer transition-all hover:bg-primary/10 relative",
                            selectedKeywordId === kw.id 
                              ? "bg-primary/10 !bg-primary/10 border-l-4 border-l-primary shadow-[inset_4px_0_0_0_var(--primary)]" 
                              : "border-l-4 border-l-transparent"
                          )}
                          onClick={() => setSelectedKeywordId(kw.id)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1 py-1">
                              <span className="text-sm font-bold leading-tight">{kw.Keyword}</span>
                              {kw.Target_URL && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate max-w-[200px]">
                                  <FileText className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{kw.Target_URL.replace(/^https?:\/\/(www\.)?/, '')}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 mt-1">
                                {(() => {
                                  const logs = contentLogs.filter(l => Array.isArray(l.Keyword_ID) && l.Keyword_ID.includes(kw.id));
                                  const latestLog = [...logs].sort((a, b) => new Date(b.Created_At).getTime() - new Date(a.Created_At).getTime())[0];
                                  const type = statusLabelMap[latestLog?.Action_Type || 'Erstellung'] || (latestLog?.Action_Type || 'Erstellung');
                                  return (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 uppercase tracking-wider font-bold border-slate-200 text-slate-500 bg-slate-50/50">
                                      {type}
                                    </Badge>
                                  );
                                })()}
                                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-slate-400" />
                                  {t('creation.commissioned')}: {(() => {
                                    const logs = contentLogs.filter(l => Array.isArray(l.Keyword_ID) && l.Keyword_ID.includes(kw.id));
                                    const firstLog = [...logs].sort((a, b) => new Date(a.Created_At).getTime() - new Date(b.Created_At).getTime())[0];
                                    const timestamp = firstLog?.Created_At;
                                    if (timestamp) {
                                      const date = new Date(timestamp);
                                       return date.toLocaleDateString(localeTag, { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + date.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' });
                                     }
                                    return new Date().toLocaleDateString(localeTag, { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' });
                                  })()}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                "whitespace-nowrap",
                                (kw.Status === 'Beauftragt' || kw.Status === 'In Arbeit')
                                  ? 'bg-amber-100 text-amber-700 border-amber-200' 
                                  : kw.Status === 'Angeliefert'
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : kw.Status === 'Review' 
                                  ? 'bg-purple-100 text-purple-700 border-purple-200'
                                  : kw.Status === 'Optimierung'
                                  ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                  : 'bg-primary/15 text-primary border-primary/25'
                              )}
                            >
                              {(kw.Status === 'Beauftragt' || kw.Status === 'In Arbeit') ? t('creation.inProgress') : kw.Status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic">
                          {t('creation.noActiveJobs')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Right Side: Editor & Preview */}
          <div className="lg:col-span-8 flex flex-col gap-4 overflow-hidden h-full">
            {!selectedKeywordId ? (
              <div className="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-primary/30 rounded-xl bg-white/50">
                <Send className="w-12 h-12 text-primary/40 mb-4" />
                <h2 className="text-xl font-medium text-primary">{t('creation.selectJob')}</h2>
              </div>
            ) : (
              <div className="flex flex-col gap-4 flex-1 min-h-0 h-full">
                <div className="flex items-center justify-between shrink-0">
                  <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {t('creation.preview')}: {selectedKeyword?.Keyword}
                  </h3>
                </div>
                
                <div className="flex-1 min-h-0">
                  {!v2Content ? (
                    <div className="flex flex-col items-center justify-center h-full border rounded-lg bg-muted/10">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                      <p className="text-sm text-muted-foreground">{t('creation.generating')}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 italic">{t('creation.generatingHint')}</p>
                    </div>
                  ) : (
                    <AIEditorWorkspace 
                      v1Content={v1Content} 
                      v2Content={v2Content} 
                      mode={creationMode as any}
                      keywordId={selectedKeywordId}
                      keyword={selectedKeyword?.Keyword || ''}
                      currentStatus={selectedKeyword?.Status || 'Beauftragt'}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

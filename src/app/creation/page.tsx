'use client';

import React, { useState, useEffect } from 'react';
import { KeywordMap, ContentLog } from '@/lib/airtable-types';
import { AIEditorWorkspace } from './ai-editor-workspace';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Zap, Clock, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function CreationPage() {
  const [keywords, setKeywords] = useState<KeywordMap[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string>('');
  const [contentLogs, setContentLogs] = useState<ContentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Using placeholder API routes to avoid client-side Airtable imports
        const [kwRes, logRes] = await Promise.all([
          fetch('/api/planning/keywords'),
          fetch('/api/planning/history') // Changed from /api/debug/airtable to ensure proper schema
        ]);
        
        const kwData = await kwRes.json();
        const logData = await logRes.json();
        
        // Ensure kwData is an array, handle wrapper from test-airtable if it still persists
        const keywordsArray = Array.isArray(kwData) ? kwData : (kwData?.sampleRecords || []);
        setKeywords(keywordsArray);
        setContentLogs(Array.isArray(logData) ? logData : []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('Fehler beim Laden der Content-Daten');
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // Poll for updates every 5 seconds to catch n8n results faster
    const interval = setInterval(fetchData, 5000);

    // Listen for refresh events
    const handleRefresh = () => fetchData();
    window.addEventListener("refresh-planning-data", handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("refresh-planning-data", handleRefresh);
    };
  }, []);

  const selectedKeyword = keywords.find((k) => k.id === selectedKeywordId);
  
  // Filter keywords for the "Aufträge" list
  const commissionedKeywords = keywords.filter(kw => {
    // A keyword belongs in the "Aufträge" list if:
    // 1. Its status is part of the creation pipeline
    const pipelineStatuses = ['Beauftragt', 'In Progress', 'In Arbeit', 'Erstellt', 'Review', 'Optimierung'];
    const hasCorrectStatus = pipelineStatuses.includes(kw.Status);
    
    // 2. OR it has any history entry at all (meaning something was done with it in n8n or manually)
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
  const reasoning = v2Log?.Reasoning_Chain || '';

  // Determine the mode (Erstellung or Optimierung) based on the log entries
  const latestLogWithAction = [...relevantLogs].sort((a, b) => 
    new Date(b.Created_At).getTime() - new Date(a.Created_At).getTime()
  ).find(log => log.Action_Type === 'Erstellung' || log.Action_Type === 'Optimierung');
  
  const creationMode = latestLogWithAction?.Action_Type || 'Erstellung';

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] space-y-6 text-[#00463c]">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content-Erstellung</h1>
          <p className="text-muted-foreground">Überprüfen und verfeinern Sie KI-generierte Content-Vorschläge.</p>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          {/* Left Side: Aufträge List */}
          <Card className="lg:col-span-4 flex flex-col overflow-hidden border-emerald-100">
            <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 py-4">
              <CardTitle className="text-lg font-bold text-[#00463c] flex items-center gap-2">
                <Zap className="h-5 w-5 fill-emerald-600 text-emerald-600" />
                Aufträge
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <Table>
                  <TableHeader className="bg-emerald-50/30 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-[#00463c] font-bold">Keyword</TableHead>
                      <TableHead className="text-[#00463c] font-bold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionedKeywords.length > 0 ? (
                      commissionedKeywords.map((kw) => (
                        <TableRow 
                          key={kw.id} 
                          className={`cursor-pointer transition-colors hover:bg-emerald-50/50 ${selectedKeywordId === kw.id ? 'bg-emerald-50 border-l-4 border-l-emerald-600' : ''}`}
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
                                  const type = latestLog?.Action_Type || 'Erstellung';
                                  return (
                                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 uppercase tracking-wider font-bold ${
                                      type === 'Erstellung' 
                                        ? 'border-emerald-200 text-emerald-700 bg-emerald-50/50' 
                                        : 'border-slate-200 text-slate-600 bg-slate-50/50'
                                    }`}>
                                      {type}
                                    </Badge>
                                  );
                                })()}
                                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Beauftragt: {(() => {
                                    // Try to find the timestamp from contentLogs first
                                    const logs = contentLogs.filter(l => Array.isArray(l.Keyword_ID) && l.Keyword_ID.includes(kw.id));
                                    const firstLog = [...logs].sort((a, b) => new Date(a.Created_At).getTime() - new Date(b.Created_At).getTime())[0];
                                    
                                    if (firstLog) {
                                      return new Date(firstLog.Created_At).toLocaleString('de-DE', { 
                                        day: '2-digit', 
                                        month: '2-digit', 
                                        year: 'numeric',
                                        hour: '2-digit', 
                                        minute: '2-digit' 
                                      });
                                    }

                                    // Fallback: If no log exists (e.g., n8n trigger just happened but Airtable delay), 
                                    // we show "jetzt" or similar since the commissioning is active.
                                    return 'gerade eben...';
                                  })()}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="secondary" 
                              className={
                                kw.Status === 'Beauftragt' 
                                  ? 'bg-amber-100 text-amber-700 border-amber-200' 
                                  : kw.Status === 'In Progress' || kw.Status === 'In Arbeit' 
                                  ? 'bg-blue-100 text-blue-700 border-blue-200' 
                                  : kw.Status === 'Erstellt'
                                  ? 'bg-[#00463c] text-white border-[#00463c]'
                                  : kw.Status === 'Review' 
                                  ? 'bg-purple-100 text-purple-700 border-purple-200'
                                  : kw.Status === 'Optimierung'
                                  ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                  : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              }
                            >
                              {kw.Status === 'In Progress' || kw.Status === 'In Arbeit' ? 'In Arbeit' : kw.Status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic">
                          Keine aktiven Aufträge gefunden.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Right Side: Editor & Preview */}
          <div className="lg:col-span-8 flex flex-col gap-6 overflow-hidden">
            {!selectedKeywordId ? (
              <div className="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-emerald-200 rounded-xl bg-white/50">
                <Send className="w-12 h-12 text-emerald-300 mb-4" />
                <h2 className="text-xl font-medium text-emerald-800">Wählen Sie einen Auftrag aus der Liste</h2>
              </div>
            ) : (
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6 pb-6">
                  {/* Main Editor Area */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[#00463c] flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Content-Vorschau: {selectedKeyword?.Keyword}
                      </h3>
                    </div>
                    
                    {!v2Content ? (
                      <div className="flex flex-col items-center justify-center h-[400px] border rounded-lg bg-muted/10">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-4" />
                        <p className="text-sm text-muted-foreground">KI generiert gerade den Content...</p>
                        <p className="text-[10px] text-muted-foreground mt-1 italic">Dies kann einige Minuten dauern.</p>
                      </div>
                    ) : (
                      <AIEditorWorkspace 
                        v1Content={v1Content} 
                        v2Content={v2Content} 
                        mode={creationMode as any}
                        keywordId={selectedKeywordId}
                        keyword={selectedKeyword?.Keyword || ''}
                      />
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

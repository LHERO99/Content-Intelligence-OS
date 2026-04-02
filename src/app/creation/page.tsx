'use client';

import React, { useState, useEffect } from 'react';
import { KeywordMap, ContentLog } from '@/lib/airtable-types';
import { AIEditorWorkspace } from './ai-editor-workspace';
import { ScoringEngine } from './scoring-engine';
import { ReasoningPanel } from './reasoning-panel';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Loader2, Send, Zap, Clock, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { triggerN8nAction } from '@/lib/n8n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function CreationPage() {
  const [keywords, setKeywords] = useState<KeywordMap[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string>('');
  const [contentLogs, setContentLogs] = useState<ContentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  // Scoring state
  const [seoScore, setSeoScore] = useState(75);
  const [brandScore, setBrandScore] = useState(85);
  const [technicalScore, setTechnicalScore] = useState(90);

  useEffect(() => {
    async function fetchData() {
      try {
        // Using placeholder API routes to avoid client-side Airtable imports
        const [kwRes, logRes] = await Promise.all([
          fetch('/api/test-airtable'),
          fetch('/api/debug/airtable?table=Content-Log')
        ]);
        
        const kwData = await kwRes.json();
        const logData = logRes.ok ? (await logRes.json()).records || [] : [];
        
        setKeywords(Array.isArray(kwData) ? kwData : []);
        setContentLogs(Array.isArray(logData) ? logData : []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('Fehler beim Laden der Content-Daten');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const selectedKeyword = keywords.find((k) => k.id === selectedKeywordId);
  
  // Filter keywords for the "Aufträge" list
  const commissionedKeywords = keywords.filter(kw => 
    kw.Status === 'Beauftragt' || kw.Status === 'In Progress'
  );

  const relevantLogs = contentLogs.filter((log) => 
    Array.isArray(log.Keyword_ID) && log.Keyword_ID.includes(selectedKeywordId)
  );
  
  const v1Content = relevantLogs.find((log) => log.Version === 'v1')?.Content_Body || '';
  const v2Log = relevantLogs.find((log) => log.Version === 'v2');
  const v2Content = v2Log?.Content_Body || '';
  const reasoning = v2Log?.Reasoning_Chain || '';

  const handleApprove = async () => {
    if (!selectedKeywordId) return;
    setApproving(true);
    try {
      await triggerN8nAction('APPROVE_PROPOSAL', {
        keywordId: selectedKeywordId,
        keyword: selectedKeyword?.Keyword,
        v2Content,
        scores: { seoScore, brandScore, technicalScore }
      });
      
      // Log the action in Content-Log
      await fetch('/api/planning/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywordId: selectedKeywordId,
          actionType: 'Optimierung',
          contentBody: v2Content,
          diffSummary: `Approved AI proposal with scores: SEO ${seoScore}, Brand ${brandScore}, Tech ${technicalScore}`,
          reasoningChain: reasoning,
          version: 'v2'
        })
      });
      
      toast.success('AI Proposal approved and sent to n8n!');
    } catch (error: any) {
      console.error('Approval failed', error);
      toast.error(error.message || 'Failed to send approval to n8n');
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] space-y-6 text-[#00463c]">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content-Erstellung</h1>
          <p className="text-muted-foreground">Überprüfen und verfeinern Sie KI-generierte Content-Vorschläge.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleApprove} 
            disabled={!selectedKeywordId || approving || loading || !v2Content}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            KI-Vorschlag freigeben
          </Button>
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
                            <div className="flex flex-col">
                              <span>{kw.Keyword}</span>
                              <div className="flex flex-col gap-0.5 mt-1">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Deadline: {kw.Editorial_Deadline ? new Date(kw.Editorial_Deadline).toLocaleDateString('de-DE') : 'Keine'}
                                </span>
                                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  Beauftragt: {(() => {
                                    const log = [...contentLogs]
                                      .filter(l => Array.isArray(l.Keyword_ID) && l.Keyword_ID.includes(kw.id))
                                      .sort((a, b) => new Date(a.Created_At).getTime() - new Date(b.Created_At).getTime())[0];
                                    return log ? new Date(log.Created_At).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
                                  })()}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="secondary" 
                              className={kw.Status === 'Beauftragt' || kw.Status === 'In Progress' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}
                            >
                              {kw.Status === 'In Progress' ? 'In Arbeit' : kw.Status}
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
                      <AIEditorWorkspace v1Content={v1Content} v2Content={v2Content} />
                    )}
                  </div>

                  {/* Sidebar Area (now below on mobile, or integrated) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ScoringEngine 
                      seoScore={seoScore}
                      brandScore={brandScore}
                      technicalScore={technicalScore}
                      onSeoChange={(v) => setSeoScore(Array.isArray(v) ? v[0] : (v as number))}
                      onBrandChange={(v) => setBrandScore(Array.isArray(v) ? v[0] : (v as number))}
                      onTechnicalChange={(v) => setTechnicalScore(Array.isArray(v) ? v[0] : (v as number))}
                    />
                    <div className="h-[400px]">
                      <ReasoningPanel reasoning={reasoning} />
                    </div>
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

'use client';

import React, { useState, useEffect } from 'react';
import { KeywordMap, ContentLog } from '@/lib/airtable-types';
import { AIEditorWorkspace } from './ai-editor-workspace';
import { ScoringEngine } from './scoring-engine';
import { ReasoningPanel } from './reasoning-panel';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { triggerN8nAction } from '@/lib/n8n';

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
        
        setKeywords(kwData);
        setContentLogs(logData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('Failed to load content data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const selectedKeyword = keywords.find((k) => k.id === selectedKeywordId);
  const relevantLogs = contentLogs.filter((log) => log.Keyword_ID?.includes(selectedKeywordId));
  
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
      
      toast.success('AI Proposal approved and sent to n8n!');
    } catch (error: any) {
      console.error('Approval failed', error);
      toast.error(error.message || 'Failed to send approval to n8n');
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#e7f3ee]/30 min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-950">Content-Erstellung</h1>
          <p className="text-emerald-700">Überprüfen und verfeinern Sie KI-generierte Content-Vorschläge.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select 
            value={selectedKeywordId} 
            onValueChange={(val) => setSelectedKeywordId(val || '')}
          >
            <SelectTrigger className="w-[250px] bg-white border-emerald-200">
              <SelectValue placeholder="Keyword auswählen" />
            </SelectTrigger>
            <SelectContent>
              {keywords.map((kw) => (
                <SelectItem key={kw.id} value={kw.id}>
                  {kw.Keyword}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={handleApprove} 
            disabled={!selectedKeywordId || approving || loading}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            KI-Vorschlag freigeben
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : !selectedKeywordId ? (
        <div className="flex flex-col items-center justify-center h-[60vh] border-2 border-dashed border-emerald-200 rounded-xl bg-white/50">
          <Send className="w-12 h-12 text-emerald-300 mb-4" />
          <h2 className="text-xl font-medium text-emerald-800">Wählen Sie ein Keyword aus, um mit der Bearbeitung zu beginnen</h2>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Editor Area */}
          <div className="lg:col-span-8 space-y-6">
            <AIEditorWorkspace v1Content={v1Content} v2Content={v2Content} />
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-6">
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
      )}
    </div>
  );
}

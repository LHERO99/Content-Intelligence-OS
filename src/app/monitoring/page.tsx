'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  KeywordMap, 
  PerformanceData, 
  ContentLog 
} from '@/lib/airtable-types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Clock, Zap, BarChart3, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlerts } from '@/components/alerts-provider';

export default function MonitoringPage() {
  const { addAlert } = useAlerts();
  const [isAuditing, setIsAuditing] = useState(false);
  const [keywords, setKeywords] = useState<KeywordMap[]>([]);
  const [performance, setPerformance] = useState<PerformanceData[]>([]);
  const [contentLogs, setContentLogs] = useState<ContentLog[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // In a real app, these would be dedicated API routes.
        // For now, we're using the test/debug routes as placeholders to avoid client-side Airtable imports.
        const [kwRes, perfRes, logRes] = await Promise.all([
          fetch('/api/test-airtable'),
          fetch('/api/debug/airtable?table=Performance-Data'),
          fetch('/api/debug/airtable?table=Content-Log')
        ]);
        
        const kwData = await kwRes.json();
        // Handle potential errors or empty responses from placeholder routes
        const perfData = perfRes.ok ? (await perfRes.json()).records || [] : [];
        const logData = logRes.ok ? (await logRes.json()).records || [] : [];
        
        // Only show published keywords or those with performance data
        const publishedKeywords = Array.isArray(kwData) 
          ? kwData.filter((k: KeywordMap) => k.Status === 'Published' || perfData.some((p: PerformanceData) => p.Keyword_ID?.includes(k.id)))
          : [];
        
        setKeywords(publishedKeywords);
        setPerformance(perfData);
        setContentLogs(logData);
        
        if (publishedKeywords.length > 0) {
          setSelectedKeywordId(publishedKeywords[0].id);
        }
      } catch (error) {
        console.error('Error fetching monitoring data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const selectedKeyword = useMemo(() => 
    keywords.find(k => k.id === selectedKeywordId), 
    [keywords, selectedKeywordId]
  );

  const keywordPerformance = useMemo(() => 
    performance
      .filter(p => p.Keyword_ID?.includes(selectedKeywordId))
      .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime()),
    [performance, selectedKeywordId]
  );

  const roiMetrics = useMemo(() => {
    if (!selectedKeyword || keywordPerformance.length === 0) return null;

    // Find the first "Published" log for this keyword
    const publishLog = contentLogs
      .filter(l => l.Keyword_ID?.includes(selectedKeywordId) && l.Version === 'v1')
      .sort((a, b) => new Date(a.Created_At).getTime() - new Date(b.Created_At).getTime())[0];

    const publishDate = publishLog ? new Date(publishLog.Created_At) : null;
    
    // Find first date where position <= 10
    const top10DateEntry = keywordPerformance.find(p => p.Position && p.Position <= 10);
    const top10Date = top10DateEntry ? new Date(top10DateEntry.Date) : null;

    let timeToRank = 'N/A';
    if (publishDate && top10Date && top10Date > publishDate) {
      const diffTime = Math.abs(top10Date.getTime() - publishDate.getTime());
      timeToRank = `${Math.ceil(diffTime / (1000 * 60 * 60 * 24))} Tage`;
    }

    // Efficiency Score: (Latest Clicks - Initial Clicks) / Number of Updates
    const maxClicks = Math.max(...keywordPerformance.map(p => p.GSC_Clicks || 0));
    const totalUpdates = contentLogs.filter(l => l.Keyword_ID?.includes(selectedKeywordId)).length || 1;
    const efficiencyScore = (maxClicks / totalUpdates).toFixed(1);

    return {
      timeToRank,
      efficiencyScore,
      publishDate: publishDate?.toLocaleDateString('de-DE') || 'Unbekannt'
    };
  }, [selectedKeyword, keywordPerformance, contentLogs, selectedKeywordId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#00463c]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content-Monitoring</h1>
          <p className="text-muted-foreground">Verfolgen Sie die Performance und den ROI Ihrer veröffentlichten Inhalte.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            className="border-[#00463c] text-[#00463c] hover:bg-[#00463c] hover:text-white"
            disabled={isAuditing}
            onClick={async () => {
              setIsAuditing(true);
              try {
                const res = await fetch('/api/n8n/trigger', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ workflow: 'full-system-audit' })
                });
                if (res.ok) {
                  addAlert({
                    type: 'success',
                    message: 'Vollständiges System-Audit gestartet',
                    description: 'n8n führt nun einen Tiefenscan der GSC- und Sistrix-Daten durch.'
                  });
                } else {
                  throw new Error('Audit konnte nicht gestartet werden');
                }
              } catch (err) {
                addAlert({
                  type: 'error',
                  message: 'Audit-Trigger fehlgeschlagen',
                  description: 'Verbindung zur n8n-Orchestrierungs-Engine fehlgeschlagen.'
                });
              } finally {
                setIsAuditing(false);
              }
            }}
          >
            <ShieldAlert className="w-4 h-4 mr-2" />
            {isAuditing ? 'Audit läuft...' : 'Vollständiges System-Audit'}
          </Button>

          <div className="w-full md:w-72">
            <Select value={selectedKeywordId} onValueChange={(value) => setSelectedKeywordId(value || '')}>
              <SelectTrigger className="bg-white border-[#00463c]/20">
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
          </div>
        </div>
      </div>

      {selectedKeyword ? (
        <>
          {/* ROI Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Time-to-Rank (Top 10)</CardTitle>
                <Clock className="w-4 h-4 text-[#00463c]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{roiMetrics?.timeToRank}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Veröffentlicht am: {roiMetrics?.publishDate}
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Effizienz-Score</CardTitle>
                <Zap className="w-4 h-4 text-[#00463c]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{roiMetrics?.efficiencyScore}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Traffic-Gewinn pro Update
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Aktuelle Sichtbarkeit</CardTitle>
                <TrendingUp className="w-4 h-4 text-[#00463c]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {keywordPerformance[keywordPerformance.length - 1]?.Sistrix_VI?.toFixed(3) || '0.000'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Sistrix Sichtbarkeitsindex
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Suchperformance-Trends
                </CardTitle>
                <CardDescription>
                  GSC Klicks vs. Impressionen für "{selectedKeyword.Keyword}"
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={keywordPerformance}>
                    <defs>
                      <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00463c" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00463c" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="Date" 
                      tickFormatter={(str) => new Date(str).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
                      stroke="#00463c"
                      fontSize={12}
                    />
                    <YAxis yAxisId="left" stroke="#00463c" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e7f3ee' }}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('de-DE')}
                    />
                    <Legend />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="GSC_Clicks" 
                      name="Klicks"
                      stroke="#00463c" 
                      fillOpacity={1} 
                      fill="url(#colorClicks)" 
                    />
                    <Area 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="GSC_Impressions" 
                      name="Impressionen"
                      stroke="#82ca9d" 
                      fillOpacity={1} 
                      fill="url(#colorImpressions)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle>Sistrix Sichtbarkeitsindex</CardTitle>
                <CardDescription>
                  Langfristiger Sichtbarkeitstrend für die Ziel-URL
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={keywordPerformance}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="Date" 
                      tickFormatter={(str) => new Date(str).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
                      stroke="#00463c"
                      fontSize={12}
                    />
                    <YAxis stroke="#00463c" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e7f3ee' }}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('de-DE')}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Sistrix_VI" 
                      name="Sichtbarkeitsindex"
                      stroke="#00463c" 
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#00463c' }}
                      activeDot={{ r: 6 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <div className="bg-white p-8 rounded-full mb-4">
            <BarChart3 className="w-12 h-12 text-[#00463c]/20" />
          </div>
          <h2 className="text-xl font-semibold">Keine veröffentlichten Inhalte gefunden</h2>
          <p className="text-muted-foreground max-w-md mx-auto mt-2">
            Beginnen Sie mit der Veröffentlichung von Inhalten im Erstellungs-Modul, um hier Performance-Daten zu sehen.
          </p>
        </div>
      )}
    </div>
  );
}

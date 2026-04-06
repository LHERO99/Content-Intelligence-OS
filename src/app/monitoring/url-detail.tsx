"use client";

import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Label
} from 'recharts';
import { PerformanceData, ContentLog, URLPerformance, KeywordRankingHistory, KeywordMap } from "@/lib/airtable-types";
import { Loader2, TrendingUp, TrendingDown, Clock, Coins, LayoutPanelLeft, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

interface UrlDetailProps {
  url: string;
}

export function UrlDetail({ url }: UrlDetailProps) {
  const [data, setData] = useState<{
    performance: PerformanceData[];
    urlPerformance: URLPerformance[];
    keywordRankings: KeywordRankingHistory[];
    keywords: KeywordMap[];
    history: ContentLog[];
    savings: { agency: number; overhead: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetail();
  }, [url]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/monitoring/detail?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error("Failed to fetch detail");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#00463c]" />
      </div>
    );
  }

  if (!data) return <div>Keine Daten gefunden.</div>;

  const getStatusInfo = () => {
    // Strictly exclude tool/planning logs from counting
    const deliveryLogs = data.history.filter(log => {
      const summary = log.Diff_Summary?.toLowerCase() || '';
      return (summary.includes('content angeliefert') || summary.includes('content veröffentlicht')) &&
             !(
               summary.includes('url wurde dem tool hinzugefügt') || 
               summary.includes('url wurde dem tab \'vorschläge\' hinzugefügt') ||
               summary.includes('url wurde der redaktionsplanung hinzugefügt')
             );
    }).sort((a, b) => new Date(a.Created_At).getTime() - new Date(b.Created_At).getTime());

    if (deliveryLogs.length === 0) {
      return { text: "Nicht optimiert", version: "" };
    }
    
    // Deduplicate by day
    const dailyLogs: typeof deliveryLogs = [];
    const seenDays = new Set<string>();

    deliveryLogs.forEach(log => {
      const day = new Date(log.Created_At).toISOString().split('T')[0];
      if (!seenDays.has(day)) {
        dailyLogs.push(log);
        seenDays.add(day);
      }
    });

    const versionCount = dailyLogs.length;
    
    if (versionCount === 1) {
      return { text: "Content erstellt", version: "" };
    }
    
    return { 
      text: "Content optimiert", 
      version: `(V${versionCount})` 
    };
  };

  const statusInfo = getStatusInfo();

  const eventMarkers = data.history.map(log => ({
    date: log.Created_At.split('T')[0],
    type: log.Action_Type,
    label: log.Action_Type === 'Erstellung' ? 'E' : 'O'
  }));

  // Prepare Keyword Ranking Chart Data
  // We need to group rankings by date
  const rankingDates = Array.from(new Set(data.keywordRankings.map(r => r.Date))).sort();
  const keywordChartData = rankingDates.map(date => {
    const entry: any = { Date: date };
    data.keywords.forEach(kw => {
      const ranking = data.keywordRankings.find(r => r.Date === date && r.Keyword_ID.includes(kw.id));
      if (ranking) {
        entry[kw.Keyword] = ranking.Ranking;
      }
    });
    return entry;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Coins className="h-4 w-4 text-[#00463c]" />
              Eingesparte Kosten (Agentur & Overhead)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#00463c]">
              {(data.savings.agency + data.savings.overhead).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </div>
            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
              <span>Agentur: {data.savings.agency.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
              <span>Overhead: {data.savings.overhead.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LayoutPanelLeft className="h-4 w-4 text-[#00463c]" />
              Content-Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{statusInfo.text} {statusInfo.version}</div>
            <p className="text-xs text-muted-foreground">
              {data.history.length > 0 
                ? `Letztes Update: ${new Date(data.history[0].Created_At).toLocaleDateString('de-DE')}`
                : 'Keine Updates vorhanden'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Hash className="h-4 w-4 text-[#00463c]" />
              Keywords
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold mb-2">{data.keywords.length} Keywords</div>
            <div className="space-y-2">
              {data.keywords.length > 0 ? (
                <>
                  {/* Main Keyword */}
                  {data.keywords.filter(k => k.Main_Keyword === 'Y').map(k => (
                    <div key={k.id} className="flex items-center gap-2">
                      <Badge variant="default" className="text-[10px] py-0 bg-[#00463c]">Main</Badge>
                      <span className="text-sm font-bold truncate" title={k.Keyword}>{k.Keyword}</span>
                    </div>
                  ))}
                  
                  {/* Secondary Keywords */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {data.keywords.filter(k => k.Main_Keyword !== 'Y').map(k => (
                      <Badge key={k.id} variant="outline" className="text-[10px] py-0 border-[#00463c]/20" title={k.Keyword}>
                        {k.Keyword}
                      </Badge>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">Keine Keywords verknüpft</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-none shadow-sm">
          <CardHeader>
            <CardTitle>URL Performance Verlauf</CardTitle>
            <CardDescription>GSC Klicks (Links) und Sistrix VI (Rechts).</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={(data.urlPerformance.length > 0 ? data.urlPerformance : data.performance) as any[]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="Date" 
                  tickFormatter={(str) => new Date(str).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
                  fontSize={12}
                />
                <YAxis yAxisId="left" stroke="#00463c" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e7f3ee' }}
                  labelFormatter={(l) => new Date(l).toLocaleDateString('de-DE')}
                />
                <Legend />
                
                {eventMarkers.map((marker, idx) => (
                  <ReferenceLine 
                    key={idx} 
                    x={marker.date} 
                    yAxisId="left" 
                    stroke={marker.type === 'Erstellung' ? '#00463c' : '#f59e0b'} 
                    strokeDasharray="3 3"
                  >
                    <Label value={marker.label} position="top" fill={marker.type === 'Erstellung' ? '#00463c' : '#f59e0b'} />
                  </ReferenceLine>
                ))}

                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="GSC_Clicks" 
                  name="Klicks" 
                  stroke="#00463c" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="Sistrix_VI" 
                  name="Sistrix VI" 
                  stroke="#82ca9d" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm">
          <CardHeader>
            <CardTitle>Keyword Ranking Verlauf</CardTitle>
            <CardDescription>Entwicklung der Rankings für Main & Secondaries (Niedriger ist besser).</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={keywordChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="Date" 
                  tickFormatter={(str) => new Date(str).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
                  fontSize={12}
                />
                <YAxis reversed domain={[1, 'auto']} fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e7f3ee' }}
                  labelFormatter={(l) => new Date(l).toLocaleDateString('de-DE')}
                />
                <Legend />
                
                {data.keywords.map((kw, idx) => (
                  <Line 
                    key={kw.id}
                    type="monotone" 
                    dataKey={kw.Keyword} 
                    name={kw.Keyword + (kw.Main_Keyword === 'Y' ? ' (Main)' : '')}
                    stroke={kw.Main_Keyword === 'Y' ? '#00463c' : `hsl(${(idx * 137) % 360}, 50%, 50%)`}
                    strokeWidth={kw.Main_Keyword === 'Y' ? 3 : 1.5}
                    dot={kw.Main_Keyword === 'Y'}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-none shadow-sm">
        <CardHeader>
          <CardTitle>Content-Historie</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Seitentyp</TableHead>
                <TableHead>Zusammenfassung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.history.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.Created_At).toLocaleDateString('de-DE')}</TableCell>
                  <TableCell>
                    <Badge variant={log.Action_Type === 'Erstellung' ? 'default' : 'outline'}>
                      {log.Action_Type}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.Page_Type}</TableCell>
                  <TableCell className="max-w-md truncate">{log.Diff_Summary || 'Keine Zusammenfassung'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

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
import { PerformanceData, ContentLog } from "@/lib/airtable-types";
import { Loader2, TrendingUp, TrendingDown, Clock, Coins, LayoutPanelLeft } from "lucide-react";
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

  const eventMarkers = data.history.map(log => ({
    date: log.Created_At.split('T')[0],
    type: log.Action_Type,
    label: log.Action_Type === 'Erstellung' ? 'E' : 'O'
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="text-lg font-bold">{data.history.length} Updates</div>
            <p className="text-xs text-muted-foreground">Letztes Update: {data.history[0] ? new Date(data.history[0].Created_At).toLocaleDateString('de-DE') : 'N/A'}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-none shadow-sm">
        <CardHeader>
          <CardTitle>Performance Verlauf & Marker</CardTitle>
          <CardDescription>GSC Klicks (Links) und Sistrix VI (Rechts) mit Content-Event Markern.</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.performance}>
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

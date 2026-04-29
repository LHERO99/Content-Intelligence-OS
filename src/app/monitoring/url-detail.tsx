"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, MousePointer2, Eye, TrendingUp, Coins } from "lucide-react";

// ── Custom event label for ReferenceLine (defined outside component for stable ref) ──
function EventLabel({ viewBox, type }: { viewBox?: any; type: string }) {
  if (!viewBox) return null;
  const { x, y } = viewBox;
  const isCreation = type === 'Erstellung';
  const color = isCreation ? 'var(--primary)' : '#f59e0b';
  const label = isCreation ? 'Erstellt' : 'Optimiert';
  const textWidth = label.length * 6 + 12;
  const bx = x - textWidth / 2;
  const by = y + 6; // inside chart area, near top
  return (
    <g>
      <rect x={bx} y={by} width={textWidth} height={16} rx={4} fill={color} opacity={0.88} />
      <text x={x} y={by + 11} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={600}>
        {label}
      </text>
    </g>
  );
}

interface URLPerformance {
  id: string;
  Target_URL: string;
  Date: string;
  GSC_Clicks?: number;
  GSC_Impressions?: number;
  Position?: number;
  Sistrix_VI?: number;
}

interface ContentLog {
  id: string;
  Action_Type: string;
  Created_At: string;
  Diff_Summary?: string;
}

interface DetailData {
  urlPerformance: URLPerformance[];
  history: ContentLog[];
  savings: { agency: number; overhead: number };
}

interface Props {
  url: string;
}

export function UrlDetail({ url }: Props) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/monitoring/detail?url=${encodeURIComponent(url)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Fehler beim Laden der Detail-Daten");
        return r.json();
      })
      .then((json: DetailData) => setData(json))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm py-8 text-center">{error}</div>
    );
  }

  if (!data) return null;

  // ── Derive content events (Erstellung / Optimierung) from history ──
  const deliveryLogs = data.history
    .filter((l) => {
      const s = l.Diff_Summary?.toLowerCase() || "";
      return (
        (s.includes("content angeliefert") || s.includes("content veröffentlicht")) &&
        !s.includes("url wurde dem tool hinzugefügt") &&
        !s.includes("url wurde dem tab") &&
        !s.includes("url wurde der redaktionsplanung")
      );
    })
    .sort((a, b) => new Date(a.Created_At).getTime() - new Date(b.Created_At).getTime());

  // Deduplicate per day
  const seenDays = new Set<string>();
  const events: { date: string; type: string }[] = [];
  deliveryLogs.forEach((log, idx) => {
    const day = new Date(log.Created_At).toISOString().split("T")[0];
    if (!seenDays.has(day)) {
      seenDays.add(day);
      events.push({ date: day, type: idx === 0 ? "Erstellung" : "Optimierung" });
    }
  });

  // ── Build chart data ──
  const chartData = data.urlPerformance.map((p) => ({
    date: p.Date,
    clicks: p.GSC_Clicks ?? null,
    impressions: p.GSC_Impressions ?? null,
    position: p.Position ?? null,
    vi: p.Sistrix_VI ?? null,
  }));

  const hasData = chartData.length > 0;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("de-DE", { month: "short", day: "numeric" });

  const latestPerf = data.urlPerformance[data.urlPerformance.length - 1];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MousePointer2 className="h-3.5 w-3.5 text-primary" />
              Klicks (aktuell)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {latestPerf?.GSC_Clicks ?? "–"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-primary" />
              Impressionen (aktuell)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {latestPerf?.GSC_Impressions ?? "–"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              Ø Position (aktuell)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {latestPerf?.Position?.toFixed(1) ?? "–"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-primary" />
              Einsparungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {(data.savings.agency + data.savings.overhead).toLocaleString("de-DE", {
                style: "currency",
                currency: "EUR",
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* URL Performance Verlauf */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-primary">URL Performance Verlauf</CardTitle>
          <CardDescription className="text-[11px]">
            GSC Klicks &amp; Impressionen über Zeit — Markierungen zeigen Erstellungs- und Optimierungszeitpunkte
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          {hasData ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 32, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="color-mix(in oklab, var(--primary) 20%, white)"
                  />
                  <XAxis
                    dataKey="date"
                    stroke="var(--primary)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatDate}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="var(--primary)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#6366f1"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid color-mix(in oklab, var(--primary) 20%, white)",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--primary)", fontWeight: "bold" }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString("de-DE")}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(value) =>
                      value === "clicks"
                        ? "Klicks"
                        : value === "impressions"
                        ? "Impressionen"
                        : value
                    }
                  />

                  {/* Event reference lines */}
                  {events.map((ev) => (
                    <ReferenceLine
                      key={ev.date + ev.type}
                      x={ev.date}
                      yAxisId="left"
                      stroke={ev.type === "Erstellung" ? "var(--primary)" : "#f59e0b"}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      label={(props: any) => <EventLabel {...props} type={ev.type} />}
                    />
                  ))}

                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="clicks"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="impressions"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              Keine Performance-Daten vorhanden
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sistrix VI Verlauf */}
      {hasData && data.urlPerformance.some((p) => p.Sistrix_VI != null) && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-primary">Sistrix Visibility Index Verlauf</CardTitle>
            <CardDescription className="text-[11px]">
              Entwicklung des Sichtbarkeitsindex über Zeit
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 32, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="color-mix(in oklab, var(--primary) 20%, white)"
                  />
                  <XAxis
                    dataKey="date"
                    stroke="var(--primary)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatDate}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="var(--primary)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid color-mix(in oklab, var(--primary) 20%, white)",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--primary)", fontWeight: "bold" }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString("de-DE")}
                  />

                  {events.map((ev) => (
                    <ReferenceLine
                      key={ev.date + ev.type}
                      x={ev.date}
                      stroke={ev.type === "Erstellung" ? "var(--primary)" : "#f59e0b"}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      label={(props: any) => <EventLabel {...props} type={ev.type} />}
                    />
                  ))}

                  <Line
                    type="monotone"
                    dataKey="vi"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                    name="Sistrix VI"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

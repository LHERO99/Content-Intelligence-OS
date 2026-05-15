"use client";

import { useState, useEffect, useMemo } from "react";
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
import { PerformanceData, ContentLog, URLPerformance, KeywordRankingHistory, KeywordMap } from "@/lib/postgres-types";
import { Loader2, TrendingUp, TrendingDown, Clock, Coins, LayoutPanelLeft, Hash, Calendar, RotateCcw, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HistoryList } from "@/features/shared/components/HistoryList";
import { Input } from "@/components/ui/input";
import { Label as UILabel } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/use-i18n";
import { toLocaleTag } from "@/i18n/locale-utils";

interface UrlDetailProps {
  url: string;
}

export function UrlDetail({ url }: UrlDetailProps) {
  const { locale, t } = useI18n();
  const localeTag = toLocaleTag(locale);
  const [data, setData] = useState<{
    performance: PerformanceData[];
    urlPerformance: URLPerformance[];
    keywordRankings: KeywordRankingHistory[];
    keywords: KeywordMap[];
    history: ContentLog[];
    savings: { agency: number; overhead: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: ""
  });
  const [hiddenUrlLines, setHiddenUrlLines] = useState<Set<string>>(new Set());
  const [hiddenRankingLines, setHiddenRankingLines] = useState<Set<string>>(new Set());

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
      
      // Auto-set initial date range based on available data
      const allPerformance = json.urlPerformance.length > 0 ? json.urlPerformance : json.performance;
      if (allPerformance.length > 0) {
        const dates = allPerformance.map((p: any) => p.Date).sort();
        setDateRange({
          start: dates[0],
          end: dates[dates.length - 1]
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUrlPerformance = useMemo(() => {
    if (!data) return [];
    const baseData = data.urlPerformance.length > 0 ? data.urlPerformance : data.performance;
    return baseData.filter(p => 
      (!dateRange.start || p.Date >= dateRange.start) && 
      (!dateRange.end || p.Date <= dateRange.end)
    );
  }, [data, dateRange]);

  const filteredKeywordRankings = useMemo(() => {
    if (!data) return [];
    return data.keywordRankings.filter(r => 
      (!dateRange.start || r.Date >= dateRange.start) && 
      (!dateRange.end || r.Date <= dateRange.end)
    );
  }, [data, dateRange]);

  const handleResetDates = () => {
    if (!data) return;
    const baseData = data.urlPerformance.length > 0 ? data.urlPerformance : data.performance;
    if (baseData.length > 0) {
      const dates = baseData.map(p => p.Date).sort();
      setDateRange({
        start: dates[0],
        end: dates[dates.length - 1]
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return <div>{t('monitoringDetail.noData')}</div>;

  const getStatusInfo = () => {
    // Strictly exclude tool/planning logs from counting
    const deliveryLogs = data.history.filter(log => {
      const summary = log.Event_Label?.toLowerCase() || '';
      return (summary.includes('content angeliefert') || summary.includes('content veröffentlicht')) &&
             !(
               summary.includes('url wurde dem tool hinzugefügt') || 
               summary.includes('url wurde dem tab \'vorschläge\' hinzugefügt') ||
               summary.includes('url wurde der redaktionsplanung hinzugefügt')
             );
    }).sort((a, b) => new Date(a.Created_At).getTime() - new Date(b.Created_At).getTime());

    if (deliveryLogs.length === 0) {
      return { text: t('monitoringDetail.statusNotOptimized'), version: "" };
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
      return { text: t('monitoringDetail.statusCreated'), version: "" };
    }
    
    return { 
      text: t('monitoringDetail.statusOptimized'), 
      version: `(V${versionCount})` 
    };
  };

  const statusInfo = getStatusInfo();

  const mainKeyword = data.keywords.find(k => k.Main_Keyword === 'Y');
  const latestRanking = mainKeyword ? data.keywordRankings
    .filter(r => r.Keyword_ID.includes(mainKeyword.id))
    .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())[0] : null;

  // ── Legend toggle helpers ────────────────────────────────────────────────────
  const toggleLine = (hidden: Set<string>, setHidden: (s: Set<string>) => void, key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setHidden(next);
  };

  const renderLegend = (hidden: Set<string>, setHidden: (s: Set<string>) => void) =>
    ({ payload }: any) => (
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {(payload ?? []).map((entry: any) => {
          const isHidden = hidden.has(entry.dataKey ?? entry.value);
          return (
            <li
              key={entry.value}
              className="flex items-center gap-1.5 cursor-pointer select-none text-xs"
              style={{ opacity: isHidden ? 0.35 : 1 }}
              onClick={() => toggleLine(hidden, setHidden, entry.dataKey ?? entry.value)}
            >
              <span
                className="inline-block w-5 h-0.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: entry.color,
                  textDecoration: isHidden ? 'line-through' : 'none',
                }}
              />
              <span style={{ textDecoration: isHidden ? 'line-through' : 'none' }}>
                {entry.value}
              </span>
            </li>
          );
        })}
      </ul>
    );

  // ── Custom event label for ReferenceLine ─────────────────────────────────────
  const EventLabel = ({ viewBox, type }: { viewBox?: any; type: string }) => {
    if (!viewBox) return null;
    const { x, y } = viewBox;
    const isCreation = type === 'Erstellung';
    const color = isCreation ? 'var(--primary)' : '#f59e0b';
    const label = isCreation ? 'Erstellt' : 'Optimiert';
    const textWidth = label.length * 6 + 10;
    const flagY = y + 4;
    return (
      <g>
        <rect
          x={x - textWidth / 2}
          y={flagY}
          width={textWidth}
          height={16}
          rx={3}
          fill={color}
          opacity={0.9}
        />
        <text
          x={x}
          y={flagY + 11}
          textAnchor="middle"
          fill="#fff"
          fontSize={10}
          fontWeight={600}
        >
          {label}
        </text>
      </g>
    );
  };

  const eventMarkers = data.history.map(log => ({    date: log.Created_At.split('T')[0],
    type: log.Action_Type,
    label: log.Action_Type === 'Erstellung' ? 'E' : 'O'
  }));

  // Logarithmische Transformation für Keyword-Ranking-Chart
  // log(1)=0 … log(20)≈3 nimmt viel Platz, log(20)…log(101) komprimiert
  const toLog = (rank: number) => Math.log(rank);
  const fromLog = (v: number) => Math.round(Math.exp(v));
  const LOG_TICKS = [1, 3, 5, 10, 20, 50, 101].map(toLog);

  // Prepare Keyword Ranking Chart Data
  // We need to group rankings by date
  const rankingDates = Array.from(new Set(filteredKeywordRankings.map(r => r.Date))).sort();
  const keywordChartData = rankingDates.map(date => {
    const entry: any = { Date: date };
    data.keywords.forEach(kw => {
      const ranking = filteredKeywordRankings.find(r => r.Date === date && r.Keyword_ID.includes(kw.id));
      if (ranking) {
        const raw = ranking.Ranking ?? 101;
        entry[kw.Keyword + '_raw'] = raw;
        entry[kw.Keyword + '_log'] = toLog(raw);
      }
    });
    return entry;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              {t('monitoringDetail.savedCosts')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {(data.savings.agency + data.savings.overhead).toLocaleString(localeTag, { style: 'currency', currency: 'EUR' })}
            </div>
            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
              <span>{t('monitoringDetail.agency')}: {data.savings.agency.toLocaleString(localeTag, { style: 'currency', currency: 'EUR' })}</span>
              <span>{t('monitoringDetail.overhead')}: {data.savings.overhead.toLocaleString(localeTag, { style: 'currency', currency: 'EUR' })}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LayoutPanelLeft className="h-4 w-4 text-primary" />
              {t('monitoringDetail.contentStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{statusInfo.text} {statusInfo.version}</div>
            <p className="text-xs text-muted-foreground">
              {data.history.length > 0 
                ? `${t('monitoringDetail.lastUpdate')}: ${new Date(data.history[0].Created_At).toLocaleDateString(localeTag)}`
                : t('monitoringDetail.noUpdates')}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />
              {t('monitoringDetail.keywords')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.keywords.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t('monitoringDetail.noKeywordsLinked')}</p>
            ) : (
              <ScrollArea className="max-h-[120px]">
                <div className="space-y-1 pr-1">
                  {data.keywords.map(k => {
                    const latestKwRanking = filteredKeywordRankings
                      .filter(r => r.Keyword_ID.includes(k.id))
                      .sort((a, b) => b.Date.localeCompare(a.Date))[0];
                    const rank = latestKwRanking?.Ranking ?? null;
                    const rankColor =
                      rank === null    ? 'text-slate-400' :
                      rank >= 101      ? 'text-orange-400' :
                      rank <= 10       ? 'text-green-600' :
                      rank <= 20       ? 'text-lime-600' :
                      rank <= 50       ? 'text-yellow-600' :
                                         'text-slate-500';
                    const rankLabel =
                      rank === null    ? '–' :
                      rank >= 101      ? '>100' :
                                         `#${rank}`;
                    return (
                      <div key={k.id} className="flex items-center justify-between gap-2 py-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {k.Main_Keyword === 'Y' && (
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-primary/10 text-primary rounded px-1 py-0.5 leading-none">
                              Main
                            </span>
                          )}
                          <span className="text-xs truncate text-foreground" title={k.Keyword}>
                            {k.Keyword}
                          </span>
                        </div>
                        <span className={`text-xs font-semibold tabular-nums shrink-0 ${rankColor}`}>
                          {rankLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              {t('monitoringDetail.rankingMain')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={`text-lg font-bold ${latestRanking?.Ranking ? 'text-primary' : 'text-slate-400'}`}>
                {latestRanking?.Ranking ? t('monitoringDetail.yes') : t('monitoringDetail.no')}
              </div>
              {latestRanking?.Ranking && (
                <span className="text-sm text-muted-foreground font-medium">
                  ({t('monitoringDetail.rankPosition')} {latestRanking.Ranking})
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate" title={mainKeyword?.Keyword}>
              {mainKeyword?.Keyword || t('monitoringDetail.noMainKeyword')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-none shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <UILabel htmlFor="start-date" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {t('monitoringDetail.periodFrom')}
              </UILabel>
              <Input
                id="start-date"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="h-9 w-[160px] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <UILabel htmlFor="end-date" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {t('monitoringDetail.periodTo')}
              </UILabel>
              <Input
                id="end-date"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="h-9 w-[160px] text-sm"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleResetDates}
              className="h-9 gap-2 text-muted-foreground hover:text-primary"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('common.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-none shadow-sm">
          <CardHeader>
            <CardTitle>{t('monitoringDetail.urlPerformanceTitle')}</CardTitle>
            <CardDescription>{t('monitoringDetail.urlPerformanceDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredUrlPerformance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="Date" 
                  tickFormatter={(str) => new Date(str).toLocaleDateString(localeTag, { month: 'short', day: 'numeric' })}
                  fontSize={12}
                />
                <YAxis yAxisId="left" stroke="var(--primary)" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid color-mix(in oklab, var(--primary) 20%, white)' }}
                  labelFormatter={(l) => new Date(l).toLocaleDateString(localeTag)}
                />
                <Legend content={renderLegend(hiddenUrlLines, setHiddenUrlLines)} />
                
                {eventMarkers.map((marker, idx) => (
                  <ReferenceLine 
                    key={idx} 
                    x={marker.date} 
                    yAxisId="left" 
                    stroke={marker.type === 'Erstellung' ? 'var(--primary)' : '#f59e0b'} 
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  >
                    <Label content={(props: any) => <EventLabel viewBox={props.viewBox} type={marker.type} />} />
                  </ReferenceLine>
                ))}

                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="GSC_Clicks" 
                  name={t('monitoringDetail.clicks')} 
                  stroke="var(--primary)" 
                  strokeWidth={2}
                  dot={false}
                  hide={hiddenUrlLines.has('GSC_Clicks')}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="Sistrix_VI" 
                  name="Sistrix VI" 
                  stroke="#82ca9d" 
                  strokeWidth={2}
                  dot={false}
                  hide={hiddenUrlLines.has('Sistrix_VI')}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm">
          <CardHeader>
            <CardTitle>{t('monitoringDetail.keywordRankingTitle')}</CardTitle>
            <CardDescription>{t('monitoringDetail.keywordRankingDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={keywordChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="Date" 
                  tickFormatter={(str) => new Date(str).toLocaleDateString(localeTag, { month: 'short', day: 'numeric' })}
                  fontSize={12}
                />
                <YAxis
                  reversed
                  domain={[toLog(1), toLog(101)]}
                  ticks={LOG_TICKS}
                  tickFormatter={(v) => {
                    const raw = fromLog(v);
                    return raw >= 101 ? '>100' : String(raw);
                  }}
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid color-mix(in oklab, var(--primary) 20%, white)' }}
                  labelFormatter={(l) => new Date(l).toLocaleDateString(localeTag)}
                  formatter={(value: any, name: any, props: any) => {
                    // name is e.g. "nutzungsklasse 31_log" — strip suffix for display
                    const displayName = String(name).replace(/_log$/, '');
                    const raw = props?.payload?.[displayName + '_raw'];
                    const label = raw === undefined
                      ? (fromLog(value) >= 101 ? 'Nicht in Top 100' : `Position ${fromLog(value)}`)
                      : (raw >= 101 ? 'Nicht in Top 100' : `Position ${raw}`);
                    return [label, displayName] as any;
                  }}
                />
                <Legend content={renderLegend(hiddenRankingLines, setHiddenRankingLines)} />

                {data.keywords.map((kw, idx) => {
                  const color = kw.Main_Keyword === 'Y' ? 'var(--primary)' : `hsl(${(idx * 137) % 360}, 50%, 50%)`;
                  const logKey = kw.Keyword + '_log';
                  return (
                    <Line
                      key={kw.id}
                      type="monotone"
                      dataKey={logKey}
                      name={kw.Keyword + (kw.Main_Keyword === 'Y' ? ' (Main)' : '') as any}
                      stroke={color}
                      strokeWidth={kw.Main_Keyword === 'Y' ? 3 : 1.5}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        const raw = payload?.[kw.Keyword + '_raw'];
                        if (raw === undefined) return <g key={`dot-${cx}-${cy}`} />;
                        if (raw >= 101) {
                          return (
                            <circle
                              key={`dot-${cx}-${cy}`}
                              cx={cx}
                              cy={cy}
                              r={4}
                              fill="#fff"
                              stroke="#94a3b8"
                              strokeWidth={1.5}
                              strokeDasharray="2 2"
                            />
                          );
                        }
                        if (kw.Main_Keyword !== 'Y') return <g key={`dot-${cx}-${cy}`} />;
                        return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={color} />;
                      }}
                      hide={hiddenRankingLines.has(kw.Keyword)}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-none shadow-sm">
        <CardHeader>
          <CardTitle>{t('monitoringDetail.contentHistoryTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoryList 
            history={data.history} 
            isLoading={false} 
          />
        </CardContent>
      </Card>
    </div>
  );
}

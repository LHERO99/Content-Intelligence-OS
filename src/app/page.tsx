'use client';

import { useState, useEffect } from 'react';
import { 
  PerformanceData,
  PotentialTrend,
  ContentLog
} from "@/lib/postgres-types";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { 
  TrendingUp, 
  MousePointer2, 
  Activity,
  RefreshCw,
  History,
  Map,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentHistoryTable } from "./content-history-table";
import { useI18n } from "@/i18n/use-i18n";
import { SystemHealthCard } from "@/components/system-health-card";
import Link from "next/link";
import type { SetupStatus } from "@/app/api/admin/setup-status/route";

// --- Helper Components ---

function KPICard({ 
  title, 
  value, 
  description, 
  icon: Icon 
}: { 
  title: string; 
  value: string | number; 
  description: string; 
  icon: any 
}) {
  return (
    <Card className="bg-white border-primary/20 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-primary/70">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

// --- Main Dashboard Page ---

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [potentialTrends, setPotentialTrends] = useState<PotentialTrend[]>([]);
  const [contentHistory, setContentHistory] = useState<ContentLog[]>([]);
  const [keywordCount, setKeywordCount] = useState<number | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [perfRes, trendsRes, historyRes, kwRes, setupRes] = await Promise.all([
        fetch('/api/debug/airtable?table=Performance-Data'),
        fetch('/api/debug/airtable?table=Potential-Trends'),
        fetch('/api/planning/history'),
        fetch('/api/planning/keywords'),
        fetch('/api/admin/setup-status'),
      ]);
      
      const perf = perfRes.ok ? (await perfRes.json()).records || [] : [];
      const trends = trendsRes.ok ? (await trendsRes.json()).records || [] : [];
      const history = historyRes.ok ? await historyRes.json() : [];
      const kw = kwRes.ok ? await kwRes.json() : [];
      const setup = setupRes.ok ? (await setupRes.json()) as SetupStatus : null;

      setPerformanceData(perf);
      setPotentialTrends(trends);
      setContentHistory(history);
      setKeywordCount(Array.isArray(kw) ? kw.length : 0);
      setSetupStatus(setup);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll for updates every 5 minutes. Performance data and trends are updated
    // by cron jobs at most once a day; polling at 30 s was hitting Airtable
    // rate limits without any practical benefit.
    const interval = setInterval(() => fetchData(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Data Processing ---

  const latestVI = performanceData.reduce((sum, item) => sum + (item.Sistrix_VI || 0), 0).toFixed(2);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const totalClicks = performanceData
    .filter(item => item.Date && new Date(item.Date) >= thirtyDaysAgo)
    .reduce((sum, item) => sum + (item.GSC_Clicks || 0), 0);

  const activeTrendsCount = potentialTrends.filter(t => t.Status === 'New').length;

  const chartDataMap = performanceData.reduce((acc, item) => {
    const date = item.Date;
    if (!date) return acc;
    if (!acc[date]) acc[date] = 0;
    acc[date] += item.Sistrix_VI || 0;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(chartDataMap)
    .map(([date, vi]) => ({ date, vi }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (loading) {
    return (
      <div className="flex-1 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-7">
          <Skeleton className="col-span-4 h-[450px]" />
          <Skeleton className="col-span-3 h-[450px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary">{t("dashboard.title")}</h1>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="border-primary/20 text-primary"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* Setup checklist — shown until all required areas are configured */}
      {setupStatus && (() => {
        const integrationsOk = setupStatus.integrations.gsc || setupStatus.integrations.sistrix || setupStatus.integrations.dataforseo;
        const allDone = setupStatus.costConfig.ok && integrationsOk && setupStatus.keywordMap.ok;
        if (allDone) return null;

        const items: { ok: boolean; warn?: boolean; label: string; desc: string; href: string; cta: string }[] = [
          {
            ok: setupStatus.keywordMap.ok,
            label: t("setup.keywordMap"),
            desc: setupStatus.keywordMap.ok
              ? t("setup.keywordMapOk").replace("{count}", String(setupStatus.keywordMap.count))
              : t("setup.keywordMapMissing"),
            href: "/planning?tab=keyword-map",
            cta: t("setup.keywordMapCta"),
          },
          {
            ok: setupStatus.costConfig.ok,
            label: t("setup.costConfig"),
            desc: setupStatus.costConfig.ok
              ? t("setup.costConfigOk").replace("{count}", String(setupStatus.costConfig.count))
              : t("setup.costConfigMissing"),
            href: "/admin?tab=costs",
            cta: t("setup.costConfigCta"),
          },
          {
            ok: integrationsOk,
            label: t("setup.integrations"),
            desc: integrationsOk ? t("setup.integrationsOk") : t("setup.integrationsMissing"),
            href: "/admin?tab=integrations",
            cta: t("setup.integrationsCta"),
          },
        ];

        return (
          <Card className="border-amber-200 bg-amber-50/60">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-base text-amber-900">{t("setup.title")}</CardTitle>
              </div>
              <CardDescription className="text-amber-700">{t("setup.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 rounded-lg border border-amber-100 bg-white/70 px-4 py-3">
                  <div className="flex items-start gap-3">
                    {item.ok
                      ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                      : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                    }
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  {!item.ok && (
                    <Link href={item.href}>
                      <Button variant="outline" size="sm" className="shrink-0 gap-1 border-amber-200 text-amber-800 hover:bg-amber-100">
                        {item.cta}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard 
          title={t("dashboard.kpi.visibilityIndex")} 
          value={latestVI} 
          description={t("dashboard.kpi.visibilityIndexDesc")} 
          icon={TrendingUp} 
        />
        <KPICard 
          title={t("dashboard.kpi.gscClicks")} 
          value={totalClicks.toLocaleString()} 
          description={t("dashboard.kpi.gscClicksDesc")} 
          icon={MousePointer2} 
        />
        <KPICard 
          title={t("dashboard.kpi.activeTrends")} 
          value={activeTrendsCount} 
          description={t("dashboard.kpi.activeTrendsDesc")} 
          icon={Activity} 
        />
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="bg-white border border-primary/20">
          <TabsTrigger value="performance" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{t("dashboard.tabs.performance")}</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <History className="h-4 w-4 mr-2" />
            {t("dashboard.tabs.history")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-7">
            {/* Performance Chart */}
            <Card className="col-span-4 bg-white border-primary/20">
              <CardHeader>
                <CardTitle className="text-primary">{t("dashboard.chart.title")}</CardTitle>
                <CardDescription>{t("dashboard.chart.description")}</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[350px] w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="color-mix(in oklab, var(--primary) 20%, white)" />
                        <XAxis 
                          dataKey="date" 
                          stroke="var(--primary)" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => new Date(value).toLocaleDateString(locale === "de" ? "de-DE" : "en-US", { month: 'short', day: 'numeric' })}
                        />
                        <YAxis 
                          stroke="var(--primary)" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                          tickFormatter={(value) => `${value}`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid color-mix(in oklab, var(--primary) 20%, white)' }}
                          labelStyle={{ color: 'var(--primary)', fontWeight: 'bold' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="vi" 
                          stroke="var(--primary)" 
                          strokeWidth={2} 
                          dot={{ r: 4, fill: 'var(--primary)' }} 
                          activeDot={{ r: 6 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">{t("dashboard.chart.noData")}</div>
                    )}
                  </div>
                </CardContent>
              </Card>

            {/* System Health */}
            <SystemHealthCard />
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="bg-white border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">{t("dashboard.history.title")}</CardTitle>
              <CardDescription>{t("dashboard.history.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ContentHistoryTable logs={contentHistory} loading={refreshing} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  Clock, 
  Coins, 
  LayoutList, 
  MousePointer2, 
  Search,
  ExternalLink,
  ChevronLeft,
  Wand2,
  Users,
  AlertCircle,
  LayoutDashboard,
  List,
  Calendar as CalendarIcon,
  RotateCcw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAlerts } from "@/components/alerts-provider";
import { UrlDetail } from "./url-detail";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/use-i18n";

interface MonitoringData {
  metrics: {
    avgTTR: number;
    totalAgencySavings: number;
    totalOverheadSavings: number;
    counts: Record<string, number>;
  };
  urls: Array<{
    url: string;
    clicks: number;
    clicksTrend: number;
    vi: number;
    viTrend: number;
    lastAction: string;
    lastActionDate: string | null;
    isPublished: boolean;
    hasOpenOptimizationRequest: boolean;
    optimizationEligibility: 'ELIGIBLE' | 'NO_PUBLISHED_CONTENT' | 'ALREADY_IN_WORKFLOW';
    savings: number;
  }>;
}

const ELIGIBILITY_MESSAGES = {
  NO_PUBLISHED_CONTENT: {
    title: "monitoring.optimizationNotPossible",
    description: "Diese URL kann erst zur Optimierung geplant werden, wenn bereits eine Content-Erstellung über das Tool stattgefunden hat und dieser Content als veröffentlicht markiert wurde.",
  },
  ALREADY_IN_WORKFLOW: {
    title: "monitoring.optimizationInProgress",
    description: "Für diese URL läuft bereits eine beauftragte Optimierung in der Content-Planung. Eine erneute Beauftragung ist erst möglich, wenn der aktuelle Vorgang abgeschlossen und veröffentlicht wurde.",
  },
} as const;

export default function MonitoringPage() {
  const router = useRouter();
  const { addAlert } = useAlerts();
  const { t, locale } = useI18n();
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('monitoring-active-tab') || "overview";
    }
    return "overview";
  });
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/monitoring");
      if (!res.ok) throw new Error("Failed to fetch monitoring data");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      addAlert({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitToSuggestions = async (urlsToSubmit?: string[]) => {
    const targetUrls = urlsToSubmit || selectedUrls;
    if (targetUrls.length === 0) return;

    const blockingEntries = targetUrls
      .map((url) => data?.urls.find((entry) => entry.url === url))
      .filter((entry): entry is NonNullable<typeof entry> => {
        if (!entry) return false;
        return entry.optimizationEligibility !== 'ELIGIBLE';
      });

    if (blockingEntries.length > 0) {
      const firstBlocked = blockingEntries[0];
      const state = firstBlocked.optimizationEligibility;
      const message = state === 'ALREADY_IN_WORKFLOW' ? ELIGIBILITY_MESSAGES.ALREADY_IN_WORKFLOW : ELIGIBILITY_MESSAGES.NO_PUBLISHED_CONTENT;

      addAlert({ 
        type: "warning", 
        message: t(message.title),
        description: (
          <span>
            {message.description}{" "}
              <button
                onClick={() => router.push(`/history?url=${encodeURIComponent(firstBlocked.url)}`)}
                className="underline hover:no-underline font-medium"
              >
                {t("common.contentHistory")}
              </button>
            </span>
          ) as any,
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/monitoring/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: targetUrls }),
      });
      if (!res.ok) throw new Error("Fehler beim Einreichen");
      addAlert({ 
        type: "success", 
        message: t("monitoring.addedToSuggestions"),
        description: (
          <button 
            onClick={() => router.push("/planning?tab=suggestions")}
            className="text-white underline hover:no-underline font-medium"
          >
            {t("monitoring.switchToSuggestions")}
          </button>
        ) as any,
      });
      if (!urlsToSubmit) setSelectedUrls([]);
    } catch (err: any) {
      addAlert({ type: "error", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUrls = data?.urls.filter(u => 
    u.url.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const isOptimizable = (url: string) => {
    const item = data?.urls.find(u => u.url === url);
    return item?.optimizationEligibility === 'ELIGIBLE';
  };

  const getEligibilityState = (url: string): 'NO_PUBLISHED_CONTENT' | 'ALREADY_IN_WORKFLOW' | null => {
    const item = data?.urls.find((entry) => entry.url === url);
    if (!item || item.optimizationEligibility === 'ELIGIBLE') return null;
    if (item.optimizationEligibility === 'ALREADY_IN_WORKFLOW') return 'ALREADY_IN_WORKFLOW';
    return 'NO_PUBLISHED_CONTENT';
  };

  if (viewingUrl) {
    const detailOptimizable = isOptimizable(viewingUrl);
    const eligibilityState = getEligibilityState(viewingUrl);
    const eligibilityMessage = eligibilityState ? ELIGIBILITY_MESSAGES[eligibilityState] : null;
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => setViewingUrl(null)} 
          className="flex items-center gap-2 text-primary"
        >
          <ChevronLeft className="h-4 w-4" /> {t("common.backToOverview")}
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-primary break-all">
            {viewingUrl}
          </h1>
          <Button 
            onClick={() => handleSubmitToSuggestions([viewingUrl])}
            disabled={submitting}
            className={`${detailOptimizable ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-gray-400 cursor-not-allowed opacity-70"}`}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
            {t("monitoring.optimizePlan")}
          </Button>
        </div>
        {!detailOptimizable && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle>{t(eligibilityMessage?.title || ELIGIBILITY_MESSAGES.NO_PUBLISHED_CONTENT.title)}</AlertTitle>
            <AlertDescription>
              {eligibilityMessage?.description || ELIGIBILITY_MESSAGES.NO_PUBLISHED_CONTENT.description}{" "}
              <button
                onClick={() => router.push(`/history?url=${encodeURIComponent(viewingUrl)}`)}
                className="underline hover:no-underline font-medium"
              >
                {t("common.contentHistory")}
              </button>
            </AlertDescription>
          </Alert>
        )}
        <UrlDetail url={viewingUrl} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">{t("monitoring.title")}</h1>
          <p className="text-muted-foreground">{t("monitoring.subtitle")}</p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
          localStorage.setItem('monitoring-active-tab', val);
        }}
        className="space-y-6"
      >
        <TabsList className="bg-primary/10 border-primary/10">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            {t("monitoring.tabs.overview")}
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <List className="mr-2 h-4 w-4" />
            {t("monitoring.tabs.performanceList")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card className="bg-white border-none shadow-sm">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="global-start-date" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {t("monitoring.periodFrom")}
                  </Label>
                  <Input
                    id="global-start-date"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="h-9 w-[160px] text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="global-end-date" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {t("monitoring.periodTo")}
                  </Label>
                  <Input
                    id="global-end-date"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="h-9 w-[160px] text-sm"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setDateRange({
                    start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
                    end: new Date().toISOString().split('T')[0]
                  })}
                  className="h-9 gap-2 text-muted-foreground hover:text-primary"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("common.reset")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  {t("monitoring.avgTimeToRank")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{data?.metrics.avgTTR || 0} {t("monitoring.days")}</div>
                <p className="text-xs text-muted-foreground">Von Veröffentlichung bis Top 10 Ranking</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-primary text-primary-foreground">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  {t("monitoring.agencySavings")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.metrics.totalAgencySavings.toLocaleString(locale === "de" ? 'de-DE' : 'en-US', { style: 'currency', currency: 'EUR' })}
                </div>
                <p className="text-xs opacity-80">Gesamtvolumen durch KI-Workflow</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MousePointer2 className="h-4 w-4 text-primary" />
                  {t("monitoring.overheadSavings")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {data?.metrics.totalOverheadSavings.toLocaleString(locale === "de" ? 'de-DE' : 'en-US', { style: 'currency', currency: 'EUR' })}
                </div>
                <p className="text-xs text-muted-foreground">Reduzierter interner Aufwand</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <LayoutList className="h-4 w-4 text-primary" />
                  {t("monitoring.contentUpdates")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {(data?.metrics.counts.neuerstellung_ratgeber || 0) +
                    (data?.metrics.counts.optimierung_ratgeber || 0) +
                    (data?.metrics.counts.neuerstellung_kategorie || 0) +
                    (data?.metrics.counts.optimierung_kategorie || 0) +
                    (data?.metrics.counts.neuerstellung_marke || 0) +
                    (data?.metrics.counts.optimierung_marke || 0) +
                    (data?.metrics.counts.neuerstellung_produkt || 0) +
                    (data?.metrics.counts.optimierung_produkt || 0)}
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] mt-1 text-muted-foreground uppercase tracking-wider">
                  <span>Ratgeber: {(data?.metrics.counts.neuerstellung_ratgeber || 0) + (data?.metrics.counts.optimierung_ratgeber || 0)}</span>
                  <span>Kategorie: {(data?.metrics.counts.neuerstellung_kategorie || 0) + (data?.metrics.counts.optimierung_kategorie || 0)}</span>
                  <span>Marke: {(data?.metrics.counts.neuerstellung_marke || 0) + (data?.metrics.counts.optimierung_marke || 0)}</span>
                  <span>Produkt: {(data?.metrics.counts.neuerstellung_produkt || 0) + (data?.metrics.counts.optimierung_produkt || 0)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Texte im Zeitraum
                </CardTitle>
                <CardDescription className="text-[10px]">Erstellt vs. Optimiert</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col justify-center h-[100px]">
                <div className="flex justify-between items-end border-b pb-2">
                  <span className="text-sm text-muted-foreground">Erstellt:</span>
                  <span className="text-xl font-bold text-primary">0</span>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <span className="text-sm text-muted-foreground">Optimiert:</span>
                  <span className="text-xl font-bold text-primary">0</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Stabilitäts-Index
                </CardTitle>
                <CardDescription className="text-[10px]">Ø Optimierungen bis Peak-Performance</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-[100px]">
                <div className="text-3xl font-bold text-primary">0.0</div>
                <span className="ml-2 text-sm text-muted-foreground">Zyklen</span>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Time-to-Performance
                </CardTitle>
                <CardDescription className="text-[10px]">Ø Tage bis signifikantem Klick-Anstieg</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-[100px]">
                <div className="text-3xl font-bold text-primary">0</div>
                <span className="ml-2 text-sm text-muted-foreground">Tage</span>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>{t("monitoring.urlOverviewTitle")}</CardTitle>
                  <CardDescription>{t("monitoring.urlOverviewDescription")}</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder={t("monitoring.searchUrl")} 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-[250px] h-9"
                    />
                  </div>
                  <Button 
                    onClick={() => handleSubmitToSuggestions()} 
                    disabled={selectedUrls.length === 0 || submitting}
                    className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                    {t("monitoring.optimizePlan")} ({selectedUrls.length})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox 
                              checked={selectedUrls.length === filteredUrls.length && filteredUrls.length > 0}
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedUrls(filteredUrls.map(u => u.url));
                                else setSelectedUrls([]);
                              }}
                            />
                          </TableHead>
                          <TableHead>{t("monitoring.url")}</TableHead>
                          <TableHead>{t("monitoring.clicksWeek")}</TableHead>
                          <TableHead>{t("monitoring.visibility")}</TableHead>
                          <TableHead>{t("monitoring.savedCosts")}</TableHead>
                          <TableHead className="text-right">{t("monitoring.lastAction")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUrls.map((item) => (
                          <TableRow 
                            key={item.url} 
                            className="group hover:bg-primary/5 cursor-pointer"
                            onClick={() => setViewingUrl(item.url)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox 
                                checked={selectedUrls.includes(item.url)}
                                onCheckedChange={(checked) => {
                                  if (checked) setSelectedUrls(prev => [...prev, item.url]);
                                  else setSelectedUrls(prev => prev.filter(u => u !== item.url));
                                }}
                                disabled={item.optimizationEligibility !== 'ELIGIBLE'}
                              />
                            </TableCell>
                            <TableCell className="max-w-md">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium truncate">{item.url}</span>
                                {item.lastActionDate && (
                                    <span className="text-[10px] text-muted-foreground">
                                    {t("monitoring.update")}: {new Date(item.lastActionDate).toLocaleDateString(locale === "de" ? 'de-DE' : 'en-US')}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {item.clicks}
                                {item.clicksTrend !== 0 && (
                                  <span className={`text-[10px] flex items-center ${item.clicksTrend > 0 ? "text-green-600" : "text-red-600"}`}>
                                    {item.clicksTrend > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                                    {Math.abs(item.clicksTrend)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {item.vi.toFixed(3)}
                                {item.viTrend !== 0 && (
                                  <span className={`text-[10px] flex items-center ${item.viTrend > 0 ? "text-green-600" : "text-red-600"}`}>
                                    {item.viTrend > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                                    {Math.abs(item.viTrend).toFixed(3)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-primary">
                                {item.savings.toLocaleString(locale === "de" ? 'de-DE' : 'en-US', { style: 'currency', currency: 'EUR' })}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={item.lastAction === "Erstellung" ? "default" : "secondary"}>
                                {item.lastAction}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    {filteredUrls.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {searchTerm ? t("monitoring.noUrlsFound") : t("monitoring.noMonitoringData")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

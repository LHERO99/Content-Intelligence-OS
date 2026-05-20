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
  CheckCircle2,
  Users,
  AlertCircle,
  AlertTriangle,
  LayoutDashboard,
  List,
  Map
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
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
  const tr = (de: string, en: string) => (locale === "de" ? de : en);
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [plannedUrl, setPlannedUrl] = useState<string | null>(null);
  const [costConfigMissing, setCostConfigMissing] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('monitoring-active-tab') || "overview";
    }
    return "overview";
  });
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [monRes, setupRes] = await Promise.all([
        fetch("/api/monitoring"),
        fetch("/api/admin/setup-status"),
      ]);
      if (!monRes.ok) throw new Error("Failed to fetch monitoring data");
      const json = await monRes.json();
      setData(json);
      if (setupRes.ok) {
        const setup = await setupRes.json();
        setCostConfigMissing(!setup.costConfig?.ok);
      }
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
             {tr(message.description, state === "ALREADY_IN_WORKFLOW"
               ? "An optimization for this URL is already commissioned in content planning. A new request is possible only after the current process is completed and published."
               : "This URL can only be planned for optimization after content has been created through this tool and marked as published.")}{" "}
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
      if (!res.ok) throw new Error(tr("Fehler beim Einreichen", "Error while submitting"));
      if (urlsToSubmit?.length === 1) setPlannedUrl(urlsToSubmit[0]);
      addAlert({ 
        type: "success", 
        message: t("monitoring.addedToSuggestions"),
        description: (
          <button 
            onClick={() => { window.location.href = '/planning?tab=suggestions'; }}
            className="underline hover:no-underline font-medium"
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
            disabled={submitting || !detailOptimizable || plannedUrl === viewingUrl}
            className={`${
              plannedUrl === viewingUrl
                ? "bg-green-600 hover:bg-green-600 text-white cursor-default"
                : detailOptimizable
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-gray-400 cursor-not-allowed opacity-70"
            }`}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : plannedUrl === viewingUrl ? (
              <><CheckCircle2 className="h-4 w-4 mr-2" />{tr("Beauftragt", "Planned")}</>
            ) : (
              <><Wand2 className="h-4 w-4 mr-2" />{t("monitoring.optimizePlan")}</>
            )}
          </Button>
        </div>
        {!detailOptimizable && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle>{t(eligibilityMessage?.title || ELIGIBILITY_MESSAGES.NO_PUBLISHED_CONTENT.title)}</AlertTitle>
            <AlertDescription>
              {eligibilityMessage
                ? tr(
                    eligibilityMessage.description,
                    eligibilityState === "ALREADY_IN_WORKFLOW"
                      ? "An optimization for this URL is already commissioned in content planning. A new request is possible only after the current process is completed and published."
                      : "This URL can only be planned for optimization after content has been created through this tool and marked as published."
                  )
                : tr(
                    ELIGIBILITY_MESSAGES.NO_PUBLISHED_CONTENT.description,
                    "This URL can only be planned for optimization after content has been created through this tool and marked as published."
                  )}{" "}
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

      {costConfigMissing && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="flex-1">{t("setup.missingCostConfig")}</span>
          <Link href="/admin?tab=costs">
            <Button variant="outline" size="sm" className="border-amber-200 text-amber-800 hover:bg-amber-100">
              {t("setup.setupNow")}
            </Button>
          </Link>
        </div>
      )}

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
                <p className="text-xs text-muted-foreground">{tr("Von Veröffentlichung bis Top 10 Ranking", "From publication to top 10 ranking")}</p>
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
                <p className="text-xs opacity-80">{tr("Gesamtvolumen durch KI-Workflow", "Total volume through AI workflow")}</p>
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
                <p className="text-xs text-muted-foreground">{tr("Reduzierter interner Aufwand", "Reduced internal effort")}</p>
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
                  <span>{tr("Ratgeber", "Guide")}: {(data?.metrics.counts.neuerstellung_ratgeber || 0) + (data?.metrics.counts.optimierung_ratgeber || 0)}</span>
                  <span>{tr("Kategorie", "Category")}: {(data?.metrics.counts.neuerstellung_kategorie || 0) + (data?.metrics.counts.optimierung_kategorie || 0)}</span>
                  <span>{tr("Marke", "Brand")}: {(data?.metrics.counts.neuerstellung_marke || 0) + (data?.metrics.counts.optimierung_marke || 0)}</span>
                  <span>{tr("Produkt", "Product")}: {(data?.metrics.counts.neuerstellung_produkt || 0) + (data?.metrics.counts.optimierung_produkt || 0)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  {t("monitoringDetail.textsInPeriod")}
                </CardTitle>
                <CardDescription className="text-[10px]">{t("monitoringDetail.createdVsOptimized")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col justify-center h-[100px]">
                <div className="flex justify-between items-end border-b pb-2">
                  <span className="text-sm text-muted-foreground">{t("monitoringDetail.created")}:</span>
                  <span className="text-xl font-bold text-primary">0</span>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <span className="text-sm text-muted-foreground">{t("monitoringDetail.optimized")}:</span>
                  <span className="text-xl font-bold text-primary">0</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {t("monitoringDetail.stabilityIndex")}
                </CardTitle>
                <CardDescription className="text-[10px]">{t("monitoringDetail.avgOptimizationsToPeak")}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-[100px]">
                <div className="text-3xl font-bold text-primary">0.0</div>
                <span className="ml-2 text-sm text-muted-foreground">{t("monitoringDetail.cycles")}</span>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Time-to-Performance
                </CardTitle>
                  <CardDescription className="text-[10px]">{t("monitoringDetail.avgDaysToLift")}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-[100px]">
                <div className="text-3xl font-bold text-primary">0</div>
                <span className="ml-2 text-sm text-muted-foreground">{t("monitoring.days")}</span>
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
                                {item.lastAction === "Erstellung" ? tr("Erstellung", "Creation") : item.lastAction === "Optimierung" ? tr("Optimierung", "Optimization") : item.lastAction}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    {filteredUrls.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          {searchTerm ? (
                            <span className="text-muted-foreground">{t("monitoring.noUrlsFound")}</span>
                          ) : (
                            <div className="flex flex-col items-center gap-3">
                              <Map className="h-8 w-8 text-primary/30" />
                              <p className="text-sm font-medium text-primary">{t("onboarding.keywordMapRequired")}</p>
                              <p className="text-xs text-muted-foreground max-w-xs">{t("onboarding.keywordMapRequiredDesc")}</p>
                              <Link href="/planning?tab=keyword-map" className="text-xs text-primary underline hover:no-underline font-medium">
                                {t("onboarding.goToKeywordMap")}
                              </Link>
                            </div>
                          )}
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

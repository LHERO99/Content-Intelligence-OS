'use client';

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { KeywordTable } from "./keyword-table";
import { SuggestionsTable } from "./suggestions-table";
import { EditorialPlanning } from "./editorial-planning";
import { Blacklist } from "./blacklist";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map, Calendar, ShieldAlert, Loader2, Sparkles } from "lucide-react";
import { AddEntryFab } from "./add-entry-fab";
import { KeywordMap, PotentialTrend } from "@/lib/postgres-types";
import { useI18n } from "@/i18n/use-i18n";

export default function PlanningPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlTab = searchParams?.get('tab');
      if (urlTab) {
        localStorage.setItem('planning-active-tab', urlTab);
        return urlTab;
      }
      return localStorage.getItem('planning-active-tab') || "keyword-map";
    }
    return "keyword-map";
  });
  const [data, setData] = useState<{ keywords: KeywordMap[], trends: PotentialTrend[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [kwRes, trendRes] = await Promise.all([
        fetch('/api/planning/keywords', { cache: 'no-store' }),
        fetch('/api/planning/trends', { cache: 'no-store' })
      ]);
      
      if (!kwRes.ok || !trendRes.ok) throw new Error(t("planning.dataLoadError"));
      
      const keywords = await kwRes.json();
      const trends = await trendRes.json();
      
      setData({ keywords, trends });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const tParam = searchParams?.get('t');
  const tabParam = searchParams?.get('tab');

  useEffect(() => {
    fetchData();
  }, [tParam]);

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
      localStorage.setItem('planning-active-tab', tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    const handleRefresh = () => fetchData();
    window.addEventListener('refresh-planning-data', handleRefresh);
    return () => window.removeEventListener('refresh-planning-data', handleRefresh);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-red-800 text-xl font-bold mb-2">{t("planning.airtableConnectionError")}</h1>
          <p className="text-red-700 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8 relative">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary">{t("planning.title")}</h1>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
          localStorage.setItem('planning-active-tab', val);
        }}
        className="space-y-4"
      >
        <TabsList className="bg-primary/10 border-primary/10">
          <TabsTrigger value="keyword-map" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Map className="mr-2 h-4 w-4" />
            1. {t("planning.keywordMap")}
          </TabsTrigger>

          <TabsTrigger value="suggestions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Sparkles className="mr-2 h-4 w-4" />
            2. {t("planning.suggestions")}
          </TabsTrigger>

          <TabsTrigger value="editorial" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Calendar className="mr-2 h-4 w-4" />
            3. {t("planning.editorialPlanning")}
          </TabsTrigger>

          <TabsTrigger value="blacklist" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ShieldAlert className="mr-2 h-4 w-4" />
            {t("planning.tabBlacklist")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keyword-map" className="space-y-4">
          <KeywordTable keywords={data.keywords} />
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          <SuggestionsTable keywords={data.keywords} refreshKey={tParam} onGoToKeywordMap={() => { setActiveTab('keyword-map'); localStorage.setItem('planning-active-tab', 'keyword-map'); }} />
        </TabsContent>

        <TabsContent value="editorial" className="space-y-4">
          <EditorialPlanning keywords={data.keywords} onGoToKeywordMap={() => { setActiveTab('keyword-map'); localStorage.setItem('planning-active-tab', 'keyword-map'); }} />
        </TabsContent>

        <TabsContent value="blacklist" className="space-y-4">
          <Blacklist hasKeywords={data.keywords.length > 0} onGoToKeywordMap={() => { setActiveTab('keyword-map'); localStorage.setItem('planning-active-tab', 'keyword-map'); }} />
        </TabsContent>
      </Tabs>

      <AddEntryFab activeTab={activeTab} />
    </div>
  );
}

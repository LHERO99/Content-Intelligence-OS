'use client';

import { useState, useEffect } from "react";
import { KeywordTable } from "./keyword-table";
import { TrendRadar } from "./trend-radar";
import { EditorialPlanning } from "./editorial-planning";
import { Blacklist } from "./blacklist";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radar, Map, Calendar, ShieldAlert, Loader2 } from "lucide-react";
import { AddEntryFab } from "./add-entry-fab";
import { KeywordMap, PotentialTrend } from "@/lib/airtable-types";

export default function PlanningPage() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('planning-active-tab') || "editorial";
    }
    return "editorial";
  });
  const [data, setData] = useState<{ keywords: KeywordMap[], trends: PotentialTrend[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [kwRes, trendRes] = await Promise.all([
        fetch('/api/planning/keywords'),
        fetch('/api/planning/trends')
      ]);
      
      if (!kwRes.ok || !trendRes.ok) throw new Error("Fehler beim Laden der Daten");
      
      const keywords = await kwRes.json();
      const trends = await trendRes.json();
      
      setData({ keywords, trends });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleRefresh = () => fetchData();
    window.addEventListener('refresh-planning-data', handleRefresh);
    return () => window.removeEventListener('refresh-planning-data', handleRefresh);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00463c]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-red-800 text-xl font-bold mb-2">Airtable Verbindungsfehler</h1>
          <p className="text-red-700 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8 relative">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-[#00463c]">Content-Planung</h1>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
          localStorage.setItem('planning-active-tab', val);
        }}
        className="space-y-4"
      >
        <TabsList className="bg-[#e7f3ee] border-[#00463c]/10">
          <TabsTrigger value="editorial" className="data-[state=active]:bg-[#00463c] data-[state=active]:text-white">
            <Calendar className="mr-2 h-4 w-4" />
            Redaktions-Planung
          </TabsTrigger>
          <TabsTrigger value="keyword-map" className="data-[state=active]:bg-[#00463c] data-[state=active]:text-white">
            <Map className="mr-2 h-4 w-4" />
            Keyword-Map
          </TabsTrigger>
          <TabsTrigger value="trend-radar" className="data-[state=active]:bg-[#00463c] data-[state=active]:text-white">
            <Radar className="mr-2 h-4 w-4" />
            Trend-Radar
          </TabsTrigger>
          <TabsTrigger value="blacklist" className="data-[state=active]:bg-[#00463c] data-[state=active]:text-white">
            <ShieldAlert className="mr-2 h-4 w-4" />
            Blacklist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editorial" className="space-y-4">
          <EditorialPlanning keywords={data.keywords} />
        </TabsContent>

        <TabsContent value="keyword-map" className="space-y-4">
          <KeywordTable keywords={data.keywords} />
        </TabsContent>

        <TabsContent value="trend-radar" className="space-y-4">
          <TrendRadar trends={data.trends} />
        </TabsContent>

        <TabsContent value="blacklist" className="space-y-4">
          <Blacklist />
        </TabsContent>
      </Tabs>

      <AddEntryFab activeTab={activeTab} />
    </div>
  );
}

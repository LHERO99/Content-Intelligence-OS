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
  Users
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAlerts } from "@/components/alerts-provider";
import { UrlDetail } from "./url-detail";
import { Checkbox } from "@/components/ui/checkbox";

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
  }>;
}

export default function MonitoringPage() {
  const { addAlert } = useAlerts();
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmitToSuggestions = async () => {
    if (selectedUrls.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/monitoring/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: selectedUrls }),
      });
      if (!res.ok) throw new Error("Fehler beim Einreichen");
      addAlert({ 
        type: "success", 
        message: `${selectedUrls.length} URLs wurden erfolgreich zur Content-Planung hinzugefügt.` 
      });
      setSelectedUrls([]);
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
        <Loader2 className="h-12 w-12 animate-spin text-[#00463c]" />
      </div>
    );
  }

  if (viewingUrl) {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => setViewingUrl(null)} 
          className="flex items-center gap-2 text-[#00463c]"
        >
          <ChevronLeft className="h-4 w-4" /> Zurück zur Übersicht
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-[#00463c] break-all">
            {viewingUrl}
          </h1>
        </div>
        <UrlDetail url={viewingUrl} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#00463c]">Content-Monitoring & ROI</h1>
          <p className="text-muted-foreground">Analysieren Sie Performance, Sichtbarkeit und Effizienz Ihrer Content-Maßnahmen.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchData} 
          className="border-[#00463c] text-[#00463c] hover:bg-[#00463c]/5"
        >
          <Loader2 className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Daten aktualisieren
        </Button>
      </div>

      {/* Global Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#00463c]" />
              Avg. Time to Rank
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#00463c]">{data?.metrics.avgTTR || 0} Tage</div>
            <p className="text-xs text-muted-foreground">Von Veröffentlichung bis Top 10 Ranking</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-[#00463c] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Eingesparte Agenturkosten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.metrics.totalAgencySavings.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </div>
            <p className="text-xs opacity-80">Gesamtvolumen durch KI-Workflow</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MousePointer2 className="h-4 w-4 text-[#00463c]" />
              Einsparung Overhead
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#00463c]">
              {data?.metrics.totalOverheadSavings.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </div>
            <p className="text-xs text-muted-foreground">Reduzierter interner Aufwand</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LayoutList className="h-4 w-4 text-[#00463c]" />
              Content-Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#00463c]">
              {(data?.metrics.counts.neuerstellung_ratgeber || 0) + (data?.metrics.counts.optimierung_ratgeber || 0) + (data?.metrics.counts.neuerstellung_kategorie || 0) + (data?.metrics.counts.optimierung_kategorie || 0)}
            </div>
            <div className="grid grid-cols-2 gap-x-2 text-[10px] mt-1 text-muted-foreground uppercase tracking-wider">
              <span>Ratgeber: { (data?.metrics.counts.neuerstellung_ratgeber || 0) + (data?.metrics.counts.optimierung_ratgeber || 0) }</span>
              <span>Kategorie: { (data?.metrics.counts.neuerstellung_kategorie || 0) + (data?.metrics.counts.optimierung_kategorie || 0) }</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>URL Performance Übersicht</CardTitle>
              <CardDescription>Liste aller überwachten URLs mit aktuellen Performance-Werten.</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="URL suchen..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-[250px] h-9"
                />
              </div>
              <Button 
                onClick={handleSubmitToSuggestions} 
                disabled={selectedUrls.length === 0 || submitting}
                className="h-9 bg-[#00463c] hover:bg-[#00332c]"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                Zur Optimierung ({selectedUrls.length})
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
                  <TableHead>URL</TableHead>
                  <TableHead>Klicks (Woche)</TableHead>
                  <TableHead>Sichtbarkeit (VI)</TableHead>
                  <TableHead>Letzte Aktion</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUrls.map((item) => (
                  <TableRow key={item.url} className="group hover:bg-[#00463c]/5">
                    <TableCell>
                      <Checkbox 
                        checked={selectedUrls.includes(item.url)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedUrls(prev => [...prev, item.url]);
                          else setSelectedUrls(prev => prev.filter(u => u !== item.url));
                        }}
                      />
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium truncate">{item.url}</span>
                        {item.lastActionDate && (
                          <span className="text-[10px] text-muted-foreground">
                            Update: {new Date(item.lastActionDate).toLocaleDateString('de-DE')}
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
                      <Badge variant={item.lastAction === "Erstellung" ? "default" : "secondary"}>
                        {item.lastAction}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setViewingUrl(item.url)}
                        className="text-[#00463c] hover:text-[#00463c] hover:bg-[#00463c]/10"
                      >
                        Details <ExternalLink className="h-3 w-3 ml-2" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUrls.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "Keine URLs gefunden, die Ihrer Suche entsprechen." : "Noch keine Monitoring-Daten vorhanden."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

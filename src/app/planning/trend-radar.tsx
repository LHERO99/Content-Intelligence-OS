"use client";

import { PotentialTrend } from "@/lib/airtable-types";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Ban, CheckCircle2, Loader2, Radar } from "lucide-react";
import { useState } from "react";
import { triggerN8nAction } from "@/lib/n8n";
import { toast } from "sonner";

interface TrendRadarProps {
  trends: PotentialTrend[];
}

export function TrendRadar({ trends }: TrendRadarProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (id: string, action: "CLAIM" | "BLACKLIST") => {
    setLoadingId(id);
    try {
      const n8nAction = action === "CLAIM" ? "CLAIM_TREND" : "BLACKLIST_TREND";
      const trend = trends.find(t => t.id === id);
      
      await triggerN8nAction(n8nAction, { 
        trendId: id,
        topic: trend?.Trend_Topic,
        source: trend?.Source
      });

      toast.success(`Trend ${action === "CLAIM" ? "claimed" : "blacklisted"} successfully!`);
    } catch (error: any) {
      console.error("Action failed", error);
      toast.error(error.message || "Failed to process trend action");
    } finally {
      setLoadingId(null);
    }
  };

  const newTrends = trends.filter((t) => t.Status === "New");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[#00463c]">
          <Radar className="h-6 w-6" />
          <h3 className="text-xl font-semibold">Trend-Radar</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Neue Potenziale, identifiziert durch GSC- und Sistrix-Gap-Analyse.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {newTrends.length > 0 ? (
          newTrends.map((trend) => (
            <Card key={trend.id} className="border-[#00463c]/10 hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-bold text-[#00463c]">
                    {trend.Trend_Topic}
                  </CardTitle>
                  <Badge variant="outline" className="bg-[#e7f3ee] text-[#00463c] border-[#00463c]/20">
                    {trend.Source}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span>Gap Score: <span className="font-bold text-foreground">{trend.Gap_Score || 0}</span></span>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1 bg-[#00463c] text-[#e7f3ee] hover:bg-[#00463c]/90"
                  onClick={() => handleAction(trend.id, "CLAIM")}
                  disabled={loadingId === trend.id}
                >
                  {loadingId === trend.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Claim
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => handleAction(trend.id, "BLACKLIST")}
                  disabled={loadingId === trend.id}
                >
                  {loadingId === trend.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Ban className="mr-2 h-4 w-4" />
                  )}
                  Blacklist
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg border-[#00463c]/10">
            No new trends found.
          </div>
        )}
      </div>
    </div>
  );
}

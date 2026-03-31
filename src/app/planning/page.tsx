import { getKeywordMap, getPotentialTrends } from "@/lib/airtable";
import { KeywordTable } from "./keyword-table";
import { TrendRadar } from "./trend-radar";
import { EditorialPlanning } from "./editorial-planning";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radar, Map, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  try {
    const [keywords, trends] = await Promise.all([
      getKeywordMap(),
      getPotentialTrends(),
    ]);

    return (
      <div className="flex-1 space-y-8 p-8 pt-6 bg-[#f8faf9]">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-[#00463c]">Content-Planung</h2>
        </div>

        <Tabs defaultValue="trend-radar" className="space-y-4">
          <TabsList className="bg-[#e7f3ee] border-[#00463c]/10">
            <TabsTrigger value="trend-radar" className="data-[state=active]:bg-[#00463c] data-[state=active]:text-white">
              <Radar className="mr-2 h-4 w-4" />
              Trend-Radar
            </TabsTrigger>
            <TabsTrigger value="keyword-map" className="data-[state=active]:bg-[#00463c] data-[state=active]:text-white">
              <Map className="mr-2 h-4 w-4" />
              Keyword-Map
            </TabsTrigger>
            <TabsTrigger value="editorial" className="data-[state=active]:bg-[#00463c] data-[state=active]:text-white">
              <Calendar className="mr-2 h-4 w-4" />
              Redaktions-Planung
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trend-radar" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#00463c]">
                <Radar className="h-6 w-6" />
                <h3 className="text-xl font-semibold">Trend-Radar</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Neue Potenziale, identifiziert durch GSC- und Sistrix-Gap-Analyse.
              </p>
              <TrendRadar trends={trends} />
            </div>
          </TabsContent>

          <TabsContent value="keyword-map" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#00463c]">
                <Map className="h-6 w-6" />
                <h3 className="text-xl font-semibold">Keyword-Map</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Strategische Verwaltung von Ziel-Keywords und deren aktuellem Status.
              </p>
              <KeywordTable data={keywords} />
            </div>
          </TabsContent>

          <TabsContent value="editorial" className="space-y-4">
            <EditorialPlanning keywords={keywords} />
          </TabsContent>
        </Tabs>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="flex-1 p-8 bg-[#f8faf9]">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-red-800 text-xl font-bold mb-2">Airtable Verbindungsfehler</h2>
          <p className="text-red-700 mb-4">{error.message}</p>
          <div className="text-sm text-red-600">
            <p><strong>Fehlerbehebung:</strong></p>
            <ul className="list-disc ml-5 mt-1">
              <li>Überprüfen Sie, ob <code>AIRTABLE_API_KEY</code> und <code>AIRTABLE_BASE_ID</code> korrekt in den Vercel-Umgebungsvariablen gesetzt sind.</li>
              <li>Stellen Sie sicher, dass das Personal Access Token die Berechtigungen <code>data.records:read</code> und <code>data.records:write</code> besitzt.</li>
              <li>Prüfen Sie, ob das Token Zugriff auf die spezifische Base <code>{process.env.AIRTABLE_BASE_ID}</code> hat.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
}

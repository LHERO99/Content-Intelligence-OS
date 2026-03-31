import { getKeywordMap, getPotentialTrends } from "@/lib/airtable";
import { KeywordTable } from "./keyword-table";
import { TrendRadar } from "./trend-radar";
import { Separator } from "@/components/ui/separator";
import { Radar, Map } from "lucide-react";

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
          <h2 className="text-3xl font-bold tracking-tight text-[#00463c]">Content Planning</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[#00463c]">
            <Radar className="h-6 w-6" />
            <h3 className="text-xl font-semibold">Trend Radar</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            New opportunities identified by GSC and Sistrix gap analysis.
          </p>
          <TrendRadar trends={trends} />
        </div>

        <Separator className="bg-[#00463c]/10" />

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[#00463c]">
            <Map className="h-6 w-6" />
            <h3 className="text-xl font-semibold">Keyword Map</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Strategic management of target keywords and their current status.
          </p>
          <KeywordTable data={keywords} />
        </div>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="flex-1 p-8 bg-[#f8faf9]">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-red-800 text-xl font-bold mb-2">Airtable Connection Error</h2>
          <p className="text-red-700 mb-4">{error.message}</p>
          <div className="text-sm text-red-600">
            <p><strong>Troubleshooting:</strong></p>
            <ul className="list-disc ml-5 mt-1">
              <li>Verify that <code>AIRTABLE_API_KEY</code> and <code>AIRTABLE_BASE_ID</code> are correctly set in Vercel environment variables.</li>
              <li>Ensure the Personal Access Token has <code>data.records:read</code> and <code>data.records:write</code> scopes.</li>
              <li>Check if the token has access to the specific base <code>{process.env.AIRTABLE_BASE_ID}</code>.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
}

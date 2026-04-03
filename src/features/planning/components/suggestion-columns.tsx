import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KeywordMap } from "@/lib/airtable-types";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, ExternalLink } from "lucide-react";
import { PlanningService } from "../services/planning-service";

const AddToEditorialButton = ({ row }: { row: any }) => {
  const [loading, setLoading] = React.useState(false);

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const isPublished = row.original.Status === "Published";
      await PlanningService.updateKeyword(row.original.id, { 
        Status: "Planned",
        Action_Type: isPublished ? "Optimierung" : "Erstellung"
      });
      window.dispatchEvent(new CustomEvent('refresh-planning-data'));
    } catch (error) {
      console.error("Failed to add to editorial:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center w-full">
      <Button 
        size="sm" 
        variant="outline" 
        className="h-7 text-xs gap-1 min-w-[110px] justify-center border-[#00463c] text-[#00463c] hover:bg-[#00463c] hover:text-white transition-colors"
        onClick={handleAdd}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Zap className="h-3 w-3 fill-current" />
        )}
        Hinzufügen
      </Button>
    </div>
  );
};

export const suggestionColumns: ColumnDef<KeywordMap>[] = [
  {
    accessorKey: "Keyword",
    header: "Keyword",
    cell: ({ row }) => <div className="font-medium">{row.getValue("Keyword")}</div>,
  },
  {
    accessorKey: "Action_Type",
    header: "Typ",
    cell: ({ row }) => {
      const type = row.getValue("Action_Type") as string || "Erstellung";
      return (
        <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50 font-medium">
          {type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "Ranking",
    header: "Ranking",
    cell: ({ row }) => {
      const val = row.getValue("Ranking") as number;
      return val ?? "-";
    },
  },
  {
    id: "Action",
    header: () => <div className="text-center w-full">Aktion</div>,
    enableColumnFilter: false,
    cell: ({ row }) => (
      <div className="flex justify-center w-full">
         <AddToEditorialButton row={row} />
      </div>
    ),
  },
  {
    accessorKey: "Priority_Score",
    header: "Prio",
    cell: ({ row }) => {
      const score = row.getValue("Priority_Score") as number;
      if (score === undefined || score === null) return "-";
      let color = "bg-slate-100 text-slate-700";
      if (score >= 70) color = "bg-red-100 text-red-700 border-red-200";
      else if (score >= 40) color = "bg-orange-100 text-orange-700 border-orange-200";
      else if (score > 0) color = "bg-green-100 text-green-700 border-green-200";
      return (
        <Badge variant="outline" className={`${color} font-bold`}>
          {score.toFixed(1)}
        </Badge>
      );
    },
  },
  {
    accessorKey: "Search_Volume",
    header: "Suchvolumen",
    cell: ({ row }) => {
      const val = row.getValue("Search_Volume") as number;
      return val ? val.toLocaleString("de-DE") : "-";
    },
  },
  {
    accessorKey: "Last_Published",
    header: "Letzte Änderung",
    cell: ({ row }) => {
      const date = row.getValue("Last_Published") as string;
      if (!date) return <span className="text-muted-foreground italic text-[10px]">Neu</span>;
      return (
        <span className="text-[10px] text-muted-foreground">
          {new Date(date).toLocaleDateString("de-DE")}
        </span>
      );
    },
  },
  {
    accessorKey: "Target_URL",
    header: "URL",
    cell: ({ row }) => {
      const url = row.getValue("Target_URL") as string;
      if (!url) return "-";
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[#00463c] hover:underline flex items-center gap-1 max-w-[200px] truncate"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          {url.replace(/^https?:\/\/(www\.)?/, '')}
        </a>
      );
    },
  },
];

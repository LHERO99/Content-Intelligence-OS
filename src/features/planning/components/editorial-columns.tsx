import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Calendar, User, ExternalLink, Zap, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { KeywordMap } from "@/lib/airtable-types";

export const editorialColumns: ColumnDef<KeywordMap>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center h-8">
        <Checkbox
          checked={
            (table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")) as any
          }
          onCheckedChange={(value: any) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value: any) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
    enableColumnFilter: false,
  },
  {
    accessorKey: "Keyword",
    header: "Keyword",
    cell: ({ row }) => <div className="font-medium">{row.getValue("Keyword")}</div>,
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
  {
    accessorKey: "Search_Volume",
    header: "Suchvolumen",
    cell: ({ row }) => {
      const vol = row.getValue("Search_Volume") as number;
      return vol ? vol.toLocaleString("de-DE") : "-";
    },
  },
  {
    accessorKey: "Difficulty",
    header: "Difficulty",
    cell: ({ row }) => {
      const diff = row.getValue("Difficulty") as number;
      return diff ?? "-";
    },
  },
  {
    accessorKey: "Ranking",
    header: "Ranking",
    cell: ({ row }) => row.getValue("Ranking") ?? "-",
  },
  {
    accessorKey: "Article_Count",
    header: "Produkt-Anzahl",
    cell: ({ row }) => row.getValue("Article_Count") ?? "-",
  },
  {
    accessorKey: "Avg_Product_Value",
    header: "Produkt-Value",
    cell: ({ row }) => {
      const val = row.getValue("Avg_Product_Value") as number;
      return val ? `${val.toFixed(2)}€` : "-";
    },
  },
  {
    accessorKey: "Status",
    header: "Status",
    cell: ({ row, table }) => {
      const id = (row.original as any).id;
      const meta = table.options.meta as any;
      const isCommissioning = meta?.isCommissioning === id;
      const isCommissioned = meta?.commissionedIds?.has(id);
      const currentStatus = row.original.Status;
      const isAlreadyInWorkflow = isCommissioned || 
                                 currentStatus === 'Beauftragt' || 
                                 currentStatus === 'In Arbeit' ||
                                 currentStatus === 'Angeliefert' ||
                                 currentStatus === 'Review' ||
                                 currentStatus === 'Optimierung' ||
                                 currentStatus === 'Published';

      return (
        <div className="flex items-center gap-2">
            {isAlreadyInWorkflow ? (
              <div className="flex justify-center w-full">
                <Badge variant="outline" className="text-green-600 border-green-600 font-bold bg-green-50/50">Beauftragt</Badge>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 min-w-[110px] justify-center border-[#00463c] text-[#00463c] hover:bg-[#00463c] hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  // Pre-log commissioning event if needed
                  try {
                    // We trigger the commission through the meta object which presumably calls an API
                    // The API update to status 'Beauftragt' should be preceded or followed by a log
                    // Looking at how handleCommissionContent works: it likely calls an API.
                    // We'll add the log entry in the UI side before calling or within the API if possible.
                    // However, 'Beauftragt' status isn't handled by the same transition logic in keywords/route.ts yet.
                  } catch (e) {}
                  meta?.handleCommissionContent(id);
                }}
                disabled={isCommissioning}
              >
                {isCommissioning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3 fill-current" />
                )}
                Beauftragen
              </Button>
            )}
        </div>
      );
    },
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
    accessorKey: "Editorial_Deadline",
    header: "Deadline",
    cell: ({ row }) => {
      const date = row.getValue("Editorial_Deadline") as string;
      if (!date) return "-";
      return (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {new Date(date).toLocaleDateString("de-DE")}
        </div>
      );
    },
  },
  {
    accessorKey: "Assigned_Editor",
    header: "Editor",
    cell: ({ row }) => {
      const editor = row.getValue("Assigned_Editor") as any[];
      return (
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          {editor && editor.length > 0 ? (typeof editor[0] === 'string' ? editor[0] : "Zugewiesen") : "Offen"}
        </div>
      );
    },
  },
  {
    accessorKey: "Policy",
    header: "Politik",
    cell: ({ row }) => {
      const policy = row.getValue("Policy") as number;
      if (policy === undefined || policy === null) return "-";
      return `${policy}%`;
    },
  },
  {
    accessorKey: "Priority_Score",
    header: "Priorität",
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
];

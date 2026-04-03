import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KeywordMap } from "@/lib/airtable-types";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Zap } from "lucide-react";
import { PlanningService } from "../services/planning-service";

const AddToEditorialButton = ({ row }: { row: any }) => {
  const [loading, setLoading] = React.useState(false);

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      // Set status to "Planned" to add it to the editorial plan
      await PlanningService.updateKeyword(row.original.id, { 
        Status: "Planned" 
      });
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

export const keywordColumns: ColumnDef<KeywordMap>[] = [
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
    header: "Target URL",
    cell: ({ row }) => {
      const url = row.getValue("Target_URL") as string;
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className="max-w-[200px] truncate text-muted-foreground text-xs">
                {url}
              </div>
            </TooltipTrigger>
            {url && (
              <TooltipContent className="max-w-md break-all">
                <p>{url}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    id: "Content-Plan",
    header: () => <div className="text-center w-full">Content-Plan</div>,
    enableColumnFilter: false,
    cell: ({ row }) => {
      const isMain = row.original.Main_Keyword === "Y";
      if (!isMain) return <div className="flex justify-center w-full">-</div>;

      const isInEditorial = (row.original.Editorial_Deadline || row.original.Status !== "Backlog") && row.original.Status !== "Backlog";
      
      if (isInEditorial) {
        return (
          <div className="flex justify-center w-full">
            <Badge variant="outline" className="text-green-600 border-green-600 font-bold bg-green-50/50">Hinzugefügt</Badge>
          </div>
        );
      }
      
      return (
        <div className="flex justify-center w-full">
           <AddToEditorialButton row={row} />
        </div>
      );
    },
  },
  {
    accessorKey: "Main_Keyword",
    header: "Main",
    cell: ({ row }) => (
      <Badge variant="outline" className={row.getValue("Main_Keyword") === "Y" ? "border-[#00463c] text-[#00463c] bg-[#00463c]/10" : "border-slate-200 text-slate-400 bg-slate-50"}>
        {row.getValue("Main_Keyword")}
      </Badge>
    ),
  },
  {
    accessorKey: "Search_Volume",
    header: "Volumen",
    cell: ({ row }) => {
      const val = row.getValue("Search_Volume") as number;
      return val ? val.toLocaleString("de-DE") : "-";
    },
  },
  {
    accessorKey: "Difficulty",
    header: "Diff.",
    cell: ({ row }) => row.getValue("Difficulty") ?? "-",
  },
  {
    accessorKey: "Search_Volume",
    header: "Volumen",
    cell: ({ row }) => {
      const val = row.getValue("Search_Volume") as number;
      return val ? val.toLocaleString("de-DE") : "-";
    },
  },
  {
    accessorKey: "Difficulty",
    header: "Diff.",
    cell: ({ row }) => row.getValue("Difficulty") ?? "-",
  },
  {
    accessorKey: "Article_Count",
    header: "Produkte",
    cell: ({ row }) => row.getValue("Article_Count") ?? "-",
  },
  {
    accessorKey: "Avg_Product_Value",
    header: "Ø Wert",
    cell: ({ row }) => {
      const val = row.getValue("Avg_Product_Value") as number;
      return val ? `${val.toFixed(2)}€` : "-";
    },
  },
];

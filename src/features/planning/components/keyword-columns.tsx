import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KeywordMap } from "@/lib/postgres-types";
import { textColumnFilterFn } from "./filter-utils";

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
    filterFn: textColumnFilterFn,
    cell: ({ row }) => <div className="font-medium">{row.getValue("Keyword")}</div>,
  },
  {
    accessorKey: "Target_URL",
    header: "Target URL",
    filterFn: textColumnFilterFn,
    size: 400,
    cell: ({ row }) => {
      const url = row.getValue("Target_URL") as string;
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className="max-w-[700px] truncate text-muted-foreground text-xs cursor-help text-left">
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
    accessorKey: "Main_Keyword",
    header: "Main",
    filterFn: textColumnFilterFn,
    size: 60,
    cell: ({ row }) => (
      <Badge variant="outline" className={row.getValue("Main_Keyword") === "Y" ? "border-primary text-primary bg-primary/10" : "border-slate-200 text-slate-400 bg-slate-50"}>
        {row.getValue("Main_Keyword")}
      </Badge>
    ),
  },
  {
    accessorKey: "Ranking",
    header: "Rank",
    size: 60,
    cell: ({ row }) => {
      const val = row.getValue("Ranking") as number;
      return val ?? "-";
    },
  },
  {
    accessorKey: "Search_Volume",
    header: "SV",
    size: 60,
    cell: ({ row }) => {
      const activeLocale = typeof document !== "undefined" ? document.documentElement.lang || "de-DE" : "de-DE";
      const val = row.getValue("Search_Volume") as number;
      return val ? val.toLocaleString(activeLocale) : "-";
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

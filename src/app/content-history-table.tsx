"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ContentLog } from "@/lib/airtable-types";
import { Loader2, History, ExternalLink, ArrowUpDown, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HistoryList } from "@/features/shared/components/HistoryList";

interface GroupedHistory {
  url: string;
  firstCreated: string;
  lastModified: string;
  logs: ContentLog[];
}

interface ContentHistoryTableProps {
  logs: ContentLog[];
  loading?: boolean;
}

export function ContentHistoryTable({ logs, loading }: ContentHistoryTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "lastModified", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [selectedGroup, setSelectedGroup] = React.useState<GroupedHistory | null>(null);

  const groupedData = React.useMemo(() => {
    const groups: Record<string, GroupedHistory> = {};
    const keywordToUrlMap: Record<string, string> = {};

    // First pass: Build a map of Keyword_ID to Target_URL where available
    logs.forEach(log => {
      if (log.Target_URL && log.Keyword_ID && log.Keyword_ID.length > 0) {
        log.Keyword_ID.forEach(id => {
          if (!keywordToUrlMap[id]) keywordToUrlMap[id] = log.Target_URL!;
        });
      }
    });
    
    logs.forEach((log) => {
      let url = log.Target_URL;
      
      // Attempt to recover URL if missing
      if (!url && log.Keyword_ID && log.Keyword_ID.length > 0) {
        // 1. Try Keyword-to-URL map
        for (const id of log.Keyword_ID) {
          if (keywordToUrlMap[id]) {
            url = keywordToUrlMap[id];
            break;
          }
        }
      }

      // 2. Try parsing Reasoning_Chain if still missing
      if (!url && log.Reasoning_Chain) {
        const urlMatch = log.Reasoning_Chain.match(/URL:\s*(https?:\/\/[^\n]+)/);
        if (urlMatch) {
          url = urlMatch[1];
        }
      }

      const finalUrl = url || "Keine URL";

      if (url === undefined || url === null) {
        console.log(`[DEBUG] Missing URL for log ID ${log.id}:`);
        console.log(`  Target_URL from log: ${log.Target_URL}`);
        console.log(`  Keyword_ID: ${log.Keyword_ID}`);
        console.log(`  Reasoning_Chain: ${log.Reasoning_Chain}`);
        const urlMatchDebug = log.Reasoning_Chain?.match(/URL:\s*(https?:\/\/[^\n]+)/);
        console.log(`  Reasoning_Chain match: ${urlMatchDebug ? urlMatchDebug[1] : 'No match'}`);
      }


      if (!groups[finalUrl]) {
        groups[finalUrl] = {
          url: finalUrl,
          firstCreated: log.Created_At,
          lastModified: log.Created_At,
          logs: [],
        };
      }
      
      groups[finalUrl].logs.push(log);
      
      if (new Date(log.Created_At) < new Date(groups[finalUrl].firstCreated)) {
        groups[finalUrl].firstCreated = log.Created_At;
      }
      if (new Date(log.Created_At) > new Date(groups[finalUrl].lastModified)) {
        groups[finalUrl].lastModified = log.Created_At;
      }
    });

    // Sort logs within each group chronologically (newest first)
    Object.values(groups).forEach(group => {
      group.logs.sort((a, b) => new Date(b.Created_At).getTime() - new Date(a.Created_At).getTime());
    });

    return Object.values(groups);
  }, [logs]);

  const columns: ColumnDef<GroupedHistory>[] = [
    {
      accessorKey: "url",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-[#00463c] font-bold p-0 hover:bg-transparent"
        >
          URL
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const url = row.getValue("url") as string;
        return (
          <div className="flex items-center gap-2 max-w-[400px]">
            <span className="font-medium truncate">{url}</span>
            {url !== "Keine URL" && (
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-[#00463c]"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "firstCreated",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-[#00463c] font-bold p-0 hover:bg-transparent"
        >
          Erstellt
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          {new Date(row.getValue("firstCreated")).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </div>
      ),
    },
    {
      accessorKey: "lastModified",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-[#00463c] font-bold p-0 hover:bg-transparent"
        >
          Zuletzt geändert
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap font-medium text-[#00463c]">
          {new Date(row.getValue("lastModified")).toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      ),
    },
    {
      id: "count",
      header: "Änderungen",
      cell: ({ row }) => (
        <Badge variant="secondary" className="bg-[#00463c]/10 text-[#00463c] border-[#00463c]/20">
          {row.original.logs.length}
        </Badge>
      ),
    },
  ];

  const table = useReactTable({
    data: groupedData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableMultiSort: false,
    enableSortingRemoval: false,
    state: {
      sorting,
      columnFilters,
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#00463c]/40" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/20 rounded-lg border border-dashed border-border">
        <History className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Keine Content-Historie gefunden</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nach URL filtern..."
            value={(table.getColumn("url")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("url")?.setFilterValue(event.target.value)
            }
            className="pl-10 h-10 border-[#00463c]/20 focus-visible:ring-[#00463c]"
          />
        </div>
        {columnFilters.length > 0 && (
          <Button 
            variant="ghost" 
            onClick={() => table.resetColumnFilters()}
            className="text-xs text-muted-foreground hover:text-[#00463c]"
          >
            Filter zurücksetzen
            <X className="ml-2 h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="rounded-md border border-[#00463c]/10 overflow-hidden">
        <Table>
          <TableHeader className="bg-[#00463c]/5">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedGroup(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Keine Ergebnisse.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedGroup} onOpenChange={(open) => !open && setSelectedGroup(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-6 pb-4 bg-[#00463c]/5 border-b border-[#00463c]/10">
            <div className="space-y-1">
              <DialogTitle className="text-[#00463c] font-bold text-xl flex items-center gap-2">
                URL-Historie
              </DialogTitle>
              <DialogDescription className="break-all font-mono text-xs">
                {selectedGroup?.url}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden p-6">
            {selectedGroup && (
              <HistoryList 
                history={selectedGroup.logs} 
                isLoading={false} 
              />
            )}
          </div>

          <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
            <Button variant="ghost" onClick={() => setSelectedGroup(null)}>
              Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

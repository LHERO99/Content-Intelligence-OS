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
import { Loader2, History, ExternalLink, ArrowUpDown, ChevronDown, Filter, X, Clock, FileText, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
    
    logs.forEach((log) => {
      const url = log.Target_URL || "Keine URL";
      if (!groups[url]) {
        groups[url] = {
          url,
          firstCreated: log.Created_At,
          lastModified: log.Created_At,
          logs: [],
        };
      }
      
      groups[url].logs.push(log);
      
      if (new Date(log.Created_At) < new Date(groups[url].firstCreated)) {
        groups[url].firstCreated = log.Created_At;
      }
      if (new Date(log.Created_At) > new Date(groups[url].lastModified)) {
        groups[url].lastModified = log.Created_At;
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
        <DialogContent className="sm:max-w-[800px] max-h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-6 pb-4 bg-[#00463c]/5 border-b border-[#00463c]/10">
            <div className="space-y-1">
              <DialogTitle className="text-[#00463c] font-bold text-xl flex items-center gap-2">
                Änderungs-Historie
              </DialogTitle>
              <DialogDescription className="break-all font-mono text-xs">
                {selectedGroup?.url}
              </DialogDescription>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              {selectedGroup?.logs.map((log, index) => (
                <div key={log.id} className="relative pl-8 pb-8 last:pb-0">
                  {/* Timeline Line */}
                  {index !== (selectedGroup.logs.length - 1) && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-[#00463c]/10" />
                  )}
                  
                  {/* Timeline Dot */}
                  <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-white border-2 border-[#00463c] flex items-center justify-center z-10 shadow-sm">
                    {log.Action_Type === 'Erstellung' ? (
                      <Zap className="h-3 w-3 text-[#00463c] fill-[#00463c]" />
                    ) : log.Action_Type === 'Planung' ? (
                      <Clock className="h-3 w-3 text-[#00463c]" />
                    ) : (
                      <FileText className="h-3 w-3 text-[#00463c]" />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[#00463c]">
                          {log.Diff_Summary || (log.Action_Type === 'Erstellung' ? 'Beauftragung / Erstellung' : 
                           log.Action_Type === 'Planung' ? 'Planung' : 'Optimierung')}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-[#00463c]/5 border-[#00463c]/10">
                          {log.Version || (log.Content_Body ? 'v2' : 'v1')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">
                          {new Date(log.Created_At).toLocaleString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    {log.Diff_Summary && !log.Diff_Summary.includes('n8n callback') && !log.Diff_Summary.includes('Beauftragung') && !log.Diff_Summary.includes('erstellt') && (
                      <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100 text-sm text-emerald-900 italic">
                        {log.Diff_Summary}
                      </div>
                    )}

                    {log.Content_Body ? (
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Content</p>
                        <div className="p-4 rounded-lg bg-muted/30 border border-border text-sm leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                          {log.Content_Body}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Kein Content-Body hinterlegt (nur Status-Änderung oder Beauftragung).</p>
                    )}

                    {log.Reasoning_Chain && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">KI-Reasoning</p>
                        <div className="p-4 rounded-lg bg-[#00463c]/5 border border-[#00463c]/10 text-sm italic text-[#00463c]/80 leading-relaxed">
                          {log.Reasoning_Chain}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

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

"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  HeaderContext,
  CellContext,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KeywordMap } from "@/lib/airtable-types";
import { KeywordImport } from "./keyword-import";
import { ManualKeywordEntry } from "./manual-keyword-entry";

export const columns: ColumnDef<KeywordMap>[] = [
  {
    accessorKey: "Keyword",
    header: ({ column }: HeaderContext<KeywordMap, unknown>) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Keyword
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }: CellContext<KeywordMap, unknown>) => <div className="font-medium">{row.getValue("Keyword")}</div>,
  },
  {
    accessorKey: "Target_URL",
    header: "Target URL",
    cell: ({ row }: CellContext<KeywordMap, unknown>) => (
      <div className="max-w-[200px] truncate text-muted-foreground">
        {(row.getValue("Target_URL") as string) || "-"}
      </div>
    ),
  },
  {
    accessorKey: "Search_Volume",
    header: ({ column }: HeaderContext<KeywordMap, unknown>) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Volume
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }: CellContext<KeywordMap, unknown>) => {
      const volume = parseFloat(row.getValue("Search_Volume") as string);
      return <div className="text-center">{!isNaN(volume) ? volume.toLocaleString() : "-"}</div>;
    },
  },
  {
    accessorKey: "Difficulty",
    header: "Difficulty",
    cell: ({ row }: CellContext<KeywordMap, unknown>) => {
      const difficulty = row.getValue("Difficulty") as number;
      return (
        <div className="flex items-center justify-center">
          <Badge variant={difficulty > 50 ? "destructive" : "secondary"}>
            {difficulty || "-"}
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "Status",
    header: "Status",
    cell: ({ row }: CellContext<KeywordMap, unknown>) => {
      const status = row.getValue("Status") as string;
      return (
        <Badge className="bg-[#00463c] text-[#e7f3ee] hover:bg-[#00463c]/90">
          {status}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }: CellContext<KeywordMap, unknown>) => {
      const keyword = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Menü öffnen</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(keyword.Keyword)}
            >
              Keyword kopieren
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Details anzeigen</DropdownMenuItem>
            <DropdownMenuItem>Status bearbeiten</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

interface KeywordTableProps {
  data: KeywordMap[];
}

export function KeywordTable({ data }: KeywordTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full space-y-6">
      <ManualKeywordEntry />
      
      <div className="flex items-center py-4">
        <Input
          placeholder="Keywords filtern..."
          value={(table.getColumn("Keyword")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("Keyword")?.setFilterValue(event.target.value)
          }
          className="max-w-sm border-[#00463c]/20 focus-visible:ring-[#00463c]"
        />
        <div className="ml-auto flex items-center gap-2">
          <KeywordImport />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" className="border-[#00463c]/20">
                  Spalten <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="rounded-md border border-[#00463c]/10">
        <Table>
          <TableHeader className="bg-[#e7f3ee]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="text-[#00463c] font-bold">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-[#e7f3ee]/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Keine Ergebnisse.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} von{" "}
          {table.getFilteredRowModel().rows.length} Zeile(n) ausgewählt.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border-[#00463c]/20"
          >
            Zurück
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border-[#00463c]/20"
          >
            Weiter
          </Button>
        </div>
      </div>
    </div>
  );
}

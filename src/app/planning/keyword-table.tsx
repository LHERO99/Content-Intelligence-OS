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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { KeywordMap, KeywordStatus } from "@/lib/airtable-types";
import { KeywordImport } from "./keyword-import";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Map, Check, X, Loader2, AlertCircle } from "lucide-react";
import { useAlerts } from "@/components/alerts-provider";

interface EditableCellProps {
  value: any;
  rowId: string;
  columnId: string;
  onSave: (value: any) => Promise<void>;
  type?: "text" | "number" | "select";
  options?: { label: string; value: string }[];
}

function EditableCell({
  value: initialValue,
  rowId,
  columnId,
  onSave,
  type = "text",
  options = [],
}: EditableCellProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [value, setValue] = React.useState(initialValue);
  const [loading, setLoading] = React.useState(false);

  const handleSave = async () => {
    if (value === initialValue) {
      setIsEditing(false);
      return;
    }
    setLoading(true);
    try {
      await onSave(value);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
      setValue(initialValue);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setValue(initialValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {type === "select" ? (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger className="h-8 min-w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            className="h-8 w-full min-w-[80px]"
            type={type}
            value={value ?? ""}
            onChange={(e) => setValue(type === "number" ? Number(e.target.value) : e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
        )}
        <Button size="icon-sm" variant="ghost" onClick={handleSave} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-green-600" />}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={handleCancel} disabled={loading}>
          <X className="h-3 w-3 text-red-600" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors min-h-[32px] flex items-center"
      onClick={() => setIsEditing(true)}
    >
      {type === "select" ? (
        <Badge className="bg-[#00463c] text-[#e7f3ee] hover:bg-[#00463c]/90">
          {initialValue}
        </Badge>
      ) : (
        <span>{type === "number" && initialValue !== undefined ? initialValue.toLocaleString() : (initialValue || "-")}</span>
      )}
    </div>
  );
}

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
    cell: ({ row, table }: CellContext<KeywordMap, unknown>) => (
      <EditableCell
        value={row.getValue("Keyword")}
        rowId={row.original.id}
        columnId="Keyword"
        onSave={(val) => (table.options.meta as any).updateData(row.original.id, { Keyword: val })}
      />
    ),
  },
  {
    accessorKey: "Target_URL",
    header: "Target URL",
    cell: ({ row, table }: CellContext<KeywordMap, unknown>) => (
      <EditableCell
        value={row.getValue("Target_URL")}
        rowId={row.original.id}
        columnId="Target_URL"
        onSave={(val) => (table.options.meta as any).updateData(row.original.id, { Target_URL: val })}
      />
    ),
  },
  {
    accessorKey: "Main_Keyword",
    header: "Main",
    cell: ({ row, table }: CellContext<KeywordMap, unknown>) => {
      const isMain = row.getValue("Main_Keyword") === "Y";
      return (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-auto"
            onClick={() => (table.options.meta as any).updateData(row.original.id, { Main_Keyword: isMain ? "N" : "Y" })}
          >
            <Badge variant={isMain ? "default" : "outline"} className={isMain ? "bg-[#00463c] text-white" : ""}>
              {isMain ? "Y" : "N"}
            </Badge>
          </Button>
        </div>
      );
    },
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
    cell: ({ row, table }: CellContext<KeywordMap, unknown>) => (
      <EditableCell
        value={row.getValue("Search_Volume")}
        rowId={row.original.id}
        columnId="Search_Volume"
        type="number"
        onSave={(val) => (table.options.meta as any).updateData(row.original.id, { Search_Volume: val })}
      />
    ),
  },
  {
    accessorKey: "Difficulty",
    header: "Difficulty",
    cell: ({ row, table }: CellContext<KeywordMap, unknown>) => (
      <EditableCell
        value={row.getValue("Difficulty")}
        rowId={row.original.id}
        columnId="Difficulty"
        type="number"
        onSave={(val) => (table.options.meta as any).updateData(row.original.id, { Difficulty: val })}
      />
    ),
  },
  {
    accessorKey: "Status",
    header: "Status",
    cell: ({ row, table }: CellContext<KeywordMap, unknown>) => (
      <EditableCell
        value={row.getValue("Status")}
        rowId={row.original.id}
        columnId="Status"
        type="select"
        options={[
          { label: "Backlog", value: "Backlog" },
          { label: "In Progress", value: "In Progress" },
          { label: "Review", value: "Review" },
          { label: "Done", value: "Done" },
        ]}
        onSave={(val) => (table.options.meta as any).updateData(row.original.id, { Status: val })}
      />
    ),
  },
  {
    accessorKey: "Article_Count",
    header: "Articles",
    cell: ({ row, table }: CellContext<KeywordMap, unknown>) => (
      <EditableCell
        value={row.getValue("Article_Count")}
        rowId={row.original.id}
        columnId="Article_Count"
        type="number"
        onSave={(val) => (table.options.meta as any).updateData(row.original.id, { Article_Count: val })}
      />
    ),
  },
  {
    accessorKey: "Avg_Product_Value",
    header: "Avg. Value",
    cell: ({ row, table }: CellContext<KeywordMap, unknown>) => (
      <EditableCell
        value={row.getValue("Avg_Product_Value")}
        rowId={row.original.id}
        columnId="Avg_Product_Value"
        type="number"
        onSave={(val) => (table.options.meta as any).updateData(row.original.id, { Avg_Product_Value: val })}
      />
    ),
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
  const { addAlert } = useAlerts();
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
    meta: {
      updateData: async (rowId: string, updates: any) => {
        try {
          const response = await fetch("/api/planning/keywords", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: rowId, ...updates }),
          });
          
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Update failed");
          }

          window.dispatchEvent(new CustomEvent("refresh-planning-data"));
        } catch (error: any) {
          console.error("Error updating keyword:", error);
          addAlert({
            message: "Fehler beim Aktualisieren",
            description: error.message,
            type: "error",
          });
          throw error;
        }
      },
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[#00463c]">
          <Map className="h-6 w-6" />
          <h3 className="text-xl font-semibold">Keyword-Map</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Strategische Verwaltung von Ziel-Keywords und deren aktuellem Status.
        </p>
      </div>

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

      <Card className="border-[#00463c]/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent border-[#00463c]/10">
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} className="text-[#00463c] font-bold whitespace-nowrap">
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
                      className="hover:bg-muted/50 border-[#00463c]/5"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="whitespace-nowrap">
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
        </CardContent>
      </Card>

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

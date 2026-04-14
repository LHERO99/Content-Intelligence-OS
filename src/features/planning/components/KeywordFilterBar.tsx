import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Filter,
  ChevronDown,
  Trash2,
  Loader2,
  ShieldAlert,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useAlerts } from "@/components/alerts-provider";
import { KeywordImport } from "./keyword-import";
import { BlacklistReasonModal } from "./blacklist-reason-modal";
import { PlanningService } from "../services/planning-service";
import { TextFilterOp, TextFilterValue } from "./filter-utils";

interface KeywordFilterBarProps {
  table: any;
  columns: ColumnDef<any>[];
  hideImport?: boolean;
}

export function KeywordFilterBar({ table, columns, hideImport = false }: KeywordFilterBarProps) {
  const [selectedColumn, setSelectedColumn] = React.useState<string>("");
  const [filterValue, setFilterValue] = React.useState<string>("");
  const [textFilterOp, setTextFilterOp] = React.useState<TextFilterOp>("contains");
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = React.useState(false);

  const columnFilters = table.getState().columnFilters;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const { addAlert } = useAlerts();

  const getAccessorKey = React.useCallback((columnId: string) => {
    const columnDef = columns.find((col) => (col.id || (col as any).accessorKey) === columnId) as any;
    if (!columnDef) return columnId;
    return columnDef.accessorKey || columnDef.id || columnId;
  }, [columns]);

  const isTextColumn = React.useCallback((columnId: string) => {
    if (!columnId) return false;
    const accessorKey = getAccessorKey(columnId);
    const values = table.getCoreRowModel().flatRows
      .map((row: any) => row.original?.[accessorKey])
      .filter((val: any) => val !== null && val !== undefined && val !== "");

    if (!values.length) return true;
    return values.some((val: any) => typeof val === "string" || Array.isArray(val));
  }, [getAccessorKey, table]);

  const isSelectedColumnText = React.useMemo(() => isTextColumn(selectedColumn), [isTextColumn, selectedColumn]);

  const addFilter = () => {
    if (!selectedColumn || !filterValue) return;
    if (isSelectedColumnText) {
      const payload: TextFilterValue = { type: "text", op: textFilterOp, value: filterValue };
      table.getColumn(selectedColumn)?.setFilterValue(payload);
    } else {
      table.getColumn(selectedColumn)?.setFilterValue(filterValue);
    }
    setSelectedColumn("");
    setFilterValue("");
    setTextFilterOp("contains");
  };

  const removeFilter = (columnId: string) => {
    table.getColumn(columnId)?.setFilterValue(undefined);
  };

  const bulkDelete = async (ids: string[]) => {
    try {
      setIsBulkDeleting(true);
      await PlanningService.deleteKeywords(ids, false);

      addAlert({
        message: `${ids.length} Keywords wurden erfolgreich gelöscht.`,
        type: "success",
      });
      table.resetRowSelection();
    } catch (error: any) {
      addAlert({
        title: "Fehler beim Bulk-Löschen",
        message: (error as Error).message,
        type: "error",
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const filterableColumns = columns.filter(
    (col) => col.id !== "select" && col.id !== "actions" && col.id !== "Content-Plan" && (col as any).accessorKey
  );

  const suggestions = React.useMemo(() => {
    if (!selectedColumn) return [];
    const accessorKey = getAccessorKey(selectedColumn);
    const allData = table.getCoreRowModel().flatRows.map((row: any) => row.original[accessorKey]);
    const uniqueValues = Array.from(new Set(allData))
      .filter((val) => val !== null && val !== undefined && val !== "")
      .sort();
    return uniqueValues;
  }, [getAccessorKey, selectedColumn, table]);

  return (
    <div className="flex flex-col gap-4 py-4 border-b border-primary/10">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-md border border-primary/10">
          <Select value={selectedColumn} onValueChange={(v) => {
            setSelectedColumn(v || "");
            setFilterValue("");
            setTextFilterOp("contains");
          }}>
            <SelectTrigger className="w-[160px] h-9 border-none bg-transparent focus:ring-0">
              <Filter className="h-4 w-4 mr-2 text-primary" />
              <SelectValue placeholder="Spalte" />
            </SelectTrigger>
            <SelectContent>
              {filterableColumns.map((col) => (
                <SelectItem key={col.id || (col as any).accessorKey} value={col.id || (col as any).accessorKey}>
                  {typeof col.header === "string" ? col.header : (col.id || (col as any).accessorKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="h-4 w-[1px] bg-primary/20 mx-1" />

          {isSelectedColumnText && selectedColumn ? (
            <>
              <Select value={textFilterOp} onValueChange={(v) => setTextFilterOp((v as TextFilterOp) || "contains")}>
                <SelectTrigger className="w-[130px] h-9 border-none bg-transparent focus:ring-0">
                  <SelectValue placeholder="Operator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">enthält</SelectItem>
                  <SelectItem value="equals">ist genau</SelectItem>
                </SelectContent>
              </Select>
              <div className="h-4 w-[1px] bg-primary/20 mx-1" />
              <Input
                placeholder="Text eingeben..."
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-[220px] h-9 border-none bg-transparent focus-visible:ring-0"
                onKeyDown={(e) => e.key === "Enter" && addFilter()}
              />
            </>
          ) : suggestions.length > 0 ? (
            <Select value={filterValue} onValueChange={(v) => setFilterValue(v || "") }>
              <SelectTrigger className="w-[200px] h-9 border-none bg-transparent focus:ring-0">
                <SelectValue placeholder="Wert wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Vorschläge</SelectLabel>
                  {suggestions.map((val: any) => (
                    <SelectItem key={String(val)} value={String(val)}>
                      {String(val)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="Filterwert..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="w-[200px] h-9 border-none bg-transparent focus-visible:ring-0"
              onKeyDown={(e) => e.key === "Enter" && addFilter()}
            />
          )}

          <Button
            onClick={addFilter}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-3 ml-1"
            disabled={!selectedColumn || !filterValue}
          >
            Anwenden
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {selectedRows.length > 0 && (
            <Popover>
              <PopoverTrigger>
                <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white h-10 px-4">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {selectedRows.length} löschen
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Möchten Sie {selectedRows.length} Einträge wirklich löschen?</p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                      disabled={isBulkDeleting}
                      onClick={() => bulkDelete(selectedRows.map((r: any) => r.original.id))}
                    >
                      {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ja, löschen"}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {selectedRows.length > 0 && (
            <>
              <Button
                variant="outline"
                className="border-orange-200 text-orange-700 hover:bg-orange-50 h-10 px-4"
                onClick={() => setIsBlacklistModalOpen(true)}
              >
                <ShieldAlert className="h-4 w-4 mr-2" />
                Blacklist
              </Button>
              <BlacklistReasonModal
                isOpen={isBlacklistModalOpen}
                onClose={() => setIsBlacklistModalOpen(false)}
                onSuccess={() => {
                  table.resetRowSelection();
                  window.dispatchEvent(new CustomEvent("refresh-planning-data"));
                }}
                keywords={selectedRows.map((r: any) => ({
                  id: r.original.id,
                  Keyword: r.original.Keyword,
                  Target_URL: r.original.Target_URL,
                  Main_Keyword: r.original.Main_Keyword,
                }))}
              />
            </>
          )}

          {!hideImport && <KeywordImport />}

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" className="border-primary/20 h-10 px-4 text-primary hover:bg-primary/10">
                Spalten <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-1">
              {table
                .getAllColumns()
                .filter((column: any) => column.getCanHide())
                .map((column: any) => {
                  const isVisible = column.getIsVisible();
                  return (
                    <DropdownMenuItem
                      key={column.id}
                      className="capitalize flex items-center justify-between gap-2"
                      onClick={() => column.toggleVisibility(!isVisible)}
                    >
                      <span>{column.id.replace(/_/g, " ")}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {isVisible ? "Sichtbar" : "Ausgeblendet"}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {columnFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-muted-foreground mr-1">Aktive Filter:</span>
          {columnFilters.map((filter: any) => {
            const column = columns.find((c) => (c.id || (c as any).accessorKey) === filter.id);
            const label = column ? (typeof column.header === "string" ? column.header : filter.id) : filter.id;
            const filterObj = filter.value && typeof filter.value === "object" ? filter.value : null;
            const valueLabel = filterObj?.type === "text"
              ? `${filterObj.op === "equals" ? "ist genau" : "enthält"}: ${filterObj.value}`
              : String(filter.value);
            return (
              <Badge key={filter.id} variant="secondary" className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary border-primary/20">
                <span className="font-semibold">{label}:</span> {valueLabel}
                <button
                  onClick={() => removeFilter(filter.id)}
                  className="ml-1 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters()}
            className="h-7 text-xs text-muted-foreground hover:text-primary"
          >
            Alle löschen
          </Button>
        </div>
      )}
    </div>
  );
}

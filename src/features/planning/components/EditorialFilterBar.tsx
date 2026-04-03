import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { 
  Filter, 
  ChevronDown, 
  Trash2, 
  Loader2, 
  Settings2, 
  X 
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useAlerts } from "@/components/alerts-provider";
import { PrioritizationSettingsModal } from "./prioritization-settings-modal";
import { PlanningService } from "../services/planning-service";

interface EditorialFilterBarProps {
  table: any;
  columns: ColumnDef<any>[];
}

export function EditorialFilterBar({ table, columns }: EditorialFilterBarProps) {
  const [selectedColumn, setSelectedColumn] = React.useState<string>("");
  const [filterValue, setFilterValue] = React.useState<string>("");
  const [isPrioritizationModalOpen, setIsPrioritizationModalOpen] = React.useState(false);

  const columnFilters = table.getState().columnFilters;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const { addAlert } = useAlerts();

  const addFilter = () => {
    if (!selectedColumn || !filterValue) return;
    table.getColumn(selectedColumn)?.setFilterValue(filterValue);
    setSelectedColumn("");
    setFilterValue("");
  };

  const removeFilter = (columnId: string) => {
    table.getColumn(columnId)?.setFilterValue(undefined);
  };

  const bulkDelete = async (ids: string[]) => {
    try {
      setIsBulkDeleting(true);
      await PlanningService.deleteKeywords(ids, true);

      addAlert({
        message: `${ids.length} Einträge wurden aus der Planung entfernt.`,
        type: "success",
      });
      table.resetRowSelection();
    } catch (error: any) {
      addAlert({
        title: "Fehler beim Entfernen",
        message: (error as Error).message,
        type: "error",
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const filterableColumns = columns.filter(
    (col) => col.id !== "select" && col.id !== "actions" && (col as any).accessorKey
  );

  const suggestions = React.useMemo(() => {
    if (!selectedColumn) return [];
    const allData = table.getCoreRowModel().flatRows.map((row: any) => row.original[selectedColumn]);
    const uniqueValues = Array.from(new Set(allData))
      .filter(val => val !== null && val !== undefined && val !== "")
      .sort();
    return uniqueValues;
  }, [selectedColumn, table]);

  return (
    <div className="flex flex-col gap-4 py-4 border-b border-[#00463c]/10">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-md border border-[#00463c]/10">
          <Select value={selectedColumn} onValueChange={(v) => {
            setSelectedColumn(v || "");
            setFilterValue("");
          }}>
            <SelectTrigger className="w-[160px] h-9 border-none bg-transparent focus:ring-0">
              <Filter className="h-4 w-4 mr-2 text-[#00463c]" />
              <SelectValue placeholder="Spalte" />
            </SelectTrigger>
            <SelectContent>
              {filterableColumns.map((col) => (
                <SelectItem key={col.id || (col as any).accessorKey} value={col.id || (col as any).accessorKey}>
                  {typeof col.header === 'string' ? col.header : (col.id || (col as any).accessorKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="h-4 w-[1px] bg-[#00463c]/20 mx-1" />

          {suggestions.length > 0 ? (
            <Select value={filterValue} onValueChange={(v) => setFilterValue(v || "")}>
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
            className="bg-[#00463c] hover:bg-[#00332c] h-8 px-3 ml-1"
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
          
          <Button 
            variant="outline" 
            className="border-[#00463c]/20 h-10 px-4 text-[#00463c] hover:bg-[#e7f3ee]"
            onClick={() => setIsPrioritizationModalOpen(true)}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Priorisierung
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" className="border-[#00463c]/20 h-10 px-4 text-[#00463c] hover:bg-[#e7f3ee]">
                Spalten <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column: any) => column.getCanHide())
                .map((column: any) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id.replace(/_/g, " ")}
                    </DropdownMenuCheckboxItem>
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
            const column = columns.find(c => (c.id || (c as any).accessorKey) === filter.id);
            const label = column ? (typeof column.header === 'string' ? column.header : filter.id) : filter.id;
            return (
              <Badge key={filter.id} variant="secondary" className="flex items-center gap-1 px-2 py-1 bg-[#00463c]/10 text-[#00463c] border-[#00463c]/20">
                <span className="font-semibold">{label}:</span> {filter.value}
                <button 
                  onClick={() => removeFilter(filter.id)}
                  className="ml-1 hover:bg-[#00463c]/20 rounded-full p-0.5 transition-colors"
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
            className="h-7 text-xs text-muted-foreground hover:text-[#00463c]"
          >
            Alle löschen
          </Button>
        </div>
      )}

      <PrioritizationSettingsModal 
        isOpen={isPrioritizationModalOpen}
        onClose={() => setIsPrioritizationModalOpen(false)}
        onWeightsUpdated={() => window.dispatchEvent(new CustomEvent("refresh-planning-data"))}
      />
    </div>
  );
}

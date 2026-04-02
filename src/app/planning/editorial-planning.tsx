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
  ColumnOrderState,
} from "@tanstack/react-table";
import { 
  ArrowUpDown, 
  ChevronDown, 
  Calendar, 
  User,
  Loader2, 
  Trash2,
  Filter,
  X,
  AlertCircle,
  GripVertical,
  Settings2,
  ExternalLink,
  BarChart3,
  Target,
  ShoppingBag,
  Euro,
  ShieldCheck
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PrioritizationSettingsModal } from "./prioritization-settings-modal";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
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
import { KeywordMap } from "@/lib/airtable-types";
import { calculatePriorityScore, PrioritizationWeights } from "@/lib/prioritization-utils";
import { Card, CardContent } from "@/components/ui/card";
import { useAlerts } from "@/components/alerts-provider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

// DND Kit Imports
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";

// --- Components ---

const DraggableTableHeader = ({ header }: { header: any }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: header.column.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.8 : 1,
    position: "relative",
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className="text-[#00463c] font-bold whitespace-nowrap pb-2"
    >
      <div className="flex items-center gap-2">
        {header.column.getCanSort() ? (
          <div
            className="-ml-3 h-8 text-[#00463c] font-bold flex items-center cursor-pointer hover:bg-accent/50 px-3 rounded-md transition-colors"
            onClick={header.column.getToggleSortingHandler()}
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
            {header.column.getIsSorted() === "asc" ? (
              <ChevronDown className="ml-2 h-4 w-4 rotate-180 shrink-0" />
            ) : header.column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 shrink-0" />
            )}
          </div>
        ) : (
          <div className="h-8 flex items-center">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </div>
        )}
        {header.column.id !== "select" && header.column.id !== "actions" && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </TableHead>
  );
};

interface FilterBarProps {
  table: any;
  columns: ColumnDef<any>[];
}

function FilterBar({ table, columns }: FilterBarProps) {
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
      const response = await fetch(`/api/planning/keywords?ids=${ids.join(',')}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || "Bulk delete failed");
      }

      addAlert({
        message: `${ids.length} Einträge wurden erfolgreich gelöscht.`,
        type: "success",
      });
      table.resetRowSelection();
      window.dispatchEvent(new CustomEvent("refresh-planning-data"));
    } catch (error: any) {
      addAlert({
        title: "Fehler beim Bulk-Löschen",
        message: error.message,
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

interface EditEditorialModalProps {
  keyword: KeywordMap | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: any) => Promise<void>;
}

function EditEditorialModal({ keyword, open, onOpenChange, onSave }: EditEditorialModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<Partial<KeywordMap>>({});

  React.useEffect(() => {
    if (keyword) {
      setFormData({
        Keyword: keyword.Keyword,
        Status: keyword.Status,
        Editorial_Deadline: keyword.Editorial_Deadline,
        Assigned_Editor: keyword.Assigned_Editor,
        Policy: keyword.Policy,
      });
    }
  }, [keyword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword) return;
    
    setError(null);
    setLoading(true);
    try {
      await onSave(keyword.id, formData);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  const MetricItem = ({ icon: Icon, label, value, subValue }: { icon: any, label: string, value: string | number | undefined, subValue?: string }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="mt-0.5 p-1.5 rounded-md bg-white border border-border shadow-sm">
        <Icon className="h-4 w-4 text-[#00463c]" />
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-semibold text-[#00463c]">{value ?? "-"}</p>
          {subValue && <span className="text-[10px] text-muted-foreground">{subValue}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden gap-0">
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 bg-[#00463c]/5 border-b border-[#00463c]/10">
            <div className="flex items-center justify-between pr-8">
              <div className="space-y-1">
                <DialogTitle className="text-[#00463c] font-bold text-2xl flex items-center gap-2">
                  {keyword?.Keyword}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  {keyword?.Target_URL ? (
                    <a 
                      href={keyword.Target_URL} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-[#00463c] hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {keyword.Target_URL}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Keine URL hinterlegt</span>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* SEO Metrics Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#00463c] uppercase tracking-widest flex items-center gap-2">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Metriken
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col items-center justify-center bg-[#00463c] text-white p-3 rounded-lg shadow-sm border border-[#00463c]/20">
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">Priority Score</p>
                    <span className="text-2xl font-black tabular-nums leading-none">
                      {keyword?.Priority_Score?.toFixed(1) || "0.0"}
                    </span>
                  </div>
                  <MetricItem 
                    icon={Target} 
                    label="Suchvolumen" 
                    value={keyword?.Search_Volume?.toLocaleString("de-DE")} 
                  />
                  <MetricItem 
                    icon={ShieldCheck} 
                    label="Difficulty" 
                    value={keyword?.Difficulty} 
                    subValue="/ 100"
                  />
                  <MetricItem 
                    icon={ShoppingBag} 
                    label="Produkt-Count" 
                    value={keyword?.Article_Count} 
                  />
                  <MetricItem 
                    icon={Euro} 
                    label="Ø Produktwert" 
                    value={keyword?.Avg_Product_Value ? `${keyword.Avg_Product_Value.toFixed(2)}€` : undefined} 
                  />
                </div>
              </div>

              <Separator className="bg-[#00463c]/10" />

              {/* Editable Fields Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#00463c] uppercase tracking-widest flex items-center gap-2">
                  <Settings2 className="h-3.5 w-3.5" />
                  Planungs-Details
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-status" className="text-xs font-bold">Status</Label>
                    <Select 
                      value={formData.Status} 
                      onValueChange={(v) => setFormData({ ...formData, Status: v as any })}
                    >
                      <SelectTrigger id="edit-status" className="h-10 border-[#00463c]/20 focus:ring-[#00463c]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Backlog">Backlog</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Review">Review</SelectItem>
                        <SelectItem value="Done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-deadline" className="text-xs font-bold">Deadline</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="edit-deadline"
                        type="date"
                        className="h-10 pl-10 border-[#00463c]/20 focus:ring-[#00463c]"
                        value={formData.Editorial_Deadline || ""}
                        onChange={(e) => setFormData({ ...formData, Editorial_Deadline: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-editor" className="text-xs font-bold">Editor</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="edit-editor"
                      placeholder="Editor Name..."
                      className="h-10 pl-10 border-[#00463c]/20 focus:ring-[#00463c]"
                      value={formData.Assigned_Editor?.[0] || ""}
                      onChange={(e) => setFormData({ ...formData, Assigned_Editor: e.target.value ? [e.target.value] : [] })}
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="edit-policy" className="text-xs font-bold">Politik / Strategie Relevanz</Label>
                    <Badge variant="secondary" className="bg-[#00463c]/10 text-[#00463c] font-bold">
                      {formData.Policy || 0}%
                    </Badge>
                  </div>
                  <Slider
                    id="edit-policy"
                    value={[formData.Policy || 0]}
                    onValueChange={(v: number | readonly number[]) => {
                      const val = Array.isArray(v) ? v[0] : v;
                      setFormData({ ...formData, Policy: val });
                    }}
                    max={100}
                    step={1}
                    className="py-2"
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    Beeinflusst den Prioritätsscore basierend auf strategischer Wichtigkeit.
                  </p>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Fehler</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-muted/30 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#00463c] hover:bg-[#00332c] min-w-[120px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Table Definition ---

export const columns: ColumnDef<KeywordMap>[] = [
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
    cell: ({ row }) => (
      <Badge variant="secondary">
        {row.getValue("Status")}
      </Badge>
    ),
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

interface EditorialPlanningProps {
  keywords: KeywordMap[];
}

export function EditorialPlanning({ keywords }: EditorialPlanningProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "Priority_Score", desc: true },
  ]);
  const { addAlert } = useAlerts();
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    Article_Count: false,
    Avg_Product_Value: false,
    Difficulty: false,
  });
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([]);

  const [editingKeyword, setEditingKeyword] = React.useState<KeywordMap | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [weights, setWeights] = React.useState<PrioritizationWeights | null>(null);

  // Fetch weights on mount
  React.useEffect(() => {
    const fetchWeights = async () => {
      try {
        const response = await fetch("/api/admin/config");
        if (!response.ok) return;
        const config = await response.json();
        
        const newWeights: PrioritizationWeights = {
          weight_search_volume: 20,
          weight_difficulty: 20,
          weight_article_count: 20,
          weight_avg_value: 20,
          weight_policy: 20,
        };
        
        config.forEach((item: { key: string; value: any }) => {
          if (item.key in newWeights) {
            newWeights[item.key as keyof PrioritizationWeights] = Number(item.value) || 0;
          }
        });
        setWeights(newWeights);
      } catch (error) {
        console.error("Error fetching weights in EditorialPlanning:", error);
      }
    };
    fetchWeights();
    
    // Listen for refresh events to re-fetch weights
    const handleRefresh = () => fetchWeights();
    window.addEventListener("refresh-planning-data", handleRefresh);
    return () => window.removeEventListener("refresh-planning-data", handleRefresh);
  }, []);

  const plannedKeywords = React.useMemo(() => {
    const filtered = keywords.filter(kw => kw.Editorial_Deadline || kw.Status !== "Backlog");
    
    if (!weights) return filtered;

    return filtered.map(kw => ({
      ...kw,
      Priority_Score: calculatePriorityScore(kw, weights)
    }));
  }, [keywords, weights]);

  const updateData = async (rowId: string, updates: any) => {
    try {
      const response = await fetch("/api/planning/keywords", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rowId, ...updates }),
      });
      
      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || "Update failed");
      }

      window.dispatchEvent(new CustomEvent("refresh-planning-data"));
    } catch (error: any) {
      addAlert({
        title: "Fehler beim Aktualisieren",
        message: error.message,
        type: "error",
      });
      throw error;
    }
  };

  const deleteData = async (id: string) => {
    try {
      const response = await fetch(`/api/planning/keywords?id=${id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || "Delete failed");
      }

      addAlert({
        message: "Eintrag wurde erfolgreich gelöscht.",
        type: "success",
      });
      window.dispatchEvent(new CustomEvent("refresh-planning-data"));
    } catch (error: any) {
      addAlert({
        title: "Fehler beim Löschen",
        message: error.message,
        type: "error",
      });
    }
  };

  // Load column order from localStorage on mount
  React.useEffect(() => {
    const savedOrder = localStorage.getItem("editorial-table-column-order");
    const defaultOrder = [
      "Keyword",
      "Status",
      "Editorial_Deadline",
      "Assigned_Editor",
      "Priority_Score",
      "Policy",
      "Search_Volume",
      "Target_URL",
    ];
    
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder) as string[];
        // Filter out any columns that no longer exist and add any new columns
        const existingColumns = parsedOrder.filter(id => defaultOrder.includes(id));
        const newColumns = defaultOrder.filter(id => !parsedOrder.includes(id));
        setColumnOrder([...existingColumns, ...newColumns]);
      } catch (e) {
        console.error("Failed to parse saved column order", e);
        setColumnOrder(defaultOrder);
      }
    } else {
      setColumnOrder(defaultOrder);
    }
  }, []);

  // Save column order to localStorage whenever it changes
  React.useEffect(() => {
    if (columnOrder.length > 0) {
      localStorage.setItem("editorial-table-column-order", JSON.stringify(columnOrder));
    }
  }, [columnOrder]);

  const table = useReactTable({
    data: plannedKeywords,
    columns,
    enableSortingRemoval: false,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    meta: {
      updateData,
      deleteData,
    },
    initialState: {
      sorting: [{ id: "Priority_Score", desc: true }],
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnOrder,
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((columnOrder) => {
        const oldIndex = columnOrder.indexOf(active.id as string);
        const newIndex = columnOrder.indexOf(over.id as string);
        return arrayMove(columnOrder, oldIndex, newIndex);
      });
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[#00463c]">
          <Calendar className="h-6 w-6" />
          <h3 className="text-xl font-semibold">Redaktions-Planung</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Übersicht der geplanten Inhalte und deren Redaktionsschluss.
        </p>
      </div>

      <FilterBar table={table} columns={columns} />

      <Card className="border-[#00463c]/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToHorizontalAxis]}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="hover:bg-transparent border-[#00463c]/10">
                      <SortableContext
                        items={columnOrder}
                        strategy={horizontalListSortingStrategy}
                      >
                        {headerGroup.headers.map((header) => (
                          <DraggableTableHeader key={header.id} header={header} />
                        ))}
                      </SortableContext>
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className="hover:bg-muted/50 border-[#00463c]/5 cursor-pointer"
                        onClick={() => {
                          setEditingKeyword(row.original);
                          setIsEditModalOpen(true);
                        }}
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
            </DndContext>
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

      <EditEditorialModal 
        keyword={editingKeyword}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSave={updateData}
      />
    </div>
  );
}

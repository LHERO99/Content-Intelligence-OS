'use client';

import * as React from 'react';
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
  ShieldAlert, 
  Loader2, 
  ArrowUpDown, 
  ChevronDown,
  AlertCircle,
  Trash2,
  Filter,
  X,
  GripVertical,
  RefreshCw,
  Eye,
  EyeOff,
  Calendar,
  Map
} from 'lucide-react';
import { BlacklistEntry } from '@/lib/postgres-types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useAlerts } from "@/components/alerts-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DateFilterOp, DateFilterValue, TextFilterOp, TextFilterValue, dateColumnFilterFn, textColumnFilterFn } from '@/features/planning/components/filter-utils';
import { useI18n } from "@/i18n/use-i18n";

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
      className="text-primary font-bold whitespace-nowrap pb-2"
    >
      <div className="flex items-center gap-2">
        {header.column.getCanSort() ? (
          <div
            className="-ml-3 h-8 text-primary font-bold flex items-center cursor-pointer hover:bg-accent/50 px-3 rounded-md transition-colors"
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

interface EditBlacklistModalProps {
  entry: BlacklistEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: any) => Promise<void>;
}

function EditBlacklistModal({ entry, open, onOpenChange, onSave }: EditBlacklistModalProps) {
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<Partial<BlacklistEntry>>({});

  React.useEffect(() => {
    if (entry) {
      setFormData({
        Keyword: entry.Keyword,
        Type: entry.Type,
        Reason: entry.Reason,
      });
    }
  }, [entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    
    setError(null);
    setLoading(true);
    try {
      await onSave(entry.id, formData);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || tr("Fehler beim Speichern", "Error saving"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-primary flex items-center gap-2 font-bold text-xl">
              {tr("Blacklist-Eintrag bearbeiten", "Edit Blacklist Entry")}
            </DialogTitle>
            <DialogDescription>
              {tr("Passe den Eintrag, den Typ oder den Grund für den Ausschluss an.", "Adjust the entry, type, or reason for exclusion.")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-keyword">{tr("Eintrag (Keyword/URL) *", "Entry (Keyword/URL) *")}</Label>
              <Input
                id="edit-keyword"
                value={formData.Keyword || ""}
                onChange={(e) => setFormData({ ...formData, Keyword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">{tr("Typ *", "Type *")}</Label>
              <Select 
                value={formData.Type || "Keyword"} 
                onValueChange={(v: any) => setFormData({ ...formData, Type: v })}
              >
                <SelectTrigger id="edit-type">
                  <SelectValue placeholder={tr("Typ wählen", "Select type")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Keyword">Keyword</SelectItem>
                  <SelectItem value="URL">URL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reason">{tr("Grund *", "Reason *")}</Label>
              <Input
                id="edit-reason"
                value={formData.Reason || ""}
                onChange={(e) => setFormData({ ...formData, Reason: e.target.value })}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{tr("Fehler", "Error")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {tr("Abbrechen", "Cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {tr("Speichern", "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface RestoreEntryModalProps {
  entry: BlacklistEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (entry: BlacklistEntry, formData: any) => Promise<void>;
}

function RestoreEntryModal({ entry, open, onOpenChange, onRestore }: RestoreEntryModalProps) {
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    Keyword: "",
    Target_URL: "",
    Search_Volume: "",
    Difficulty: "",
    Main_Keyword: "N" as "Y" | "N",
  });

  React.useEffect(() => {
    if (entry && open) {
      setFormData({
        Keyword: entry.Type === "Keyword" ? entry.Keyword : "",
        Target_URL: entry.Type === "URL" ? entry.Keyword : "",
        Search_Volume: "",
        Difficulty: "",
        Main_Keyword: "N",
      });
      setError(null);
    }
  }, [entry, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    if (!formData.Keyword || !formData.Target_URL || !formData.Main_Keyword) {
      setError(tr("Keyword, Target URL und Main Keyword sind Pflichtfelder.", "Keyword, Target URL and Main Keyword are required fields."));
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await onRestore(entry, formData);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || tr("Fehler bei der Wiederherstellung", "Error during restoration"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-primary flex items-center gap-2 font-bold text-xl">
              {tr("Eintrag wiederherstellen", "Restore Entry")}
            </DialogTitle>
            <DialogDescription>
              {tr("Verschiebe diesen Eintrag zurück in die Keyword-Map.", "Move this entry back to the Keyword Map.")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="restore-keyword">Keyword *</Label>
              <Input
                id="restore-keyword"
                value={formData.Keyword}
                onChange={(e) => setFormData({ ...formData, Keyword: e.target.value })}
                placeholder={tr("z.B. Vitamin C Serum", "e.g. Vitamin C Serum")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restore-url">Target URL *</Label>
              <Input
                id="restore-url"
                value={formData.Target_URL}
                onChange={(e) => setFormData({ ...formData, Target_URL: e.target.value })}
                placeholder={tr("z.B. /de-de/p/vitamin-c-serum", "e.g. /de-de/p/vitamin-c-serum")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restore-main">Main Keyword *</Label>
              <Select 
                value={formData.Main_Keyword} 
                onValueChange={(v: "Y" | "N" | null) => {
                  if (v) setFormData({ ...formData, Main_Keyword: v });
                }}
              >
                <SelectTrigger id="restore-main">
                  <SelectValue placeholder={tr("Main Keyword?", "Main Keyword?")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Y">{tr("Ja (Y)", "Yes (Y)")}</SelectItem>
                  <SelectItem value="N">{tr("Nein (N)", "No (N)")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="restore-sv">Search Volume</Label>
                <Input
                  id="restore-sv"
                  type="number"
                  value={formData.Search_Volume}
                  onChange={(e) => setFormData({ ...formData, Search_Volume: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restore-diff">Difficulty</Label>
                <Input
                  id="restore-diff"
                  type="number"
                  value={formData.Difficulty}
                  onChange={(e) => setFormData({ ...formData, Difficulty: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{tr("Fehler", "Error")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {tr("Abbrechen", "Cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {tr("Wiederherstellen", "Restore")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Filter Bar Component ---

interface FilterBarProps {
  table: any;
  columns: ColumnDef<any>[];
  onRestoreClick?: () => void;
}

function FilterBar({ table, columns, onRestoreClick }: FilterBarProps) {
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);
  const [selectedColumn, setSelectedColumn] = React.useState<string>("");
  const [filterValue, setFilterValue] = React.useState<string>("");
  const [textFilterOp, setTextFilterOp] = React.useState<TextFilterOp>("contains");
  const [dateFilterOp, setDateFilterOp] = React.useState<DateFilterOp>("on");

  const columnFilters = table.getState().columnFilters;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const { addAlert } = useAlerts();

  const getAccessorKey = React.useCallback((columnId: string) => {
    const columnDef = columns.find((col) => (col.id || (col as any).accessorKey) === columnId) as any;
    if (!columnDef) return columnId;
    return columnDef.accessorKey || columnDef.id || columnId;
  }, [columns]);

  const isDateColumn = React.useCallback((columnId: string) => {
    if (!columnId) return false;
    return getAccessorKey(columnId) === 'Added_At';
  }, [getAccessorKey]);

  const isTextColumn = React.useCallback((columnId: string) => {
    if (!columnId || isDateColumn(columnId)) return false;
    const accessorKey = getAccessorKey(columnId);
    const values = table.getCoreRowModel().flatRows
      .map((row: any) => row.original?.[accessorKey])
      .filter((val: any) => val !== null && val !== undefined && val !== "");

    if (!values.length) return true;
    return values.some((val: any) => typeof val === 'string' || Array.isArray(val));
  }, [getAccessorKey, isDateColumn, table]);

  const isSelectedDateColumn = React.useMemo(() => isDateColumn(selectedColumn), [isDateColumn, selectedColumn]);
  const isSelectedTextColumn = React.useMemo(() => isTextColumn(selectedColumn), [isTextColumn, selectedColumn]);

  const addFilter = () => {
    if (!selectedColumn || !filterValue) return;
    if (isSelectedDateColumn) {
      const payload: DateFilterValue = { type: 'date', op: dateFilterOp, value: filterValue };
      table.getColumn(selectedColumn)?.setFilterValue(payload);
    } else if (isSelectedTextColumn) {
      const payload: TextFilterValue = { type: 'text', op: textFilterOp, value: filterValue };
      table.getColumn(selectedColumn)?.setFilterValue(payload);
    } else {
      table.getColumn(selectedColumn)?.setFilterValue(filterValue);
    }
    setSelectedColumn("");
    setFilterValue("");
    setTextFilterOp('contains');
    setDateFilterOp('on');
  };

  const removeFilter = (columnId: string) => {
    table.getColumn(columnId)?.setFilterValue(undefined);
  };

  const bulkDelete = async (ids: string[]) => {
    try {
      setIsBulkDeleting(true);
      const response = await fetch(`/api/planning/blacklist?ids=${ids.join(',')}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || "Bulk delete failed");
      }

      addAlert({
        message: `${ids.length} ${tr("Einträge wurden erfolgreich gelöscht.", "entries were successfully deleted.")}`,
        type: "success",
      });
      table.resetRowSelection();
      window.dispatchEvent(new CustomEvent("refresh-blacklist-data"));
    } catch (error: any) {
      addAlert({
        title: tr("Fehler beim Bulk-Löschen", "Error during bulk delete"),
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
    if (isDateColumn(selectedColumn) || isTextColumn(selectedColumn)) return [];
    const accessorKey = getAccessorKey(selectedColumn);
    const allData = table.getCoreRowModel().flatRows.map((row: any) => row.original[accessorKey]);
    const uniqueValues = Array.from(new Set(allData))
      .filter(val => val !== null && val !== undefined && val !== "")
      .sort();
    return uniqueValues;
  }, [getAccessorKey, isDateColumn, isTextColumn, selectedColumn, table]);

  return (
    <div className="flex flex-col gap-4 py-4 border-b border-primary/10">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-md border border-primary/10">
          <Select value={selectedColumn} onValueChange={(v) => {
            setSelectedColumn(v || "");
            setFilterValue("");
            setTextFilterOp('contains');
            setDateFilterOp('on');
          }}>
            <SelectTrigger className="w-[160px] h-9 border-none bg-transparent focus:ring-0">
              <Filter className="h-4 w-4 mr-2 text-primary" />
              <SelectValue placeholder={tr("Spalte", "Column")} />
            </SelectTrigger>
            <SelectContent>
              {filterableColumns.map((col) => (
                <SelectItem key={col.id || (col as any).accessorKey} value={col.id || (col as any).accessorKey}>
                  {typeof col.header === 'string' ? col.header : (col.id || (col as any).accessorKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="h-4 w-[1px] bg-primary/20 mx-1" />

          {isSelectedDateColumn && selectedColumn ? (
            <>
              <Select value={dateFilterOp} onValueChange={(v) => setDateFilterOp((v as DateFilterOp) || 'on')}>
                <SelectTrigger className="w-[120px] h-9 border-none bg-transparent focus:ring-0">
                  <SelectValue placeholder={tr("Datum", "Date")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">{tr("ist am", "is on")}</SelectItem>
                  <SelectItem value="before">{tr("vor", "before")}</SelectItem>
                  <SelectItem value="after">{tr("nach", "after")}</SelectItem>
                </SelectContent>
              </Select>
              <div className="h-4 w-[1px] bg-primary/20 mx-1" />
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="w-[220px] h-9 border-none bg-transparent focus-visible:ring-0 pl-9"
                  onKeyDown={(e) => e.key === "Enter" && addFilter()}
                />
              </div>
            </>
          ) : isSelectedTextColumn && selectedColumn ? (
            <>
              <Select value={textFilterOp} onValueChange={(v) => setTextFilterOp((v as TextFilterOp) || 'contains')}>
                <SelectTrigger className="w-[130px] h-9 border-none bg-transparent focus:ring-0">
                  <SelectValue placeholder={tr("Operator", "Operator")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">{tr("enthält", "contains")}</SelectItem>
                  <SelectItem value="equals">{tr("ist genau", "is exactly")}</SelectItem>
                </SelectContent>
              </Select>
              <div className="h-4 w-[1px] bg-primary/20 mx-1" />
              <Input
                placeholder={tr("Text eingeben...", "Enter text...")}
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-[220px] h-9 border-none bg-transparent focus-visible:ring-0"
                onKeyDown={(e) => e.key === "Enter" && addFilter()}
              />
            </>
          ) : suggestions.length > 0 ? (
            <Select value={filterValue} onValueChange={(v) => setFilterValue(v || "")}>
              <SelectTrigger className="w-[200px] h-9 border-none bg-transparent focus:ring-0">
                <SelectValue placeholder={tr("Wert wählen...", "Select value...")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{tr("Vorschläge", "Suggestions")}</SelectLabel>
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
              placeholder={tr("Filterwert...", "Filter value...")}
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
            {tr("Anwenden", "Apply")}
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
                  <p className="text-sm font-medium">{tr("Möchtest du", "Do you want to delete")} {selectedRows.length} {tr("Einträge wirklich löschen?", "entries?")}</p>
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                      disabled={isBulkDeleting}
                      onClick={() => bulkDelete(selectedRows.map((r: any) => r.original.id))}
                    >
                      {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Ja, löschen", "Yes, delete")}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {selectedRows.length === 1 && (
            <Button variant="outline" className="border-primary/20 h-10 px-4 text-primary hover:bg-primary/10"
              onClick={onRestoreClick}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {tr("Wiederherstellen", "Restore")}
            </Button>
          )}
          
          <Popover>
            <PopoverTrigger>
              <Button variant="outline" className="border-primary/20 h-10 px-4 text-primary hover:bg-primary/10">
                {tr("Spalten", "Columns")} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1">
              <div className="space-y-1">
                {table
                  .getAllColumns()
                  .filter((column: any) => column.getCanHide())
                  .map((column: any) => {
                    const isVisible = column.getIsVisible();
                    return (
                      <button
                        key={column.id}
                        type="button"
                        className="w-full capitalize flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                        onClick={() => column.toggleVisibility(!isVisible)}
                      >
                        <span>{column.id.replace(/_/g, " ")}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          {isVisible ? tr("Sichtbar", "Visible") : tr("Ausgeblendet", "Hidden")}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {columnFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-muted-foreground mr-1">{tr("Aktive Filter:", "Active filters:")}</span>
          {columnFilters.map((filter: any) => {
            const column = columns.find(c => (c.id || (c as any).accessorKey) === filter.id);
            const label = column ? (typeof column.header === 'string' ? column.header : filter.id) : filter.id;
            const filterObj = filter.value && typeof filter.value === 'object' ? filter.value : null;
            let valueLabel = String(filter.value);
            if (filterObj?.type === 'text') {
              valueLabel = `${filterObj.op === 'equals' ? tr('ist genau', 'is exactly') : tr('enthält', 'contains')}: ${filterObj.value}`;
            }
            if (filterObj?.type === 'date') {
              const dateLabel = filterObj.op === 'before' ? tr('vor', 'before') : filterObj.op === 'after' ? tr('nach', 'after') : tr('ist am', 'is on');
              valueLabel = `${dateLabel}: ${filterObj.value}`;
            }
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
            {tr("Alle löschen", "Clear all")}
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Table Columns ---

function buildColumns(tr: (de: string, en: string) => string): ColumnDef<BlacklistEntry>[] {
  return [
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
    header: tr("Eintrag", "Entry"),
    filterFn: textColumnFilterFn,
    cell: ({ row }) => <div className="font-medium">{row.getValue("Keyword")}</div>,
  },
  {
    accessorKey: "Type",
    header: tr("Typ", "Type"),
    filterFn: textColumnFilterFn,
    cell: ({ row }) => {
      const type = row.getValue("Type") as string;
      return (
        <Badge variant={type === 'URL' ? 'outline' : 'secondary'} className={type === 'URL' ? 'border-blue-200 text-blue-700 bg-blue-50' : ''}>
          {type || 'Keyword'}
        </Badge>
      );
    },
  },
  {
    accessorKey: "Reason",
    header: tr("Grund", "Reason"),
    filterFn: textColumnFilterFn,
    cell: ({ row }) => <div>{row.getValue("Reason") || "-"}</div>,
  },
  {
    accessorKey: "Added_At",
    header: tr("Hinzugefügt am", "Added on"),
    filterFn: dateColumnFilterFn,
    cell: ({ row }) => {
      const date = row.getValue("Added_At") as string;
      const activeLocale = typeof document !== 'undefined' ? (document.documentElement.lang || 'de-DE') : 'de-DE';
      return <div>{date ? new Date(date).toLocaleDateString(activeLocale) : "-"}</div>;
    },
  },
];
}

// --- Main Component ---

export function Blacklist({ hasKeywords = true, onGoToKeywordMap }: { hasKeywords?: boolean; onGoToKeywordMap?: () => void }) {
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);
  const [data, setData] = React.useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { addAlert } = useAlerts();

  const columns = React.useMemo(() => buildColumns(tr), [locale]);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([]);

  const [editingEntry, setEditingEntry] = React.useState<BlacklistEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);

  const [restoringEntry, setRestoringEntry] = React.useState<BlacklistEntry | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = React.useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/planning/blacklist');
      if (!response.ok) throw new Error('Fehler beim Laden der Blacklist');
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
    
    const handleRefresh = () => fetchData();
    window.addEventListener("refresh-blacklist-data", handleRefresh);
    return () => window.removeEventListener("refresh-blacklist-data", handleRefresh);
  }, []);

  const updateData = async (id: string, updates: any) => {
    try {
      const response = await fetch("/api/planning/blacklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      
      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || "Update failed");
      }

      addAlert({
        message: tr("Eintrag wurde erfolgreich aktualisiert.", "Entry updated successfully."),
        type: "success",
      });
      fetchData();
    } catch (error: any) {
      addAlert({
        title: tr("Fehler beim Aktualisieren", "Error updating"),
        message: error.message,
        type: "error",
      });
      throw error;
    }
  };

  const deleteData = async (id: string) => {
    try {
      const response = await fetch(`/api/planning/blacklist?id=${id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || "Delete failed");
      }

      addAlert({
        message: tr("Eintrag wurde erfolgreich gelöscht.", "Entry deleted successfully."),
        type: "success",
      });
      fetchData();
    } catch (error: any) {
      addAlert({
        title: tr("Fehler beim Löschen", "Error deleting"),
        message: error.message,
        type: "error",
      });
    }
  };

  const restoreEntry = async (entry: BlacklistEntry, formData: any) => {
    try {
      // 1. Create in Keyword-Map
      // The API /api/planning/keywords already implements:
      // - Duplicate check (Keyword + Target_URL)
      // - SEO Rule: Only one 'Y' (Main Keyword) per URL
      // - SEO Rule: A Keyword can only be a 'Y' (Main Keyword) once globally
      const createResponse = await fetch("/api/planning/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!createResponse.ok) {
        const resData = await createResponse.json();
        // If it's a 409 Conflict or other validation error, the message from the API is displayed
        throw new Error(resData.error || "Fehler beim Erstellen des Keywords");
      }

      // 2. Delete from Blacklist
      const deleteResponse = await fetch(`/api/planning/blacklist?id=${entry.id}`, {
        method: "DELETE",
      });

      if (!deleteResponse.ok) {
        const resData = await deleteResponse.json();
        throw new Error(resData.error || "Fehler beim Löschen aus der Blacklist");
      }

      addAlert({
        message: tr("Eintrag wurde erfolgreich in die Keyword-Map wiederhergestellt.", "Entry successfully restored to the Keyword Map."),
        type: "success",
      });

      // 3. Log the restoration event
      try {
        const restoredKeyword = await createResponse.json();
        await fetch("/api/planning/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              keywordId: restoredKeyword.id,
              url: formData.Target_URL,
              Logged_URL: formData.Target_URL,
              Action_Type: restoredKeyword.Action_Type || 'Optimierung',
              Event_Label: `Eintrag wurde aus der Blacklist wiederhergestellt. Ursprünglicher Eintrag: ${entry.Keyword}`,
            }),
        });
      } catch (logErr) {
        console.error('[Blacklist] Error creating restoration log:', logErr);
      }

      // 4. Refresh data
      fetchData();
      table.resetRowSelection();
      
      // Trigger global refresh for planning data
      window.dispatchEvent(new CustomEvent("refresh-planning-data"));
    } catch (error: any) {
      // The error is caught here and re-thrown to be handled by the modal's handleSubmit
      throw error;
    }
  };

  // Load column order from localStorage on mount
  React.useEffect(() => {
    const savedOrder = localStorage.getItem("blacklist-table-column-order");
    const defaultOrder = columns.map((column) => column.id as string || (column as any).accessorKey as string);
    
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
      localStorage.setItem("blacklist-table-column-order", JSON.stringify(columnOrder));
    }
  }, [columnOrder]);

  const table = useReactTable({
    data,
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
        <div className="flex items-center gap-2 text-primary">
          <ShieldAlert className="h-6 w-6" />
          <h3 className="text-xl font-semibold">Blacklist</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {tr("Verwaltung von Keywords und URLs, die nicht für die Content-Erstellung berücksichtigt werden sollen.", "Management of keywords and URLs that should not be considered for content creation.")}
        </p>
      </div>

      {!hasKeywords ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 text-center">
          <Map className="h-12 w-12 text-primary/30" />
          <div>
            <p className="text-lg font-semibold text-primary">{tr("Starte mit der Keyword-Map", "Start with the Keyword Map")}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">{tr("Lege zuerst Keywords in der Keyword-Map an – alle anderen Bereiche bauen darauf auf.", "Add your keywords to the Keyword Map first – all other sections depend on this data.")}</p>
          </div>
          <Button onClick={onGoToKeywordMap}>{tr("Zur Keyword-Map", "Go to Keyword Map")}</Button>
        </div>
      ) : (
        <>
          <FilterBar 
            table={table} 
            columns={columns} 
            onRestoreClick={() => {
              const selectedRows = table.getFilteredSelectedRowModel().rows;
              if (selectedRows.length === 1) {
                setRestoringEntry(selectedRows[0].original);
                setIsRestoreModalOpen(true);
              }
            }}
          />

          <Card className="border-primary/10 overflow-hidden">
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
                        <TableRow key={headerGroup.id} className="hover:bg-transparent border-primary/10">
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
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={columns.length} className="h-24 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                          </TableCell>
                        </TableRow>
                      ) : table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            data-state={row.getIsSelected() && "selected"}
                            className="hover:bg-muted/50 border-primary/5 cursor-pointer"
                            onClick={() => {
                              setEditingEntry(row.original);
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
                            {tr("Keine Ergebnisse.", "No results.")}
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
              {table.getFilteredSelectedRowModel().rows.length} {tr("von", "of")}{" "}
              {table.getFilteredRowModel().rows.length} {tr("Zeile(n) ausgewählt.", "row(s) selected.")}
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="border-primary/20"
              >
                {tr("Zurück", "Previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="border-primary/20"
              >
                {tr("Weiter", "Next")}
              </Button>
            </div>
          </div>

          <EditBlacklistModal 
            entry={editingEntry}
            open={isEditModalOpen}
            onOpenChange={setIsEditModalOpen}
            onSave={updateData}
          />

          <RestoreEntryModal
            entry={restoringEntry}
            open={isRestoreModalOpen}
            onOpenChange={setIsRestoreModalOpen}
            onRestore={restoreEntry}
          />
        </>
      )}
    </div>
  );
}

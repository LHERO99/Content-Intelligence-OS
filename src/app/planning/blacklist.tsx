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
  GripVertical
} from 'lucide-react';
import { BlacklistEntry } from '@/lib/airtable-types';
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

interface EditBlacklistModalProps {
  entry: BlacklistEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: any) => Promise<void>;
}

function EditBlacklistModal({ entry, open, onOpenChange, onSave }: EditBlacklistModalProps) {
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
      setError(err.message || "Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-[#00463c] flex items-center gap-2 font-bold text-xl">
              Blacklist-Eintrag bearbeiten
            </DialogTitle>
            <DialogDescription>
              Passen Sie den Eintrag, den Typ oder den Grund für den Ausschluss an.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-keyword">Eintrag (Keyword/URL) *</Label>
              <Input
                id="edit-keyword"
                value={formData.Keyword || ""}
                onChange={(e) => setFormData({ ...formData, Keyword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Typ *</Label>
              <Select 
                value={formData.Type || "Keyword"} 
                onValueChange={(v: any) => setFormData({ ...formData, Type: v })}
              >
                <SelectTrigger id="edit-type">
                  <SelectValue placeholder="Typ wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Keyword">Keyword</SelectItem>
                  <SelectItem value="URL">URL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reason">Grund *</Label>
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
                <AlertTitle>Fehler</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#00463c] hover:bg-[#00332c]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Speichern
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
}

function FilterBar({ table, columns }: FilterBarProps) {
  const [selectedColumn, setSelectedColumn] = React.useState<string>("");
  const [filterValue, setFilterValue] = React.useState<string>("");

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
      const response = await fetch(`/api/planning/blacklist?ids=${ids.join(',')}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || "Bulk delete failed");
      }

      addAlert({
        message: `${ids.length} Einträge gelöscht`,
        type: "success",
      });
      table.resetRowSelection();
      window.dispatchEvent(new CustomEvent("refresh-blacklist-data"));
    } catch (error: any) {
      addAlert({
        message: "Fehler beim Bulk-Löschen",
        description: error.message,
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
    </div>
  );
}

// --- Table Columns ---

export const columns: ColumnDef<BlacklistEntry>[] = [
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
    header: "Eintrag",
    cell: ({ row }) => <div className="font-medium">{row.getValue("Keyword")}</div>,
  },
  {
    accessorKey: "Type",
    header: "Typ",
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
    header: "Grund",
    cell: ({ row }) => <div>{row.getValue("Reason") || "-"}</div>,
  },
  {
    accessorKey: "Added_At",
    header: "Hinzugefügt am",
    cell: ({ row }) => {
      const date = row.getValue("Added_At") as string;
      return <div>{date ? new Date(date).toLocaleDateString('de-DE') : "-"}</div>;
    },
  },
];

// --- Main Component ---

export function Blacklist() {
  const [data, setData] = React.useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { addAlert } = useAlerts();

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([]);

  const [editingEntry, setEditingEntry] = React.useState<BlacklistEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);

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
        message: "Erfolgreich aktualisiert",
        type: "success",
      });
      fetchData();
    } catch (error: any) {
      addAlert({
        message: "Fehler beim Aktualisieren",
        description: error.message,
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
        message: "Eintrag gelöscht",
        type: "success",
      });
      fetchData();
    } catch (error: any) {
      addAlert({
        message: "Fehler beim Löschen",
        description: error.message,
        type: "error",
      });
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
        <div className="flex items-center gap-2 text-[#00463c]">
          <ShieldAlert className="h-6 w-6" />
          <h3 className="text-xl font-semibold">Blacklist</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Verwaltung von Keywords und URLs, die nicht für die Content-Erstellung berücksichtigt werden sollen.
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
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#00463c]" />
                      </TableCell>
                    </TableRow>
                  ) : table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className="hover:bg-muted/50 border-[#00463c]/5 cursor-pointer"
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

      <EditBlacklistModal 
        entry={editingEntry}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSave={updateData}
      />
    </div>
  );
}

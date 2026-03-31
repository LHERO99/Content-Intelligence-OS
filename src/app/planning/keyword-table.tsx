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
  MoreHorizontal, 
  Search, 
  Map, 
  Loader2, 
  GripVertical,
  Plus,
  AlertCircle
} from "lucide-react";

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
import { KeywordMap } from "@/lib/airtable-types";
import { KeywordImport } from "./keyword-import";
import { Card, CardContent } from "@/components/ui/card";
import { useAlerts } from "@/components/alerts-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {header.column.getCanSort() ? (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-8 data-[state=open]:bg-accent text-[#00463c] font-bold"
              onClick={header.column.getToggleSortingHandler()}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            flexRender(header.column.columnDef.header, header.getContext())
          )}
          {header.column.id !== "select" && header.column.id !== "actions" && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
        {header.column.getCanFilter() ? (
          <div className="px-1">
            <Input
              placeholder="Filter..."
              value={(header.column.getFilterValue() as string) ?? ""}
              onChange={(event) => header.column.setFilterValue(event.target.value)}
              className="h-7 text-xs font-normal border-[#00463c]/10 focus-visible:ring-[#00463c]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <div className="h-7" /> // Spacer for alignment
        )}
      </div>
    </TableHead>
  );
};

interface EditKeywordModalProps {
  keyword: KeywordMap | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: any) => Promise<void>;
}

function EditKeywordModal({ keyword, open, onOpenChange, onSave }: EditKeywordModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Form states
  const [formData, setFormData] = React.useState<Partial<KeywordMap>>({});

  React.useEffect(() => {
    if (keyword) {
      setFormData({
        Keyword: keyword.Keyword,
        Target_URL: keyword.Target_URL,
        Search_Volume: keyword.Search_Volume,
        Difficulty: keyword.Difficulty,
        Main_Keyword: keyword.Main_Keyword,
        Status: keyword.Status,
        Article_Count: keyword.Article_Count,
        Avg_Product_Value: keyword.Avg_Product_Value,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-[#00463c] flex items-center gap-2 font-bold text-xl">
              Keyword bearbeiten
            </DialogTitle>
            <DialogDescription>
              Ändern Sie die Details für "{keyword?.Keyword}".
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-keyword">Keyword *</Label>
                <Input
                  id="edit-keyword"
                  value={formData.Keyword || ""}
                  onChange={(e) => setFormData({ ...formData, Keyword: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-url">Target URL *</Label>
                <Input
                  id="edit-url"
                  value={formData.Target_URL || ""}
                  onChange={(e) => setFormData({ ...formData, Target_URL: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-volume">Suchvolumen</Label>
                <Input
                  id="edit-volume"
                  type="number"
                  value={formData.Search_Volume ?? ""}
                  onChange={(e) => setFormData({ ...formData, Search_Volume: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-difficulty">Difficulty</Label>
                <Input
                  id="edit-difficulty"
                  type="number"
                  value={formData.Difficulty ?? ""}
                  onChange={(e) => setFormData({ ...formData, Difficulty: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-main">Main Keyword</Label>
                <Select 
                  value={formData.Main_Keyword} 
                  onValueChange={(v) => setFormData({ ...formData, Main_Keyword: v as 'Y' | 'N' })}
                >
                  <SelectTrigger id="edit-main">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Y">Ja (Y)</SelectItem>
                    <SelectItem value="N">Nein (N)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select 
                  value={formData.Status} 
                  onValueChange={(v) => setFormData({ ...formData, Status: v as any })}
                >
                  <SelectTrigger id="edit-status">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-articles">Produkt-Anzahl</Label>
                <Input
                  id="edit-articles"
                  type="number"
                  value={formData.Article_Count ?? ""}
                  onChange={(e) => setFormData({ ...formData, Article_Count: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-value">Avg. Value</Label>
                <Input
                  id="edit-value"
                  type="number"
                  step="0.01"
                  value={formData.Avg_Product_Value ?? ""}
                  onChange={(e) => setFormData({ ...formData, Avg_Product_Value: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
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

// --- Table Definition ---

export const columns: ColumnDef<KeywordMap>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex flex-col gap-2">
        <div className="flex items-center h-8">
          <Checkbox
            checked={
              (table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")) as any
            }
            onCheckedChange={(value: any) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        </div>
        <div className="h-7" />
      </div>
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value: any) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      />
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
    header: "Target URL",
    cell: ({ row }) => {
      const url = row.getValue("Target_URL") as string;
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className="max-w-[200px] truncate text-muted-foreground text-xs">
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
    id: "Content-Plan",
    header: () => (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center h-8">
          Content-Plan
        </div>
        <div className="h-7" />
      </div>
    ),
    enableColumnFilter: false,
    cell: ({ row, table }) => {
      const isMain = row.original.Main_Keyword === "Y";
      if (!isMain) return null;

      const isInEditorial = row.original.Editorial_Deadline || row.original.Status !== "Backlog";
      
      if (isInEditorial) {
        return (
          <div className="flex justify-center">
            <Badge variant="outline" className="text-green-600 border-green-600">Vorhanden</Badge>
          </div>
        );
      }

      return (
        <div className="flex justify-center">
          <Button 
            size="sm" 
            variant="outline" 
            className="h-7 text-xs border-[#00463c] text-[#00463c] hover:bg-[#00463c] hover:text-white"
            onClick={async (e: React.MouseEvent) => {
              e.stopPropagation();
              const today = new Date().toISOString().split('T')[0];
              await (table.options.meta as any).updateData(row.original.id, { 
                Editorial_Deadline: today,
                Status: "In Progress"
              });
            }}
          >
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
      );
    }
  },
  {
    accessorKey: "Main_Keyword",
    header: "Main",
    cell: ({ row }) => (
      <Badge className={row.getValue("Main_Keyword") === "Y" ? "bg-[#00463c] text-white" : "bg-muted text-muted-foreground"}>
        {row.getValue("Main_Keyword")}
      </Badge>
    ),
  },
  {
    accessorKey: "Search_Volume",
    header: "Volume",
    cell: ({ row }) => <div>{row.getValue<number>("Search_Volume")?.toLocaleString() || "-"}</div>,
  },
  {
    accessorKey: "Difficulty",
    header: "Difficulty",
    cell: ({ row }) => <div>{row.getValue("Difficulty") || "-"}</div>,
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
    accessorKey: "Article_Count",
    header: "Produkt-Anzahl",
    cell: ({ row }) => <div>{row.getValue("Article_Count") || "-"}</div>,
  },
  {
    accessorKey: "Avg_Product_Value",
    header: "Avg. Value",
    cell: ({ row }) => <div>{row.getValue<number>("Avg_Product_Value")?.toFixed(2) || "-"} €</div>,
  },
  {
    id: "actions",
    enableHiding: false,
    enableColumnFilter: false,
    header: () => (
      <div className="flex flex-col gap-2">
        <div className="h-8" />
        <div className="h-7" />
      </div>
    ),
    cell: ({ row }) => {
      const keyword = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <span className="sr-only">Menü öffnen</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(keyword.Keyword)}>
              Keyword kopieren
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Details anzeigen</DropdownMenuItem>
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
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(
    columns.map((column) => column.id as string || (column as any).accessorKey as string)
  );

  const [editingKeyword, setEditingKeyword] = React.useState<KeywordMap | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const updateData = async (rowId: string, updates: any) => {
    try {
      const response = await fetch("/api/planning/keywords", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rowId, ...updates }),
      });
      
      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || "Update failed");
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
  };

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
    onColumnOrderChange: setColumnOrder,
    meta: {
      updateData,
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnOrder,
    },
  });

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
          <Map className="h-6 w-6" />
          <h3 className="text-xl font-semibold">Keyword-Map</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Strategische Verwaltung von Ziel-Keywords und deren aktuellem Status.
        </p>
      </div>

      <div className="flex items-center py-4 gap-4">
        <div className="ml-auto flex items-center gap-2">
          <KeywordImport />
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" className="border-[#00463c]/20">
                Spalten <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
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
                      {column.id.replace(/_/g, " ")}
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

      <EditKeywordModal 
        keyword={editingKeyword}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSave={updateData}
      />
    </div>
  );
}

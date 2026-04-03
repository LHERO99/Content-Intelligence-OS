'use client';

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
  Map, 
  Loader2, 
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KeywordMap } from "@/lib/airtable-types";
import { Card, CardContent } from "@/components/ui/card";
import { useAlerts } from "@/components/alerts-provider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";

// Feature Imports
import { 
  EditKeywordModal, 
  KeywordFilterBar 
} from "@/features/planning/components";
import { DraggableTableHeader } from "@/features/shared/components/DraggableTableHeader";
import { PlanningService } from "@/features/planning/services/planning-service";

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
    header: () => <div className="text-center w-full">Content-Plan</div>,
    enableColumnFilter: false,
    cell: ({ row, table }) => {
      const isMain = row.original.Main_Keyword === "Y";
      if (!isMain) return <div className="flex justify-center w-full">-</div>;

      const isInEditorial = (row.original.Editorial_Deadline || row.original.Status !== "Backlog") && row.original.Status !== "Backlog";
      
      if (isInEditorial) {
        return (
          <div className="flex justify-center w-full">
            <Badge variant="outline" className="text-green-600 border-green-600 font-bold bg-green-50/50">Geplant</Badge>
          </div>
        );
      }
      
      return (
        <div className="flex justify-center w-full">
           <Badge variant="outline" className="text-muted-foreground border-muted-foreground bg-muted/10">Kein Plan</Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "Main_Keyword",
    header: "Main",
    cell: ({ row }) => (
      <Badge variant="outline" className={row.getValue("Main_Keyword") === "Y" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-400 bg-slate-50"}>
        {row.getValue("Main_Keyword")}
      </Badge>
    ),
  },
  {
    accessorKey: "Search_Volume",
    header: "Volumen",
    cell: ({ row }) => {
      const val = row.getValue("Search_Volume") as number;
      return val ? val.toLocaleString("de-DE") : "-";
    },
  },
  {
    accessorKey: "Difficulty",
    header: "Diff.",
    cell: ({ row }) => row.getValue("Difficulty") ?? "-",
  },
  {
    accessorKey: "Status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="outline" className="font-medium">
        {row.getValue("Status")}
      </Badge>
    ),
  },
  {
    accessorKey: "Action_Type",
    header: "Typ",
    cell: ({ row }) => row.getValue("Action_Type") || "Erstellung",
  },
  {
    accessorKey: "Article_Count",
    header: "Produkte",
    cell: ({ row }) => row.getValue("Article_Count") ?? "-",
  },
  {
    accessorKey: "Avg_Product_Value",
    header: "Ø Wert",
    cell: ({ row }) => {
      const val = row.getValue("Avg_Product_Value") as number;
      return val ? `${val.toFixed(2)}€` : "-";
    },
  },
];

interface KeywordTableProps {
  keywords: KeywordMap[];
}

export function KeywordTable({ keywords }: KeywordTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "Search_Volume", desc: true },
  ]);
  const { addAlert } = useAlerts();
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    Article_Count: false,
    Avg_Product_Value: false,
    Difficulty: false,
    Action_Type: false,
  });
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([]);
  const [editingKeyword, setEditingKeyword] = React.useState<KeywordMap | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);

  const updateData = async (id: string, updates: any) => {
    try {
      await PlanningService.updateKeyword(id, updates);

      addAlert({
        title: "Erfolg",
        message: "Eintrag wurde aktualisiert.",
        type: "success",
      });
    } catch (error) {
      addAlert({
        title: "Fehler",
        message: "Fehler beim Aktualisieren des Eintrags.",
        type: "error",
      });
      throw error;
    }
  };

  // Load column order from localStorage on mount
  React.useEffect(() => {
    const savedOrder = localStorage.getItem("keyword-table-column-order");
    const defaultOrder = [
      "select",
      "Keyword",
      "Content-Plan",
      "Main_Keyword",
      "Search_Volume",
      "Difficulty",
      "Status",
      "Action_Type",
      "Article_Count",
      "Avg_Product_Value",
      "Target_URL",
    ];
    
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder) as string[];
        const existingColumns = parsedOrder.filter(id => defaultOrder.includes(id));
        const newColumns = defaultOrder.filter(id => !parsedOrder.includes(id));
        
        let finalOrder = [...existingColumns, ...newColumns];
        if (finalOrder.includes("select")) {
          finalOrder = ["select", ...finalOrder.filter(id => id !== "select")];
        }
        setColumnOrder(finalOrder);
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
      localStorage.setItem("keyword-table-column-order", JSON.stringify(columnOrder));
    }
  }, [columnOrder]);

  const table = useReactTable({
    data: keywords,
    columns,
    enableSortingRemoval: false,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    initialState: {
      pagination: {
        pageSize: 10,
      },
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
          <Map className="h-6 w-6" />
          <h3 className="text-xl font-semibold">Keyword-Map</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Zentrales Repository aller Keywords und deren Performance-Metriken.
        </p>
      </div>

      <KeywordFilterBar table={table} columns={columns} />

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

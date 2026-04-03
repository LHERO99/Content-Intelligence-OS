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
  Calendar, 
  User,
  Loader2, 
  ExternalLink,
  Zap
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { triggerN8nAction } from "@/lib/n8n";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KeywordMap } from "@/lib/airtable-types";
import { useAlerts } from "@/components/alerts-provider";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

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
  EditEditorialModal, 
  EditorialFilterBar 
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
    cell: ({ row, table }) => {
      const id = (row.original as any).id;
      const meta = table.options.meta as any;
      const isCommissioning = meta?.isCommissioning === id;
      const isCommissioned = meta?.commissionedIds?.has(id);
      const currentStatus = row.original.Status;
      const isAlreadyInWorkflow = isCommissioned || 
                                 currentStatus === 'Beauftragt' || 
                                 (currentStatus === 'In Progress' && isCommissioned) || 
                                 currentStatus === 'In Arbeit' ||
                                 currentStatus === 'Erstellt' ||
                                 currentStatus === 'Review' ||
                                 currentStatus === 'Optimierung' ||
                                 currentStatus === 'Published';

      return (
        <div className="flex items-center gap-2">
            {isAlreadyInWorkflow ? (
              <div className="flex justify-center w-full">
                <Badge variant="outline" className="text-green-600 border-green-600 font-bold bg-green-50/50">Beauftragt</Badge>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 min-w-[110px] justify-center border-[#00463c] text-[#00463c] hover:bg-[#00463c] hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  meta?.handleCommissionContent(id);
                }}
                disabled={isCommissioning}
              >
                {isCommissioning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3 fill-current" />
                )}
                Beauftragen
              </Button>
            )}
        </div>
      );
    },
  },
  {
    accessorKey: "Action_Type",
    header: "Typ",
    cell: ({ row }) => {
      const type = row.getValue("Action_Type") as string || "Erstellung";
      return (
        <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50 font-medium">
          {type}
        </Badge>
      );
    },
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
  const [isCommissioning, setIsCommissioning] = React.useState<string | null>(null);
  const [commissionedIds, setCommissionedIds] = React.useState<Set<string>>(new Set());

  // Local filtered state for the table
  const plannedKeywords = React.useMemo(() => {
    return keywords.filter(k => k.Editorial_Deadline || (k.Status && k.Status !== 'Backlog'));
  }, [keywords]);

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

  const deleteData = async (id: string) => {
    try {
      await PlanningService.deleteKeywords([id], true);
      addAlert({
        title: "Erfolg",
        message: "Eintrag wurde aus der Planung entfernt.",
        type: "success",
      });
    } catch (error) {
      addAlert({
        title: "Fehler",
        message: "Fehler beim Entfernen des Eintrags.",
        type: "error",
      });
    }
  };

  const handleCommissionContent = async (id: string) => {
    try {
      setIsCommissioning(id);
      
      const keyword = keywords.find(k => k.id === id);

      // Trigger n8n Multi-Agent Workflow via internal proxy
      try {
        await triggerN8nAction('COMMISSION_CONTENT', {
          keywordId: id,
          keyword: keyword?.Keyword || '',
          targetUrl: keyword?.Target_URL || '',
        });
      } catch (n8nError) {
        console.error("Failed to trigger n8n workflow:", n8nError);
      }

      // Update local state immediately for instant UI feedback
      setCommissionedIds(prev => new Set([...Array.from(prev), id]));

      addAlert({
        title: "Erfolg",
        message: "Content beauftragt. In wenigen Minuten im Tab 'Content-Erstellung' einsehbar.",
        type: "success",
      });
      
      // Still refresh to get latest status from Airtable
      window.dispatchEvent(new CustomEvent("refresh-planning-data"));
    } catch (error) {
      addAlert({
        title: "Fehler",
        message: "Fehler beim Beauftragen des Contents.",
        type: "error",
      });
    } finally {
      setIsCommissioning(null);
    }
  };

  // Load column order from localStorage on mount
  React.useEffect(() => {
    const savedOrder = localStorage.getItem("editorial-table-column-order");
    const defaultOrder = [
      "select",
      "Keyword",
      "Priority_Score",
      "Status",
      "Action_Type",
      "Editorial_Deadline",
      "Assigned_Editor",
      "Article_Count",
      "Avg_Product_Value",
      "Difficulty",
      "Policy",
      "Search_Volume",
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
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    getPaginationRowModel: getPaginationRowModel(),
    meta: {
      updateData,
      deleteData,
      handleCommissionContent,
      isCommissioning,
      commissionedIds,
    },
    initialState: {
      sorting: [{ id: "Priority_Score", desc: true }],
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
          <Calendar className="h-6 w-6" />
          <h3 className="text-xl font-semibold">Redaktions-Planung</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Übersicht der geplanten Inhalte und deren Redaktionsschluss.
        </p>
      </div>

      <EditorialFilterBar table={table} columns={columns} />

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
        onCommission={handleCommissionContent}
        isCommissioning={!!isCommissioning}
        commissionedIds={commissionedIds}
      />
    </div>
  );
}

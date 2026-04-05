"use client";

import * as React from "react";
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnOrderState,
} from "@tanstack/react-table";
import { Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { triggerN8nAction } from "@/lib/n8n";
import { KeywordMap } from "@/lib/airtable-types";
import { useAlerts } from "@/components/alerts-provider";

// DND Kit Imports
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

// Feature Imports
import { 
  EditEditorialModal, 
  EditorialFilterBar,
  PlanningTable,
  PlanningHeader,
  editorialColumns as columns
} from "@/features/planning/components";
import { PlanningService } from "@/features/planning/services/planning-service";

interface EditorialPlanningProps {
  keywords: KeywordMap[];
}

export function EditorialPlanning({ keywords }: EditorialPlanningProps) {
  const { addAlert } = useAlerts();
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "Priority_Score", desc: true }]);
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

  const plannedKeywords = React.useMemo(() => {
    // Show active planning workflow, but exclude Backlog and Published
    return keywords.filter(k => k.Status && ['Planned', 'Beauftragt', 'In Arbeit', 'Angeliefert', 'Review', 'Optimierung'].includes(k.Status));
  }, [keywords]);

  const updateData = async (id: string, updates: any) => {
    try {
      await PlanningService.updateKeyword(id, updates);
      addAlert({ title: "Erfolg", message: "Eintrag wurde aktualisiert.", type: "success" });
    } catch (error) {
      addAlert({ title: "Fehler", message: "Fehler beim Aktualisieren.", type: "error" });
      throw error;
    }
  };

  const handleCommissionContent = async (id: string) => {
    try {
      setIsCommissioning(id);
      const keyword = keywords.find(k => k.id === id);

      await triggerN8nAction('COMMISSION_CONTENT', {
        keywordId: id,
        keyword: keyword?.Keyword || '',
        targetUrl: keyword?.Target_URL || '',
      });

      setCommissionedIds(prev => new Set([...Array.from(prev), id]));
      addAlert({ title: "Erfolg", message: "Content beauftragt.", type: "success" });
      PlanningService.refreshData();
    } catch (error) {
      addAlert({ title: "Fehler", message: "Fehler beim Beauftragen.", type: "error" });
    } finally {
      setIsCommissioning(null);
    }
  };

  React.useEffect(() => {
    const savedOrder = localStorage.getItem("editorial-table-column-order");
    const defaultOrder = ["select", "Keyword", "Priority_Score", "Status", "Action_Type", "Editorial_Deadline", "Assigned_Editor", "Article_Count", "Avg_Product_Value", "Difficulty", "Policy", "Search_Volume", "Target_URL"];
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder) as string[];
        const filteredOrder = parsedOrder.filter(id => defaultOrder.includes(id));
        setColumnOrder(["select", ...filteredOrder.filter(id => id !== "select")]);
      } catch (e) { setColumnOrder(defaultOrder); }
    } else { setColumnOrder(defaultOrder); }
  }, []);

  const table = useReactTable({
    data: plannedKeywords,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    getPaginationRowModel: getPaginationRowModel(),
    enableMultiSort: false,
    enableSortingRemoval: false,
    meta: { handleCommissionContent, isCommissioning, commissionedIds },
    initialState: { sorting: [{ id: "Priority_Score", desc: true }], pagination: { pageSize: 10 } },
    state: { sorting, columnFilters, columnVisibility, rowSelection, columnOrder },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        const newOrder = arrayMove(prev, oldIndex, newIndex);
        localStorage.setItem("editorial-table-column-order", JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };

  return (
    <div className="w-full space-y-6">
      <PlanningHeader 
        icon={Calendar} 
        title="Redaktions-Planung" 
        description="Übersicht der geplanten Inhalte und deren Redaktionsschluss." 
      />
      <EditorialFilterBar table={table} columns={columns} />
      <PlanningTable 
        table={table} 
        columnOrder={columnOrder} 
        sensors={sensors} 
        onDragEnd={handleDragEnd} 
        onRowClick={(keyword) => { setEditingKeyword(keyword); setIsEditModalOpen(true); }}
      />
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} von {table.getFilteredRowModel().rows.length} Zeile(n) ausgewählt.
        </div>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Zurück</Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Weiter</Button>
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

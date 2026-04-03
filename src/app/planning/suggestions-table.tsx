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
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  EditKeywordModal, 
  KeywordFilterBar,
  PlanningTable,
  PlanningHeader,
  suggestionColumns as columns
} from "@/features/planning/components";
import { PlanningService } from "@/features/planning/services/planning-service";

interface SuggestionsTableProps {
  keywords: KeywordMap[];
}

export function SuggestionsTable({ keywords }: SuggestionsTableProps) {
  const { addAlert } = useAlerts();
  
  // Filter for Main Keywords that are in Backlog or already Published (eligible for Optimization)
  const suggestionData = React.useMemo(() => {
    return keywords.filter(kw => 
      kw.Main_Keyword === 'Y' && 
      (kw.Status === 'Backlog' || kw.Status === 'Published')
    );
  }, [keywords]);

  const [sorting, setSorting] = React.useState<SortingState>([{ id: "Priority_Score", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    Article_Count: false,
    Difficulty: false,
  });
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([]);
  const [editingKeyword, setEditingKeyword] = React.useState<KeywordMap | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);

  const updateData = async (id: string, updates: any) => {
    try {
      await PlanningService.updateKeyword(id, updates);
      addAlert({ title: "Erfolg", message: "Eintrag wurde aktualisiert.", type: "success" });
    } catch (error) {
      addAlert({ title: "Fehler", message: "Fehler beim Aktualisieren.", type: "error" });
      throw error;
    }
  };

  React.useEffect(() => {
    const savedOrder = localStorage.getItem("suggestions-table-column-order");
    const defaultOrder = ["select", "Keyword", "Action", "Priority_Score", "Search_Volume", "Difficulty", "Article_Count", "Last_Published", "Target_URL"];
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder) as string[];
        const filteredOrder = parsedOrder.filter(id => defaultOrder.includes(id));
        setColumnOrder(["select", ...filteredOrder.filter(id => id !== "select")]);
      } catch (e) { setColumnOrder(defaultOrder); }
    } else { setColumnOrder(defaultOrder); }
  }, []);

  const table = useReactTable({
    data: suggestionData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    initialState: { pagination: { pageSize: 50 } },
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
        localStorage.setItem("suggestions-table-column-order", JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };

  return (
    <div className="w-full space-y-6">
      <PlanningHeader 
        icon={Sparkles} 
        title="Vorschläge" 
        description="Vorschläge für neue Inhalte oder zur Optimierung bestehender Inhalte basierend auf SEO-Metriken." 
      />
      <PlanningTable 
        table={table} 
        columnOrder={columnOrder} 
        sensors={sensors} 
        onDragEnd={handleDragEnd} 
        onRowClick={(keyword) => { setEditingKeyword(keyword); setIsEditModalOpen(true); }}
      />
      <div className="flex justify-between items-center py-4">
        <KeywordFilterBar table={table} columns={columns} />
        <div className="flex items-center space-x-2">
          <div className="text-sm text-muted-foreground mr-4">
            {table.getFilteredSelectedRowModel().rows.length} von {table.getFilteredRowModel().rows.length} Zeile(n) ausgewählt.
          </div>
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Zurück</Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Weiter</Button>
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

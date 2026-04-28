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
import { useI18n } from "@/i18n/use-i18n";

interface SuggestionsTableProps {
  keywords: KeywordMap[];
}

export function SuggestionsTable({ keywords }: SuggestionsTableProps) {
  const { t } = useI18n();
  const { addAlert } = useAlerts();
  const [optimizationSuggestions, setOptimizationSuggestions] = React.useState<Record<string, { reasons: string[]; reasonCodes: string[] }>>({});

  React.useEffect(() => {
    const loadOptimizationSuggestions = async () => {
      try {
        const res = await fetch('/api/planning/optimization-suggestions');
        if (!res.ok) return;
        const data = await res.json();
        const mapped: Record<string, { reasons: string[]; reasonCodes: string[] }> = {};
        for (const item of data.suggestions || []) {
          if (!item.keywordId) continue;
          mapped[item.keywordId] = {
            reasons: item.reasons || [],
            reasonCodes: item.reasonCodes || [],
          };
        }
        setOptimizationSuggestions(mapped);
      } catch {
        // fail silently in UI; core suggestions still work
      }
    };

    loadOptimizationSuggestions();
  }, []);

  // Filter for Main Keywords that are in Backlog
  const suggestionData = React.useMemo(() => {
    return keywords.filter(kw => 
      kw.Main_Keyword === 'Y' && 
      (kw.Status === 'Backlog' || !!optimizationSuggestions[kw.id])
    );
  }, [keywords, optimizationSuggestions]);

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
    const defaultOrder = ["select", "Keyword", "Action_Type", "Action", "Priority_Score", "Optimization_Reasons", "Search_Volume", "Difficulty", "Article_Count", "Last_Published", "Target_URL"];
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder) as string[];
        const filteredOrder = parsedOrder.filter(id => defaultOrder.includes(id));
        setColumnOrder(["select", ...filteredOrder.filter(id => id !== "select")]);
      } catch (e) { setColumnOrder(defaultOrder); }
    } else { setColumnOrder(defaultOrder); }
  }, []);

  React.useEffect(() => {
    if (columnOrder.length === 0) return;
    if (!columnOrder.includes("Optimization_Reasons")) {
      setColumnOrder((prev) => {
        const next = [...prev];
        const insertAt = Math.min(Math.max(next.indexOf("Priority_Score") + 1, 1), next.length);
        next.splice(insertAt, 0, "Optimization_Reasons");
        return next;
      });
    }
  }, [columnOrder]);

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
    enableMultiSort: false,
    enableSortingRemoval: false,
    initialState: { pagination: { pageSize: 50 } },
    state: { sorting, columnFilters, columnVisibility, rowSelection, columnOrder },
    meta: {
      optimizationReasons: Object.fromEntries(
        Object.entries(optimizationSuggestions).map(([id, value]) => [id, value.reasons])
      ),
    },
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
        title={t("planning.suggestions")} 
        description="Vorschläge für neue Inhalte oder zur Optimierung bestehender Inhalte basierend auf SEO-Metriken." 
      />
      <KeywordFilterBar table={table} columns={columns} hideImport={true} />
      <PlanningTable 
        table={table} 
        columnOrder={columnOrder} 
        sensors={sensors} 
        onDragEnd={handleDragEnd} 
        onRowClick={(keyword) => { setEditingKeyword(keyword); setIsEditModalOpen(true); }}
      />
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {t("planning.selectedRows")
            .replace("{selected}", String(table.getFilteredSelectedRowModel().rows.length))
            .replace("{total}", String(table.getFilteredRowModel().rows.length))}
        </div>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>{t("planning.previous")}</Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>{t("planning.next")}</Button>
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

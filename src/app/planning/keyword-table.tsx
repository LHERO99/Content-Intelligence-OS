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
import { Map } from "lucide-react";

import { Button } from "@/components/ui/button";
import { KeywordMap } from "@/lib/postgres-types";
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
  keywordColumns as columns
} from "@/features/planning/components";
import { PlanningService } from "@/features/planning/services/planning-service";
import { useI18n } from "@/i18n/use-i18n";
import { useTopicClusters } from "@/features/topic-map/hooks/use-topic-clusters";

interface KeywordTableProps {
  keywords: KeywordMap[];
}

const DEFAULT_COLUMN_ORDER = [
  "select",
  "Keyword",
  "Main_Keyword",
  "Search_Volume",
  "Difficulty",
  "Article_Count",
  "Avg_Product_Value",
  "Target_URL",
  "topicCluster",
];

export function KeywordTable({ keywords }: KeywordTableProps) {
  const { t } = useI18n();
  const { addAlert } = useAlerts();
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "Search_Volume", desc: true }]);
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

  // Local data state for optimistic updates
  const [data, setData] = React.useState<KeywordMap[]>(keywords);
  React.useEffect(() => {
    setData(keywords);
  }, [keywords]);

  // Topic clusters
  const { clusters, refresh: refreshClusters } = useTopicClusters();
  React.useEffect(() => {
    refreshClusters();
  }, [refreshClusters]);

  const updateData = async (id: string, updates: any) => {
    try {
      await PlanningService.updateKeyword(id, updates);
      addAlert({ title: "Erfolg", message: "Eintrag wurde aktualisiert.", type: "success" });
    } catch (error) {
      addAlert({ title: "Fehler", message: "Fehler beim Aktualisieren.", type: "error" });
      throw error;
    }
  };

  const handleClusterAssign = React.useCallback(async (keywordId: string, newClusterId: string | null) => {
    const row = data.find((d) => d.id === keywordId);
    if (!row) return;
    const urlId = row.urlId;
    if (!urlId) return;

    const oldClusterId = row.topicClusterId ?? null;
    if (oldClusterId === newClusterId) return;

    // Optimistic update — update all keywords sharing the same URL
    const newCluster = clusters.find((c) => c.id === newClusterId);
    setData((prev) =>
      prev.map((r) =>
        r.urlId === urlId
          ? {
              ...r,
              topicClusterId:    newClusterId,
              topicClusterName:  newCluster?.name ?? null,
              topicClusterColor: newCluster?.color ?? null,
            }
          : r,
      ),
    );

    try {
      if (oldClusterId) {
        await fetch(`/api/topic-clusters/${oldClusterId}/urls/${urlId}`, { method: "DELETE" });
      }
      if (newClusterId) {
        await fetch(`/api/topic-clusters/${newClusterId}/urls`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urlId }),
        });
      }
    } catch {
      // Rollback on error
      setData((prev) =>
        prev.map((r) =>
          r.urlId === urlId
            ? {
                ...r,
                topicClusterId:    oldClusterId,
                topicClusterName:  row.topicClusterName ?? null,
                topicClusterColor: row.topicClusterColor ?? null,
              }
            : r,
        ),
      );
      addAlert({ title: "Fehler", message: "Cluster-Zuweisung fehlgeschlagen.", type: "error" });
    }
  }, [data, clusters, addAlert]);

  React.useEffect(() => {
    const savedOrder = localStorage.getItem("keyword-table-column-order");
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder) as string[];
        const filteredOrder = parsedOrder.filter((id) => DEFAULT_COLUMN_ORDER.includes(id));
        // Append any newly added columns not present in the saved order
        const newColumns = DEFAULT_COLUMN_ORDER.filter(
          (id) => !parsedOrder.includes(id) && id !== "select",
        );
        setColumnOrder(["select", ...filteredOrder.filter((id) => id !== "select"), ...newColumns]);
      } catch (e) {
        setColumnOrder(DEFAULT_COLUMN_ORDER);
      }
    } else {
      setColumnOrder(DEFAULT_COLUMN_ORDER);
    }
  }, []);

  const table = useReactTable({
    data,
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
      clusters,
      onClusterAssign: (keywordId: string, newClusterId: string | null) => {
        handleClusterAssign(keywordId, newClusterId);
      },
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
        localStorage.setItem("keyword-table-column-order", JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };

  return (
    <div className="w-full space-y-6">
      <PlanningHeader
        icon={Map}
        title={t("planning.keywordMap")}
        description={t("planning.keywordMapDesc")}
      />
      <KeywordFilterBar table={table} columns={columns} />
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

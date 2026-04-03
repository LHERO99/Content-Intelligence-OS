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
  Map, 
  Loader2, 
  GripVertical,
  Plus,
  AlertCircle,
  Trash2,
  Filter,
  X,
  ShieldAlert,
  Calendar,
  ExternalLink
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
import { KeywordMap, ContentLog } from "@/lib/airtable-types";
import Link from "next/link";
import { KeywordImport } from "./keyword-import";
import { BlacklistReasonModal } from "./blacklist-reason-modal";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = React.useState(false);

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
        message: `${ids.length} Keywords wurden erfolgreich gelöscht.`,
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
    (col) => col.id !== "select" && col.id !== "actions" && col.id !== "Content-Plan" && (col as any).accessorKey
  );

  // Get unique values for the selected column
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

          {selectedRows.length > 0 && (
            <>
              <Button
                variant="outline"
                className="border-orange-200 text-orange-700 hover:bg-orange-50 h-10 px-4"
                onClick={() => setIsBlacklistModalOpen(true)}
              >
                <ShieldAlert className="h-4 w-4 mr-2" />
                Blacklist
              </Button>
              <BlacklistReasonModal
                isOpen={isBlacklistModalOpen}
                onClose={() => setIsBlacklistModalOpen(false)}
                onSuccess={() => {
                  table.resetRowSelection();
                  window.dispatchEvent(new CustomEvent("refresh-planning-data"));
                }}
                keywords={selectedRows.map((r: any) => ({
                  id: r.original.id,
                  Keyword: r.original.Keyword,
                  Target_URL: r.original.Target_URL
                }))}
              />
            </>
          )}
          
          <KeywordImport />
          
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

interface EditKeywordModalProps {
  keyword: KeywordMap | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: any) => Promise<void>;
}

function EditKeywordModal({ keyword, open, onOpenChange, onSave }: EditKeywordModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [isAddingToPlan, setIsAddingToPlan] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Form states
  const [formData, setFormData] = React.useState<Partial<KeywordMap>>({});
  const [history, setHistory] = React.useState<ContentLog[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  React.useEffect(() => {
    if (keyword) {
      setFormData({
        Keyword: keyword.Keyword,
        Target_URL: keyword.Target_URL,
        Search_Volume: keyword.Search_Volume,
        Difficulty: keyword.Difficulty,
        Main_Keyword: keyword.Main_Keyword,
        Status: keyword.Status,
        Action_Type: keyword.Action_Type || 'Erstellung',
        Article_Count: keyword.Article_Count,
        Avg_Product_Value: keyword.Avg_Product_Value,
        Editorial_Deadline: keyword.Editorial_Deadline,
      });

      // Fetch history
      const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
          const queryParam = keyword.Target_URL 
            ? `url=${encodeURIComponent(keyword.Target_URL)}` 
            : `keywordId=${keyword.id}`;
          const response = await fetch(`/api/planning/history?${queryParam}`);
          if (response.ok) {
            const data = await response.json();
            setHistory(data);
          }
        } catch (err) {
          console.error("Failed to fetch history:", err);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchHistory();
    } else {
      setHistory([]);
    }
  }, [keyword]);

  const handleAddToContentPlan = async () => {
    if (!keyword) return;
    setIsAddingToPlan(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const updates: Partial<KeywordMap> = {
        Editorial_Deadline: today,
        Status: "In Progress"
      };
      await onSave(keyword.id, updates);
      // Update local form state to reflect changes
      setFormData(prev => ({ ...prev, ...updates }));
    } catch (err: any) {
      setError(err.message || "Fehler beim Hinzufügen zum Content-Plan");
    } finally {
      setIsAddingToPlan(false);
    }
  };

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

  const handleOpenChange = (newOpen: boolean) => {
    // Only allow closing if it's not from an outside click or escape key
    // In many Dialog implementations, onOpenChange(false) is called for all close actions.
    // If we want to allow the "X" button but not outside click, we need to check the source.
    // However, with standard Shadcn/Radix, onOpenChange doesn't provide the event.
    onOpenChange(newOpen);
  };

  const closeDialog = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            {/* Row 1: Keyword and Main Keyword */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit-keyword">Keyword *</Label>
                <Input
                  id="edit-keyword"
                  value={formData.Keyword || ""}
                  onChange={(e) => setFormData({ ...formData, Keyword: e.target.value })}
                  required
                />
              </div>
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
            </div>

            {/* Row 2: Suchvolumen, Difficulty, Status, Typ */}
            <div className="grid grid-cols-4 gap-4">
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
                    <SelectItem value="Planned">Planned</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type">Typ</Label>
                <Select 
                  value={formData.Action_Type} 
                  onValueChange={(v) => setFormData({ ...formData, Action_Type: v as any })}
                >
                  <SelectTrigger id="edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Erstellung">Erstellung</SelectItem>
                    <SelectItem value="Optimierung">Optimierung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Target URL (Full width) */}
            <div className="space-y-2">
              <Label htmlFor="edit-url">Target URL *</Label>
              <Input
                id="edit-url"
                value={formData.Target_URL || ""}
                onChange={(e) => setFormData({ ...formData, Target_URL: e.target.value })}
                required
              />
            </div>

            {/* Row 4: Produkt-Count and Ø Produktwert */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-articles">Produkt-Count</Label>
                <Input
                  id="edit-articles"
                  type="number"
                  value={formData.Article_Count ?? ""}
                  onChange={(e) => setFormData({ ...formData, Article_Count: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-value">Ø Produktwert</Label>
                <Input
                  id="edit-value"
                  type="number"
                  step="0.01"
                  value={formData.Avg_Product_Value ?? ""}
                  onChange={(e) => setFormData({ ...formData, Avg_Product_Value: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>

            <div className="border-t border-[#00463c]/10 pt-4 mt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-[#00463c]">Content-Plan Status</Label>
                  <div className="flex items-center gap-2">
                    {formData.Editorial_Deadline || (formData.Status && formData.Status !== "Backlog") ? (
                      <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">
                        Hinzugefügt
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-muted-foreground bg-muted/20">
                        Nicht im Plan
                      </Badge>
                    )}
                  </div>
                </div>
                
                {!(formData.Editorial_Deadline || (formData.Status && formData.Status !== "Backlog")) && formData.Main_Keyword === "Y" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-[#00463c] text-[#00463c] hover:bg-[#00463c] hover:text-white"
                    onClick={handleAddToContentPlan}
                    disabled={isAddingToPlan || loading}
                  >
                    {isAddingToPlan ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Plus className="h-3 w-3 mr-1" />
                    )}
                    Zum Plan hinzufügen
                  </Button>
                )}
              </div>
            </div>

            <div className="border-t border-[#00463c]/10 pt-4 mt-2 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#00463c] uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Content-Historie
                </h4>
                {keyword?.Target_URL && (
                  <Link 
                    href={`/history?url=${encodeURIComponent(keyword.Target_URL)}`}
                    className="text-[10px] text-emerald-600 hover:underline font-bold flex items-center gap-1"
                  >
                    Vollständige Historie
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-[#00463c]/40" />
                </div>
              ) : history.filter(entry => entry.Action_Type || entry.Diff_Summary).length > 0 ? (
                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                  {history
                    .filter(entry => entry.Action_Type || entry.Diff_Summary)
                    .map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border text-[11px]">
                        <div className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${entry.Action_Type === 'Erstellung' ? 'bg-blue-500' : 'bg-green-500'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold truncate">{entry.Action_Type || '-'}</p>
                            <span className="text-muted-foreground whitespace-nowrap">
                              {new Date(entry.Created_At).toLocaleDateString('de-DE')}
                            </span>
                          </div>
                          {entry.Diff_Summary && !entry.Diff_Summary.includes('n8n callback') && (
                            <p className="text-muted-foreground line-clamp-1 mt-0.5 italic">
                              {entry.Diff_Summary}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-4 bg-muted/20 rounded-lg border border-dashed border-border">
                  <p className="text-[10px] text-muted-foreground">Keine relevanten Einträge vorhanden</p>
                </div>
              )}
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
            <Button type="button" variant="outline" onClick={closeDialog} disabled={loading}>
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
            <Badge variant="outline" className="text-green-600 border-green-600">Hinzugefügt</Badge>
          </div>
        );
      }

      return (
        <div className="flex justify-center w-full">
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
    accessorKey: "Article_Count",
    header: "Product-Count",
    cell: ({ row }) => <div>{row.getValue("Article_Count") || "-"}</div>,
  },
  {
    accessorKey: "Avg_Product_Value",
    header: "Ø Produktwert",
    cell: ({ row }) => <div>{row.getValue<number>("Avg_Product_Value")?.toFixed(2) || "-"} €</div>,
  },
];

interface KeywordTableProps {
  data: KeywordMap[];
}

export function KeywordTable({ data }: KeywordTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const { addAlert } = useAlerts();
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    Action_Type: false,
  });
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([]);

  // Load column order from localStorage on mount
  React.useEffect(() => {
    const savedOrder = localStorage.getItem("keyword-table-column-order");
    const defaultOrder = ["select", "Keyword", "Status", "Action_Type", "Content-Plan", "Main_Keyword", "Search_Volume", "Difficulty", "Article_Count", "Avg_Product_Value"];
    
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
      localStorage.setItem("keyword-table-column-order", JSON.stringify(columnOrder));
    }
  }, [columnOrder]);

  const [editingKeyword, setEditingKeyword] = React.useState<KeywordMap | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);

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
        message: "Keyword wurde erfolgreich gelöscht.",
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
        message: `${ids.length} Keywords wurden erfolgreich gelöscht.`,
        type: "success",
      });
      setRowSelection({});
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
    initialState: {
      pagination: {
        pageSize: 100,
      },
    },
    meta: {
      updateData,
      deleteData,
      openEditModal: (keyword: KeywordMap) => {
        setEditingKeyword(keyword);
        setIsEditModalOpen(true);
      }
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

  const selectedRows = table.getFilteredSelectedRowModel().rows;

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

      <EditKeywordModal 
        keyword={editingKeyword}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSave={updateData}
      />
    </div>
  );
}

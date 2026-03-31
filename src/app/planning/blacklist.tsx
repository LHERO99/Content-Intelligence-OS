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
} from "@tanstack/react-table";
import { 
  ShieldAlert, 
  Loader2, 
  ArrowUpDown, 
  MoreHorizontal,
  AlertCircle,
  Trash2,
  Filter
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// --- Edit Modal Component ---

interface EditBlacklistModalProps {
  entry: BlacklistEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function EditBlacklistModal({ entry, open, onOpenChange, onSave, onDelete }: EditBlacklistModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<Partial<BlacklistEntry>>({});

  React.useEffect(() => {
    if (entry) {
      setFormData({
        Keyword: entry.Keyword,
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

  const handleDelete = async () => {
    if (!entry) return;
    
    setError(null);
    setLoading(true);
    try {
      await onDelete(entry.id);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Fehler beim Löschen");
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
              Passen Sie das Keyword oder den Grund für den Ausschluss an.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
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

          <DialogFooter className="flex justify-between sm:justify-between">
            <Popover>
              <PopoverTrigger>
                <Button 
                  type="button" 
                  variant="destructive" 
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Löschen
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-3">
                <div className="space-y-3">
                  <p className="text-xs font-medium">Eintrag wirklich löschen?</p>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-7 text-xs w-full"
                    onClick={handleDelete}
                  >
                    Ja, löschen
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#00463c] hover:bg-[#00332c]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Speichern
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Table Columns ---

export const columns: ColumnDef<BlacklistEntry>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          (table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")) as any
        }
        onCheckedChange={(value: any) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        onClick={(e) => e.stopPropagation()}
      />
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
  },
  {
    accessorKey: "Keyword",
    header: ({ column }) => (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8 text-[#00463c] font-bold"
        >
          Keyword
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-8 w-8 p-0 ${column.getFilterValue() ? 'text-[#00463c]' : 'text-muted-foreground'}`}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <Filter className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-3" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Filter Keyword</h4>
              <Input
                placeholder="Suchen..."
                value={(column.getFilterValue() as string) ?? ""}
                onChange={(event) => column.setFilterValue(event.target.value)}
                className="h-8 text-xs"
                autoFocus
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    ),
    cell: ({ row }) => <div className="font-medium">{row.getValue("Keyword")}</div>,
  },
  {
    accessorKey: "Reason",
    header: ({ column }) => (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8 text-[#00463c] font-bold"
        >
          Grund
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-8 w-8 p-0 ${column.getFilterValue() ? 'text-[#00463c]' : 'text-muted-foreground'}`}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <Filter className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-3" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Filter Grund</h4>
              <Input
                placeholder="Suchen..."
                value={(column.getFilterValue() as string) ?? ""}
                onChange={(event) => column.setFilterValue(event.target.value)}
                className="h-8 text-xs"
                autoFocus
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    ),
    cell: ({ row }) => <div>{row.getValue("Reason") || "-"}</div>,
  },
  {
    accessorKey: "Added_At",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-3 h-8 text-[#00463c] font-bold"
      >
        Hinzugefügt am
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const date = row.getValue("Added_At") as string;
      return <div>{date ? new Date(date).toLocaleDateString('de-DE') : "-"}</div>;
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row, table }) => {
      const entry = row.original;
      return (
        <div className="flex items-center justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <span className="sr-only">Menü öffnen</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                navigator.clipboard.writeText(entry.Keyword);
              }}>
                Keyword kopieren
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                (table.options.meta as any).openEditModal(entry);
              }}>
                Details bearbeiten
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-3" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <div className="space-y-3">
                <p className="text-xs font-medium">Eintrag löschen?</p>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-7 text-xs w-full"
                  onClick={async (e: React.MouseEvent) => {
                    e.stopPropagation();
                    await (table.options.meta as any).deleteData(entry.id);
                  }}
                >
                  Löschen
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      );
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
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);

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
      throw error;
    }
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
      setRowSelection({});
      fetchData();
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
    meta: {
      updateData,
      deleteData,
      openEditModal: (entry: BlacklistEntry) => {
        setEditingEntry(entry);
        setIsEditModalOpen(true);
      }
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#00463c]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
        {error}
      </div>
    );
  }

  const selectedRows = table.getFilteredSelectedRowModel().rows;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[#00463c]">
          <ShieldAlert className="h-6 w-6" />
          <h3 className="text-xl font-semibold">Blacklist</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Keywords, die explizit von der Planung ausgeschlossen wurden.
        </p>
      </div>

      <div className="flex items-center py-4 gap-4">
        {selectedRows.length > 0 && (
          <Popover>
            <PopoverTrigger>
              <Button variant="destructive" size="sm" className="bg-red-600 hover:bg-red-700">
                <Trash2 className="h-4 w-4 mr-2" />
                {selectedRows.length} löschen
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4">
              <div className="space-y-3">
                <p className="text-sm font-medium">Möchten Sie {selectedRows.length} Einträge wirklich löschen?</p>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="w-full"
                  disabled={isBulkDeleting}
                  onClick={() => bulkDelete(selectedRows.map(r => r.original.id))}
                >
                  {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ja, löschen"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <Card className="border-[#00463c]/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent border-[#00463c]/10">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="text-[#00463c] font-bold whitespace-nowrap">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
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
        onDelete={deleteData}
      />
    </div>
  );
}

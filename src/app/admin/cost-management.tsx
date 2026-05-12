"use client";

import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Coins, Save, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CostConfig } from "@/lib/postgres-types";
import { useI18n } from "@/i18n/use-i18n";

const PAGE_TYPES = ["Kategorie", "Ratgeber", "Marke", "Produkt"];
const ACTION_TYPES = ["Erstellung", "Optimierung"];

export function CostManagement() {
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);
  const [configs, setConfigs] = useState<CostConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // New config modal state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newConfig, setNewConfig] = useState({
    Page_Type: "Ratgeber",
    Action_Type: "Erstellung",
    Agency_Cost: 0,
    Overhead_Cost: 0
  });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/costs");
      if (!res.ok) throw new Error(tr("Fehler beim Laden der Kostenkonfiguration", "Error loading cost configuration"));
      const data = await res.json();
      setConfigs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, pageType: string, actionType: string, agency: number, overhead: number) => {
    setSavingId(id);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/admin/costs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          Page_Type: pageType,
          Action_Type: actionType,
          Agency_Cost: agency, 
          Overhead_Cost: overhead 
        }),
      });

      if (!res.ok) throw new Error(tr("Fehler beim Speichern der Kosten", "Error saving costs"));
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      fetchConfigs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr("Möchten Sie diesen Eintrag wirklich löschen?", "Do you really want to delete this entry?"))) return;
    
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/costs/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(tr("Fehler beim Löschen des Eintrags", "Error deleting entry"));
      
      fetchConfigs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdd = async () => {
    setIsAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });

      if (!res.ok) throw new Error(tr("Fehler beim Erstellen des Eintrags", "Error creating entry"));
      
      setIsAddDialogOpen(false);
      setNewConfig({
        Page_Type: "Ratgeber",
        Action_Type: "Erstellung",
        Agency_Cost: 0,
        Overhead_Cost: 0
      });
      fetchConfigs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const updateLocalValue = (id: string, field: keyof CostConfig, value: any) => {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Coins className="h-5 w-5" />
            {tr("ROI & Kosten-Konfiguration", "ROI & Cost Configuration")}
          </CardTitle>
          <CardDescription>
            {tr(
              "Pflegen Sie hier die Standardkosten für Agenturleistung und internen Overhead pro Seitentyp. Diese Werte werden für die ROI-Berechnung im Monitoring verwendet.",
              "Manage standard costs for agency services and internal overhead per page type. These values are used for ROI calculation in monitoring."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>{tr("Fehler", "Error")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="border-green-500 bg-green-50 text-green-700">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>{tr("Erfolg", "Success")}</AlertTitle>
              <AlertDescription>{tr("Kosten wurden erfolgreich gespeichert.", "Costs saved successfully.")}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Seitentyp", "Page Type")}</TableHead>
                  <TableHead>{tr("Aktion", "Action")}</TableHead>
                  <TableHead>{tr("Agentur-Kosten (€)", "Agency Costs (€)")}</TableHead>
                  <TableHead>{tr("Overhead-Kosten (€)", "Overhead Costs (€)")}</TableHead>
                  <TableHead className="text-right">{tr("Aktionen", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <Select 
                        value={config.Page_Type} 
                        onValueChange={(v) => updateLocalValue(config.id, 'Page_Type', v)}
                      >
                        <SelectTrigger className="w-[140px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={config.Action_Type} 
                        onValueChange={(v) => updateLocalValue(config.id, 'Action_Type', v)}
                      >
                        <SelectTrigger className="w-[140px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={config.Agency_Cost}
                        onChange={(e) => updateLocalValue(config.id, 'Agency_Cost', parseFloat(e.target.value) || 0)}
                        className="w-24 h-9"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={config.Overhead_Cost}
                        onChange={(e) => updateLocalValue(config.id, 'Overhead_Cost', parseFloat(e.target.value) || 0)}
                        className="w-24 h-9"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleUpdate(config.id, config.Page_Type, config.Action_Type, config.Agency_Cost, config.Overhead_Cost)}
                          disabled={savingId === config.id}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          {savingId === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                          {tr("Speichern", "Save")}
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => handleDelete(config.id)}
                          disabled={deletingId === config.id}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          {deletingId === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {configs.length === 0 && (
                  <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {tr("Keine Konfigurationen gefunden. Nutzen Sie das \"+\" zum Hinzufügen.", "No configurations found. Use \"+\" to add one.")}
                  </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* FAB */}
      <Button
        className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground z-50"
        size="icon"
        onClick={() => setIsAddDialogOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{tr("Neue Kostenkonfiguration", "New Cost Configuration")}</DialogTitle>
            <DialogDescription>
              {tr(
                "Legen Sie Standardkosten für eine bestimmte Kombination aus Seitentyp und Aktion fest.",
                "Set default costs for a specific combination of page type and action."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{tr("Seitentyp", "Page Type")}</Label>
              <Select 
                value={newConfig.Page_Type} 
                onValueChange={(v) => setNewConfig(prev => ({ ...prev, Page_Type: v || "Ratgeber" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{tr("Aktion", "Action")}</Label>
              <Select 
                value={newConfig.Action_Type} 
                onValueChange={(v) => setNewConfig(prev => ({ ...prev, Action_Type: v || "Erstellung" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{tr("Agentur-Kosten (€)", "Agency Costs (€)")}</Label>
                <Input 
                  type="number" 
                  value={newConfig.Agency_Cost}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, Agency_Cost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>{tr("Overhead-Kosten (€)", "Overhead Costs (€)")}</Label>
                <Input 
                  type="number" 
                  value={newConfig.Overhead_Cost}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, Overhead_Cost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>{tr("Abbrechen", "Cancel")}</Button>
            <Button 
              onClick={handleAdd} 
              disabled={isAdding}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Hinzufügen", "Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

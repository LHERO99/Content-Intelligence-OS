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
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Coins, Save, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CostConfig } from "@/lib/airtable-types";

export function CostManagement() {
  const [configs, setConfigs] = useState<CostConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/costs");
      if (!res.ok) throw new Error("Fehler beim Laden der Kostenkonfiguration");
      const data = await res.json();
      setConfigs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, agency: number, overhead: number) => {
    setSavingId(id);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/admin/costs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Agency_Cost: agency, Overhead_Cost: overhead }),
      });

      if (!res.ok) throw new Error("Fehler beim Speichern der Kosten");
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      fetchConfigs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const updateLocalValue = (id: string, field: 'Agency_Cost' | 'Overhead_Cost', value: string) => {
    const numValue = parseFloat(value) || 0;
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: numValue } : c));
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
          <CardTitle className="flex items-center gap-2 text-[#00463c]">
            <Coins className="h-5 w-5" />
            ROI & Kosten-Konfiguration
          </CardTitle>
          <CardDescription>
            Pflegen Sie hier die Standardkosten für Agenturleistung und internen Overhead pro Seitentyp. Diese Werte werden für die ROI-Berechnung im Monitoring verwendet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Fehler</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="border-green-500 bg-green-50 text-green-700">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Erfolg</AlertTitle>
              <AlertDescription>Kosten wurden erfolgreich gespeichert.</AlertDescription>
            </Alert>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seitentyp</TableHead>
                  <TableHead>Aktion</TableHead>
                  <TableHead>Agentur-Kosten (€)</TableHead>
                  <TableHead>Overhead-Kosten (€)</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.Page_Type}</TableCell>
                    <TableCell>{config.Action_Type}</TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={config.Agency_Cost}
                        onChange={(e) => updateLocalValue(config.id, 'Agency_Cost', e.target.value)}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={config.Overhead_Cost}
                        onChange={(e) => updateLocalValue(config.id, 'Overhead_Cost', e.target.value)}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        onClick={() => handleUpdate(config.id, config.Agency_Cost, config.Overhead_Cost)}
                        disabled={savingId === config.id}
                        className="bg-[#00463c] hover:bg-[#00332c]"
                      >
                        {savingId === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Speichern
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {configs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                      Keine Konfigurationen gefunden. Diese müssen initial in Airtable angelegt werden.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

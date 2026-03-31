"use client";

import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Key, Save, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ApiKeysManagement() {
  const [sistrixKey, setSistrixKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/config");
      if (!res.ok) throw new Error("Fehler beim Laden der Konfiguration");
      const data = await res.json();
      
      const sistrix = data.find((c: any) => c.Key === "SISTRIX_API_KEY");
      if (sistrix) {
        setSistrixKey(sistrix.Value);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "SISTRIX_API_KEY", value: sistrixKey }),
      });

      if (!res.ok) throw new Error("Fehler beim Speichern des API-Keys");
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Externe API-Keys
          </CardTitle>
          <CardDescription>
            Verwalten Sie hier die API-Schlüssel für externe Dienste wie Sistrix.
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
              <AlertDescription>Der API-Key wurde erfolgreich gespeichert.</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Sistrix API-Key</label>
            <div className="flex gap-2">
              <Input 
                type="password"
                placeholder="Ihr Sistrix API-Key" 
                value={sistrixKey}
                onChange={(e) => setSistrixKey(e.target.value)}
                className="h-10"
              />
              <Button onClick={handleSave} disabled={saving} className="h-10 bg-[#00463c] hover:bg-[#00332c]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Speichern
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Dieser Key wird für den Abruf von Sichtbarkeitsindizes und Keyword-Daten verwendet.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
import { Loader2, Key, Save, Database } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ApiKeysManagement() {
  const [sistrixKey, setSistrixKey] = useState("");
  const [bqCredentials, setBqCredentials] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      if (sistrix) setSistrixKey(sistrix.Value);
      
      const bq = data.find((c: any) => c.Key === "BIGQUERY_CREDENTIALS");
      if (bq) setBqCredentials(bq.Value);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string, value: string) => {
    setSaving(key);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });

      if (!res.ok) throw new Error(`Fehler beim Speichern von ${key}`);
      
      setSuccess(key);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
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
            Externe API-Keys & Datenverbindungen
          </CardTitle>
          <CardDescription>
            Verwalten Sie hier die API-Schlüssel für externe Dienste wie Sistrix und die Anbindung an Google Search Console via BigQuery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Fehler</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
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
              <Button onClick={() => handleSave("SISTRIX_API_KEY", sistrixKey)} disabled={saving === "SISTRIX_API_KEY"} className="h-10 bg-[#00463c] hover:bg-[#00332c]">
                {saving === "SISTRIX_API_KEY" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Speichern
              </Button>
            </div>
            {success === "SISTRIX_API_KEY" && <p className="text-xs text-green-600 font-medium">Sistrix Key gespeichert.</p>}
            <p className="text-xs text-muted-foreground">
              Dieser Key wird für den Abruf von Sichtbarkeitsindizes und Keyword-Daten verwendet.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Database className="h-3 w-3" />
              BigQuery Credentials (JSON)
            </label>
            <div className="flex gap-2">
              <Input 
                type="password"
                placeholder="JSON-Zugangsdaten für BigQuery" 
                value={bqCredentials}
                onChange={(e) => setBqCredentials(e.target.value)}
                className="h-10"
              />
              <Button onClick={() => handleSave("BIGQUERY_CREDENTIALS", bqCredentials)} disabled={saving === "BIGQUERY_CREDENTIALS"} className="h-10 bg-[#00463c] hover:bg-[#00332c]">
                {saving === "BIGQUERY_CREDENTIALS" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Speichern
              </Button>
            </div>
            {success === "BIGQUERY_CREDENTIALS" && <p className="text-xs text-green-600 font-medium">BigQuery Credentials gespeichert.</p>}
            <p className="text-xs text-muted-foreground">
              Wird für den Zugriff auf historische GSC-Daten verwendet. Geben Sie hier den vollständigen JSON-Inhalt Ihres Service-Accounts ein.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

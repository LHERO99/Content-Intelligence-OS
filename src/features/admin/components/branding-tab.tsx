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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Save, Image as ImageIcon, Palette } from "lucide-react";

export function BrandingTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [config, setConfig] = useState({
    BRAND_PRIMARY_COLOR: "#00463c",
    BRAND_LOGO_URL: "/docmorris-logo.png",
    BRAND_FAVICON_URL: "/favicon.ico",
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/config");
      if (!res.ok) throw new Error("Fehler beim Laden der Branding-Einstellungen");
      const data = await res.json();
      
      setConfig({
        BRAND_PRIMARY_COLOR: data.BRAND_PRIMARY_COLOR || "#00463c",
        BRAND_LOGO_URL: data.BRAND_LOGO_URL || "/docmorris-logo.png",
        BRAND_FAVICON_URL: data.BRAND_FAVICON_URL || "/favicon.ico",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      for (const [key, value] of Object.entries(config)) {
        const res = await fetch("/api/admin/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        if (!res.ok) throw new Error(`Fehler beim Speichern von ${key}`);
      }

      setSuccess("Die Branding-Einstellungen wurden erfolgreich gespeichert. Bitte laden Sie die Seite neu, um alle Änderungen zu sehen.");
      
      // Update CSS variable immediately for preview
      document.documentElement.style.setProperty('--primary', config.BRAND_PRIMARY_COLOR);
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
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 bg-green-50 text-green-900">
          <AlertTitle>Erfolg</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Colors & Styles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Farben & Stil
            </CardTitle>
            <CardDescription>
              Passen Sie das Farbschema der Anwendung an.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Primärfarbe (Hex)</label>
              <div className="flex gap-4">
                <Input 
                  type="color" 
                  value={config.BRAND_PRIMARY_COLOR}
                  onChange={(e) => setConfig({ ...config, BRAND_PRIMARY_COLOR: e.target.value })}
                  className="h-10 w-20 p-1"
                />
                <Input 
                  type="text" 
                  value={config.BRAND_PRIMARY_COLOR}
                  onChange={(e) => setConfig({ ...config, BRAND_PRIMARY_COLOR: e.target.value })}
                  placeholder="#00463c"
                  className="h-10 font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Diese Farbe wird für Buttons, Navigation und Hervorhebungen verwendet.
              </p>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Vorschau</h4>
              <div className="flex flex-wrap gap-2">
                <Button style={{ backgroundColor: config.BRAND_PRIMARY_COLOR }}>Button</Button>
                <Button variant="outline" style={{ borderColor: config.BRAND_PRIMARY_COLOR, color: config.BRAND_PRIMARY_COLOR }}>Outline</Button>
                <div 
                  className="h-10 w-10 rounded-full border shadow-sm" 
                  style={{ backgroundColor: config.BRAND_PRIMARY_COLOR }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Logos & Icons
            </CardTitle>
            <CardDescription>
              Laden Sie Ihr Logo und Favicon hoch oder geben Sie die URL an.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Logo URL</label>
              <Input 
                value={config.BRAND_LOGO_URL}
                onChange={(e) => setConfig({ ...config, BRAND_LOGO_URL: e.target.value })}
                placeholder="/logo.png"
                className="h-10"
              />
              <div className="mt-2 flex items-center justify-center p-4 border rounded-lg bg-muted/50 h-24">
                <img 
                  src={config.BRAND_LOGO_URL} 
                  alt="Logo Vorschau" 
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/200x50?text=Ungültiges+Logo';
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Favicon URL</label>
              <div className="flex gap-2">
                <Input 
                  value={config.BRAND_FAVICON_URL}
                  onChange={(e) => setConfig({ ...config, BRAND_FAVICON_URL: e.target.value })}
                  placeholder="/favicon.ico"
                  className="h-10"
                />
                <div className="h-10 w-10 flex items-center justify-center border rounded bg-background">
                  <img src={config.BRAND_FAVICON_URL} alt="Favicon" className="h-6 w-6" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="gap-2 bg-[#00463c] hover:bg-[#00332c]"
          style={{ backgroundColor: config.BRAND_PRIMARY_COLOR }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Einstellungen speichern
        </Button>
      </div>
    </div>
  );
}

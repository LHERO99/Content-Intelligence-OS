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
import { Loader2, Save, Image as ImageIcon, Palette, Upload } from "lucide-react";
import { applyBrandingCssVariables, contrastRatio, getBestForegroundColor, normalizeHexColor } from "@/lib/branding";

export function BrandingTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<{ logo: boolean; favicon: boolean }>({ logo: false, favicon: false });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [config, setConfig] = useState({
    BRAND_PRIMARY_COLOR: "#00463c",
    BRAND_LOGO_URL: "/docmorris-logo.png",
    BRAND_FAVICON_URL: "/favicon.ico",
  });

  const normalizedPrimary = normalizeHexColor(config.BRAND_PRIMARY_COLOR);
  const computedForeground = getBestForegroundColor(normalizedPrimary);
  const primaryContrast = contrastRatio(normalizedPrimary, computedForeground);
  const isPrimaryColorValid = /^#([0-9a-fA-F]{6})$/.test(String(config.BRAND_PRIMARY_COLOR || '').trim());

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
        BRAND_PRIMARY_COLOR: normalizeHexColor(data.BRAND_PRIMARY_COLOR),
        BRAND_LOGO_URL: data.BRAND_LOGO_URL || "/docmorris-logo.png",
        BRAND_FAVICON_URL: data.BRAND_FAVICON_URL || "/favicon.ico",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 2MB
    if (file.size > 2 * 1024 * 1024) {
      setError("Die Datei ist zu groß. Maximal 2MB erlaubt.");
      return;
    }

    setUploading(prev => ({ ...prev, [type]: true }));
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload fehlgeschlagen');
      }

      const { url } = await res.json();
      setConfig(prev => ({
        ...prev,
        [type === 'logo' ? 'BRAND_LOGO_URL' : 'BRAND_FAVICON_URL']: url
      }));
      setSuccess(`${type === 'logo' ? 'Logo' : 'Favicon'} erfolgreich hochgeladen.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
      // Reset input
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!isPrimaryColorValid) {
      setError("Bitte geben Sie eine gültige Hex-Farbe im Format #RRGGBB ein.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      for (const [key, value] of Object.entries(config)) {
        // Prepare the body for each key update
        const body: any = { key, value };
        
        // If the value is a Base64 string (meaning it was just uploaded), 
        // we keep it as value for the text fallback, 
        // and we could optionally try to handle it as a file if the backend supported it directly.
        // For Airtable Attachments, we ideally need a public URL, but we'll try to 
        // pass the Base64 to the backend and see if it can be handled there.
        
        const res = await fetch("/api/admin/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || `Fehler beim Speichern von ${key}`);
        }
      }

      const safePrimary = normalizeHexColor(config.BRAND_PRIMARY_COLOR);
      applyBrandingCssVariables(safePrimary);
      setSuccess("Die Branding-Einstellungen wurden erfolgreich gespeichert.");
      window.dispatchEvent(new CustomEvent('branding-updated'));
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
                  value={normalizedPrimary}
                  onChange={(e) => {
                    const next = normalizeHexColor(e.target.value);
                    setConfig({ ...config, BRAND_PRIMARY_COLOR: next });
                    applyBrandingCssVariables(next);
                  }}
                  className="h-10 w-20 p-1"
                />
                <Input 
                  type="text" 
                  value={config.BRAND_PRIMARY_COLOR}
                  onChange={(e) => {
                    const next = e.target.value;
                    setConfig({ ...config, BRAND_PRIMARY_COLOR: next });
                    if (/^#([0-9a-fA-F]{6})$/.test(next.trim())) {
                      applyBrandingCssVariables(next.trim());
                    }
                  }}
                  placeholder="#00463c"
                  className="h-10 font-mono"
                />
              </div>
              {!isPrimaryColorValid && (
                <p className="text-xs text-red-600">Ungültiges Format. Bitte nutzen Sie #RRGGBB.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Kontrast (Primärfarbe zu Text): {primaryContrast.toFixed(2)}:1
              </p>
              <p className="text-xs text-muted-foreground">
                Diese Farbe wird für Buttons, Navigation und Hervorhebungen verwendet.
              </p>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Vorschau</h4>
              <div className="flex flex-wrap gap-2">
                <Button style={{ backgroundColor: normalizedPrimary, color: computedForeground }}>Button</Button>
                <Button variant="outline" style={{ borderColor: normalizedPrimary, color: normalizedPrimary }}>Outline</Button>
                <div 
                  className="h-10 w-10 rounded-full border shadow-sm" 
                  style={{ backgroundColor: normalizedPrimary }}
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
              Laden Sie Ihr Logo und Favicon hoch (maximal 2MB).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <label className="text-sm font-medium">Anwendungs-Logo</label>
              <div className="flex flex-col gap-3">
                <input
                  type="file"
                  id="logo-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'logo')}
                  disabled={uploading.logo}
                />
                <div 
                  onClick={() => !uploading.logo && document.getElementById('logo-upload')?.click()}
                  className={`relative flex items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all cursor-pointer group
                    ${uploading.logo ? 'bg-muted/20 border-muted' : 'bg-muted/50 border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5'}`}
                >
                  {uploading.logo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 rounded-xl">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-2">
                    <img 
                      src={config.BRAND_LOGO_URL} 
                      alt="Logo Vorschau" 
                      className="max-h-32 w-auto object-contain transition-transform group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/400x100?text=Klicken+zum+Upload';
                      }}
                    />
                    <span className="text-xs text-muted-foreground mt-2 group-hover:text-primary">Klicken zum Ändern</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <label className="text-sm font-medium">Favicon</label>
              <div className="flex flex-col gap-3">
                <input
                  type="file"
                  id="favicon-upload"
                  className="hidden"
                  accept="image/*,.ico"
                  onChange={(e) => handleFileUpload(e, 'favicon')}
                  disabled={uploading.favicon}
                />
                <div 
                  onClick={() => !uploading.favicon && document.getElementById('favicon-upload')?.click()}
                  className={`relative flex items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer group w-32 h-32 mx-auto
                    ${uploading.favicon ? 'bg-muted/20 border-muted' : 'bg-muted/50 border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5'}`}
                >
                  {uploading.favicon && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 rounded-xl">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-2">
                    <img 
                      src={config.BRAND_FAVICON_URL} 
                      alt="Favicon" 
                      className="h-16 w-16 object-contain transition-transform group-hover:scale-110" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/%3E%3Cpath d="M21 3v5h-5"/%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                </div>
                <p className="text-center text-xs text-muted-foreground">Klicken zum Ändern</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving || !isPrimaryColorValid}
          className="gap-2 bg-primary hover:bg-primary/90"
          style={{ backgroundColor: normalizedPrimary, color: computedForeground }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Einstellungen speichern
        </Button>
      </div>
    </div>
  );
}

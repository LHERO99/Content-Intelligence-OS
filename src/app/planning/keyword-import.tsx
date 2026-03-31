"use client";

import React, { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function KeywordImport() {
  const [isUploading, setIsUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const keywords = results.data.map((row: any) => ({
            Keyword: row.Keyword || row.keyword || row.Name || row.name,
            Target_URL: row.Target_URL || row.target_url || row.URL || row.url,
            Search_Volume: parseInt(row.Search_Volume || row.search_volume || row.Volume || row.volume || "0"),
            Difficulty: parseInt(row.Difficulty || row.difficulty || "0"),
            Status: "New",
            Main_Keyword: (row.Main_Keyword || row.main_keyword || "N").toUpperCase() === "Y" ? "Y" : "N",
            Article_Count: row.Article_Count || row.article_count ? parseInt(row.Article_Count || row.article_count) : undefined,
            Avg_Product_Value: row.Avg_Product_Value || row.avg_product_value ? parseFloat(row.Avg_Product_Value || row.avg_product_value) : undefined,
          })).filter((kw: any) => kw.Keyword && kw.Target_URL);

          if (keywords.length === 0) {
            throw new Error("Keine gültigen Keywords mit Target_URL in der Datei gefunden.");
          }

          const response = await fetch("/api/planning/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keywords }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Import fehlgeschlagen");
          }

          const data = await response.json();
          alert(`Erfolgreich ${data.count} Keywords importiert.`);
          setIsOpen(false);
          window.location.reload(); // Refresh to show new data
        } catch (error: any) {
          console.error("Import error:", error);
          alert(`Fehler beim Import: ${error.message}`);
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (error) => {
        console.error("Parse error:", error);
        alert(`Fehler beim Lesen der Datei: ${error.message}`);
        setIsUploading(false);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        <Button variant="outline" className="border-[#00463c]/20 text-[#00463c] hover:bg-[#e7f3ee] h-10 px-4">
          <Upload className="mr-2 h-4 w-4" />
          Keywords importieren
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Keywords importieren</DialogTitle>
          <DialogDescription>
            Laden Sie eine CSV-Datei hoch. Erwartete Spalten: Keyword (Pflicht), Target_URL (Pflicht), Search_Volume, Difficulty, Main_Keyword (Y/N), Produkt-Anzahl, Avg_Product_Value.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div 
            className="border-2 border-dashed border-[#00463c]/20 rounded-lg p-8 text-center hover:bg-[#e7f3ee]/50 cursor-pointer transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-[#00463c]" />
                <p className="text-sm font-medium">Verarbeitung läuft...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-[#00463c]/40" />
                <p className="text-sm font-medium">Klicken oder Datei hierher ziehen</p>
                <p className="text-xs text-muted-foreground">CSV oder Excel (via CSV Export)</p>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isUploading}>
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

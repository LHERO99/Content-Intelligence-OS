"use client";

import React, { useRef, useState, useEffect } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, FileText, ArrowRight, Download } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define the system columns that we want to map to
const SYSTEM_COLUMNS = [
  { id: "Keyword", label: "Keyword", required: true },
  { id: "Target_URL", label: "Target URL", required: true },
  { id: "Search_Volume", label: "Search Volume", required: false },
  { id: "Difficulty", label: "Difficulty", required: false },
  { id: "Main_Keyword", label: "Main Keyword (Y/N)", required: false },
  { id: "Article_Count", label: "Article Count", required: false },
  { id: "Avg_Product_Value", label: "Avg Product Value", required: false },
  { id: "Cluster", label: "Cluster", required: false },
  { id: "Status", label: "Status", required: false },
];

type Mapping = Record<string, string>;

export function KeywordImport() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "mapping" | "importing" | "success" | "error">("upload");
  const [fileData, setFileData] = useState<any[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [mapping, setMapping] = useState<Mapping>({});
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importCount, setImportCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [skippedRecords, setSkippedRecords] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep("upload");
      setFileData([]);
      setFileHeaders([]);
      setFileName("");
      setMapping({});
      setError(null);
      setImportCount(0);
      setSkippedCount(0);
      setSkippedRecords([]);
    }
  }, [isOpen]);

  const autoMapColumns = (headers: string[]) => {
    const newMapping: Mapping = {};
    headers.forEach(header => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "");
      
      SYSTEM_COLUMNS.forEach(sysCol => {
        const normalizedSys = sysCol.id.toLowerCase().replace(/[^a-z0-9]/g, "");
        const normalizedLabel = sysCol.label.toLowerCase().replace(/[^a-z0-9]/g, "");
        
        if (normalizedHeader === normalizedSys || normalizedHeader === normalizedLabel) {
          newMapping[sysCol.id] = header;
        }
      });
      
      // Special cases
      if (!newMapping["Keyword"] && (normalizedHeader === "name" || normalizedHeader === "term")) {
        newMapping["Keyword"] = header;
      }
      if (!newMapping["Target_URL"] && (normalizedHeader === "url" || normalizedHeader === "link")) {
        newMapping["Target_URL"] = header;
      }
      if (!newMapping["Search_Volume"] && (normalizedHeader === "volume" || normalizedHeader === "msv")) {
        newMapping["Search_Volume"] = header;
      }
    });
    setMapping(newMapping);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setFileData(results.data);
            const headers = Object.keys(results.data[0] as object);
            setFileHeaders(headers);
            autoMapColumns(headers);
            setStep("mapping");
          } else {
            setError("Die Datei scheint leer zu sein.");
            setStep("error");
          }
        },
        error: (err) => {
          setError(`Fehler beim Lesen der CSV: ${err.message}`);
          setStep("error");
        }
      });
    } else if (extension === "xlsx" || extension === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          
          if (jsonData && jsonData.length > 0) {
            setFileData(jsonData);
            const headers = Object.keys(jsonData[0] as object);
            setFileHeaders(headers);
            autoMapColumns(headers);
            setStep("mapping");
          } else {
            setError("Die Excel-Datei scheint leer zu sein.");
            setStep("error");
          }
        } catch (err: any) {
          setError(`Fehler beim Lesen der Excel-Datei: ${err.message}`);
          setStep("error");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError("Nicht unterstütztes Dateiformat. Bitte nutzen Sie CSV oder XLSX.");
      setStep("error");
    }
  };

  const handleImport = async () => {
    // Validate required mappings
    const missingRequired = SYSTEM_COLUMNS.filter(col => col.required && !mapping[col.id]);
    if (missingRequired.length > 0) {
      setError(`Bitte ordnen Sie die Pflichtfelder zu: ${missingRequired.map(c => c.label).join(", ")}`);
      return;
    }

    setIsUploading(true);
    setStep("importing");

    try {
      const keywords = fileData.map((row: any) => {
        const mappedRow: any = {};

        SYSTEM_COLUMNS.forEach(col => {
          const fileKey = mapping[col.id];
          if (fileKey) {
            let value = row[fileKey];
            
            // Type conversions
            if (col.id === "Search_Volume" || col.id === "Difficulty" || col.id === "Article_Count") {
              value = parseInt(String(value).replace(/[^0-9]/g, "") || "0");
            } else if (col.id === "Avg_Product_Value") {
              value = parseFloat(String(value).replace(/[^0-9.]/g, "") || "0");
            } else if (col.id === "Main_Keyword") {
              const val = String(value).toLowerCase();
              value = (val === "y" || val === "yes" || val === "ja" || val === "1" || val === "true") ? "Y" : "N";
            }
            
            mappedRow[col.id] = value;
          }
        });

        // Ensure Status is set if not mapped
        if (!mappedRow.Status) {
          mappedRow.Status = "Backlog";
        }

        return mappedRow;
      }).filter(kw => kw.Keyword && kw.Target_URL);

      if (keywords.length === 0) {
        throw new Error("Keine gültigen Datensätze nach dem Mapping gefunden.");
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
      setImportCount(data.count);
      setSkippedCount(data.skippedCount || 0);
      setSkippedRecords(data.skipped || []);
      setStep("success");
    } catch (err: any) {
      setError(err.message);
      setStep("error");
    } finally {
      setIsUploading(false);
    }
  };

  const downloadSkipped = () => {
    if (skippedRecords.length === 0) return;
    
    const worksheet = XLSX.utils.json_to_sheet(skippedRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Duplikate");
    XLSX.writeFile(workbook, "import_duplikate.xlsx");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        <Button variant="outline" className="border-[#00463c]/20 text-[#00463c] hover:bg-[#e7f3ee] h-10 px-4">
          <Upload className="mr-2 h-4 w-4" />
          Keywords importieren
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Keywords importieren</DialogTitle>
          <DialogDescription>
            Importieren Sie Keywords aus CSV- oder Excel-Dateien mit flexiblem Spalten-Mapping.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6">
          {step === "upload" && (
            <div 
              className="border-2 border-dashed border-[#00463c]/20 rounded-xl p-12 text-center hover:bg-[#e7f3ee]/50 cursor-pointer transition-all group flex flex-col items-center justify-center gap-4 h-full min-h-[300px]"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="bg-[#e7f3ee] p-4 rounded-full group-hover:scale-110 transition-transform">
                <Upload className="h-10 w-10 text-[#00463c]" />
              </div>
              <div>
                <p className="text-lg font-semibold text-[#00463c]">Datei auswählen</p>
                <p className="text-sm text-muted-foreground mt-1">Klicken oder Datei hierher ziehen</p>
              </div>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  <FileText className="h-3 w-3" /> CSV
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  <FileSpreadsheet className="h-3 w-3" /> XLSX / XLS
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {step === "mapping" && (
            <div className="flex flex-col h-full gap-4">
              <div className="flex items-center justify-between bg-[#e7f3ee]/50 p-3 rounded-lg border border-[#00463c]/10">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-[#00463c]" />
                  <span className="font-medium text-sm truncate max-w-[200px]">{fileName}</span>
                </div>
                <span className="text-xs text-muted-foreground">{fileData.length} Zeilen gefunden</span>
                <Button variant="ghost" size="sm" onClick={() => setStep("upload")} className="h-7 text-xs">
                  Datei ändern
                </Button>
              </div>

              <div className="flex-1 overflow-hidden border rounded-lg">
                <ScrollArea className="h-[350px]">
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4 pb-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div>System-Spalte</div>
                      <div>Ihre Datei-Spalte</div>
                    </div>
                    {SYSTEM_COLUMNS.map((col) => (
                      <div key={col.id} className="grid grid-cols-2 gap-4 items-center">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-medium">
                            {col.label}
                            {col.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                        </div>
                        <Select 
                          value={mapping[col.id] || "none"} 
                          onValueChange={(val) => {
                            if (!val) return;
                            setMapping(prev => {
                              const newMapping = { ...prev };
                              if (val === "none") {
                                delete newMapping[col.id];
                              } else {
                                newMapping[col.id] = val;
                              }
                              return newMapping;
                            });
                          }}
                        >
                          <SelectTrigger className={`h-9 ${mapping[col.id] ? 'border-[#00463c]/40 bg-[#e7f3ee]/20' : ''}`}>
                            <SelectValue placeholder="Nicht zugeordnet" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nicht zugeordnet</SelectItem>
                            {fileHeaders.map(header => (
                              <SelectItem key={header} value={header}>{header}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center justify-center gap-6 h-full min-h-[300px]">
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-[#00463c]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-[#00463c]/40" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">Import läuft...</p>
                <p className="text-sm text-muted-foreground">Ihre Daten werden verarbeitet und gespeichert.</p>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center gap-6 h-full min-h-[300px]">
              <div className="bg-green-100 p-4 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-green-700">Import abgeschlossen!</p>
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Es wurden <span className="font-bold text-[#00463c]">{importCount}</span> Keywords erfolgreich übernommen.
                  </p>
                  {skippedCount > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                      <p className="text-sm text-amber-800 flex items-center justify-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {skippedCount} bereits existierende Einträge wurden übersprungen.
                      </p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="text-amber-900 font-bold mt-1 h-auto p-0"
                        onClick={downloadSkipped}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Duplikate als Excel herunterladen
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <Button 
                className="bg-[#00463c] hover:bg-[#00332c] text-white px-8"
                onClick={() => {
                  setIsOpen(false);
                  window.location.reload();
                }}
              >
                Import abschließen
              </Button>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col h-full gap-4 min-h-[300px]">
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>Fehler beim Import</AlertTitle>
                <AlertDescription className="text-sm">
                  {error || "Ein unbekannter Fehler ist aufgetreten."}
                </AlertDescription>
              </Alert>
              <div className="flex-1 flex items-center justify-center">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Erneut versuchen
                </Button>
              </div>
            </div>
          )}
        </div>

        {step === "mapping" && (
          <DialogFooter className="p-6 pt-0 border-t mt-auto">
            <div className="flex justify-between w-full items-center">
              <p className="text-xs text-muted-foreground italic">
                * Pflichtfelder müssen zugeordnet werden
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  Abbrechen
                </Button>
                <Button 
                  className="bg-[#00463c] hover:bg-[#00332c] text-white"
                  onClick={handleImport}
                  disabled={!mapping["Keyword"] || !mapping["Target_URL"]}
                >
                  Import starten
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

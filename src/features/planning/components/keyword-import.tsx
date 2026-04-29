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
import { useI18n } from "@/i18n/use-i18n";

// Define the system columns that we want to map to
const SYSTEM_COLUMNS = [
  { id: "Keyword", label: "Keyword", required: true },
  { id: "Target_URL", label: "Target URL", required: true },
  { id: "Search_Volume", label: "Search Volume", required: false },
  { id: "Difficulty", label: "Difficulty", required: false },
  { id: "Ranking", label: "Ranking", required: false },
  { id: "Main_Keyword", label: "Main Keyword (Y/N)", required: false },
  { id: "Article_Count", label: "Article Count", required: false },
  { id: "Avg_Product_Value", label: "Avg Product Value", required: false },
  { id: "Page_Type", label: "Page Type (Kategorie/Ratgeber/Marke/Produkt)", required: false },
  { id: "Cluster", label: "Cluster", required: false },
  { id: "Status", label: "Status", required: false },
];

type Mapping = Record<string, string>;

export function KeywordImport() {
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);

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
      if (!newMapping["Keyword"] && (normalizedHeader === "name" || normalizedHeader === "term")) {
        newMapping["Keyword"] = header;
      }
      if (!newMapping["Target_URL"] && (normalizedHeader === "url" || normalizedHeader === "link")) {
        newMapping["Target_URL"] = header;
      }
      if (!newMapping["Search_Volume"] && (normalizedHeader === "volume" || normalizedHeader === "msv")) {
        newMapping["Search_Volume"] = header;
      }
      if (!newMapping["Page_Type"] && (normalizedHeader === "seitentyp" || normalizedHeader === "pagetype" || normalizedHeader === "type")) {
        newMapping["Page_Type"] = header;
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
            setError(tr("Die Datei scheint leer zu sein.", "The file appears to be empty."));
            setStep("error");
          }
        },
        error: (err) => {
          setError(tr(`Fehler beim Lesen der CSV: ${err.message}`, `Error reading CSV: ${err.message}`));
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
            setError(tr("Die Excel-Datei scheint leer zu sein.", "The Excel file appears to be empty."));
            setStep("error");
          }
        } catch (err: any) {
          setError(tr(`Fehler beim Lesen der Excel-Datei: ${err.message}`, `Error reading Excel file: ${err.message}`));
          setStep("error");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError(tr("Nicht unterstütztes Dateiformat. Bitte nutzen Sie CSV oder XLSX.", "Unsupported file format. Please use CSV or XLSX."));
      setStep("error");
    }
  };

  const handleImport = async () => {
    const missingRequired = SYSTEM_COLUMNS.filter(col => col.required && !mapping[col.id]);
    if (missingRequired.length > 0) {
      setError(tr(
        `Bitte ordnen Sie die Pflichtfelder zu: ${missingRequired.map(c => c.label).join(", ")}`,
        `Please map the required fields: ${missingRequired.map(c => c.label).join(", ")}`
      ));
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
            if (col.id === "Search_Volume" || col.id === "Difficulty" || col.id === "Article_Count" || col.id === "Ranking") {
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
        if (!mappedRow.Status) mappedRow.Status = "Backlog";
        return mappedRow;
      }).filter(kw => kw.Keyword && kw.Target_URL);

      if (keywords.length === 0) {
        throw new Error(tr("Keine gültigen Datensätze nach dem Mapping gefunden.", "No valid records found after mapping."));
      }

      const response = await fetch("/api/planning/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || tr("Import fehlgeschlagen", "Import failed"));
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
    XLSX.utils.book_append_sheet(workbook, worksheet, tr("Duplikate", "Duplicates"));
    XLSX.writeFile(workbook, tr("import_duplikate.xlsx", "import_duplicates.xlsx"));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/10 h-10 px-4">
          <Upload className="mr-2 h-4 w-4" />
          {tr("Keywords importieren", "Import keywords")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{tr("Keywords importieren", "Import keywords")}</DialogTitle>
          <DialogDescription>
            {tr(
              "Importieren Sie Keywords aus CSV- oder Excel-Dateien mit flexiblem Spalten-Mapping.",
              "Import keywords from CSV or Excel files with flexible column mapping."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6">
          {step === "upload" && (
            <div
              className="border-2 border-dashed border-primary/20 rounded-xl p-12 text-center hover:bg-primary/10 cursor-pointer transition-all group flex flex-col items-center justify-center gap-4 h-full min-h-[300px]"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="bg-primary/10 p-4 rounded-full group-hover:scale-110 transition-transform">
                <Upload className="h-10 w-10 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-primary">{tr("Datei auswählen", "Select file")}</p>
                <p className="text-sm text-muted-foreground mt-1">{tr("Klicken oder Datei hierher ziehen", "Click or drag file here")}</p>
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
              <div className="flex items-center justify-between bg-primary/10 p-3 rounded-lg border border-primary/10">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <span className="font-medium text-sm truncate max-w-[200px]">{fileName}</span>
                </div>
                <span className="text-xs text-muted-foreground">{fileData.length} {tr("Zeilen gefunden", "rows found")}</span>
                <Button variant="ghost" size="sm" onClick={() => setStep("upload")} className="h-7 text-xs">
                  {tr("Datei ändern", "Change file")}
                </Button>
              </div>

              <div className="flex-1 overflow-hidden border rounded-lg">
                <ScrollArea className="h-[350px]">
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4 pb-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div>{tr("System-Spalte", "System column")}</div>
                      <div>{tr("Ihre Datei-Spalte", "Your file column")}</div>
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
                          <SelectTrigger className={`h-9 ${mapping[col.id] ? 'border-primary/40 bg-primary/10' : ''}`}>
                            <SelectValue placeholder={tr("Nicht zugeordnet", "Not mapped")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{tr("Nicht zugeordnet", "Not mapped")}</SelectItem>
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
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-primary/40" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">{tr("Import läuft...", "Import in progress...")}</p>
                <p className="text-sm text-muted-foreground">{tr("Ihre Daten werden verarbeitet und gespeichert.", "Your data is being processed and saved.")}</p>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center gap-6 h-full min-h-[300px] px-6">
              <div className="bg-green-100 p-4 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-green-700">{tr("Import abgeschlossen!", "Import complete!")}</p>
                <div className="mt-4 w-full px-6">
                  <div className="grid grid-cols-2 gap-4 w-full text-center">
                    <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl">
                      <p className="text-3xl font-bold text-primary">{importCount}</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mt-1">{tr("Importiert", "Imported")}</p>
                    </div>
                    <div className={skippedCount > 0 ? "bg-amber-50 border border-amber-200 p-4 rounded-xl" : "bg-gray-50 border border-gray-200 p-4 rounded-xl"}>
                      <p className={`text-3xl font-bold ${skippedCount > 0 ? "text-amber-700" : "text-gray-500"}`}>{skippedCount}</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mt-1">{tr("Übersprungen", "Skipped")}</p>
                    </div>
                  </div>

                  {skippedCount > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4 text-left w-full">
                      <p className="text-sm text-amber-800 flex items-center gap-2 font-semibold mb-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {tr("Details zu den Übersprungenen:", "Details on skipped records:")}
                      </p>
                      <div className="w-full rounded border border-amber-100 bg-white/50 p-2 flex flex-col overflow-hidden">
                        <ScrollArea className="h-[120px] w-full">
                          <ul className="text-xs space-y-2 pr-2">
                            {skippedRecords.map((record, idx) => (
                              <li key={idx} className="border-b border-amber-100 pb-1 last:border-0 whitespace-normal break-words">
                                <span className="font-bold text-amber-900">{record.Keyword || tr("Unbekannt", "Unknown")}</span>: {record.reason || tr("Bereits vorhanden", "Already exists")}
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-amber-900 font-bold mt-2 h-auto p-0 justify-start w-fit text-xs"
                        onClick={downloadSkipped}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {tr("Liste als Excel laden", "Download as Excel")}
                      </Button>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 text-left w-full">
                    <p className="text-sm text-blue-800 flex items-center gap-2 font-semibold mb-1">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {tr("Rankings noch nicht abgefragt", "Rankings not yet fetched")}
                    </p>
                    <p className="text-xs text-blue-700">
                      {tr(
                        `Rankings für ${importCount} importierte Keywords werden beim nächsten automatischen Sync (montags, 04:30 Uhr) ermittelt. Keywords ohne Ranking in den Top 100 werden als \">100\" markiert. Du kannst den Sync auch manuell im Admin-Bereich starten.`,
                        `Rankings for ${importCount} imported keywords will be fetched at the next automatic sync (Mondays, 04:30 UTC). Keywords not ranking in the top 100 will be marked as ">100". You can also trigger the sync manually in the Admin area.`
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
                onClick={() => {
                  setIsOpen(false);
                  window.location.reload();
                }}
              >
                {tr("Import abschließen", "Finish import")}
              </Button>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col h-full gap-4 min-h-[300px]">
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>{tr("Fehler beim Import", "Import error")}</AlertTitle>
                <AlertDescription className="text-sm">
                  {error || tr("Ein unbekannter Fehler ist aufgetreten.", "An unknown error occurred.")}
                </AlertDescription>
              </Alert>
              <div className="flex-1 flex items-center justify-center">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  {tr("Erneut versuchen", "Try again")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {step === "mapping" && (
          <DialogFooter className="p-6 pt-0 border-t mt-auto">
            <div className="flex justify-between w-full items-center">
              <p className="text-xs text-muted-foreground italic">
                * {tr("Pflichtfelder müssen zugeordnet werden", "Required fields must be mapped")}
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  {tr("Abbrechen", "Cancel")}
                </Button>
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={handleImport}
                  disabled={!mapping["Keyword"] || !mapping["Target_URL"]}
                >
                  {tr("Import starten", "Start import")}
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

import * as React from "react";
import { 
  BarChart3, 
  Settings2, 
  Target, 
  ShieldCheck, 
  ShoppingBag, 
  Euro, 
  ExternalLink, 
  Calendar, 
  User, 
  Zap, 
  Loader2, 
  AlertCircle 
} from "lucide-react";
import Link from "next/link";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KeywordMap } from "@/lib/airtable-types";
import { useContentHistory } from "../hooks/useContentHistory";
import { HistoryList, MetricItem } from "../../shared/components";

interface EditEditorialModalProps {
  keyword: KeywordMap | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: any) => Promise<void>;
  onCommission: (id: string) => Promise<void>;
  isCommissioning: boolean;
  commissionedIds: Set<string>;
}

export function EditEditorialModal({ 
  keyword, 
  open, 
  onOpenChange, 
  onSave, 
  onCommission, 
  isCommissioning, 
  commissionedIds 
}: EditEditorialModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<Partial<KeywordMap>>({});
  const { history, isLoading: loadingHistory } = useContentHistory(keyword?.id, keyword?.Target_URL);

  React.useEffect(() => {
    if (keyword) {
      setFormData({
        Keyword: keyword.Keyword,
        Status: keyword.Status,
        Action_Type: keyword.Action_Type || 'Erstellung',
        Editorial_Deadline: keyword.Editorial_Deadline,
        Assigned_Editor: keyword.Assigned_Editor,
        Policy: keyword.Policy,
      });
    }
  }, [keyword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword) return;
    
    setError(null);
    setLoading(true);
    try {
      await onSave(keyword.id, formData);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  const isAlreadyCommissioned = React.useMemo(() => {
    if (!keyword) return false;
    return commissionedIds.has(keyword.id) || 
           keyword.Status === 'Beauftragt' || 
           (keyword.Status === 'In Progress' && commissionedIds.has(keyword.id)) || 
           keyword.Status === 'In Arbeit' ||
           keyword.Status === 'Erstellt' ||
           keyword.Status === 'Review' ||
           keyword.Status === 'Optimierung' ||
           keyword.Status === 'Published';
  }, [keyword, commissionedIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden gap-0">
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 bg-[#00463c]/5 border-b border-[#00463c]/10">
            <div className="flex items-center justify-between pr-8">
              <div className="space-y-1">
                <DialogTitle className="text-[#00463c] font-bold text-2xl flex items-center gap-2">
                  {keyword?.Keyword}
                </DialogTitle>
                <DialogDescription className="flex items-start gap-2">
                  {keyword?.Target_URL ? (
                    <a 
                      href={keyword.Target_URL} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-[#00463c] hover:underline flex items-start gap-1 break-all line-clamp-3"
                    >
                      <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
                      {keyword.Target_URL}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Keine URL hinterlegt</span>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* SEO Metrics Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#00463c] uppercase tracking-widest flex items-center gap-2">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Metriken
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col items-center justify-center bg-[#00463c] text-white p-3 rounded-lg shadow-sm border border-[#00463c]/20">
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">Priority Score</p>
                    <span className="text-2xl font-black tabular-nums leading-none">
                      {keyword?.Priority_Score?.toFixed(1) || "0.0"}
                    </span>
                  </div>
                  <MetricItem 
                    icon={Target} 
                    label="Suchvolumen" 
                    value={keyword?.Search_Volume?.toLocaleString("de-DE")} 
                  />
                  <MetricItem 
                    icon={ShieldCheck} 
                    label="Difficulty" 
                    value={keyword?.Difficulty} 
                    subValue="/ 100"
                  />
                  <MetricItem 
                    icon={ShoppingBag} 
                    label="Produkt-Count" 
                    value={keyword?.Article_Count} 
                  />
                  <MetricItem 
                    icon={Euro} 
                    label="Ø Produktwert" 
                    value={keyword?.Avg_Product_Value ? `${keyword.Avg_Product_Value.toFixed(2)}€` : undefined} 
                  />
                </div>
              </div>

              <Separator className="bg-[#00463c]/10" />

              {/* Editable Fields Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#00463c] uppercase tracking-widest flex items-center gap-2">
                  <Settings2 className="h-3.5 w-3.5" />
                  Planungs-Details
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-type" className="text-xs font-bold">Bearbeitungs-Typ</Label>
                    <Select 
                      value={formData.Action_Type} 
                      onValueChange={(v) => setFormData({ ...formData, Action_Type: v as any })}
                    >
                      <SelectTrigger id="edit-type" className="h-10 border-[#00463c]/20 focus:ring-[#00463c]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Erstellung">Erstellung</SelectItem>
                        <SelectItem value="Optimierung">Optimierung</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-deadline" className="text-xs font-bold">Deadline</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="edit-deadline"
                        type="date"
                        className="h-10 pl-10 border-[#00463c]/20 focus:ring-[#00463c]"
                        value={formData.Editorial_Deadline || ""}
                        onChange={(e) => setFormData({ ...formData, Editorial_Deadline: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-editor" className="text-xs font-bold">Editor</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="edit-editor"
                        placeholder="Editor Name..."
                        className="h-10 pl-10 border-[#00463c]/20 focus:ring-[#00463c]"
                        value={formData.Assigned_Editor?.[0] || ""}
                        onChange={(e) => setFormData({ ...formData, Assigned_Editor: e.target.value ? [e.target.value] : [] })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-policy" className="text-xs font-bold">Politik / Strategie Relevanz</Label>
                    <div className="flex items-center gap-3 h-10">
                      <Slider
                        id="edit-policy"
                        value={[formData.Policy || 0]}
                        onValueChange={(v: number | readonly number[]) => {
                          const val = Array.isArray(v) ? v[0] : v;
                          setFormData({ ...formData, Policy: val });
                        }}
                        max={100}
                        step={1}
                        className="flex-1"
                      />
                      <Badge variant="secondary" className="bg-[#00463c]/10 text-[#00463c] font-bold min-w-[45px] justify-center">
                        {formData.Policy || 0}%
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#00463c]/10 pt-4 mt-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-[#00463c]">Content-Status</Label>
                    <div className="flex items-center gap-2">
                      {isAlreadyCommissioned ? (
                        <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50 font-bold">
                          Beauftragt
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-muted-foreground bg-muted/20 font-bold">
                          Noch nicht beauftragt
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {!isAlreadyCommissioned && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-[#00463c] text-[#00463c] hover:bg-[#00463c] hover:text-white"
                      onClick={() => {
                        if (keyword) {
                          onCommission(keyword.id);
                        }
                      }}
                      disabled={isCommissioning}
                    >
                      {isCommissioning ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Zap className="h-3 w-3 mr-1 fill-current" />
                      )}
                      Content beauftragen
                    </Button>
                  )}
                </div>
              </div>

              <div className="border-t border-[#00463c]/10 pt-4 mt-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#00463c] uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Content-Historie
                  </h4>
                  {keyword?.Target_URL && (
                    <Link 
                      href={`/history?url=${encodeURIComponent(keyword.Target_URL)}`}
                      className="text-[10px] text-emerald-600 hover:underline font-bold flex items-center gap-1"
                    >
                      Vollständige Historie
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>

                <HistoryList history={history} isLoading={loadingHistory} />
              </div>

              {error && (
                <Alert variant="destructive" className="mt-4 overflow-hidden border-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <div className="flex-1 overflow-hidden">
                    <AlertTitle>Fehler</AlertTitle>
                    <AlertDescription className="break-words text-sm">
                      {error}
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-muted/30 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#00463c] hover:bg-[#00332c] min-w-[120px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

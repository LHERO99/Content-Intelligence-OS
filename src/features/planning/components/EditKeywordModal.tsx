import * as React from "react";
import { 
  Loader2, 
  Plus, 
  Calendar, 
  ExternalLink, 
  AlertCircle,
  Zap
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KeywordMap } from "@/lib/airtable-types";
import { useContentHistory } from "../hooks/useContentHistory";
import { HistoryList } from "../../shared/components";

interface EditKeywordModalProps {
  keyword: KeywordMap | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: any) => Promise<void>;
}

export function EditKeywordModal({ keyword, open, onOpenChange, onSave }: EditKeywordModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [isAddingToPlan, setIsAddingToPlan] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<Partial<KeywordMap>>({});
  const { history, isLoading: loadingHistory } = useContentHistory(keyword?.id, keyword?.Target_URL);

  React.useEffect(() => {
    if (keyword) {
      setFormData({
        Keyword: keyword.Keyword,
        Target_URL: keyword.Target_URL,
        Search_Volume: keyword.Search_Volume,
        Difficulty: keyword.Difficulty,
        Main_Keyword: keyword.Main_Keyword,
        Status: keyword.Status,
        Action_Type: keyword.Action_Type || 'Erstellung',
        Article_Count: keyword.Article_Count,
        Avg_Product_Value: keyword.Avg_Product_Value,
        Editorial_Deadline: keyword.Editorial_Deadline,
      });
    }
  }, [keyword]);

  const handleAddToContentPlan = async () => {
    if (!keyword) return;
    setIsAddingToPlan(true);
    setError(null);
    try {
      const updates: Partial<KeywordMap> = {
        Status: "Planned"
      };
      await onSave(keyword.id, updates);
      setFormData(prev => ({ ...prev, ...updates }));
    } catch (err: any) {
      setError(err.message || "Fehler beim Hinzufügen zum Content-Plan");
    } finally {
      setIsAddingToPlan(false);
    }
  };

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

  const closeDialog = () => onOpenChange(false);

  const isInContentPlan = React.useMemo(() => {
    return formData.Editorial_Deadline || (formData.Status && formData.Status !== "Backlog");
  }, [formData.Editorial_Deadline, formData.Status]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-[#00463c] flex items-center gap-2 font-bold text-xl">
              Keyword bearbeiten
            </DialogTitle>
            <DialogDescription>
              Ändern Sie die Details für "{keyword?.Keyword}".
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 pb-6">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="edit-keyword">Keyword *</Label>
                  <Input
                    id="edit-keyword"
                    value={formData.Keyword || ""}
                    onChange={(e) => setFormData({ ...formData, Keyword: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-main">Main Keyword</Label>
                  <Select 
                    value={formData.Main_Keyword} 
                    onValueChange={(v) => setFormData({ ...formData, Main_Keyword: v as 'Y' | 'N' })}
                  >
                    <SelectTrigger id="edit-main">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Y">Ja (Y)</SelectItem>
                      <SelectItem value="N">Nein (N)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-volume">Suchvolumen</Label>
                  <Input
                    id="edit-volume"
                    type="number"
                    value={formData.Search_Volume ?? ""}
                    onChange={(e) => setFormData({ ...formData, Search_Volume: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-difficulty">Difficulty</Label>
                  <Input
                    id="edit-difficulty"
                    type="number"
                    value={formData.Difficulty ?? ""}
                    onChange={(e) => setFormData({ ...formData, Difficulty: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select 
                    value={formData.Status} 
                    onValueChange={(v) => setFormData({ ...formData, Status: v as any })}
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Backlog">Backlog</SelectItem>
                      <SelectItem value="Planned">Planned</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Typ</Label>
                  <Select 
                    value={formData.Action_Type} 
                    onValueChange={(v) => setFormData({ ...formData, Action_Type: v as any })}
                  >
                    <SelectTrigger id="edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Erstellung">Erstellung</SelectItem>
                      <SelectItem value="Optimierung">Optimierung</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-url">Target URL *</Label>
                <Input
                  id="edit-url"
                  value={formData.Target_URL || ""}
                  onChange={(e) => setFormData({ ...formData, Target_URL: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-articles">Produkt-Count</Label>
                  <Input
                    id="edit-articles"
                    type="number"
                    value={formData.Article_Count ?? ""}
                    onChange={(e) => setFormData({ ...formData, Article_Count: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-value">Ø Produktwert</Label>
                  <Input
                    id="edit-value"
                    type="number"
                    step="0.01"
                    value={formData.Avg_Product_Value ?? ""}
                    onChange={(e) => setFormData({ ...formData, Avg_Product_Value: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
              </div>

              <div className="border-t border-[#00463c]/10 pt-4 mt-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-[#00463c]">Content-Plan Status</Label>
                    <div className="flex items-center gap-2">
                      {isInContentPlan ? (
                        <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">
                          Hinzugefügt
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-muted-foreground bg-muted/20">
                          Nicht im Plan
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {!isInContentPlan && formData.Main_Keyword === "Y" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 min-w-[110px] justify-center border-[#00463c] text-[#00463c] hover:bg-[#00463c] hover:text-white transition-colors"
                      onClick={handleAddToContentPlan}
                      disabled={isAddingToPlan || loading}
                    >
                      {isAddingToPlan ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Zap className="h-3 w-3 fill-current" />
                      )}
                      Hinzufügen
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
                <Alert variant="destructive" className="overflow-hidden border-red-200">
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

          <DialogFooter className="p-6 bg-muted/30 border-t border-border mt-auto">
            <Button type="button" variant="outline" onClick={closeDialog} disabled={loading}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#00463c] hover:bg-[#00332c]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

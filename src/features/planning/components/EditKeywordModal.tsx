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
import { LastActionHistory } from "../../shared/components";

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
        Ranking: keyword.Ranking,
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
      console.error("Error adding to plan:", err);
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
    return (formData.Editorial_Deadline || (formData.Status && formData.Status !== "Backlog")) && formData.Status !== "Backlog";
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

                <div className="grid grid-cols-3 gap-4">
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
                    <Label htmlFor="edit-ranking">Ranking</Label>
                    <Input
                      id="edit-ranking"
                      type="number"
                      value={formData.Ranking ?? ""}
                      onChange={(e) => setFormData({ ...formData, Ranking: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-url">Target URL *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="edit-url"
                      value={formData.Target_URL || ""}
                      onChange={(e) => setFormData({ ...formData, Target_URL: e.target.value })}
                      required
                    />
                    {formData.Target_URL && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon" 
                        className="shrink-0"
                        onClick={() => window.open(formData.Target_URL, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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

                <LastActionHistory history={history} isLoading={loadingHistory} />
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

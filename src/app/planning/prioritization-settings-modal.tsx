"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAlerts } from "@/components/alerts-provider";
import { Loader2, Settings2 } from "lucide-react";

interface PrioritizationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWeightsUpdated: () => void;
}

export function PrioritizationSettingsModal({
  isOpen,
  onClose,
  onWeightsUpdated,
}: PrioritizationSettingsModalProps) {
  const { addAlert } = useAlerts();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [weights, setWeights] = React.useState({
    weight_search_volume: 20,
    weight_difficulty: 20,
    weight_article_count: 20,
    weight_avg_value: 20,
    weight_policy: 20,
  });

  React.useEffect(() => {
    if (isOpen) {
      fetchWeights();
    }
  }, [isOpen]);

  const fetchWeights = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/config");
      if (!response.ok) throw new Error("Fehler beim Laden der Konfiguration");
      const config = await response.json();
      
      const newWeights = { ...weights };
      let foundAny = false;
      
      config.forEach((item: { key: string; value: any }) => {
        if (item.key in newWeights) {
          newWeights[item.key as keyof typeof weights] = Number(item.value) || 0;
          foundAny = true;
        }
      });

      if (foundAny) {
        setWeights(newWeights);
      }
    } catch (error) {
      console.error("Error fetching weights:", error);
      addAlert({
        title: "Fehler",
        message: "Die Priorisierungseinstellungen konnten nicht geladen werden.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Fehler beim Speichern der Konfiguration");
      }

      addAlert({
        message: "Priorisierungseinstellungen wurden erfolgreich gespeichert.",
        type: "success",
      });
      onWeightsUpdated();
      onClose();
    } catch (error: any) {
      console.error("Error saving weights:", error);
      addAlert({
        title: "Fehler",
        message: error.message || "Die Einstellungen konnten nicht vollständig gespeichert werden.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateWeight = (key: keyof typeof weights, value: number | readonly number[]) => {
    const val = Array.isArray(value) ? value[0] : value;
    setWeights((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-[#00463c]" />
            Priorisierungseinstellungen
          </DialogTitle>
          <DialogDescription>
            Passen Sie die Gewichtung der Metriken für die automatische Themen-Priorisierung an (0-100%).
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[#00463c]" />
          </div>
        ) : (
          <div className="grid gap-6 py-4">
            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Suchvolumen</Label>
                <span className="text-sm font-medium text-[#00463c]">{weights.weight_search_volume}%</span>
              </div>
              <Slider
                value={[weights.weight_search_volume]}
                onValueChange={(v) => updateWeight("weight_search_volume", v)}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Schwierigkeit (Invertiert)</Label>
                <span className="text-sm font-medium text-[#00463c]">{weights.weight_difficulty}%</span>
              </div>
              <Slider
                value={[weights.weight_difficulty]}
                onValueChange={(v) => updateWeight("weight_difficulty", v)}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Anzahl Artikel</Label>
                <span className="text-sm font-medium text-[#00463c]">{weights.weight_article_count}%</span>
              </div>
              <Slider
                value={[weights.weight_article_count]}
                onValueChange={(v) => updateWeight("weight_article_count", v)}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Durchschn. Artikelwert</Label>
                <span className="text-sm font-medium text-[#00463c]">{weights.weight_avg_value}%</span>
              </div>
              <Slider
                value={[weights.weight_avg_value]}
                onValueChange={(v) => updateWeight("weight_avg_value", v)}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Politik / Strategie</Label>
                <span className="text-sm font-medium text-[#00463c]">{weights.weight_policy}%</span>
              </div>
              <Slider
                value={[weights.weight_policy]}
                onValueChange={(v) => updateWeight("weight_policy", v)}
                max={100}
                step={1}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || isLoading}
            className="bg-[#00463c] hover:bg-[#00332c]"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Einstellungen speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

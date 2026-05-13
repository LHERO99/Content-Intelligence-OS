"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { BarChart3, CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

interface PricingTier {
  id: string;
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export default function PricingPage() {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTier, setEditTier] = useState<PricingTier | null>(null);
  const [form, setForm] = useState({ name: "", monthlyPrice: "", yearlyPrice: "", features: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/pricing-tiers");
    setTiers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTier(null);
    setForm({ name: "", monthlyPrice: "", yearlyPrice: "", features: "" });
    setDialogOpen(true);
  };

  const openEdit = (tier: PricingTier) => {
    setEditTier(tier);
    setForm({
      name:         tier.name,
      monthlyPrice: tier.monthlyPrice,
      yearlyPrice:  tier.yearlyPrice,
      features:     (tier.features ?? []).join("\n"),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      name:         form.name,
      monthlyPrice: parseFloat(form.monthlyPrice) || 0,
      yearlyPrice:  parseFloat(form.yearlyPrice) || 0,
      features:     form.features.split("\n").map((f) => f.trim()).filter(Boolean),
    };

    if (editTier) {
      await fetch(`/api/super-admin/pricing-tiers/${editTier.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/super-admin/pricing-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const deleteTier = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/super-admin/pricing-tiers/${id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6" /> Pricing Tiers
        </h1>
        <p className="text-muted-foreground mt-1">Definiere Abonnement-Pläne und weise sie Tenants zu.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Alle Tiers</CardTitle>
            <CardDescription>Monatliche und jährliche Preise mit enthaltenen Features.</CardDescription>
          </div>
          <Button size="sm" className="gap-1" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Neuer Tier
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tiers.map((tier) => (
                <Card key={tier.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{tier.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(tier)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteTier(tier.id)}
                          disabled={deletingId === tier.id}
                        >
                          {deletingId === tier.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-md bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">Monatlich</p>
                        <p className="font-bold text-sm">
                          €{parseFloat(tier.monthlyPrice).toLocaleString("de-DE")}
                        </p>
                      </div>
                      <div className="p-2 rounded-md bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">Jährlich</p>
                        <p className="font-bold text-sm">
                          €{parseFloat(tier.yearlyPrice).toLocaleString("de-DE")}
                        </p>
                      </div>
                    </div>
                    {tier.features && tier.features.length > 0 && (
                      <ul className="space-y-1">
                        {tier.features.map((f, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
              {tiers.length === 0 && (
                <div className="col-span-3 text-center text-muted-foreground py-12">
                  Noch keine Pricing Tiers angelegt. Klicke &quot;Neuer Tier&quot; um zu beginnen.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTier ? "Tier bearbeiten" : "Neuen Tier anlegen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. Starter, Pro, Enterprise"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monatspreis (€)</Label>
                <Input
                  type="number"
                  value={form.monthlyPrice}
                  onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Jahrespreis (€)</Label>
                <Input
                  type="number"
                  value={form.yearlyPrice}
                  onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Features (eine pro Zeile)</Label>
              <textarea
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                placeholder={"Unbegrenzte Keywords\nGSC Integration\nPriority Support"}
                rows={5}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving || !form.name}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editTier ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

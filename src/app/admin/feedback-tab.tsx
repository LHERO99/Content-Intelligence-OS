"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, CheckCircle2, Clock, Rocket, XCircle, Wrench, AlertTriangle } from "lucide-react";

type FeatureStatus = "Open" | "InValidation" | "Planned" | "InDevelopment" | "Released" | "Cancelled";

interface FeedbackItem {
  id: string;
  type: "feature" | "bug";
  title: string;
  description: string | null;
  status: FeatureStatus;
  priority: "low" | "medium" | "high";
  createdAt: string;
}

function StatusBadge({ status }: { status: FeatureStatus }) {
  const config: Record<FeatureStatus, { label: string; className: string; icon: React.ReactNode }> = {
    Open:          { label: "Offen",            className: "bg-slate-100 text-slate-800",   icon: <Clock className="w-3 h-3" /> },
    InValidation:  { label: "In Prüfung",       className: "bg-blue-100 text-blue-800",     icon: <AlertTriangle className="w-3 h-3" /> },
    Planned:       { label: "Geplant",           className: "bg-purple-100 text-purple-800", icon: <CheckCircle2 className="w-3 h-3" /> },
    InDevelopment: { label: "In Entwicklung",   className: "bg-orange-100 text-orange-800", icon: <Wrench className="w-3 h-3" /> },
    Released:      { label: "Veröffentlicht",   className: "bg-green-100 text-green-800",   icon: <Rocket className="w-3 h-3" /> },
    Cancelled:     { label: "Abgelehnt",        className: "bg-red-100 text-red-800",       icon: <XCircle className="w-3 h-3" /> },
  };
  const c = config[status];
  return (
    <Badge className={`${c.className} gap-1`}>
      {c.icon} {c.label}
    </Badge>
  );
}

export function FeedbackTab() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    type:        "feature" as "feature" | "bug",
    title:       "",
    description: "",
    priority:    "medium" as "low" | "medium" | "high",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/feedback");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.title.trim()) {
      setError("Bitte gib einen Titel ein.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);

    if (!res.ok) {
      setError("Fehler beim Einreichen. Bitte versuche es erneut.");
      return;
    }

    setSuccess(true);
    setShowForm(false);
    setForm({ type: "feature", title: "", description: "", priority: "medium" });
    setTimeout(() => setSuccess(false), 3000);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Submit Form */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Feedback einreichen</CardTitle>
            <CardDescription>Sende einen Feature Request oder Bug Report an das Entwicklungsteam.</CardDescription>
          </div>
          {!showForm && (
            <Button size="sm" className="gap-1" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> Neu
            </Button>
          )}
        </CardHeader>
        {showForm && (
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Typ</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "feature" | "bug" })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">Feature Request</SelectItem>
                    <SelectItem value="bug">Bug Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priorität</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as "low" | "medium" | "high" })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Titel</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Kurze Beschreibung..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Was soll passieren? Was ist das erwartete Verhalten?"
                rows={4}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowForm(false); setError(null); }}>
                Abbrechen
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Einreichen
              </Button>
            </div>
          </CardContent>
        )}
        {success && (
          <CardContent>
            <div className="rounded-md bg-green-50 text-green-800 text-sm p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Erfolgreich eingereicht!
            </div>
          </CardContent>
        )}
      </Card>

      {/* My Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>Meine Einreichungen</CardTitle>
          <CardDescription>Status-Übersicht deiner Feature Requests und Bug Reports</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Typ</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Priorität</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Eingereicht am</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={item.type === "bug" ? "border-red-300 text-red-700" : "border-blue-300 text-blue-700"}
                      >
                        {item.type === "bug" ? "Bug" : "Feature"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          item.priority === "high"   ? "bg-red-100 text-red-800" :
                          item.priority === "medium" ? "bg-yellow-100 text-yellow-800" :
                                                       "bg-slate-100 text-slate-700"
                        }
                      >
                        {item.priority === "high" ? "Hoch" : item.priority === "medium" ? "Mittel" : "Niedrig"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("de-DE")}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Noch keine Einreichungen vorhanden.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

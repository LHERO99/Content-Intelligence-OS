"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Loader2, MessageSquare, RefreshCw } from "lucide-react";

type FeatureStatus = "Open" | "InValidation" | "Planned" | "InDevelopment" | "Released" | "Cancelled";

interface FeatureRequest {
  id: string;
  type: "feature" | "bug";
  title: string;
  description: string | null;
  status: FeatureStatus;
  priority: "low" | "medium" | "high";
  createdAt: string;
  tenantId: string;
  tenantName: string | null;
}

const FEATURE_STATUSES: FeatureStatus[] = [
  "Open", "InValidation", "Planned", "InDevelopment", "Released", "Cancelled",
];

const STATUS_CONFIG: Record<FeatureStatus, { label: string; className: string }> = {
  Open:          { label: "Open",           className: "bg-slate-100 text-slate-800" },
  InValidation:  { label: "In Validation",  className: "bg-blue-100 text-blue-800" },
  Planned:       { label: "Planned",        className: "bg-purple-100 text-purple-800" },
  InDevelopment: { label: "In Development", className: "bg-orange-100 text-orange-800" },
  Released:      { label: "Released",       className: "bg-green-100 text-green-800" },
  Cancelled:     { label: "Cancelled",      className: "bg-red-100 text-red-800" },
};

function StatusBadge({ status }: { status: FeatureStatus }) {
  const c = STATUS_CONFIG[status];
  return <Badge className={c.className}>{c.label}</Badge>;
}

function PriorityBadge({ priority }: { priority: "low" | "medium" | "high" }) {
  const map = {
    low:    "bg-slate-100 text-slate-700",
    medium: "bg-yellow-100 text-yellow-800",
    high:   "bg-red-100 text-red-800",
  };
  return <Badge className={map[priority]}>{priority}</Badge>;
}

export default function FeedbackPage() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/super-admin/feature-requests?${params}`);
    setRequests(await res.json());
    setLoading(false);
  }, [typeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: FeatureStatus) => {
    setUpdatingId(id);
    await fetch(`/api/super-admin/feature-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    setUpdatingId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="w-6 h-6" /> Feature &amp; Bug Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Zentrale Ansicht aller Einreichungen von Tenants. Status direkt hier änderbar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Alle Einreichungen</CardTitle>
              <CardDescription>Cross-Tenant Übersicht mit Filter- und Status-Verwaltung.</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Typen</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  {FEATURE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={load}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Typ</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Priorität</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erstellt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={r.type === "bug"
                          ? "border-red-300 text-red-700"
                          : "border-blue-300 text-blue-700"}
                      >
                        {r.type === "bug" ? "Bug" : "Feature"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{r.title}</p>
                        {r.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {r.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.tenantName ?? r.tenantId}
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={r.priority} />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.status}
                        onValueChange={(v) => v && updateStatus(r.id, v as FeatureStatus)}
                        disabled={updatingId === r.id}
                      >
                        <SelectTrigger className="h-7 w-40 border-0 p-0 shadow-none focus:ring-0">
                          {updatingId === r.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <StatusBadge status={r.status} />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {FEATURE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              <StatusBadge status={s} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("de-DE")}
                    </TableCell>
                  </TableRow>
                ))}
                {requests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      Keine Einträge gefunden.
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

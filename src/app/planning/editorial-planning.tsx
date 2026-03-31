"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Map } from "lucide-react";
import { KeywordMap } from "@/lib/airtable-types";

interface EditorialPlanningProps {
  keywords: KeywordMap[];
}

export function EditorialPlanning({ keywords }: EditorialPlanningProps) {
  // Filter keywords that have a deadline or are in progress
  const plannedKeywords = keywords
    .filter(kw => kw.Editorial_Deadline || kw.Status !== "Backlog")
    .sort((a, b) => {
      if (!a.Editorial_Deadline) return 1;
      if (!b.Editorial_Deadline) return -1;
      return new Date(a.Editorial_Deadline).getTime() - new Date(b.Editorial_Deadline).getTime();
    });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[#00463c]">
          <Calendar className="h-6 w-6" />
          <h3 className="text-xl font-semibold">Redaktions-Planung</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Übersicht der geplanten Inhalte und deren Redaktionsschluss.
        </p>
      </div>

      <Card className="border-[#00463c]/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-[#00463c]/10">
                  <TableHead className="text-[#00463c] font-bold whitespace-nowrap">Keyword</TableHead>
                  <TableHead className="text-[#00463c] font-bold whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-[#00463c] font-bold whitespace-nowrap">Deadline</TableHead>
                  <TableHead className="text-[#00463c] font-bold whitespace-nowrap">Editor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plannedKeywords.length > 0 ? (
                  plannedKeywords.map((kw) => (
                    <TableRow key={kw.id} className="hover:bg-muted/50 border-[#00463c]/5">
                      <TableCell className="font-medium whitespace-nowrap">{kw.Keyword}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge className="bg-[#00463c] text-[#e7f3ee] hover:bg-[#00463c]/90">
                          {kw.Status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {kw.Editorial_Deadline ? new Date(kw.Editorial_Deadline).toLocaleDateString('de-DE') : "Nicht gesetzt"}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {kw.Assigned_Editor && kw.Assigned_Editor.length > 0 ? "Zugewiesen" : "Offen"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Keine geplanten Keywords gefunden.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

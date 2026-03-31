"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, User } from "lucide-react";
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-[#00463c]">Redaktions-Planung</h3>
          <p className="text-sm text-muted-foreground">
            Übersicht der geplanten Inhalte und deren Redaktionsschluss.
          </p>
        </div>
      </div>

      <Card className="border-[#00463c]/10 overflow-hidden">
        <CardHeader className="bg-[#e7f3ee]/30">
          <CardTitle className="text-lg text-[#00463c]">Aktueller Plan</CardTitle>
          <CardDescription>
            Alle Keywords mit zugewiesenen Deadlines oder Bearbeitungsstatus.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[300px] whitespace-nowrap">Keyword</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Deadline</TableHead>
                  <TableHead className="whitespace-nowrap">Editor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plannedKeywords.length > 0 ? (
                  plannedKeywords.map((kw) => (
                    <TableRow key={kw.id} className="hover:bg-[#e7f3ee]/20">
                      <TableCell className="font-medium whitespace-nowrap">{kw.Keyword}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge className="bg-[#00463c] text-[#e7f3ee]">
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

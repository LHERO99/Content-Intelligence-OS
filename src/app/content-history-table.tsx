"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ContentLog } from "@/lib/airtable-types";
import { Loader2, History, FileText, Zap } from "lucide-react";

interface ContentHistoryTableProps {
  logs: ContentLog[];
  loading?: boolean;
}

export function ContentHistoryTable({ logs, loading }: ContentHistoryTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#00463c]/40" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/20 rounded-lg border border-dashed border-border">
        <History className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Keine Content-Historie gefunden</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#00463c]/10 overflow-hidden">
      <Table>
        <TableHeader className="bg-[#00463c]/5">
          <TableRow>
            <TableHead className="text-[#00463c] font-bold">Datum</TableHead>
            <TableHead className="text-[#00463c] font-bold">Aktion</TableHead>
            <TableHead className="text-[#00463c] font-bold">Keyword ID</TableHead>
            <TableHead className="text-[#00463c] font-bold">Zusammenfassung</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-medium whitespace-nowrap">
                {new Date(log.Created_At).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </TableCell>
              <TableCell>
                <Badge 
                  variant="secondary" 
                  className={`flex items-center gap-1 w-fit ${
                    log.Action_Type === 'Erstellung' 
                      ? 'bg-blue-100 text-blue-700 border-blue-200' 
                      : 'bg-green-100 text-green-700 border-green-200'
                  }`}
                >
                  {log.Action_Type === 'Erstellung' ? <FileText className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                  {log.Action_Type}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {log.Keyword_ID?.[0] || '-'}
              </TableCell>
              <TableCell className="max-w-[300px] truncate text-sm">
                {log.Diff_Summary || log.Reasoning_Chain || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

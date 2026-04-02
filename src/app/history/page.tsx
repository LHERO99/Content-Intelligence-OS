"use client";

import React, { useState, useEffect } from 'react';
import { ContentLog } from '@/lib/airtable-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentHistoryTable } from "../content-history-table";
import { useAlerts } from "@/components/alerts-provider";

export default function HistoryPage() {
  const [logs, setLogs] = useState<ContentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { addAlert } = useAlerts();

  const fetchHistory = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await fetch('/api/planning/history');
      if (!response.ok) throw new Error('Fehler beim Laden der Historie');
      const data = await response.json();
      setLogs(data);
    } catch (error: any) {
      console.error('Failed to fetch history:', error);
      addAlert({
        title: 'Fehler',
        message: error.message || 'Die Content-Historie konnte nicht geladen werden.',
        type: 'error'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-2 text-[#00463c]">
          <History className="h-8 w-8" />
          <h1 className="text-3xl font-bold tracking-tight">Content-Historie</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchHistory(true)}
            disabled={refreshing}
            className="border-[#00463c]/20 text-[#00463c]"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      <Card className="bg-white border-[#00463c]/10">
        <CardHeader>
          <CardTitle className="text-[#00463c]">Globale Content-Historie</CardTitle>
          <CardDescription>Vollständige Liste aller Erstellungen und Optimierungen über alle URLs.</CardDescription>
        </CardHeader>
        <CardContent>
          <ContentHistoryTable logs={logs} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}

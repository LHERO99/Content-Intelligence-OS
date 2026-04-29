"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ContentLog } from '@/lib/airtable-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { History } from "lucide-react";
import { ContentHistoryTable } from "../content-history-table";
import { useAlerts } from "@/components/alerts-provider";
import { useI18n } from "@/i18n/use-i18n";

// Remove the 'refreshing' state and the button
export default function HistoryPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<ContentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { addAlert } = useAlerts();
  const initialUrl = searchParams.get('url') || undefined;

  const fetchHistory = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/planning/history');
      if (!response.ok) throw new Error(t('history.loadError'));
      const data = await response.json();
      setLogs(data);
    } catch (error: any) {
      console.error('Failed to fetch history:', error);
      addAlert({
        title: 'Fehler',
        message: error.message || t('history.loadErrorMessage'),
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <History className="h-8 w-8" />
          <h1 className="text-3xl font-bold tracking-tight">{t('history.title')}</h1>
        </div>
      </div>

      <Card className="bg-white border-primary/10">
        <CardHeader>
          <CardTitle className="text-primary">{t('history.globalTitle')}</CardTitle>
          <CardDescription>{t('history.globalDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ContentHistoryTable logs={logs} loading={loading} initialUrl={initialUrl} />
        </CardContent>
      </Card>
    </div>
  );
}

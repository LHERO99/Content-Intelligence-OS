'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { KeywordMap, ContentLog, KeywordStatus } from '@/lib/postgres-types';
import { triggerN8nAction } from '@/lib/n8n';
import { AIEditorWorkspace } from './ai-editor-workspace';
import { cn } from '@/lib/utils';
import {
  Loader2, Send, Zap, Clock, FileText, AlertTriangle,
  RefreshCw, Map as MapIcon, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/i18n/use-i18n';
import { toLocaleTag } from '@/i18n/locale-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * One entry in the Auftrags-Liste = one commissioning event.
 * Derived from a single "Content wurde beauftragt" log entry.
 */
interface JobEntry {
  /** ID of the "Content wurde beauftragt" content_log row */
  commissionLogId: number;
  commissionedAt: string;
  keywordId: string;
  keyword: string;
  targetUrl?: string;
  actionType: 'Erstellung' | 'Optimierung';
  keywordStatus: KeywordStatus;
  /** ID of the next "Content angeliefert" log after this commissioning event */
  deliveryLogId?: number;
  /**
   * ID of the newest v2 log for this cycle (used to load the displayed body).
   * After a manual save a new log is created; displayLogId points to that newer log
   * so the editor always shows the latest saved version, not the original delivery.
   * Falls back to deliveryLogId for cycles without a Commission_Log_Id (pre-migration).
   */
  displayLogId?: number;
  /** True when the keyword was reset to Planned after a failed run */
  isFailedRetry: boolean;
}

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildJobEntries(
  contentLogs: ContentLog[],
  keywords: KeywordMap[],
): JobEntry[] {
  const kwMap: Record<string, KeywordMap> = {};
  keywords.forEach((k) => {
    kwMap[k.id] = k;
  });

  // All commissioning events, newest first (logs are already sorted desc by API)
  // Extra safeguard: only show commission logs for keywords that are actually commissioned
  const commissioningLogs = contentLogs.filter((l) => {
    const keywordId = l.Keyword_ID?.[0];
    if (!keywordId) return false;
    
    // Must have the correct event label
    if (l.Event_Label !== 'Content wurde beauftragt') return false;
    
    // Extra safety: keyword must actually be in commissioned workflow status
    const keyword = kwMap[keywordId];
    if (!keyword) return false;
    
    // Only show main keywords in commission list
    // (All keywords of a URL share the same execution cycle)
    if (keyword.Main_Keyword !== 'Y') return false;
    
    // Only show if keyword is in the commissioned workflow (not just "Planned")
    return keyword.Status === 'Beauftragt' || 
           keyword.Status === 'In Arbeit' || 
           keyword.Status === 'Angeliefert' || 
           keyword.Status === 'Review' ||
           keyword.Status === 'Published';
  });

  // All delivery logs (v2 = has actual content body)
  const deliveryLogs = contentLogs.filter(
    (l) => l.Event_Label === 'Content angeliefert' && l.Version === 'v2',
  );

  // All publish logs — used to determine per-cycle published status
  const publishLogs = contentLogs.filter(
    (l) => l.Event_Label === 'Content veröffentlicht',
  );

  // Newest v2 log per commission cycle — tracks the latest saved version for display.
  // After a manual save the new log has Commission_Log_Id set; this map always points
  // to the most recent v2 entry so bodyCache always fetches the latest content.
  const latestV2LogByCommission = new Map<number, ContentLog>();
  for (const log of contentLogs) {
    if (log.Version !== 'v2' || log.Commission_Log_Id == null) continue;
    const existing = latestV2LogByCommission.get(log.Commission_Log_Id);
    if (!existing || new Date(log.Created_At) > new Date(existing.Created_At)) {
      latestV2LogByCommission.set(log.Commission_Log_Id, log);
    }
  }

  // Identify the "active" (newest) commissioning log ID per keyword.
  // commissioningLogs are already sorted newest-first from the API.
  const activeCommissionIdByKeyword = new Map<string, number>();
  for (const cl of commissioningLogs) {
    const kwId = cl.Keyword_ID?.[0];
    if (kwId && !activeCommissionIdByKeyword.has(kwId)) {
      activeCommissionIdByKeyword.set(kwId, cl.ID);
    }
  }

  return commissioningLogs.filter(cl => cl.Keyword_ID?.[0]).map((cl): JobEntry => {
    const kwId = cl.Keyword_ID![0];
    const kw = kwMap[kwId];
    const commissionedAt = cl.Created_At;

    // --- Delivery lookup ---
    // Prefer FK-based lookup (Commission_Log_Id set on new data).
    // Fall back to temporal proximity for rows that pre-date this migration.
    let delivery = deliveryLogs.find(
      (dl) => dl.Commission_Log_Id != null && dl.Commission_Log_Id === cl.ID,
    );
    if (!delivery) {
      // Temporal fallback: earliest delivery for the same keyword AFTER this commissioning
      delivery = deliveryLogs
        .filter(
          (dl) =>
            dl.Commission_Log_Id == null &&
            dl.Keyword_ID?.[0] === kwId &&
            new Date(dl.Created_At!).getTime() > new Date(commissionedAt).getTime(),
        )
        .sort((a, b) => new Date(a.Created_At!).getTime() - new Date(b.Created_At!).getTime())[0];
    }

    // --- Per-cycle publish status ---
    // A cycle is "Published" when it has its own "Content veröffentlicht" log entry
    // linked via Commission_Log_Id FK. For legacy data (no FK) we fall back to kw.Status
    // only for the active (newest) cycle.
    const publishLog = publishLogs.find(
      (pl) => pl.Commission_Log_Id != null && pl.Commission_Log_Id === cl.ID,
    );

    const isActiveCycle = activeCommissionIdByKeyword.get(kwId) === cl.ID;
    let keywordStatus: KeywordStatus;
    if (publishLog) {
      keywordStatus = 'Published';
    } else if (isActiveCycle) {
      // Active cycle: use the live kw.Status (tracks Beauftragt → In Arbeit → Angeliefert etc.)
      keywordStatus = kw?.Status ?? ('Backlog' as KeywordStatus);
    } else {
      // Older cycle without a FK-linked publish log — legacy data.
      // Show Published only if kw.Status is Published AND this cycle has a delivery log.
      keywordStatus = (kw?.Status === 'Published' && !!delivery)
        ? 'Published'
        : ('Backlog' as KeywordStatus);
    }

    // displayLogId: prefer the newest FK-linked v2 log; fall back to deliveryLogId
    // for pre-migration cycles that have no Commission_Log_Id on any content log.
    const latestV2Log = latestV2LogByCommission.get(cl.ID);
    const displayLogId = latestV2Log?.ID ?? delivery?.ID;

    return {
      commissionLogId: cl.ID,
      commissionedAt,
      keywordId: kwId,
      keyword: kw?.Keyword ?? kwId,
      targetUrl: kw?.Target_URL ?? cl.Target_URL,
      actionType: (cl.Action_Type === 'Optimierung' ? 'Optimierung' : 'Erstellung') as 'Erstellung' | 'Optimierung',
      keywordStatus,
      deliveryLogId: delivery?.ID,
      displayLogId,
      // Failed = active cycle keyword was reset to Planned with no delivery yet
      isFailedRetry: isActiveCycle && keywordStatus === 'Planned' && !delivery,
    };
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreationPage() {
  const { locale, t } = useI18n();
  const localeTag = toLocaleTag(locale);
  const tr = (de: string, en: string) => (locale === 'de' ? de : en);

  const [keywords, setKeywords] = useState<KeywordMap[]>([]);
  const [contentLogs, setContentLogs] = useState<ContentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  // Which job row is selected (commission log id as string key)
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  // Pagination
  const [jobPage, setJobPage] = useState(0);

  // Body cache: logId → { Content_Body, Event_Label }
  const [bodyCache, setBodyCache] = useState<
    Record<string, { Content_Body?: string; Event_Label?: string }>
  >({});

  // ── Data fetching ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      try {
        const [kwRes, logRes] = await Promise.all([
          fetch('/api/planning/keywords'),
          fetch('/api/planning/history'),
        ]);
        const kwData = await kwRes.json();
        const logData = await logRes.json();
        setKeywords(Array.isArray(kwData) ? kwData : kwData?.sampleRecords ?? []);
        setContentLogs(Array.isArray(logData) ? logData : []);
      } catch {
        toast.error(t('creation.loadError'));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 5000);
    const onRefresh = () => fetchData();
    window.addEventListener('refresh-planning-data', onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('refresh-planning-data', onRefresh);
    };
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const allJobs = useMemo(
    () => buildJobEntries(contentLogs, keywords),
    [contentLogs, keywords],
  );

  const totalPages = Math.ceil(allJobs.length / PAGE_SIZE);
  const pagedJobs = allJobs.slice(jobPage * PAGE_SIZE, (jobPage + 1) * PAGE_SIZE);

  const selectedJob = allJobs.find((j) => j.commissionLogId === selectedJobId) ?? null;

  // Keyword record for the selected job (needed by AIEditorWorkspace)
  const selectedKeyword = selectedJob
    ? keywords.find((k) => k.id === selectedJob.keywordId)
    : null;

  // ── Body on-demand loading ───────────────────────────────────────────────────
  // Use displayLogId (newest v2 log for the cycle) so that after a manual save
  // the editor reloads the latest saved body rather than the original delivery.
  // Falls back to deliveryLogId for pre-migration cycles (no Commission_Log_Id).
  const displayLogId = selectedJob?.displayLogId
    ? String(selectedJob.displayLogId)
    : null;

  useEffect(() => {
    if (!displayLogId || bodyCache[displayLogId] !== undefined) return;
    fetch(`/api/planning/history/${displayLogId}/body`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setBodyCache((prev) => ({ ...prev, [displayLogId]: data }));
      })
      .catch(() => {/* non-critical */});
  }, [displayLogId]);

  const displayedBody = displayLogId ? bodyCache[displayLogId] : undefined;
  const v2Content = displayedBody?.Content_Body ?? '';

  // v1 content: first non-v2 log for the keyword (legacy plain text, rarely used)
  const v1Content = useMemo(() => {
    if (!selectedJob) return '';
    return (
      contentLogs
        .filter(
          (l) =>
            l.Keyword_ID?.[0] === selectedJob.keywordId && l.Version === 'v1',
        )
        .sort(
          (a, b) =>
            new Date(a.Created_At).getTime() - new Date(b.Created_At).getTime(),
        )[0]?.Content_Body ?? ''
    );
  }, [selectedJob, contentLogs]);

  // ── Retry handler ────────────────────────────────────────────────────────────
  const handleRetry = async (job: JobEntry) => {
    try {
      setRetrying(String(job.commissionLogId));
      const actionType =
        job.actionType === 'Optimierung' ? 'COMMISSION_OPTIMIZATION' : 'COMMISSION_CONTENT';
      await triggerN8nAction(actionType, {
        keywordId: job.keywordId,
        keyword: job.keyword,
        targetUrl: job.targetUrl ?? '',
      });
      toast.success(tr('Content erneut beauftragt.', 'Content re-commissioned.'));
    } catch {
      toast.error(tr('Fehler beim erneuten Beauftragen.', 'Error re-commissioning content.'));
    } finally {
      setRetrying(null);
    }
  };

  // ── Status badge styling ─────────────────────────────────────────────────────
  const statusBadgeClass = (job: JobEntry) => {
    if (job.isFailedRetry) return 'bg-red-100 text-red-700 border-red-200';
    const s = job.keywordStatus;
    if (s === 'Beauftragt' || s === 'In Arbeit')
      return 'bg-amber-100 text-amber-700 border-amber-200';
    if (s === 'Angeliefert') return 'bg-primary text-primary-foreground border-primary';
    if (s === 'Review') return 'bg-purple-100 text-purple-700 border-purple-200';
    if (s === 'Optimierung') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    return 'bg-primary/15 text-primary border-primary/25';
  };

  const statusLabel = (job: JobEntry) => {
    if (job.isFailedRetry) return tr('Fehlgeschlagen', 'Failed');
    const s = job.keywordStatus;
    if (s === 'Beauftragt' || s === 'In Arbeit') return t('creation.inProgress');
    if (s === 'Published') return tr('Veröffentlicht', 'Published');
    return s;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString(localeTag, { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ', ' +
      d.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-120px)] space-y-6 text-primary">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('creation.title')}</h1>
          <p className="text-muted-foreground">{t('creation.subtitle')}</p>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          {/* ── Left: Auftrags-Liste ─────────────────────────────────────────── */}
          <Card className="lg:col-span-4 flex flex-col overflow-hidden border-primary/20 h-full">
            <CardHeader className="bg-primary/10 border-b border-primary/20 py-4 shrink-0">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
                <Zap className="h-5 w-5 fill-primary text-primary" />
                {t('creation.jobs')}
                {allJobs.length > 0 && (
                  <Badge variant="secondary" className="ml-auto bg-primary/10 text-primary text-xs">
                    {allJobs.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader className="bg-primary/5 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-primary font-bold">{tr('Auftrag', 'Job')}</TableHead>
                      <TableHead className="text-primary font-bold text-right">{tr('Status', 'Status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedJobs.length > 0 ? (
                      pagedJobs.map((job) => (
                        <TableRow
                          key={job.commissionLogId}
                          className={cn(
                            'cursor-pointer transition-all hover:bg-primary/10 relative',
                            selectedJobId === job.commissionLogId
                              ? 'bg-primary/10 !bg-primary/10 border-l-4 border-l-primary shadow-[inset_4px_0_0_0_var(--primary)]'
                              : 'border-l-4 border-l-transparent',
                          )}
                          onClick={() => setSelectedJobId(job.commissionLogId)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1 py-1">
                              <span className="text-sm font-bold leading-tight">{job.keyword}</span>
                              {job.targetUrl && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate max-w-[200px]">
                                  <FileText className="h-3 w-3 shrink-0" />
                                  <span className="truncate">
                                    {job.targetUrl.replace(/^https?:\/\/(www\.)?/, '')}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 mt-1">
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1.5 py-0 uppercase tracking-wider font-bold border-slate-200 text-slate-500 bg-slate-50/50"
                                >
                                  {job.actionType}
                                </Badge>
                                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-slate-400" />
                                  {formatDate(job.commissionedAt)}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="secondary"
                              className={cn('whitespace-nowrap', statusBadgeClass(job))}
                            >
                              {statusLabel(job)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : keywords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="py-8">
                          <div className="flex flex-col items-center gap-2 text-center px-4 w-full">
                            <MapIcon className="h-7 w-7 text-primary/30 shrink-0" />
                            <p className="text-xs font-medium text-primary leading-snug">
                              {t('onboarding.keywordMapRequired')}
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              {t('onboarding.keywordMapRequiredDesc')}
                            </p>
                            <Link
                              href="/planning?tab=keyword-map"
                              className="text-[11px] text-primary underline hover:no-underline font-medium"
                            >
                              {t('onboarding.goToKeywordMap')}
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic">
                          {t('creation.noActiveJobs')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="shrink-0 flex items-center justify-between border-t border-primary/10 px-3 py-2 bg-primary/5">
                  <span className="text-[11px] text-muted-foreground">
                    {jobPage * PAGE_SIZE + 1}–{Math.min((jobPage + 1) * PAGE_SIZE, allJobs.length)}{' '}
                    {tr('von', 'of')} {allJobs.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={jobPage === 0}
                      onClick={() => setJobPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-[11px] font-medium text-primary tabular-nums">
                      {jobPage + 1} / {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={jobPage >= totalPages - 1}
                      onClick={() => setJobPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Right: Editor & Preview ──────────────────────────────────────── */}
          <div className="lg:col-span-8 flex flex-col gap-4 overflow-hidden h-full">
            {!selectedJob ? (
              <div className="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-primary/30 rounded-xl bg-white/50">
                <Send className="w-12 h-12 text-primary/40 mb-4" />
                <h2 className="text-xl font-medium text-primary">{t('creation.selectJob')}</h2>
              </div>
            ) : (
              <div className="flex flex-col gap-4 flex-1 min-h-0 h-full">
                <div className="flex items-center justify-between shrink-0">
                  <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {t('creation.preview')}: {selectedJob.keyword}
                    <Badge
                      variant="outline"
                      className="ml-1 text-xs font-semibold border-slate-200 text-slate-600 bg-slate-50"
                    >
                      {selectedJob.actionType}
                    </Badge>
                  </h3>
                </div>

                <div className="flex-1 min-h-0">
                  {selectedJob.isFailedRetry ? (
                    <div className="flex flex-col items-center justify-center h-full border border-red-200 rounded-lg bg-red-50/40 gap-4 p-8 text-center">
                      <AlertTriangle className="h-10 w-10 text-red-500" />
                      <div>
                        <p className="text-sm font-semibold text-red-700">
                          {tr('Agent-Run fehlgeschlagen', 'Agent run failed')}
                        </p>
                        <p className="text-xs text-red-500 mt-1">
                          {tr(
                            'Der letzte Ausführungsversuch ist fehlgeschlagen. Du kannst den Auftrag erneut anstoßen.',
                            'The last execution attempt failed. You can re-commission the content.',
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRetry(selectedJob)}
                        disabled={retrying === String(selectedJob.commissionLogId)}
                        className={cn(
                          'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                          'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed',
                        )}
                      >
                        {retrying === String(selectedJob.commissionLogId) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        {tr('Erneut beauftragen', 'Re-commission')}
                      </button>
                    </div>
                  ) : !v2Content ? (
                    <div className="flex flex-col items-center justify-center h-full border rounded-lg bg-muted/10">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                      <p className="text-sm text-muted-foreground">{t('creation.generating')}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 italic">
                        {t('creation.generatingHint')}
                      </p>
                    </div>
                  ) : (
                    <AIEditorWorkspace
                      v1Content={v1Content}
                      v2Content={v2Content}
                      mode={selectedJob.actionType}
                      keywordId={selectedJob.keywordId}
                      keyword={selectedJob.keyword}
                      currentStatus={selectedJob.keywordStatus}
                      commissionLogId={selectedJob.commissionLogId}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

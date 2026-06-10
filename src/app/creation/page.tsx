'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { KeywordMap, ContentLog, KeywordStatus } from '@/lib/postgres-types';
import { triggerN8nAction } from '@/lib/n8n';
import { AIEditorWorkspace } from './ai-editor-workspace';
import { cn } from '@/lib/utils';
import {
  Loader2, Send, Zap, Clock, FileText, AlertTriangle,
  RefreshCw, Map as MapIcon, User, Square, RotateCcw, Activity,
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface JobEntry {
  commissionLogId: number;
  commissionedAt: string;
  keywordId: string;
  keyword: string;
  targetUrl?: string;
  actionType: 'Erstellung' | 'Optimierung';
  keywordStatus: KeywordStatus;
  deliveryLogId?: number;
  displayLogId?: number;
  /** True when the keyword was reset to Planned after a failed run (legacy) */
  isFailedRetry: boolean;
  userName?: string;
  userEmail?: string;
  /** ID of the linked agent_workflow_run (from execution_cycles.agent_run_id) */
  agentRunId?: string | null;
  /** execution_cycle.id — needed for cancel/restart */
  cycleId?: number | null;
}

interface AgentProgress {
  round?: number;
  activeAgentName?: string;
  phase?: string;
}

const PAGE_SIZE = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildJobEntries(contentLogs: ContentLog[], keywords: KeywordMap[]): JobEntry[] {
  const kwMap: Record<string, KeywordMap> = {};
  keywords.forEach((k) => { kwMap[k.id] = k; });

  const commissioningLogs = contentLogs.filter((l) => {
    const keywordId = l.Keyword_ID?.[0];
    if (!keywordId || l.Event_Label !== 'Content wurde beauftragt') return false;
    const keyword = kwMap[keywordId];
    if (!keyword || keyword.Main_Keyword !== 'Y') return false;
    return (
      keyword.Status === 'Beauftragt' || keyword.Status === 'In Arbeit' ||
      keyword.Status === 'Angeliefert' || keyword.Status === 'Review' ||
      keyword.Status === 'Published' || keyword.Status === 'Fehlgeschlagen' ||
      keyword.Status === 'Abgebrochen'
    );
  });

  const deliveryLogs = contentLogs.filter(
    (l) => l.Event_Label === 'Content angeliefert' && l.Version === 'v2',
  );
  const publishLogs = contentLogs.filter((l) => l.Event_Label === 'Content veröffentlicht');

  const latestV2LogByCommission = new Map<number, ContentLog>();
  for (const log of contentLogs) {
    if (log.Version !== 'v2' || log.Commission_Log_Id == null) continue;
    const existing = latestV2LogByCommission.get(log.Commission_Log_Id);
    if (!existing || new Date(log.Created_At) > new Date(existing.Created_At)) {
      latestV2LogByCommission.set(log.Commission_Log_Id, log);
    }
  }

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

    let delivery = deliveryLogs.find((dl) => dl.Commission_Log_Id != null && dl.Commission_Log_Id === cl.ID);
    if (!delivery) {
      delivery = deliveryLogs
        .filter((dl) =>
          dl.Commission_Log_Id == null && dl.Keyword_ID?.[0] === kwId &&
          new Date(dl.Created_At!).getTime() > new Date(cl.Created_At).getTime(),
        )
        .sort((a, b) => new Date(a.Created_At!).getTime() - new Date(b.Created_At!).getTime())[0];
    }

    const publishLog = publishLogs.find((pl) => pl.Commission_Log_Id != null && pl.Commission_Log_Id === cl.ID);
    const isActiveCycle = activeCommissionIdByKeyword.get(kwId) === cl.ID;

    let keywordStatus: KeywordStatus;
    if (publishLog) {
      keywordStatus = 'Published';
    } else if (isActiveCycle) {
      const rawStatus = kw?.Status ?? ('Backlog' as KeywordStatus);
      if (rawStatus === 'Published') {
        const contamination = publishLogs.some(
          (pl) => pl.Commission_Log_Id != null && pl.Commission_Log_Id !== cl.ID && pl.Keyword_ID?.[0] === kwId,
        );
        keywordStatus = contamination
          ? (delivery ? 'Angeliefert' : 'Backlog' as KeywordStatus)
          : 'Published';
      } else {
        keywordStatus = rawStatus;
      }
    } else {
      keywordStatus = (kw?.Status === 'Published' && !!delivery) ? 'Published' : 'Backlog' as KeywordStatus;
    }

    const latestV2Log = latestV2LogByCommission.get(cl.ID);
    const displayLogId = latestV2Log?.ID ?? delivery?.ID;

    return {
      commissionLogId: cl.ID,
      commissionedAt: cl.Created_At,
      keywordId: kwId,
      keyword: kw?.Keyword ?? kwId,
      targetUrl: kw?.Target_URL ?? cl.Target_URL,
      actionType: (cl.Action_Type === 'Optimierung' ? 'Optimierung' : 'Erstellung') as 'Erstellung' | 'Optimierung',
      keywordStatus,
      deliveryLogId: delivery?.ID,
      displayLogId,
      isFailedRetry: isActiveCycle && keywordStatus === 'Planned' && !delivery,
      userName: cl.User_Name,
      userEmail: cl.User_Email,
      agentRunId: kw?.agentRunId ?? null,
      cycleId: kw?.cycleId ?? null,
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

  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [bodyCache, setBodyCache] = useState<
    Record<string, { contentBody?: string; Content_Body?: string; Event_Label?: string }>
  >({});

  // Action states
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [restartingJobId, setRestartingJobId] = useState<string | null>(null);

  // Agent progress for active runs
  const [agentProgress, setAgentProgress] = useState<AgentProgress>({});

  // ── Data fetching ──────────────────────────────────────────────────────────
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

  // ── Agent progress polling (when selected job is active) ─────────────────
  const allJobs = useMemo(() => buildJobEntries(contentLogs, keywords), [contentLogs, keywords]);
  const selectedJob = allJobs.find((j) => j.commissionLogId === selectedJobId) ?? null;

  useEffect(() => {
    const runId = selectedJob?.agentRunId;
    const isActive = selectedJob?.keywordStatus === 'Beauftragt' || selectedJob?.keywordStatus === 'In Arbeit';
    if (!runId || !isActive) {
      setAgentProgress({});
      return;
    }

    let cancelled = false;
    async function pollProgress() {
      try {
        const res = await fetch(`/api/agent-workflows-v2/runs/${runId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const run = data?.run ?? data;
        const steps: any[] = run?.steps ?? [];
        if (steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          setAgentProgress({
            round: lastStep.round,
            activeAgentName: lastStep.nodeName,
            phase: lastStep.phase,
          });
        }
      } catch {}
    }

    pollProgress();
    const interval = setInterval(pollProgress, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedJob?.agentRunId, selectedJob?.keywordStatus]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const visibleJobs = useMemo(() => allJobs.slice(0, visibleCount), [allJobs, visibleCount]);
  const hasMore = visibleCount < allJobs.length;
  const selectedKeyword = selectedJob ? keywords.find((k) => k.id === selectedJob.keywordId) : null;

  // ── Body on-demand loading ────────────────────────────────────────────────
  const displayLogId = selectedJob?.displayLogId ? String(selectedJob.displayLogId) : null;

  useEffect(() => {
    if (!displayLogId || bodyCache[displayLogId] !== undefined) return;
    fetch(`/api/planning/history/${displayLogId}/body`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && displayLogId) setBodyCache((prev) => ({ ...prev, [displayLogId]: data }));
      })
      .catch(() => {});
  }, [displayLogId]);

  const displayedBody = displayLogId ? bodyCache[displayLogId] : undefined;

  const lastV2Ref = useRef<Record<number, string>>({});
  const v2ContentRaw = displayedBody?.contentBody ?? displayedBody?.Content_Body ?? '';
  if (v2ContentRaw && selectedJobId != null) lastV2Ref.current[selectedJobId] = v2ContentRaw;
  const v2Content = v2ContentRaw || (selectedJobId != null ? lastV2Ref.current[selectedJobId] ?? '' : '');

  const v1Content = useMemo(() => {
    if (!selectedJob) return '';
    return (
      contentLogs
        .filter((l) => l.Keyword_ID?.[0] === selectedJob.keywordId && l.Version === 'v1')
        .sort((a, b) => new Date(a.Created_At).getTime() - new Date(b.Created_At).getTime())
        [0]?.Content_Body ?? ''
    );
  }, [selectedJob, contentLogs]);

  // ── Cancel handler ────────────────────────────────────────────────────────
  const handleCancel = async (job: JobEntry) => {
    try {
      setCancellingJobId(String(job.commissionLogId));
      const res = await fetch('/api/agent-webhook/runs/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId: job.cycleId, runId: job.agentRunId }),
      });
      if (!res.ok) throw new Error('Cancel failed');
      toast.success(tr('Agent-Run wird abgebrochen.', 'Agent run is being cancelled.'));
      window.dispatchEvent(new Event('refresh-planning-data'));
    } catch {
      toast.error(tr('Fehler beim Abbrechen.', 'Error cancelling run.'));
    } finally {
      setCancellingJobId(null);
    }
  };

  // ── Restart handler ───────────────────────────────────────────────────────
  const handleRestart = async (job: JobEntry) => {
    if (!job.cycleId) {
      // Fallback: legacy retry (creates new cycle)
      return handleLegacyRetry(job);
    }
    try {
      setRestartingJobId(String(job.commissionLogId));
      const res = await fetch('/api/agent-webhook/runs/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId: job.cycleId }),
      });
      if (!res.ok) throw new Error('Restart failed');
      toast.success(tr('Agent-Run wird neu gestartet.', 'Agent run restarted.'));
      window.dispatchEvent(new Event('refresh-planning-data'));
    } catch {
      toast.error(tr('Fehler beim Neu-Starten.', 'Error restarting run.'));
    } finally {
      setRestartingJobId(null);
    }
  };

  const handleLegacyRetry = async (job: JobEntry) => {
    try {
      setRestartingJobId(String(job.commissionLogId));
      const actionType = job.actionType === 'Optimierung' ? 'COMMISSION_OPTIMIZATION' : 'COMMISSION_CONTENT';
      await triggerN8nAction(actionType, {
        keywordId: job.keywordId,
        keyword: job.keyword,
        targetUrl: job.targetUrl ?? '',
      });
      toast.success(tr('Content erneut beauftragt.', 'Content re-commissioned.'));
      window.dispatchEvent(new Event('refresh-planning-data'));
    } catch {
      toast.error(tr('Fehler beim erneuten Beauftragen.', 'Error re-commissioning content.'));
    } finally {
      setRestartingJobId(null);
    }
  };

  // ── Status helpers ────────────────────────────────────────────────────────
  const statusBadgeClass = (job: JobEntry) => {
    if (job.isFailedRetry || job.keywordStatus === 'Fehlgeschlagen')
      return 'bg-red-100 text-red-700 border-red-200';
    if (job.keywordStatus === 'Abgebrochen')
      return 'bg-orange-100 text-orange-700 border-orange-200';
    if (job.keywordStatus === 'Beauftragt' || job.keywordStatus === 'In Arbeit')
      return 'bg-amber-100 text-amber-700 border-amber-200';
    if (job.keywordStatus === 'Angeliefert')
      return 'bg-primary text-primary-foreground border-primary';
    if (job.keywordStatus === 'Review')
      return 'bg-purple-100 text-purple-700 border-purple-200';
    if (job.keywordStatus === 'Optimierung')
      return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    return 'bg-primary/15 text-primary border-primary/25';
  };

  const statusLabel = (job: JobEntry) => {
    if (job.isFailedRetry || job.keywordStatus === 'Fehlgeschlagen')
      return tr('Fehlgeschlagen', 'Failed');
    if (job.keywordStatus === 'Abgebrochen') return tr('Abgebrochen', 'Cancelled');
    if (job.keywordStatus === 'Beauftragt' || job.keywordStatus === 'In Arbeit')
      return t('creation.inProgress');
    if (job.keywordStatus === 'Published') return tr('Veröffentlicht', 'Published');
    return job.keywordStatus;
  };

  const isRunning = (job: JobEntry) =>
    job.keywordStatus === 'Beauftragt' || job.keywordStatus === 'In Arbeit';

  const isTerminal = (job: JobEntry) =>
    job.isFailedRetry || job.keywordStatus === 'Fehlgeschlagen' || job.keywordStatus === 'Abgebrochen';

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString(localeTag, { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ', ' +
      d.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
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

          {/* ── Left: Auftrags-Liste ──────────────────────────────────────── */}
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

            <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
              <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
                <Table>
                  <TableHeader className="bg-primary/5 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-primary font-bold">{tr('Auftrag', 'Job')}</TableHead>
                      <TableHead className="text-primary font-bold text-right">{tr('Status', 'Status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleJobs.length > 0 ? (
                      <>
                        {visibleJobs.map((job) => (
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
                                {job.userName && (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate max-w-[200px]">
                                    <User className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{job.userName}</span>
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
                              <div className="flex flex-col items-end gap-1">
                                <Badge
                                  variant="secondary"
                                  className={cn('whitespace-nowrap', statusBadgeClass(job))}
                                >
                                  {isRunning(job) && <Loader2 className="h-3 w-3 mr-1 animate-spin inline" />}
                                  {statusLabel(job)}
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {hasMore && (
                          <TableRow>
                            <TableCell colSpan={2} className="py-3 text-center">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground/50" />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
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
            </CardContent>
          </Card>

          {/* ── Right: Editor & Preview ───────────────────────────────────── */}
          <div className="lg:col-span-8 flex flex-col gap-4 overflow-hidden h-full">
            {!selectedJob ? (
              <div className="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-primary/30 rounded-xl bg-white/50">
                <Send className="w-12 h-12 text-primary/40 mb-4" />
                <h2 className="text-xl font-medium text-primary">{t('creation.selectJob')}</h2>
              </div>
            ) : (
              <div className="flex flex-col gap-4 flex-1 min-h-0 h-full">

                {/* Job header with action buttons */}
                <div className="flex items-center justify-between shrink-0 gap-2">
                  <h3 className="text-lg font-bold text-primary flex items-center gap-2 min-w-0">
                    <FileText className="h-5 w-5 shrink-0" />
                    <span className="truncate">{t('creation.preview')}: {selectedJob.keyword}</span>
                    <Badge
                      variant="outline"
                      className="ml-1 text-xs font-semibold border-slate-200 text-slate-600 bg-slate-50 shrink-0"
                    >
                      {selectedJob.actionType}
                    </Badge>
                  </h3>

                  {/* Cancel button — shown while run is active */}
                  {isRunning(selectedJob) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(selectedJob)}
                      disabled={cancellingJobId === String(selectedJob.commissionLogId)}
                      className="border-red-300 text-red-600 hover:bg-red-50 shrink-0"
                    >
                      {cancellingJobId === String(selectedJob.commissionLogId) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4 mr-1" />
                      )}
                      {tr('Abbrechen', 'Cancel')}
                    </Button>
                  )}

                  {/* Restart button — shown for failed/cancelled */}
                  {isTerminal(selectedJob) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestart(selectedJob)}
                      disabled={restartingJobId === String(selectedJob.commissionLogId)}
                      className="border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                    >
                      {restartingJobId === String(selectedJob.commissionLogId) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-1" />
                      )}
                      {tr('Neu starten', 'Restart')}
                    </Button>
                  )}
                </div>

                <div className="flex-1 min-h-0">

                  {/* Terminal states: failed or cancelled */}
                  {isTerminal(selectedJob) ? (
                    <div className={cn(
                      'flex flex-col items-center justify-center h-full border rounded-lg gap-4 p-8 text-center',
                      selectedJob.keywordStatus === 'Abgebrochen'
                        ? 'border-orange-200 bg-orange-50/40'
                        : 'border-red-200 bg-red-50/40',
                    )}>
                      <AlertTriangle className={cn(
                        'h-10 w-10',
                        selectedJob.keywordStatus === 'Abgebrochen' ? 'text-orange-500' : 'text-red-500',
                      )} />
                      <div>
                        <p className={cn(
                          'text-sm font-semibold',
                          selectedJob.keywordStatus === 'Abgebrochen' ? 'text-orange-700' : 'text-red-700',
                        )}>
                          {selectedJob.keywordStatus === 'Abgebrochen'
                            ? tr('Agent-Run abgebrochen', 'Agent run cancelled')
                            : tr('Agent-Run fehlgeschlagen', 'Agent run failed')}
                        </p>
                        <p className={cn(
                          'text-xs mt-1',
                          selectedJob.keywordStatus === 'Abgebrochen' ? 'text-orange-500' : 'text-red-500',
                        )}>
                          {selectedJob.keywordStatus === 'Abgebrochen'
                            ? tr(
                                'Der Auftrag wurde abgebrochen. Du kannst ihn jederzeit neu starten.',
                                'The run was cancelled. You can restart it at any time.',
                              )
                            : tr(
                                'Der letzte Ausführungsversuch ist fehlgeschlagen. Du kannst den Auftrag neu starten.',
                                'The last execution attempt failed. You can restart the run.',
                              )}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleRestart(selectedJob)}
                        disabled={restartingJobId === String(selectedJob.commissionLogId)}
                        className={selectedJob.keywordStatus === 'Abgebrochen'
                          ? 'bg-orange-600 text-white hover:bg-orange-700'
                          : 'bg-red-600 text-white hover:bg-red-700'}
                      >
                        {restartingJobId === String(selectedJob.commissionLogId) ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RotateCcw className="h-4 w-4 mr-2" />
                        )}
                        {tr('Neu starten', 'Restart')}
                      </Button>
                    </div>

                  ) : !v2Content ? (
                    /* Active run: spinner + progress */
                    <div className="flex flex-col items-center justify-center h-full border rounded-lg bg-muted/10 gap-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t('creation.generating')}</p>
                        {agentProgress.round && (
                          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-primary/70">
                            <Activity className="h-3.5 w-3.5" />
                            <span>
                              {tr('Runde', 'Round')} {agentProgress.round}
                              {agentProgress.activeAgentName && (
                                <> · <span className="font-medium">{agentProgress.activeAgentName}</span></>
                              )}
                            </span>
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 italic">
                          {t('creation.generatingHint')}
                        </p>
                      </div>
                      {/* Cancel while in spinner state */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(selectedJob)}
                        disabled={cancellingJobId === String(selectedJob.commissionLogId)}
                        className="border-red-300 text-red-600 hover:bg-red-50 text-xs"
                      >
                        {cancellingJobId === String(selectedJob.commissionLogId)
                          ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          : <Square className="h-3 w-3 mr-1" />}
                        {tr('Abbrechen', 'Cancel')}
                      </Button>
                    </div>

                  ) : (
                    <AIEditorWorkspace
                      v1Content={v1Content}
                      v2Content={v2Content}
                      mode={selectedJob.actionType}
                      keywordId={selectedJob.keywordId}
                      keyword={selectedJob.keyword}
                      targetUrl={selectedJob.targetUrl}
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

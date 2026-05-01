import { useEffect, useRef } from "react";
import { RunRecord, RunStep, RunMessage } from "../types";

type LoadRunsFn = () => Promise<void>;
type LoadRunDetailsFn = (runId: string) => Promise<void>;
type LoadRunModalDetailsFn = (runId: string) => Promise<void>;

export function useRunPolling({
  runs,
  selectedRunId,
  runDetailModalOpen,
  runDetailModalRunId,
  loadRuns,
  loadRunDetails,
  loadRunModalDetails,
  intervalMs = 2000,
}: {
  runs: RunRecord[];
  selectedRunId: string | null;
  runDetailModalOpen: boolean;
  runDetailModalRunId: string | null;
  loadRuns: LoadRunsFn;
  loadRunDetails: LoadRunDetailsFn;
  loadRunModalDetails: LoadRunModalDetailsFn;
  intervalMs?: number;
}) {
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const hasActiveRun = runs.some((r) => r.status === "running" || r.status === "pending");

    if (!hasActiveRun) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    if (pollingIntervalRef.current) return; // already polling

    pollingIntervalRef.current = setInterval(async () => {
      try {
        await loadRuns();
        if (selectedRunId) await loadRunDetails(selectedRunId);
        if (runDetailModalOpen && runDetailModalRunId) {
          await loadRunModalDetails(runDetailModalRunId);
        }
      } catch {
        // silent — polling should not interrupt the user
      }
    }, intervalMs);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [runs, selectedRunId, runDetailModalOpen, runDetailModalRunId, loadRuns, loadRunDetails, loadRunModalDetails, intervalMs]);
}

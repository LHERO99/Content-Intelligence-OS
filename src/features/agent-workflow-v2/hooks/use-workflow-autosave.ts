import { useEffect, useRef } from "react";
import { WorkflowRecord } from "../types";

type SaveFn = (opts: { silent: boolean }) => Promise<void>;

export function useWorkflowAutosave({
  nodes,
  edges,
  activeWorkflow,
  loading,
  onSave,
  debounceMs = 900,
}: {
  nodes: unknown[];
  edges: unknown[];
  activeWorkflow: WorkflowRecord | null;
  loading: boolean;
  onSave: SaveFn;
  debounceMs?: number;
}) {
  const skipNextRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Expose a way for callers to skip the next autosave trigger (e.g. on initial load)
  const skipNext = () => {
    skipNextRef.current = true;
  };

  useEffect(() => {
    if (loading || !activeWorkflow) return;
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      void onSave({ silent: true });
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, activeWorkflow?.id, loading]);

  return { skipNext };
}

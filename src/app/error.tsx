"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError boundary]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 p-8 text-slate-100">
      <div className="rounded-full border border-red-500/30 bg-red-500/10 p-4">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <div className="max-w-md text-center space-y-2">
        <h2 className="text-lg font-semibold">Ein Fehler ist aufgetreten</h2>
        <p className="text-sm text-slate-400">
          {error?.message || "Unbekannter Fehler. Bitte versuche es erneut."}
        </p>
        {error?.digest && (
          <p className="text-xs text-slate-600 font-mono">Fehler-ID: {error.digest}</p>
        )}
      </div>
      <Button variant="secondary" onClick={reset} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Erneut versuchen
      </Button>
    </div>
  );
}

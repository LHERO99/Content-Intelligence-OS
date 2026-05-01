"use client";

// global-error.tsx must include its own <html>/<body> tags — it replaces the
// root layout entirely when a fatal error occurs during server rendering.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1120",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: "2rem",
            borderRadius: "0.75rem",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.03)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</div>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: 600 }}>
            Ein unerwarteter Fehler ist aufgetreten
          </h1>
          <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "#94a3b8" }}>
            {error?.message || "Unbekannter Fehler"}
            {error?.digest && (
              <span style={{ display: "block", marginTop: "0.5rem", fontSize: "0.75rem", color: "#64748b" }}>
                Fehler-ID: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              color: "#e2e8f0",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Seite neu laden
          </button>
        </div>
      </body>
    </html>
  );
}

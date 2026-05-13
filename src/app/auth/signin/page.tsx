"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearchParams } from "next/navigation";
import { Building2, ArrowLeft, Loader2 } from "lucide-react";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantOption {
  tenantId:   string;
  tenantName: string;
}

type View = "credentials" | "tenant-select";

// ─── Main Form ────────────────────────────────────────────────────────────────

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams?.get("callbackUrl") || "/";

  const [view, setView]           = useState<View>("credentials");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [tenants, setTenants]     = useState<TenantOption[]>([]);
  const [error, setError]         = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ── Step 1: look up which tenants this email/password belongs to ──────────
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res  = await fetch("/api/auth/lookup-tenants", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Ungültige E-Mail oder Passwort.");
        setIsLoading(false);
        return;
      }

      const found: TenantOption[] = data.tenants ?? [];

      if (found.length === 0) {
        setError("Kein aktiver Account gefunden.");
        setIsLoading(false);
        return;
      }

      if (found.length === 1) {
        // Exactly one tenant — sign in directly without showing the picker
        await doSignIn(found[0].tenantId);
        return;
      }

      // Multiple tenants — show the picker
      setTenants(found);
      setView("tenant-select");
      setIsLoading(false);
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.");
      setIsLoading(false);
    }
  };

  // ── Step 2: sign in with a specific tenantId ──────────────────────────────
  const doSignIn = async (tenantId: string) => {
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        tenantId,
        redirect:    false,
        callbackUrl,
      });

      if (result?.error) {
        setError("Anmeldung fehlgeschlagen. Bitte versuche es erneut.");
        setIsLoading(false);
      } else if (result?.ok) {
        window.location.href = callbackUrl;
      }
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.");
      setIsLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-primary/10">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">

        {/* Logo + Title */}
        <div className="text-center flex flex-col items-center">
          <div className="mb-6">
            <Image
              src="/docmorris-logo.png"
              alt="DocMorris Logo"
              width={180}
              height={48}
              priority
              className="h-auto w-auto"
            />
          </div>
          <h2 className="text-3xl font-bold text-primary">SEO Content Intelligence OS</h2>
          <p className="mt-2 text-sm text-gray-600">
            {view === "credentials" ? "Sign in to your account" : "Projekt auswählen"}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded bg-red-50 p-2 text-sm text-red-500 text-center">
            {error}
          </div>
        )}

        {/* ── View A: Credentials ── */}
        {view === "credentials" && (
          <form className="mt-8 space-y-6" onSubmit={handleCredentialsSubmit}>
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="E-Mail Adresse"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 border-gray-300 focus:border-primary focus:ring-primary"
              />
              <Input
                type="password"
                placeholder="Passwort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 border-gray-300 focus:border-primary focus:ring-primary"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Wird geprüft…</>
                : "Weiter"}
            </Button>
          </form>
        )}

        {/* ── View B: Tenant Picker ── */}
        {view === "tenant-select" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-gray-500 text-center">
              Dein Account ist in mehreren Projekten vorhanden. Bitte wähle aus, mit welchem du dich anmelden möchtest.
            </p>

            <div className="space-y-2">
              {tenants.map((t) => (
                <button
                  key={t.tenantId}
                  onClick={() => doSignIn(t.tenantId)}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{t.tenantName}</p>
                  </div>
                  {isLoading && (
                    <Loader2 className="w-4 h-4 animate-spin ml-auto text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => { setView("credentials"); setError(""); }}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mt-2 disabled:opacity-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Zurück
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}

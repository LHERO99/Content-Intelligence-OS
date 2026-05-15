"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const token         = searchParams?.get("token") ?? "";

  const [tokenValid, setTokenValid]     = useState<boolean | null>(null);
  const [newPassword, setNewPassword]   = useState("");
  const [confirmPw, setConfirmPw]       = useState("");
  const [isLoading, setIsLoading]       = useState(false);
  const [success, setSuccess]           = useState(false);
  const [error, setError]               = useState("");

  // Token beim Laden validieren
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }

    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => setTokenValid(data.valid === true))
      .catch(() => setTokenValid(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (newPassword !== confirmPw) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Ein Fehler ist aufgetreten.");
        return;
      }

      setSuccess(true);
      // Nach 3 Sekunden automatisch zum Login weiterleiten
      setTimeout(() => router.push("/auth/signin"), 3000);
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-between bg-primary/10 px-4 py-8 overflow-hidden">
      <div />

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
          <h2 className="text-3xl font-bold text-primary">Plexaro</h2>
          <p className="mt-2 text-sm text-gray-600">Neues Passwort setzen</p>
        </div>

        {/* Loading Token-Validierung */}
        {tokenValid === null && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Ungültiger / abgelaufener Token */}
        {tokenValid === false && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <XCircle className="w-12 h-12 text-red-400" />
            </div>
            <p className="text-sm text-gray-700">
              Dieser Reset-Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.
            </p>
            <Link
              href="/auth/forgot-password"
              className="inline-block mt-2 text-sm text-primary hover:underline"
            >
              Neuen Reset-Link anfordern
            </Link>
          </div>
        )}

        {/* Erfolgreich */}
        {success && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <p className="text-sm text-gray-700 font-medium">
              Dein Passwort wurde erfolgreich geändert.
            </p>
            <p className="text-xs text-gray-500">Du wirst in Kürze zum Login weitergeleitet…</p>
          </div>
        )}

        {/* Formular */}
        {tokenValid === true && !success && (
          <form className="mt-4 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded bg-red-50 p-2 text-sm text-red-500 text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <Input
                type="password"
                placeholder="Neues Passwort (min. 8 Zeichen)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 border-gray-300 focus:border-primary focus:ring-primary"
              />
              <Input
                type="password"
                placeholder="Passwort bestätigen"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 border-gray-300 focus:border-primary focus:ring-primary"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || !newPassword || !confirmPw}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Wird gespeichert…</>
              ) : (
                "Passwort speichern"
              )}
            </Button>
          </form>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <Link href="/legal?tab=imprint" className="hover:text-gray-600 transition-colors">
            Impressum
          </Link>
          <span>·</span>
          <Link href="/legal?tab=privacy" className="hover:text-gray-600 transition-colors">
            Datenschutz
          </Link>
          <span>·</span>
          <Link href="/legal?tab=terms" className="hover:text-gray-600 transition-colors">
            AGB
          </Link>
        </div>
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} Plexaro
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

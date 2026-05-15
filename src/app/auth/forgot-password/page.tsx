"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Ein Fehler ist aufgetreten.");
        return;
      }

      setSubmitted(true);
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
          <p className="mt-2 text-sm text-gray-600">Passwort zurücksetzen</p>
        </div>

        {submitted ? (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <MailCheck className="w-12 h-12 text-green-500" />
            </div>
            <p className="text-sm text-gray-700">
              Falls ein aktiver Account mit dieser E-Mail-Adresse existiert, haben wir dir einen
              Link zum Zurücksetzen deines Passworts gesendet. Bitte überprüfe auch deinen
              Spam-Ordner.
            </p>
            <p className="text-xs text-gray-500">Der Link ist 60 Minuten gültig.</p>
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mt-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Zurück zum Login
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <p className="text-sm text-gray-600">
              Gib deine E-Mail-Adresse ein. Du erhältst einen Link, mit dem du ein neues Passwort
              setzen kannst.
            </p>

            {error && (
              <div className="rounded bg-red-50 p-2 text-sm text-red-500 text-center">
                {error}
              </div>
            )}

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
            </div>

            <Button
              type="submit"
              disabled={isLoading || !email}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Wird gesendet…</>
              ) : (
                "Reset-Link senden"
              )}
            </Button>

            <div className="text-center">
              <Link
                href="/auth/signin"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Zurück zum Login
              </Link>
            </div>
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

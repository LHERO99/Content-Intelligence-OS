"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  Radio,
  Zap,
  ShieldCheck,
  Info,
} from "lucide-react";
import { useI18n } from "@/i18n/use-i18n";

type AgentMode = "internal" | "external";

interface PingResult {
  ok: boolean;
  status?: number;
  message: string;
}

function generateSecret(length = 40): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

export function AgentSettingsTab() {
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);

  const [mode, setMode] = useState<AgentMode>("internal");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/config");
        if (!res.ok) return;
        const config = await res.json();
        if (config.EXTERNAL_AGENT_ENABLED === "true") setMode("external");
        if (config.EXTERNAL_AGENT_WEBHOOK_URL)
          setWebhookUrl(config.EXTERNAL_AGENT_WEBHOOK_URL);
        if (config.EXTERNAL_AGENT_WEBHOOK_SECRET)
          setWebhookSecret(config.EXTERNAL_AGENT_WEBHOOK_SECRET);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function validateUrl(url: string): string | null {
    if (!url.trim())
      return tr("Webhook URL ist erforderlich.", "Webhook URL is required.");
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:")
        return tr(
          "URL muss mit https:// beginnen.",
          "URL must start with https://"
        );
    } catch {
      return tr("Ungültige URL.", "Invalid URL.");
    }
    return null;
  }

  async function handleSave() {
    setSaveError(null);
    setSaveSuccess(false);
    setPingResult(null);

    if (mode === "external") {
      const err = validateUrl(webhookUrl);
      if (err) {
        setUrlError(err);
        return;
      }
    }
    setUrlError(null);
    setSaving(true);

    try {
      const patches: { key: string; value: string }[] = [
        {
          key: "EXTERNAL_AGENT_ENABLED",
          value: mode === "external" ? "true" : "false",
        },
        { key: "EXTERNAL_AGENT_WEBHOOK_URL", value: webhookUrl },
        // Only persist the secret when a value is present to avoid overwriting
        // an existing secret with an empty string on subsequent saves
        ...(webhookSecret ? [{ key: "EXTERNAL_AGENT_WEBHOOK_SECRET", value: webhookSecret }] : []),
      ];

      for (const patch of patches) {
        const res = await fetch("/api/admin/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || res.statusText);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err.message || tr("Unbekannter Fehler", "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function handlePing() {
    const err = validateUrl(webhookUrl);
    if (err) {
      setUrlError(err);
      return;
    }
    setUrlError(null);
    setPingResult(null);
    setPinging(true);

    try {
      const res = await fetch("/api/admin/agent-webhook/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, secret: webhookSecret }),
      });
      const body = await res.json().catch(() => ({}));
      setPingResult({
        ok: body.ok ?? res.ok,
        status: body.status ?? res.status,
        message:
          body.message ??
          (res.ok
            ? tr("Webhook erreichbar.", "Webhook reachable.")
            : tr("Keine Antwort.", "No response.")),
      });
    } catch {
      setPingResult({
        ok: false,
        message: tr(
          "Verbindung fehlgeschlagen.",
          "Connection failed."
        ),
      });
    } finally {
      setPinging(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{tr("Laden…", "Loading…")}</span>
      </div>
    );
  }

  const isExternal = mode === "external";

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {tr("Ausführungsmodus", "Execution Mode")}
          </CardTitle>
          <CardDescription>
            {tr(
              "Legt fest, ob Content-Erstellung und Optimierungen über den internen Agent Builder oder einen externen Webhook ausgeführt werden.",
              "Determines whether content creation and optimizations run via the internal agent builder or an external webhook."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Internal option */}
          <button
            type="button"
            onClick={() => setMode("internal")}
            className={`w-full text-left rounded-lg border-2 p-4 transition-colors ${
              !isExternal
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  !isExternal ? "border-primary" : "border-muted-foreground/50"
                }`}
              >
                {!isExternal && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {tr("Interner Agent Builder", "Internal Agent Builder")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tr(
                    "Nutzt den konfigurierten Workflow aus dem Content-Agent-Builder. Standard-Einstellung.",
                    "Uses the configured workflow from the Content Agent Builder. Default setting."
                  )}
                </p>
              </div>
            </div>
          </button>

          {/* External option */}
          <button
            type="button"
            onClick={() => setMode("external")}
            className={`w-full text-left rounded-lg border-2 p-4 transition-colors ${
              isExternal
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  isExternal ? "border-primary" : "border-muted-foreground/50"
                }`}
              >
                {isExternal && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {tr("Externer Webhook", "External Webhook")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tr(
                    "Alle Aufträge und Optimierungen werden an eine externe URL weitergeleitet. Der interne Builder wird nicht verwendet.",
                    "All commissions and optimizations are forwarded to an external URL. The internal builder is not used."
                  )}
                </p>
              </div>
            </div>
          </button>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card className={!isExternal ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4" />
            {tr("Webhook-Konfiguration", "Webhook Configuration")}
          </CardTitle>
          <CardDescription>
            {tr(
              "Einstellungen für den externen Agenten. Nur aktiv wenn 'Externer Webhook' ausgewählt ist.",
              "Settings for the external agent. Only active when 'External Webhook' is selected."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* URL */}
          <div className="space-y-1.5">
            <Label htmlFor="webhook-url">
              {tr("Webhook URL", "Webhook URL")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://your-agent.example.com/webhook"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                setUrlError(null);
                setPingResult(null);
              }}
              className={urlError ? "border-destructive" : ""}
            />
            {urlError && (
              <p className="text-xs text-destructive">{urlError}</p>
            )}
          </div>

          {/* Secret */}
          <div className="space-y-1.5">
            <Label htmlFor="webhook-secret">
              {tr("Webhook Secret", "Webhook Secret")}{" "}
              <span className="text-muted-foreground text-xs font-normal">
                ({tr("optional", "optional")})
              </span>
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="webhook-secret"
                  type={showSecret ? "text" : "password"}
                  placeholder={tr("Shared Secret…", "Shared secret…")}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setWebhookSecret(generateSecret())}
                className="shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {tr("Generieren", "Generate")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              {tr(
                "Wird als Bearer Token im Authorization-Header mitgesendet und muss vom externen Dienst für Callbacks im X-API-KEY Header zurückgesendet werden.",
                "Sent as Bearer token in the Authorization header. The external service must return it in the X-API-KEY header for callbacks."
              )}
            </p>
            {webhookSecret && (
              <Alert className="mt-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/30">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-800 dark:text-amber-300 text-sm font-semibold">
                  {tr("Secret auch im externen Tool konfigurieren", "Configure secret in your external tool too")}
                </AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs mt-1 space-y-1">
                  <p>
                    {tr(
                      "Damit Callbacks akzeptiert werden, muss dein externes Tool (z.\u00a0B. n8n) das Secret beim Callback-Request als Header mitsenden:",
                      "For callbacks to be accepted, your external tool (e.g. n8n) must send the secret as a header in the callback request:"
                    )}
                  </p>
                  <code className="block bg-amber-100 dark:bg-amber-900/40 rounded px-2 py-1 font-mono text-xs">
                    X-API-KEY: {webhookSecret}
                  </code>
                  <p className="text-amber-600 dark:text-amber-500">
                    {tr("Callback-URL:", "Callback URL:")}{" "}
                    <span className="font-mono">
                      {process.env.NEXT_PUBLIC_APP_URL ?? "<APP_BASE_URL>"}/api/agent-webhook/callback
                    </span>
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Payload info */}
          <div className="rounded-md bg-muted/50 border p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {tr("Payload-Vorschau", "Payload preview")}
            </p>
            <pre className="text-xs text-muted-foreground leading-relaxed overflow-x-auto">
{`{
  "action": "COMMISSION_CONTENT" | "COMMISSION_OPTIMIZATION",
  "keywordId": "recXXXX",
  "targetUrl": "https://...",
  "mainKeyword": "...",
  "secondaryKeywords": ["keyword-a", "keyword-b"],
  "pageType": "Ratgeber",
  "actionType": "Erstellung",
  "tenantId": "default",
  "callbackUrl": "${process.env.NEXT_PUBLIC_APP_URL ?? '<APP_BASE_URL>'}/api/agent-webhook/callback"
}`}
            </pre>
          </div>

          {/* Ping result */}
          {pingResult && (
            <Alert variant={pingResult.ok ? "default" : "destructive"}>
              {pingResult.ok ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertTitle>
                {pingResult.ok
                  ? tr("Verbindung erfolgreich", "Connection successful")
                  : tr("Verbindung fehlgeschlagen", "Connection failed")}
                {pingResult.status ? ` (HTTP ${pingResult.status})` : ""}
              </AlertTitle>
              <AlertDescription>{pingResult.message}</AlertDescription>
            </Alert>
          )}

          <Button
            variant="outline"
            type="button"
            onClick={handlePing}
            disabled={pinging || !isExternal}
          >
            {pinging ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Radio className="h-4 w-4 mr-2" />
            )}
            {tr("Test-Ping senden", "Send test ping")}
          </Button>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {isExternal ? (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
              <Zap className="h-4 w-4" />
              {tr(
                "Aktiver Modus: Externer Webhook",
                "Active mode: External webhook"
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Bot className="h-4 w-4" />
              {tr(
                "Aktiver Modus: Interner Agent Builder",
                "Active mode: Internal agent builder"
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              {tr("Gespeichert", "Saved")}
            </span>
          )}
          {saveError && (
            <span className="text-sm text-destructive">{saveError}</span>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {tr("Speichern", "Save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, LogIn, PlugZap, RefreshCcw, Save, ShieldCheck, XCircle } from "lucide-react";
import { useI18n } from "@/i18n/use-i18n";
import { toLocaleTag } from "@/i18n/locale-utils";

type IntegrationProvider =
  | "sistrix"
  | "openai"
  | "openrouter"
  | "gemini"
  | "copilot"
  | "perplexity"
  | "dataforseo"
  | "vertex_legal"
  | "google_search_console";

type DiscoverableProvider = "openai" | "openrouter" | "gemini" | "copilot" | "perplexity";

type ProviderField = {
  key: string;
  label: string;
  type: "password" | "text";
  placeholder: string;
};

type ProviderDefinition = {
  id: IntegrationProvider;
  name: string;
  description: string;
  fields: ProviderField[];
};

type IntegrationState = {
  provider: IntegrationProvider;
  configured: boolean;
  maskedValues: Record<string, string>;
};

type ApiResponse = {
  providers: ProviderDefinition[];
  integrations: IntegrationState[];
};

type DiscoveredModel = {
  id: string;
  label: string;
  contextWindow?: number;
};

function isDiscoverableProvider(providerId: IntegrationProvider): providerId is DiscoverableProvider {
  return (
    providerId === "openai" ||
    providerId === "openrouter" ||
    providerId === "gemini" ||
    providerId === "copilot" ||
    providerId === "perplexity"
  );
}

export function IntegrationsManagement() {
  const { locale } = useI18n();
  const localeTag = toLocaleTag(locale);
  const tr = (de: string, en: string) => (locale === "de" ? de : en);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationState[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<IntegrationProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [savingProvider, setSavingProvider] = useState<IntegrationProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<IntegrationProvider | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string; testedAt: string }>>({});
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, DiscoveredModel[]>>({});
  const [loadingModelsProvider, setLoadingModelsProvider] = useState<IntegrationProvider | null>(null);
  const [modelErrorsByProvider, setModelErrorsByProvider] = useState<Record<string, string>>({});
  // GSC OAuth state
  const [gscConnectedEmail, setGscConnectedEmail] = useState<string | null>(null);
  const [gscProperties, setGscProperties] = useState<string[]>([]);
  const [gscPropertiesLoading, setGscPropertiesLoading] = useState(false);
  const [gscPropertiesError, setGscPropertiesError] = useState<string | null>(null);
  const [gscSelectedProperty, setGscSelectedProperty] = useState<string>("");

  const stateByProvider = useMemo(() => {
    const map: Record<string, IntegrationState> = {};
    integrations.forEach((entry) => {
      map[entry.provider] = entry;
    });
    return map;
  }, [integrations]);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/integrations");
      const data = (await res.json()) as ApiResponse;

      if (!res.ok) {
        throw new Error((data as any)?.error || tr("Fehler beim Laden der Integrationen", "Failed to load integrations"));
      }

      setProviders(data.providers || []);
      setIntegrations(data.integrations || []);
      setSelectedProviderId((prev) => {
        const nextProviders = data.providers || [];
        if (!nextProviders.length) return null;
        if (prev && nextProviders.some((provider) => provider.id === prev)) return prev;
        return nextProviders[0].id;
      });
    } catch (err: any) {
      setError(err.message || tr("Fehler beim Laden der Integrationen", "Failed to load integrations"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  // Auto-load GSC properties when GSC is selected and connected
  const fetchGscProperties = async () => {
    setGscPropertiesLoading(true);
    setGscPropertiesError(null);
    try {
      const res = await fetch("/api/admin/integrations/google_search_console/properties");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr("Properties konnten nicht geladen werden.", "Failed to load properties."));
      setGscProperties(data.properties || []);
    } catch (err: any) {
      setGscPropertiesError(err.message);
    } finally {
      setGscPropertiesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProviderId === "google_search_console" && stateByProvider["google_search_console"]?.configured) {
      fetchGscProperties();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProviderId, stateByProvider]);

  // Handle GSC OAuth redirect result (?gsc=connected&email=... or ?gsc=error&message=...)
  useEffect(() => {
    const gscStatus = searchParams.get("gsc");
    if (!gscStatus) return;

    if (gscStatus === "connected") {
      const email = searchParams.get("email") ?? "";
      setGscConnectedEmail(email);
      setSuccess(tr(
        `Google Search Console erfolgreich verbunden${email ? ` (${email})` : ""}.`,
        `Google Search Console connected successfully${email ? ` (${email})` : ""}.`
      ));
      setSelectedProviderId("google_search_console");
    } else if (gscStatus === "error") {
      const message = searchParams.get("message") ?? "Unknown error";
      setError(tr(
        `GSC-Verbindung fehlgeschlagen: ${message}`,
        `GSC connection failed: ${message}`
      ));
      setSelectedProviderId("google_search_console");
    }

    // Clean up URL params
    const url = new URL(window.location.href);
    url.searchParams.delete("gsc");
    url.searchParams.delete("email");
    url.searchParams.delete("message");
    router.replace(url.pathname + (url.search || ""), { scroll: false });
  }, [searchParams]);

  const setProviderField = (provider: IntegrationProvider, fieldKey: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [provider]: {
        ...(prev[provider] || {}),
        [fieldKey]: value,
      },
    }));
  };

  const saveProvider = async (provider: ProviderDefinition) => {
    const values = formValues[provider.id] || {};
    const payloadValues: Record<string, string> = {};

    provider.fields.forEach((field) => {
      const value = (values[field.key] || "").trim();
      if (value) payloadValues[field.key] = value;
    });

    if (!Object.keys(payloadValues).length) {
      setError(tr(`Bitte mindestens ein Feld für ${provider.name} ausfüllen.`, `Please provide at least one field for ${provider.name}.`));
      return;
    }

    try {
      setSavingProvider(provider.id);
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/admin/integrations/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payloadValues }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || tr(`Fehler beim Speichern für ${provider.name}`, `Failed to save ${provider.name}`));
      }

      setSuccess(tr(`${provider.name} erfolgreich gespeichert.`, `${provider.name} saved successfully.`));
      setFormValues((prev) => ({ ...prev, [provider.id]: {} }));
      await fetchIntegrations();
    } catch (err: any) {
      setError(err.message || tr(`Fehler beim Speichern für ${provider.name}`, `Failed to save ${provider.name}`));
    } finally {
      setSavingProvider(null);
    }
  };

  const testProvider = async (provider: ProviderDefinition) => {
    try {
      setTestingProvider(provider.id);
      setError(null);

      const res = await fetch(`/api/admin/integrations/${provider.id}`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || tr(`Verbindungstest für ${provider.name} fehlgeschlagen`, `Connection test for ${provider.name} failed`));
      }

      setTestResult((prev) => ({
        ...prev,
        [provider.id]: {
          ok: true,
          message: data?.message || tr("Verbindung erfolgreich getestet.", "Connection test successful."),
          testedAt: new Date().toISOString(),
        },
      }));
    } catch (err: any) {
      const message = err.message || tr(`Verbindungstest für ${provider.name} fehlgeschlagen`, `Connection test for ${provider.name} failed`);
      setTestResult((prev) => ({
        ...prev,
        [provider.id]: {
          ok: false,
          message,
          testedAt: new Date().toISOString(),
        },
      }));
      setError(message);
    } finally {
      setTestingProvider(null);
    }
  };

  const loadModels = async (provider: ProviderDefinition, refresh = false) => {
    if (!isDiscoverableProvider(provider.id)) return;

    try {
      setLoadingModelsProvider(provider.id);
      setError(null);
      setModelErrorsByProvider((prev) => {
        const next = { ...prev };
        delete next[provider.id];
        return next;
      });

      const refreshQuery = refresh ? "?refresh=1" : "";
      const res = await fetch(`/api/admin/integrations/${provider.id}/models${refreshQuery}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || tr(`Modelle für ${provider.name} konnten nicht geladen werden`, `Could not load models for ${provider.name}`));
      }

      const models = Array.isArray(data?.models) ? (data.models as DiscoveredModel[]) : [];
      setModelsByProvider((prev) => ({
        ...prev,
        [provider.id]: models,
      }));
    } catch (err: any) {
      const message = err.message || tr(`Modelle für ${provider.name} konnten nicht geladen werden`, `Could not load models for ${provider.name}`);
      setModelErrorsByProvider((prev) => ({
        ...prev,
        [provider.id]: message,
      }));
    } finally {
      setLoadingModelsProvider(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) || null;
  const selectedIntegrationState = selectedProvider ? stateByProvider[selectedProvider.id] : null;
  const selectedConfigured = Boolean(selectedIntegrationState?.configured);
  const selectedTestResult = selectedProvider ? testResult[selectedProvider.id] : undefined;
  const selectedModels = selectedProvider ? modelsByProvider[selectedProvider.id] || [] : [];
  const selectedModelError = selectedProvider ? modelErrorsByProvider[selectedProvider.id] : undefined;
  const selectedModelsLoading = selectedProvider ? loadingModelsProvider === selectedProvider.id : false;
  const selectedCanDiscoverModels = selectedProvider ? isDiscoverableProvider(selectedProvider.id) : false;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlugZap className="h-5 w-5" />
              {tr("Provider", "Provider")}
            </CardTitle>
            <CardDescription>{tr("Wähle links einen Provider und konfiguriere ihn im Detailbereich.", "Choose a provider on the left and configure it in the detail pane.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {providers.map((provider) => {
              const integrationState = stateByProvider[provider.id];
              const configured = Boolean(integrationState?.configured);
              const result = testResult[provider.id];
              const modelCount = (modelsByProvider[provider.id] || []).length;
              const isActive = selectedProviderId === provider.id;

              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedProviderId(provider.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive ? "border-primary/50 bg-primary/10" : "border-border hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{provider.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{provider.description}</div>
                    </div>
                    <Badge variant={configured ? "default" : "secondary"}>{configured ? tr("Verbunden", "Connected") : tr("Offen", "Open")}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{result ? tr(`Letzter Test: ${result.ok ? "OK" : "Fehler"}`, `Last test: ${result.ok ? "OK" : "Error"}`) : tr("Noch nicht getestet", "Not tested yet")}</span>
                    {isDiscoverableProvider(provider.id) ? <span>{tr(`${modelCount} Modelle`, `${modelCount} models`)}</span> : <span>-</span>}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {!selectedProvider ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">
              {tr("Kein Provider ausgewählt.", "No provider selected.")}
            </CardContent>
          </Card>

        ) : selectedProvider.id === "google_search_console" ? (
          // ── GSC OAuth-based provider — special UI ────────────────────────────
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{selectedProvider.name}</span>
                <Badge variant={selectedConfigured ? "default" : "secondary"}>
                  {selectedConfigured ? tr("Verbunden", "Connected") : tr("Nicht verbunden", "Not connected")}
                </Badge>
              </CardTitle>
              <CardDescription>{selectedProvider.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>{tr("Fehler", "Error")}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>{tr("Verbunden", "Connected")}</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              {/* Step 1: OAuth Connect */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">{tr("1) Google-Konto verbinden", "1) Connect Google account")}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tr(
                      "Klicke auf 'Mit Google verbinden', um die Search Console zu autorisieren. Du wirst zu Google weitergeleitet und danach automatisch zurückgeleitet.",
                      "Click 'Connect with Google' to authorize Search Console access. You will be redirected to Google and then back here automatically."
                    )}
                  </p>
                </div>
                {(selectedConfigured || gscConnectedEmail) ? (
                  <div className="flex items-center gap-3">
                    <a href="/api/auth/google/gsc?returnTo=/admin" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                      {tr("Neu verbinden", "Reconnect")}
                    </a>
                  </div>
                ) : (
                  <a href="/api/auth/google/gsc?returnTo=/admin">
                    <Button className="h-10">
                      <LogIn className="h-4 w-4 mr-2" />
                      {tr("Mit Google verbinden", "Connect with Google")}
                    </Button>
                  </a>
                )}
              </section>

              {/* Step 2: GSC Site URL */}
              <section className="space-y-3 border-t pt-5">
                <div>
                  <h3 className="text-sm font-semibold">{tr("2) GSC Property URL", "2) GSC Property URL")}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tr(
                      "Wähle die verifizierte Property aus der Google Search Console. Wird für Daten-Abfragen verwendet.",
                      "Select the verified property from Google Search Console. Used for data queries."
                    )}
                  </p>
                </div>
                {gscPropertiesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tr("Properties werden geladen…", "Loading properties…")}
                  </div>
                ) : gscPropertiesError ? (
                  <div className="space-y-2">
                    <p className="text-xs text-destructive">{gscPropertiesError}</p>
                    <Button variant="outline" size="sm" onClick={fetchGscProperties}>
                      <RefreshCcw className="h-3 w-3 mr-1" />
                      {tr("Erneut versuchen", "Retry")}
                    </Button>
                  </div>
                ) : !selectedConfigured ? (
                  <p className="text-xs text-muted-foreground">
                    {tr("Bitte zuerst ein Google-Konto verbinden (Schritt 1).", "Please connect a Google account first (step 1).")}
                  </p>
                ) : (
                  <div className="space-y-2 max-w-md">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={gscSelectedProperty || formValues[selectedProvider.id]?.["GSC_SITE_URL"] || ""}
                      onChange={(e) => {
                        setGscSelectedProperty(e.target.value);
                        setProviderField(selectedProvider.id, "GSC_SITE_URL", e.target.value);
                      }}
                    >
                      <option value="">{tr("– Property auswählen –", "– Select property –")}</option>
                      {gscProperties.map((url) => (
                        <option key={url} value={url}>{url}</option>
                      ))}
                    </select>
                    {selectedIntegrationState?.maskedValues?.["GSC_SITE_URL"] && (
                      <p className="text-xs text-muted-foreground">
                        {tr(`Aktuell: ${selectedIntegrationState.maskedValues["GSC_SITE_URL"]}`, `Current: ${selectedIntegrationState.maskedValues["GSC_SITE_URL"]}`)}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => saveProvider(selectedProvider)}
                        disabled={savingProvider === selectedProvider.id || !gscSelectedProperty}
                        className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {savingProvider === selectedProvider.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        {tr("Property URL speichern", "Save property URL")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={fetchGscProperties} disabled={gscPropertiesLoading}>
                        <RefreshCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              {/* Step 3: Test */}
              <section className="space-y-3 border-t pt-5">
                <div>
                  <h3 className="text-sm font-semibold">{tr("3) Verbindung testen", "3) Test connection")}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tr(
                      "Prüft ob das gespeicherte Token noch gültig ist und GSC-Properties abrufbar sind.",
                      "Checks whether the stored token is still valid and GSC properties can be fetched."
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => testProvider(selectedProvider)}
                    disabled={testingProvider === selectedProvider.id || !selectedConfigured}
                    className="h-10"
                  >
                    {testingProvider === selectedProvider.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                    {tr("Verbindung testen", "Test connection")}
                  </Button>
                  {selectedTestResult && (
                    <span className="text-xs text-muted-foreground">
                      {tr("Letzter Test", "Last test")}: {new Date(selectedTestResult.testedAt).toLocaleString(localeTag)}
                    </span>
                  )}
                </div>
                {selectedTestResult && (
                  <div className={`text-sm rounded-md border px-3 py-2 ${selectedTestResult.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                    <span className="inline-flex items-center gap-1">
                      {selectedTestResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {selectedTestResult.message}
                    </span>
                  </div>
                )}

              </section>
            </CardContent>
          </Card>

        ) : (
          // ── Standard API-key-based provider UI ───────────────────────────────
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{selectedProvider.name}</span>
                <Badge variant={selectedConfigured ? "default" : "secondary"}>
                  {selectedConfigured ? tr("Verbunden", "Connected") : tr("Nicht verbunden", "Not connected")}
                </Badge>
              </CardTitle>
              <CardDescription>{selectedProvider.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>{tr("Fehler", "Error")}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>{tr("Gespeichert", "Saved")}</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">{tr("1) Zugangsdaten", "1) Credentials")}</h3>
                  <p className="text-xs text-muted-foreground">{tr("Hinterlege oder aktualisiere die Zugangsdaten für diesen Provider.", "Provide or update credentials for this provider.")}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {selectedProvider.fields.map((field) => {
                    const masked = selectedIntegrationState?.maskedValues?.[field.key] || "";
                    return (
                      <div key={field.key} className="space-y-2">
                        <label className="text-sm font-medium">{field.label}</label>
                        <Input
                          type={field.type}
                          placeholder={field.placeholder}
                          value={formValues[selectedProvider.id]?.[field.key] || ""}
                          onChange={(e) => setProviderField(selectedProvider.id, field.key, e.target.value)}
                          className="h-10"
                        />
                        <p className="text-xs text-muted-foreground">
                          {masked ? tr(`Aktueller Wert: ${masked}`, `Current value: ${masked}`) : tr("Noch kein Wert hinterlegt.", "No value stored yet.")}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <Button
                  onClick={() => saveProvider(selectedProvider)}
                  disabled={savingProvider === selectedProvider.id}
                  className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {savingProvider === selectedProvider.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {tr("Speichern", "Save")}
                </Button>
              </section>

              <section className="space-y-4 border-t pt-5">
                <div>
                  <h3 className="text-sm font-semibold">{tr("2) Verbindung testen", "2) Test connection")}</h3>
                  <p className="text-xs text-muted-foreground">{tr("Prüft, ob die gespeicherten Credentials mit dem Provider funktionieren.", "Checks whether stored credentials work with the provider.")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => testProvider(selectedProvider)}
                    disabled={testingProvider === selectedProvider.id || !selectedConfigured}
                    className="h-10"
                  >
                    {testingProvider === selectedProvider.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                    {tr("Verbindung testen", "Test connection")}
                  </Button>
                  {selectedTestResult && (
                    <span className="text-xs text-muted-foreground">
                      {tr("Letzter Test", "Last test")}: {new Date(selectedTestResult.testedAt).toLocaleString(localeTag)}
                    </span>
                  )}
                </div>
                {selectedTestResult && (
                  <div className={`text-sm rounded-md border px-3 py-2 ${selectedTestResult.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                    <span className="inline-flex items-center gap-1">
                      {selectedTestResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {selectedTestResult.message}
                    </span>
                  </div>
                )}
                <Alert>
                  <AlertTitle>{tr("Tipp zur Kostenkontrolle", "Cost control tip")}</AlertTitle>
                  <AlertDescription>
                    {tr("Hinterlegen Sie nach Möglichkeit ein Ausgabenlimit im Provider-Account. Das schafft zusätzliche Kostensicherheit bei automatisierten Workflows.", "Set a spending limit in your provider account where possible. This adds cost safety for automated workflows.")}
                  </AlertDescription>
                </Alert>
              </section>

              {selectedCanDiscoverModels && (
                <section className="space-y-4 border-t pt-5">
                  <div>
                    <h3 className="text-sm font-semibold">{tr("3) Verfügbare Modelle", "3) Available models")}</h3>
                    <p className="text-xs text-muted-foreground">{tr("Modelle serverseitig über die hinterlegte API-Key-Verbindung abrufen.", "Load models server-side via the configured API key connection.")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadModels(selectedProvider, false)}
                      disabled={!selectedConfigured || selectedModelsLoading}
                    >
                      {selectedModelsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Modelle laden", "Load models")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadModels(selectedProvider, true)}
                      disabled={!selectedConfigured || selectedModelsLoading}
                    >
                      <RefreshCcw className="mr-1 h-4 w-4" />
                      {tr("Aktualisieren", "Refresh")}
                    </Button>
                  </div>
                  {selectedModelError && <p className="text-xs text-red-600">{selectedModelError}</p>}
                  {selectedModels.length > 0 ? (
                    <div className="max-h-72 overflow-auto rounded border">
                      <div className="divide-y">
                        {selectedModels.map((model) => (
                          <div key={model.id} className="flex items-center justify-between px-3 py-2 text-xs">
                            <div>
                              <div className="font-mono">{model.id}</div>
                              {model.label !== model.id && <div className="text-muted-foreground">{model.label}</div>}
                            </div>
                            {model.contextWindow ? (
                              <span className="text-muted-foreground">{model.contextWindow.toLocaleString(localeTag)} ctx</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{tr("Noch keine Modelle geladen.", "No models loaded yet.")}</p>
                  )}
                </section>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, PlugZap, RefreshCcw, Save, ShieldCheck, XCircle } from "lucide-react";

type IntegrationProvider = "sistrix" | "openai" | "openrouter" | "gemini" | "dataforseo" | "vertex_legal";

type DiscoverableProvider = "openai" | "openrouter" | "gemini";

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
  return providerId === "openai" || providerId === "openrouter" || providerId === "gemini";
}

export function IntegrationsManagement() {
  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [savingProvider, setSavingProvider] = useState<IntegrationProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<IntegrationProvider | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, DiscoveredModel[]>>({});
  const [loadingModelsProvider, setLoadingModelsProvider] = useState<IntegrationProvider | null>(null);
  const [modelErrorsByProvider, setModelErrorsByProvider] = useState<Record<string, string>>({});

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
        throw new Error((data as any)?.error || "Fehler beim Laden der Integrationen");
      }

      setProviders(data.providers || []);
      setIntegrations(data.integrations || []);
    } catch (err: any) {
      setError(err.message || "Fehler beim Laden der Integrationen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

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
      setError(`Bitte mindestens ein Feld für ${provider.name} ausfüllen.`);
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
        throw new Error(data?.error || `Fehler beim Speichern für ${provider.name}`);
      }

      setSuccess(`${provider.name} erfolgreich gespeichert.`);
      setFormValues((prev) => ({ ...prev, [provider.id]: {} }));
      await fetchIntegrations();
    } catch (err: any) {
      setError(err.message || `Fehler beim Speichern für ${provider.name}`);
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
        throw new Error(data?.error || `Verbindungstest für ${provider.name} fehlgeschlagen`);
      }

      setTestResult((prev) => ({
        ...prev,
        [provider.id]: {
          ok: true,
          message: data?.message || "Verbindung erfolgreich getestet.",
        },
      }));
    } catch (err: any) {
      const message = err.message || `Verbindungstest für ${provider.name} fehlgeschlagen`;
      setTestResult((prev) => ({
        ...prev,
        [provider.id]: {
          ok: false,
          message,
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
        throw new Error(data?.error || `Modelle für ${provider.name} konnten nicht geladen werden`);
      }

      const models = Array.isArray(data?.models) ? (data.models as DiscoveredModel[]) : [];
      setModelsByProvider((prev) => ({
        ...prev,
        [provider.id]: models,
      }));
    } catch (err: any) {
      const message = err.message || `Modelle für ${provider.name} konnten nicht geladen werden`;
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

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Gespeichert</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((provider) => {
          const integrationState = stateByProvider[provider.id];
          const configured = Boolean(integrationState?.configured);
          const result = testResult[provider.id];
          const discoveredModels = modelsByProvider[provider.id] || [];
          const modelError = modelErrorsByProvider[provider.id];
          const modelsLoading = loadingModelsProvider === provider.id;
          const canDiscoverModels = isDiscoverableProvider(provider.id);

          return (
            <Card key={provider.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <PlugZap className="h-5 w-5" />
                    {provider.name}
                  </span>
                  <Badge variant={configured ? "default" : "secondary"}>
                    {configured ? "Verbunden" : "Nicht verbunden"}
                  </Badge>
                </CardTitle>
                <CardDescription>{provider.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {provider.fields.map((field) => {
                  const masked = integrationState?.maskedValues?.[field.key] || "";
                  return (
                    <div key={field.key} className="space-y-2">
                      <label className="text-sm font-medium">{field.label}</label>
                      <Input
                        type={field.type}
                        placeholder={field.placeholder}
                        value={formValues[provider.id]?.[field.key] || ""}
                        onChange={(e) => setProviderField(provider.id, field.key, e.target.value)}
                        className="h-10"
                      />
                      {masked ? (
                        <p className="text-xs text-muted-foreground">Aktueller Wert: {masked}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Noch kein Wert hinterlegt.</p>
                      )}
                    </div>
                  );
                })}

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => saveProvider(provider)}
                    disabled={savingProvider === provider.id}
                    className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {savingProvider === provider.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Speichern
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => testProvider(provider)}
                    disabled={testingProvider === provider.id || !configured}
                    className="h-10"
                  >
                    {testingProvider === provider.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                    Verbindung testen
                  </Button>
                </div>

                {result && (
                  <div className={`text-sm rounded-md border px-3 py-2 ${result.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                    <span className="inline-flex items-center gap-1">
                      {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {result.message}
                    </span>
                  </div>
                )}

                {canDiscoverModels && (
                  <div className="space-y-2 rounded-md border border-dashed border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Verfügbare Modelle</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadModels(provider, false)}
                          disabled={!configured || modelsLoading}
                        >
                          {modelsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Modelle laden"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadModels(provider, true)}
                          disabled={!configured || modelsLoading}
                        >
                          <RefreshCcw className="mr-1 h-4 w-4" />
                          Aktualisieren
                        </Button>
                      </div>
                    </div>

                    {modelError && <p className="text-xs text-red-600">{modelError}</p>}

                    {discoveredModels.length > 0 ? (
                      <div className="max-h-48 overflow-auto rounded border">
                        <div className="divide-y">
                          {discoveredModels.map((model) => (
                            <div key={model.id} className="flex items-center justify-between px-3 py-2 text-xs">
                              <span className="font-mono">{model.id}</span>
                              {model.contextWindow ? (
                                <span className="text-muted-foreground">{model.contextWindow.toLocaleString("de-DE")} ctx</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Noch keine Modelle geladen.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

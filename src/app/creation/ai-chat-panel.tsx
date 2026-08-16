'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Sparkles, User, CheckCheck, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/use-i18n';
import type { ProviderWithModels } from '@/app/api/creation/models/route';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Refined HTML content proposed by the AI for this message */
  refinedContent?: string;
  /** null = not yet acted on, 'applied' = saved to DB, 'rejected' = user dismissed */
  status?: 'applied' | 'rejected' | null;
}

interface AIChatPanelProps {
  currentContent: string;
  /** Called when the AI returns a new proposal — parent should show it in the preview */
  onPreviewChange: (content: string | null) => void;
  /** Called when user clicks "Übernehmen" — parent should save to DB; resolves true on success */
  onApplyChanges: (content: string) => Promise<boolean>;
  keywordId: string;
  keyword: string;
}

export function AIChatPanel({
  currentContent,
  onPreviewChange,
  onApplyChanges,
  keywordId,
  keyword,
}: AIChatPanelProps) {
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === 'de' ? de : en);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Model selection
  const [providers, setProviders] = useState<ProviderWithModels[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  /** Combined value: "providerId::modelId" */
  const [selectedProviderModel, setSelectedProviderModel] = useState<string>('');

  const scrollRef = useRef<HTMLDivElement>(null);

  // Set greeting when locale or keyword changes
  useEffect(() => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: tr(
          `Hallo! Ich bin dein KI-Assistent für das Keyword "${keyword}". Wähle oben ein Modell und schreib mir, wie ich den Text verbessern soll.`,
          `Hello! I'm your AI assistant for the keyword "${keyword}". Select a model above and tell me how to improve the text.`
        ),
      },
    ]);
  }, [locale, keyword]);

  // Fetch available models on mount
  useEffect(() => {
    async function fetchModels() {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const res = await fetch('/api/creation/models');
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        const loadedProviders: ProviderWithModels[] = data.providers ?? [];
        setProviders(loadedProviders);

        // Auto-select first model
        if (loadedProviders.length > 0 && loadedProviders[0].models.length > 0) {
          setSelectedProviderModel(`${loadedProviders[0].id}::${loadedProviders[0].models[0].id}`);
        }
      } catch (err: any) {
        setModelsError(tr('Modelle konnten nicht geladen werden.', 'Failed to load models.'));
      } finally {
        setModelsLoading(false);
      }
    }
    fetchModels();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleApply = async (messageId: string, refinedContent: string) => {
    setApplyingId(messageId);
    try {
      const success = await onApplyChanges(refinedContent);
      if (success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, status: 'applied' } : m))
        );
      }
    } finally {
      setApplyingId(null);
    }
  };

  const handleReject = (messageId: string, refinedContent: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'rejected' } : m))
    );
    // Reset preview back to current working content
    onPreviewChange(null);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    if (!selectedProviderModel) return;

    const [providerId, ...modelParts] = selectedProviderModel.split('::');
    const modelId = modelParts.join('::'); // model IDs can contain "::"

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);
    const sentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/creation/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywordId,
          keyword,
          currentContent,
          instructions: sentInput,
          modelId,
          providerId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const refinedContent: string = result.refinedContent ?? '';

      const assistantId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: tr(
            'Ich habe den Text überarbeitet. Sieh dir die Vorschau links an und übernimm oder lehn die Änderungen ab.',
            "I've revised the text. Review the preview on the left and accept or reject the changes."
          ),
          refinedContent,
          status: null,
        },
      ]);

      // Immediately update the left preview with the AI proposal
      onPreviewChange(refinedContent);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: tr(
            `Fehler: ${error.message || 'Die KI konnte nicht erreicht werden. Bitte versuche es später erneut.'}`,
            `Error: ${error.message || 'The AI could not be reached. Please try again later.'}`
          ),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-3 border-b bg-white shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 font-bold text-primary text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            {tr('KI-Optimierung', 'AI Optimization')}
          </div>
          <Badge variant="outline" className="text-[10px] font-medium bg-primary/10 text-primary border-primary/20">
            Direct API
          </Badge>
        </div>

        {/* Model selector */}
        {modelsLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 h-9">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {tr('Modelle werden geladen…', 'Loading models…')}
          </div>
        ) : modelsError ? (
          <p className="text-xs text-destructive">{modelsError}</p>
        ) : providers.length === 0 ? (
          <p className="text-xs text-amber-600">
            {tr(
              'Keine KI-Integration konfiguriert. Bitte im Admin-Bereich einen Provider einrichten.',
              'No AI integration configured. Please set up a provider in the admin area.'
            )}
          </p>
        ) : (
          <Select value={selectedProviderModel} onValueChange={(v) => setSelectedProviderModel(v ?? '')}>
            <SelectTrigger className="h-8 text-xs border-slate-200 focus:ring-primary">
              <SelectValue placeholder={tr('Modell auswählen…', 'Select model…')} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {providers.map((provider) => (
                <SelectGroup key={provider.id}>
                  <SelectLabel className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                    {provider.name}
                  </SelectLabel>
                  {provider.models.map((model) => (
                    <SelectItem
                      key={`${provider.id}::${model.id}`}
                      value={`${provider.id}::${model.id}`}
                      className="text-xs"
                    >
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 relative">
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto p-4 custom-scrollbar"
        >
          <div className="space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300',
                  m.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm',
                    m.role === 'user'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-white text-slate-600 border'
                  )}
                >
                  {m.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </div>
                <div className="flex flex-col gap-2 max-w-[85%]">
                  <div
                    className={cn(
                      'p-3 rounded-2xl text-sm shadow-sm',
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-white text-slate-700 border rounded-tl-none'
                    )}
                  >
                    {m.content}
                  </div>

                  {/* Action buttons for messages with a proposal */}
                  {m.role === 'assistant' && m.refinedContent && m.status !== 'applied' && m.status !== 'rejected' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApply(m.id, m.refinedContent!)}
                        disabled={applyingId === m.id}
                        className="h-8 gap-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
                      >
                        {applyingId === m.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCheck className="h-3.5 w-3.5" />
                        )}
                        {applyingId === m.id
                          ? tr('Wird gespeichert…', 'Saving…')
                          : tr('Übernehmen', 'Accept')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(m.id, m.refinedContent!)}
                        disabled={applyingId === m.id}
                        className="h-8 gap-2 text-xs font-bold border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-300 transition-all"
                      >
                        <X className="h-3.5 w-3.5" />
                        {tr('Ablehnen', 'Reject')}
                      </Button>
                    </div>
                  )}

                  {/* Applied confirmation */}
                  {m.role === 'assistant' && m.status === 'applied' && (
                    <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                      <CheckCheck className="h-3.5 w-3.5" />
                      {tr('Übernommen & gespeichert', 'Accepted & saved')}
                    </div>
                  )}

                  {/* Rejected confirmation */}
                  {m.role === 'assistant' && m.status === 'rejected' && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                      <X className="h-3.5 w-3.5" />
                      {tr('Abgelehnt', 'Rejected')}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-white text-slate-600 border flex items-center justify-center shrink-0">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
                <div className="p-3 rounded-2xl rounded-tl-none text-sm bg-white text-slate-400 border italic shadow-sm">
                  {tr('KI analysiert den Text…', 'AI is analyzing the text…')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t shrink-0">
        <div className="flex gap-2">
          <Input
            placeholder={tr('Anweisung eingeben…', 'Enter instruction…')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            disabled={isLoading || !selectedProviderModel}
            className="text-sm h-10 border-slate-200 focus-visible:ring-primary shadow-sm"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim() || !selectedProviderModel}
            className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 w-10 p-0 shrink-0 shadow-sm transition-transform active:scale-95"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center italic">
          {tr(
            'Der aktuelle Text wird der KI als Kontext mitgegeben.',
            'The current text is provided to the AI as context.'
          )}
        </p>
      </div>
    </div>
  );
}

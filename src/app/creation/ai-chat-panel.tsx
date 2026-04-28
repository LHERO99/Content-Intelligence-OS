'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Sparkles, User, CheckCheck, ChevronDown } from 'lucide-react';
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
  /** If present, a "apply" button will be shown for this message */
  refinedContent?: string;
  applied?: boolean;
}

interface AIChatPanelProps {
  currentContent: string;
  onApplyChanges: (newContent: string) => void;
  keywordId: string;
  keyword: string;
}

export function AIChatPanel({ currentContent, onApplyChanges, keywordId, keyword }: AIChatPanelProps) {
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === 'de' ? de : en);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleApply = (messageId: string, refinedContent: string) => {
    onApplyChanges(refinedContent);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, applied: true } : m))
    );
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
          tenantId: 'default', // Multi-tenant stub
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
            'Ich habe den Text überarbeitet. Sieh dir die Vorschau links an und übernimm die Änderungen, wenn du zufrieden bist.',
            "I've revised the text. Review the preview on the left and apply the changes if you're happy with them."
          ),
          refinedContent,
          applied: false,
        },
      ]);
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

  const selectedLabel = (() => {
    if (!selectedProviderModel) return null;
    const [pid, ...mparts] = selectedProviderModel.split('::');
    const mid = mparts.join('::');
    const provider = providers.find((p) => p.id === pid);
    const model = provider?.models.find((m) => m.id === mid);
    if (!provider || !model) return null;
    return `${provider.name} · ${model.label}`;
  })();

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
              <SelectValue
                placeholder={tr('Modell auswählen…', 'Select model…')}
              />
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
                  {/* Apply button for messages that carry refined content */}
                  {m.role === 'assistant' && m.refinedContent && (
                    <Button
                      size="sm"
                      onClick={() => handleApply(m.id, m.refinedContent!)}
                      disabled={m.applied}
                      className={cn(
                        'h-8 gap-2 text-xs font-bold self-start transition-all',
                        m.applied
                          ? 'bg-green-600 hover:bg-green-600 text-white cursor-default'
                          : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      )}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      {m.applied
                        ? tr('Übernommen', 'Applied')
                        : tr('Änderungen übernehmen', 'Apply changes')}
                    </Button>
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

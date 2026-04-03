'use client';

import React, { useState } from 'react';
import { Send, Loader2, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatPanelProps {
  currentContent: string;
  onApplyChanges: (newContent: string) => void;
  keywordId: string;
  keyword: string;
}

export function AIChatPanel({ currentContent, onApplyChanges, keywordId, keyword }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: '1', 
      role: 'assistant', 
      content: `Hallo! Ich bin dein KI-Assistent für das Keyword "${keyword}". Wie kann ich den Text für dich optimieren? (z.B. "Schreibe die Einleitung emotionaler" oder "Füge eine Liste mit Vorteilen hinzu")` 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/n8n/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REFINE_CONTENT',
          data: {
            keywordId,
            keyword,
            currentContent,
            instructions: input
          }
        })
      });

      if (!response.ok) throw new Error('KI-Anfrage fehlgeschlagen');

      const result = await response.json();
      const aiResponse = result.result?.refinedContent || "Entschuldigung, ich konnte den Text nicht wie gewünscht verarbeiten.";

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse.includes('<html>') || aiResponse.includes('<div>') 
          ? "Ich habe den Text basierend auf deinen Wünschen angepasst. Du kannst die Änderungen jetzt mit dem Button unten übernehmen."
          : aiResponse
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // If the AI returned HTML/refined content, we offer to apply changes
      if (result.result?.refinedContent) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: "Klicke auf den Button unten, um diesen Vorschlag in deinen Arbeitsstand zu übernehmen."
        }]);
        onApplyChanges(result.result.refinedContent);
      }

    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: "Fehler: Die KI konnte nicht erreicht werden. Bitte versuche es später erneut." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border rounded-lg overflow-hidden">
      <div className="p-3 border-b bg-white flex items-center gap-2 font-bold text-[#00463c] text-sm">
        <Sparkles className="h-4 w-4 text-emerald-600" />
        KI-Optimierung
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                m.role === 'user' ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-600 border"
              )}>
                {m.role === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </div>
              <div className={cn(
                "p-3 rounded-2xl text-sm max-w-[85%] shadow-sm",
                m.role === 'user' 
                  ? "bg-emerald-600 text-white rounded-tr-none" 
                  : "bg-white text-slate-700 border rounded-tl-none"
              )}>
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-white text-slate-600 border flex items-center justify-center shrink-0">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <div className="p-3 rounded-2xl rounded-tl-none text-sm bg-white text-slate-400 border italic">
                KI schreibt...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 bg-white border-t">
        <div className="flex gap-2">
          <Input 
            placeholder="Anweisung eingeben..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className="text-sm h-10 border-slate-200"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={isLoading || !input.trim()}
            className="bg-[#00463c] hover:bg-[#00332c] h-10 w-10 p-0 shrink-0"
          >
            <Send className="h-4 w-4 text-white" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center italic">
          Die KI berücksichtigt den aktuellen Text als Kontext.
        </p>
      </div>
    </div>
  );
}

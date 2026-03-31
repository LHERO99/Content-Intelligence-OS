'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrainCircuit } from 'lucide-react';

interface ReasoningPanelProps {
  reasoning: string;
}

export function ReasoningPanel({ reasoning }: ReasoningPanelProps) {
  return (
    <Card className="bg-emerald-50/50 border-emerald-100 h-full flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <BrainCircuit className="w-5 h-5 text-emerald-600" />
        <CardTitle className="text-lg font-semibold text-emerald-900">Reasoning Chain</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="text-sm text-emerald-800 whitespace-pre-wrap leading-relaxed">
            {reasoning || "No reasoning data available for this draft."}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { AgentStepType, TOOLBOX_NODE_TYPES } from "../types";

// ─── NodePalette ──────────────────────────────────────────────────────────────

export function NodePalette() {
  const handleDragStart = (event: React.DragEvent, type: AgentStepType) => {
    event.dataTransfer.setData("application/agent-node-type", type);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <Card className="border-white/10 bg-[#0b1220]/80 text-slate-100">
      <CardHeader>
        <CardTitle className="text-base">Toolbox</CardTitle>
        <CardDescription className="text-slate-400">Neue Agenten-Nodes hinzufügen</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {TOOLBOX_NODE_TYPES.map((entry) => (
          <Button
            key={entry.type}
            draggable
            onDragStart={(event) => handleDragStart(event, entry.type)}
            variant="outline"
            className="w-full justify-start border-white/15 bg-transparent text-slate-100 hover:bg-white/10"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("agent-builder:add-node", { detail: { type: entry.type } }));
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {entry.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── DataMappingBuilder ───────────────────────────────────────────────────────

export function DataMappingBuilder({
  outputSchema,
  inputMappings,
  onAssign,
}: {
  outputSchema: string[];
  inputMappings: Array<{ key: string; value: string }>;
  onAssign: (inputKey: string, value: string) => void;
}) {
  const onDragStart = (event: React.DragEvent, pill: string) => {
    event.dataTransfer.setData("application/mapping-pill", pill);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-300">Output Schema</div>
        <div className="space-y-1.5">
          {outputSchema.map((pill) => (
            <button
              key={pill}
              draggable
              onDragStart={(event) => onDragStart(event, pill)}
              className="w-full rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-left text-[11px] text-blue-100 cursor-grab active:cursor-grabbing"
            >
              {pill}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-300">Input Mapping</div>
        <div className="space-y-1.5">
          {inputMappings.map((mapping) => (
            <div
              key={mapping.key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const pill = event.dataTransfer.getData("application/mapping-pill");
                if (!pill) return;
                onAssign(mapping.key, pill);
              }}
              className="rounded-md border border-white/15 bg-black/20 px-2 py-1.5 text-[11px] text-slate-200"
            >
              <div className="font-semibold text-[10px] uppercase tracking-wider text-slate-400">{mapping.key}</div>
              <div className="mt-0.5">{mapping.value || "Drop value here"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ConfigSection ────────────────────────────────────────────────────────────

export function ConfigSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-white/10 bg-[#0f172a]/50">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-2.5">
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          <div className="text-xs text-slate-400">{description}</div>
        </div>
        <span className="mt-0.5 text-xs text-slate-400 group-open:hidden">Aufklappen</span>
        <span className="mt-0.5 hidden text-xs text-slate-400 group-open:inline">Einklappen</span>
      </summary>
      <div className="border-t border-white/10 px-3 py-3">{children}</div>
    </details>
  );
}

"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TopicClusterWithStats } from "@/lib/db/topic-journey-types";

interface TopicClusterCellProps {
  clusterId: string | null;
  clusterName: string | null;
  clusterColor: string | null;
  clusters: TopicClusterWithStats[];
  onAssign: (clusterId: string | null) => void;
}

export function TopicClusterCell({
  clusterId,
  clusterName,
  clusterColor,
  clusters,
  onAssign,
}: TopicClusterCellProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(
    () => clusters.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [clusters, search],
  );

  const handleSelect = (id: string | null) => {
    onAssign(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setSearch("");
        }}
      >
        <PopoverTrigger
          className={cn(
            "cursor-pointer",
            clusterId
              ? "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium hover:opacity-80 transition-opacity max-w-[140px]"
              : "flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:text-primary transition-colors",
          )}
          style={
            clusterId
              ? {
                  backgroundColor: `${clusterColor}20`,
                  color: clusterColor ?? undefined,
                  border: `1px solid ${clusterColor}40`,
                }
              : {}
          }
        >
          {clusterId ? (
            <>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: clusterColor ?? undefined }}
              />
              <span className="truncate">{clusterName}</span>
            </>
          ) : (
            <>
              <Plus className="w-3 h-3" />
              <span>Cluster</span>
            </>
          )}
        </PopoverTrigger>

        <PopoverContent
          className="w-56 p-2"
          side="bottom"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <Input
            placeholder="Cluster suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs mb-2"
          />

          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-1.5">
                Keine Cluster gefunden.
              </p>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-accent transition-colors text-left",
                  clusterId === c.id && "bg-accent",
                )}
                onClick={() => handleSelect(c.id)}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span className="flex-1 truncate">{c.name}</span>
                {clusterId === c.id && (
                  <Check className="w-3 h-3 shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>

          {clusterId && (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-destructive hover:bg-destructive/10 transition-colors text-left"
                onClick={() => handleSelect(null)}
              >
                <X className="w-3 h-3" />
                Cluster entfernen
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

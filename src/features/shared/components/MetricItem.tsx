import * as React from "react";
import { LucideIcon } from "lucide-react";

interface MetricItemProps {
  icon: LucideIcon;
  label: string;
  value: string | number | undefined;
  subValue?: string;
}

export const MetricItem = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue 
}: MetricItemProps) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
    <div className="mt-0.5 p-1.5 rounded-md bg-white border border-border shadow-sm">
      <Icon className="h-4 w-4 text-[#00463c]" />
    </div>
    <div className="space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-sm font-semibold text-[#00463c]">{value ?? "-"}</p>
        {subValue && <span className="text-[10px] text-muted-foreground">{subValue}</span>}
      </div>
    </div>
  </div>
);

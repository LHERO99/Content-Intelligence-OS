import * as React from "react";
import { LucideIcon } from "lucide-react";

interface PlanningHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function PlanningHeader({ icon: Icon, title, description }: PlanningHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[#00463c]">
        <Icon className="h-6 w-6" />
        <h3 className="text-xl font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

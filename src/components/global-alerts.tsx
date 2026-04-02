'use client';

import { useAlerts } from "@/components/alerts-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { X, AlertCircle, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const icons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
};

export function GlobalAlerts() {
  const { alerts, removeAlert } = useAlerts();

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-md">
      {alerts.map((alert) => {
        const Icon = icons[alert.type];
        return (
          <Alert key={alert.id} variant={alert.type === 'error' ? 'destructive' : 'default'} className="bg-background border shadow-lg">
            <Icon className="h-4 w-4" />
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  {alert.title && (
                    <AlertTitle className="capitalize mb-1">
                      {alert.title}
                    </AlertTitle>
                  )}
                  <AlertDescription>
                    <div className="font-medium">{alert.message}</div>
                    {alert.description && <div className="text-xs opacity-80 mt-1">{alert.description}</div>}
                  </AlertDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-transparent shrink-0"
                  onClick={() => removeAlert(alert.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Alert>
        );
      })}
    </div>
  );
}

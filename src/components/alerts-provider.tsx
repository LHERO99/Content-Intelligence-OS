'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';

export type AlertType = 'info' | 'warning' | 'error' | 'success';

export interface Alert {
  id: string;
  type: AlertType;
  title?: string;
  message: string;
  description?: string;
  timestamp: Date;
}

interface AlertsContextType {
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp'>) => void;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

const AUTO_DISMISS_TIMEOUT = 5000;

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
    
    // Clear timeout if it exists
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const addAlert = useCallback((alert: Omit<Alert, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newAlert: Alert = {
      ...alert,
      id,
      timestamp: new Date(),
    };
    
    setAlerts((prev) => [newAlert, ...prev]);

    // Auto-dismiss success alerts
    if (alert.type === 'success') {
      const timeout = setTimeout(() => {
        removeAlert(id);
      }, AUTO_DISMISS_TIMEOUT);
      
      timeoutsRef.current.set(id, timeout);
    }
  }, [removeAlert]);

  const clearAlerts = useCallback(() => {
    // Clear all active timeouts
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current.clear();
    setAlerts([]);
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      // eslint-disable-next-line react-hooks/exhaustive-deps
      timeoutsRef.current.clear();
    };
  }, []);

  return (
    <AlertsContext.Provider value={{ alerts, addAlert, removeAlert, clearAlerts }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (context === undefined) {
    throw new Error('useAlerts must be used within an AlertsProvider');
  }
  return context;
}

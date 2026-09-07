import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number; // in ms, default 15000ms
  timestamp: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: {
    type?: ToastType;
    title?: string;
    message: string;
    duration?: number;
  }) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    ({
      type = 'error',
      title,
      message,
      duration = 15000, // 15 seconds default so user has plenty of time to inspect and copy
    }: {
      type?: ToastType;
      title?: string;
      message: string;
      duration?: number;
    }) => {
      const id = 'toast_' + Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = {
        id,
        type,
        title,
        message,
        duration,
        timestamp: Date.now(),
      };

      setToasts((prev) => [newToast, ...prev.slice(0, 4)]); // Keep maximum 5 toasts at once
      return id;
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, clearAllToasts }}>
      {children}
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

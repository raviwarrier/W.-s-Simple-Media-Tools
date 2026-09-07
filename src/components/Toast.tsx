import React, { useState, useEffect, useRef } from 'react';
import { useToast, ToastItem } from '../context/ToastContext';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Copy,
  Check,
  X,
} from 'lucide-react';

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  isDarkMode: boolean;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onDismiss, isDarkMode }) => {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const duration = toast.duration || 15000;
  const [remainingTime, setRemainingTime] = useState(duration);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isHovered) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const stepMs = 100;
    intervalRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= stepMs) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onDismiss(toast.id);
          return 0;
        }
        return prev - stepMs;
      });
    }, stepMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isHovered, toast.id, onDismiss]);

  const handleCopy = async () => {
    try {
      const fullText = toast.title
        ? `${toast.title}\n\n${toast.message}`
        : toast.message;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  };

  const progressPercent = Math.max(0, Math.min(100, (remainingTime / duration) * 100));
  const remainingSec = Math.ceil(remainingTime / 1000);

  // Styling based on type
  const config = {
    error: {
      icon: <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />,
      border: isDarkMode ? 'border-red-600/60' : 'border-red-500',
      bg: isDarkMode ? 'bg-[#1e1414]' : 'bg-[#fff5f5]',
      badgeBg: isDarkMode ? 'bg-red-950/80 text-red-300 border-red-800/60' : 'bg-red-100 text-red-800 border-red-200',
      badgeText: 'Error',
      progressBar: isDarkMode ? 'bg-red-500' : 'bg-red-600',
      copyBtn: isDarkMode ? 'hover:bg-red-950/70 text-red-300 border-red-800/60' : 'hover:bg-red-100 text-red-700 border-red-300',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />,
      border: isDarkMode ? 'border-amber-600/60' : 'border-amber-500',
      bg: isDarkMode ? 'bg-[#1e1a12]' : 'bg-[#fffbf0]',
      badgeBg: isDarkMode ? 'bg-amber-950/80 text-amber-300 border-amber-800/60' : 'bg-amber-100 text-amber-800 border-amber-200',
      badgeText: 'Warning',
      progressBar: isDarkMode ? 'bg-amber-500' : 'bg-amber-600',
      copyBtn: isDarkMode ? 'hover:bg-amber-950/70 text-amber-300 border-amber-800/60' : 'hover:bg-amber-100 text-amber-700 border-amber-300',
    },
    info: {
      icon: <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />,
      border: isDarkMode ? 'border-sky-600/60' : 'border-sky-500',
      bg: isDarkMode ? 'bg-[#121a22]' : 'bg-[#f0f8ff]',
      badgeBg: isDarkMode ? 'bg-sky-950/80 text-sky-300 border-sky-800/60' : 'bg-sky-100 text-sky-800 border-sky-200',
      badgeText: 'Info',
      progressBar: isDarkMode ? 'bg-sky-500' : 'bg-sky-600',
      copyBtn: isDarkMode ? 'hover:bg-sky-950/70 text-sky-300 border-sky-800/60' : 'hover:bg-sky-100 text-sky-700 border-sky-300',
    },
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />,
      border: isDarkMode ? 'border-emerald-600/60' : 'border-emerald-500',
      bg: isDarkMode ? 'bg-[#121f17]' : 'bg-[#f2fcf5]',
      badgeBg: isDarkMode ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60' : 'bg-emerald-100 text-emerald-800 border-emerald-200',
      badgeText: 'Success',
      progressBar: isDarkMode ? 'bg-emerald-500' : 'bg-emerald-600',
      copyBtn: isDarkMode ? 'hover:bg-emerald-950/70 text-emerald-300 border-emerald-800/60' : 'hover:bg-emerald-100 text-emerald-700 border-emerald-300',
    },
  }[toast.type];

  return (
    <div
      id={`toast-${toast.id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative w-full max-w-md overflow-hidden rounded-lg border shadow-xl transition-all duration-200 ${config.bg} ${config.border} text-sm`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {config.icon}

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${config.badgeBg}`}>
                  {config.badgeText}
                </span>
                {toast.title && (
                  <h4 className={`text-xs font-semibold select-text ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
                    {toast.title}
                  </h4>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className={`p-1 rounded transition-colors ${
                  isDarkMode ? 'text-neutral-400 hover:text-white hover:bg-white/10' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error / Warning Details (Selectable text) */}
            <div
              className={`my-2 max-h-36 overflow-y-auto text-xs font-mono select-text whitespace-pre-wrap rounded p-2.5 border ${
                isDarkMode
                  ? 'bg-black/40 border-white/10 text-neutral-200'
                  : 'bg-white/80 border-neutral-200 text-neutral-800'
              }`}
            >
              {toast.message}
            </div>

            {/* Footer Actions: Copy Button & Timer Indicator */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopy}
                id={`btn-copy-toast-${toast.id}`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border transition-all ${config.copyBtn}`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500 font-semibold">Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>

              <span className={`text-[11px] font-mono ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {isHovered ? (
                  <span className="font-semibold text-amber-400">Paused</span>
                ) : (
                  `${remainingSec}s`
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Animated Countdown Progress Bar */}
      <div className={`h-1 w-full ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`}>
        <div
          className={`h-full transition-all duration-100 ${config.progressBar}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-auto max-w-sm sm:max-w-md w-full px-3 sm:px-0"
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
          isDarkMode={isDarkMode}
        />
      ))}
    </div>
  );
};

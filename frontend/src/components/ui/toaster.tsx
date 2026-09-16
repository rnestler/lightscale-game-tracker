import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { subscribeToasts } from '../../utils/toast';
import type { ToastItem } from '../../utils/toast';
import { cn } from '../../utils/cn';
import { CheckCircle, XCircle } from 'lucide-react';

export function Toaster(): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts(setToasts);
  }, []);

  return (
    <div
      className="fixed z-[200] flex flex-col gap-2 pointer-events-none"
      style={{
        top: 'var(--toast-top, auto)',
        right: 'var(--toast-right, 1rem)',
        bottom: 'var(--toast-bottom, 1rem)',
        left: 'var(--toast-left, auto)',
      }}
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium pointer-events-auto',
            'min-w-[280px] max-w-[420px] animate-slide-up bg-card text-foreground',
            t.variant === 'error' ? 'border-destructive/40' : 'border-border'
          )}
        >
          {t.variant === 'success' ? (
            <CheckCircle className="h-4 w-4 ui-success-text flex-shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive-text flex-shrink-0" />
          )}
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

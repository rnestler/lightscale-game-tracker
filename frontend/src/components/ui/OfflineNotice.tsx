import { i18n } from '../../i18n/text';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { CloudOff, Wifi } from 'lucide-react';
import { subscribeConnectivity } from '../../utils/connectivity';
import type { ConnectivityState } from '../../utils/connectivity';
import { cn } from '../../utils/cn';

export function OfflineNotice(): JSX.Element | null {
  const [state, setState] = useState<ConnectivityState>('online');

  useEffect(() => subscribeConnectivity(setState), []);

  if (state === 'online') {
    return null;
  }

  const restored = state === 'restored';

  return (
    <div
      className="ui-viewport-bar pointer-events-none fixed inset-x-0 top-4 z-[300] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'flex max-w-full items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 animate-slide-down',
          'bg-card/80 shadow-lg backdrop-blur-xl',
          restored ? 'ui-success-border' : 'border-border/70'
        )}
      >
        <span
          className={cn(
            'relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
            restored ? 'ui-success-notice' : 'ui-warning-notice'
          )}
        >
          {!restored && (
            <span className="absolute inset-0 animate-ping rounded-full ui-warning-notice" />
          )}
          {restored ? (
            <Wifi className="relative h-3.5 w-3.5 ui-success-text" />
          ) : (
            <CloudOff className="relative h-3.5 w-3.5 ui-warning-text" />
          )}
        </span>
        <span className="truncate text-sm font-medium text-foreground">
          {restored ? i18n.chrome.offlineRestored : i18n.chrome.offlineTitle}
        </span>
        {!restored && (
          <span className="hidden truncate text-sm text-muted-foreground sm:inline">
            {i18n.chrome.offlineDescription}
          </span>
        )}
      </div>
    </div>
  );
}

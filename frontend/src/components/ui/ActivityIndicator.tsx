import { i18n } from '../../i18n/text';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { subscribeActivity } from '../../utils/activityStore';
import type { ActivityState } from '../../utils/activityStore';
import { cn } from '../../utils/cn';
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const ACTIVITY_HINT_KEY = 'lightscale-ai-activity-hint-seen';

function readHintSeen(): boolean {
  try {
    return window.localStorage.getItem(ACTIVITY_HINT_KEY) === '1';
  } catch {
    return true;
  }
}

function writeHintSeen(): void {
  try {
    window.localStorage.setItem(ACTIVITY_HINT_KEY, '1');
  } catch {
    /* Empty by design */
  }
}

export function ActivityIndicator(): JSX.Element | null {
  const [state, setState] = useState<ActivityState>(() => ({
    pending: 0,
    operations: [],
    updatedAt: Date.now(),
  }));
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [hintSeen, setHintSeen] = useState(readHintSeen);

  useEffect(() => subscribeActivity(setState), []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return (): void => {
      clearInterval(timer);
    };
  }, []);

  const count = Math.max(state.pending, state.operations.length);
  if (count === 0) {
    return null;
  }

  const drift = now - state.updatedAt;
  const showHint = !hintSeen && !open;

  function dismissHint(): void {
    if (!hintSeen) {
      writeHintSeen();
      setHintSeen(true);
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-[200] flex flex-col items-start gap-2">
      {showHint && (
        <div className="w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-primary/30 bg-card shadow-lg p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary-text flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">{i18n.chrome.aiActivityHint}</p>
          </div>
          <button
            type="button"
            onClick={dismissHint}
            className="mt-2 ml-6 text-xs font-medium text-primary-text hover:underline"
          >
            {i18n.chrome.aiActivityHintDismiss}
          </button>
        </div>
      )}
      {open && (
        <div className="w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-semibold text-foreground">
            {i18n.chrome.aiActivityTitle}
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {state.operations.length === 0
              ? Array.from({ length: state.pending }).map((_, index) => (
                  <li key={index} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 text-muted-foreground">
                      {i18n.chrome.aiActivityStarting}
                    </span>
                  </li>
                ))
              : state.operations.map((operation) => (
                  <li key={operation.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    {operation.status.kind === 'retrying' ? (
                      <RefreshCw className="h-4 w-4 animate-spin ui-warning-text flex-shrink-0" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-primary-text flex-shrink-0" />
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-foreground">{operation.label}</span>
                      {operation.status.kind === 'retrying' && (
                        <span className="block text-xs ui-warning-text">
                          {i18n.chrome.aiActivityRetrying} {operation.status.attempt}/
                          {operation.status.maximumAttempts}
                        </span>
                      )}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground flex-shrink-0">
                      {formatElapsed(operation.elapsedMilliseconds + drift)}
                    </span>
                  </li>
                ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          dismissHint();
          setOpen((value) => !value);
        }}
        className={cn(
          'flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 shadow-lg text-sm font-medium text-foreground',
          'hover:bg-accent hover:text-accent-foreground transition-colors'
        )}
        aria-label={i18n.chrome.aiActivityWorking}
      >
        <Sparkles className="h-4 w-4 text-primary-text animate-pulse flex-shrink-0" />
        <span>{i18n.chrome.aiActivityWorking}</span>
        {count > 1 && (
          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-primary/10 text-primary-text text-xs">
            {count}
          </span>
        )}
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

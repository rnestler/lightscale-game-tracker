import type { JSX } from 'react';

interface ErrorMessageProps {
  message: string;
  title?: string;
}

export function ErrorMessage({ message, title = 'Error' }: ErrorMessageProps): JSX.Element {
  return (
    <div
      role="alert"
      className="rounded-lg border border-border bg-card p-4 flex items-start gap-3"
    >
      <div className="h-5 w-5 rounded-full ui-danger-icon-wrap flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-destructive-text text-xs font-bold">!</span>
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground mt-1">{message}</div>
      </div>
    </div>
  );
}

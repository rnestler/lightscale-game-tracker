import { i18n } from '../i18n/text';
import type { JSX } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AuthFrame } from './AuthFrame';

export function NotAvailable(): JSX.Element {
  return (
    <AuthFrame screenTitle={i18n.chrome.notAvailableToAccount} screenSubtitle={''}>
      <div className="space-y-6">
        <div className="ui-icon-chip flex h-10 w-10 flex-shrink-0 items-center justify-center">
          <ShieldAlert className="h-5 w-5 text-muted-foreground" />
        </div>
        <a
          href="/app"
          className="flex h-10 w-full items-center justify-center rounded-md bg-secondary text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          {i18n.chrome.returnToMainPage}
        </a>
      </div>
    </AuthFrame>
  );
}

import type { JSX } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AuthFrame } from './AuthFrame';
import { useAuth } from '../hooks/useAuth';
import { runWithToast } from '../utils/errorHandling';

export function AwaitingApproval(): JSX.Element {
  const { signOut, user } = useAuth();

  return (
    <AuthFrame
      title={'Awaiting Approval'}
      subtitle={'You need administrator approval before you can access the application.'}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="ui-icon-chip flex h-10 w-10 flex-shrink-0 items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
          </div>
          {user && (
            <div className="text-sm text-muted-foreground">
              Signed up as <span className="font-medium text-foreground">{user.email}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            runWithToast(
              (async (): Promise<void> => {
                await signOut();
                window.location.href = '/';
              })()
            );
          }}
          className="h-10 w-full rounded-md bg-secondary text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          Sign out
        </button>
      </div>
    </AuthFrame>
  );
}

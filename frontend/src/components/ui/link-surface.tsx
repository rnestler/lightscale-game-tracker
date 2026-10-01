import type { JSX, MouseEvent, ReactNode, Ref } from 'react';
import { useSyncExternalStore } from 'react';
import { hasShell, openSignIn, subscribeNavigationTargets } from '../../utils/recordNavigation';
import { useAuth } from '../../hooks/useAuth';

interface LinkSurfaceProps {
  isAvailable: () => boolean;
  keepsContent?: boolean;
  onActivate: () => void;
  signInTo?: () => string;
  className?: string;
  children: ReactNode;
  'data-ls'?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  ref?: Ref<HTMLButtonElement>;
}

export function LinkSurface({
  isAvailable,
  keepsContent = false,
  onActivate,
  signInTo,
  className,
  children,
  'data-ls': anchor,
  onClick,
  ref,
}: LinkSurfaceProps): JSX.Element | null {
  const here = useSyncExternalStore(subscribeNavigationTargets, isAvailable);
  const shell = useSyncExternalStore(subscribeNavigationTargets, hasShell);
  const { isAuthenticated } = useAuth();
  if (!here && isAuthenticated && shell) {
    return keepsContent ? (
      <div className={className} data-ls={anchor}>
        {children}
      </div>
    ) : null;
  }
  return (
    <button
      ref={ref}
      type="button"
      className={className}
      data-ls={anchor}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (here || isAuthenticated) {
          onActivate();
        } else {
          openSignIn(
            signInTo === undefined
              ? `${window.location.pathname}${window.location.search}`
              : signInTo()
          );
        }
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}

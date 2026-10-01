import type { JSX, MouseEvent, ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { cn } from '../../utils/cn';
import {
  canNavigateTo,
  canOpenRecord,
  navigateTo,
  openSignIn,
  recordAddress,
  subscribeNavigationTargets,
} from '../../utils/recordNavigation';
import { useAuth } from '../../hooks/useAuth';
import { apiBaseUrl } from '../../config/apiConfig';
import type { FileValue } from '../../types/file';
import { Avatar } from './avatar';

interface RecordChipProps {
  collection?: string;
  id?: string | null;
  label: string;
  initials?: boolean;
  picture?: FileValue | null;
  icon?: ReactNode;
  className?: string;
  'data-ls'?: string;
}

export function RecordChip({
  collection = '',
  id = null,
  label,
  initials = false,
  picture = null,
  icon,
  className,
  'data-ls': anchor,
}: RecordChipProps): JSX.Element {
  const navigable = useSyncExternalStore(
    subscribeNavigationTargets,
    () => collection !== '' && canOpenRecord(collection)
  );
  const { isAuthenticated } = useAuth();
  const image = picture?.mimeType.startsWith('image/')
    ? `${apiBaseUrl}/api/files/${picture.id}/download?v=${encodeURIComponent(picture.fileName)}`
    : null;
  const mark =
    initials || image !== null ? (
      <Avatar name={label} image={image} size="xs" />
    ) : (
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
    );
  const shape = cn(
    'inline-flex max-w-full items-center gap-2 rounded-md align-middle text-left',
    className
  );
  if (!navigable || id === null) {
    return (
      <span className={shape} data-ls={anchor}>
        {mark}
        <span className="min-w-0 truncate" title={label}>
          {label}
        </span>
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cn(
        shape,
        'min-h-11 min-w-11 transition-colors hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      data-ls={anchor}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (canNavigateTo(collection) || isAuthenticated) {
          navigateTo(collection, id);
          return;
        }
        openSignIn(recordAddress(collection, id));
      }}
    >
      {mark}
      <span className="min-w-0 truncate" title={label}>
        {label}
      </span>
    </button>
  );
}

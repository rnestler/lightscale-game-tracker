import type { JSX, MouseEvent, ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { cn } from '../../utils/cn';
import {
  canNavigateTo,
  navigateTo,
  subscribeNavigationTargets,
} from '../../utils/recordNavigation';
import { Avatar } from './avatar';

interface RecordChipProps {
  collection?: string;
  id?: string | null;
  label: string;
  initials?: boolean;
  icon?: ReactNode;
  className?: string;
  'data-ls'?: string;
}

export function RecordChip({
  collection = '',
  id = null,
  label,
  initials = false,
  icon,
  className,
  'data-ls': anchor,
}: RecordChipProps): JSX.Element {
  const navigable = useSyncExternalStore(
    subscribeNavigationTargets,
    () => collection !== '' && canNavigateTo(collection)
  );
  const mark = initials ? (
    <Avatar name={label} size="xs" />
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
        <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">{label}</span>
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
        navigateTo(collection, id);
      }}
    >
      {mark}
      <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">{label}</span>
    </button>
  );
}

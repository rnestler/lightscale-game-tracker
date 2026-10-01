import { createContext, useContext } from 'react';
import type { JSX, ReactNode } from 'react';
import { isOwnClick } from '../../utils/ownClick';

export const CardSelectContext = createContext<{
  selectedId: string | null;
  onSelect: (id: string) => void;
}>({
  selectedId: null,
  onSelect: () => undefined,
});

export function SelectCard({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  const { selectedId, onSelect } = useContext(CardSelectContext);
  const selected = selectedId === id;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={`${className ?? ''} cursor-pointer rounded-xl transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring${selected ? ' ring-1 ring-primary/30 shadow-md' : ''}`}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onSelect(id);
        }
      }}
      onClick={(event) => {
        if (isOwnClick(event)) {
          onSelect(id);
        }
      }}
    >
      {children}
    </div>
  );
}

export function SelectCards({
  selectedId,
  onSelect,
  className,
  children,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <CardSelectContext.Provider value={{ selectedId, onSelect }}>
      <div className={className}>{children}</div>
    </CardSelectContext.Provider>
  );
}

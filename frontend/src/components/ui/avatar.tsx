import type { JSX } from 'react';
import { cn } from '../../utils/cn';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getAvatarPaletteIndex(name: string): number {
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return index % 8;
}

interface AvatarProps {
  name?: string | null;
  image?: string | null;
  size?: 'xs' | 'control' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[0.625rem]',
  control: 'w-9 h-9 text-xs',
  sm: 'w-14 h-14 text-lg',
  md: 'w-16 h-16 text-xl',
  lg: 'w-20 h-20 text-2xl',
};

export function Avatar({ name, image, size = 'md', className }: AvatarProps): JSX.Element {
  const resolved = name ?? '';
  const paletteIndex = getAvatarPaletteIndex(resolved);
  return (
    <div
      className={cn(
        sizeClasses[size],
        'ui-avatar flex items-center justify-center overflow-hidden font-semibold flex-shrink-0',
        className
      )}
      style={{
        backgroundColor: `var(--avatar-bg-${paletteIndex})`,
      }}
    >
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(resolved)
      )}
    </div>
  );
}

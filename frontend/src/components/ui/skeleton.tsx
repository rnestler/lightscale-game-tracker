import type { JSX } from 'react';
import type * as React from 'react';
import { cn } from '../../utils/cn';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export function SkeletonCardGrid(props: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-5 xl:gap-6"
      {...props}
    >
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="border border-border rounded-lg p-4 space-y-3 bg-card">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonTableProps extends React.HTMLAttributes<HTMLDivElement> {
  columns: number;
  rows?: number;
}

const COLUMN_WIDTHS = ['w-32', 'w-24', 'w-20', 'w-28', 'w-16'];

export function SkeletonTable({ columns, rows = 6, ...props }: SkeletonTableProps): JSX.Element {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg" {...props}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {Array.from({ length: rows }).map((_row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/50 last:border-0">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-3.5">
                    <Skeleton className={`h-4 ${COLUMN_WIDTHS[colIndex % COLUMN_WIDTHS.length]}`} />
                  </td>
                ))}
                <td className="px-4 py-3.5 w-20" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

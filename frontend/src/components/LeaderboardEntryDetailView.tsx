import type { JSX } from 'react';
import type * as $Domain from '../types/domain';
import { ChevronLeftIcon } from 'lucide-react';
import { Sheet, SheetContent } from './ui/sheet';
import { LeaderboardEntryDetailBody } from './LeaderboardEntryDetailBody';

interface LeaderboardEntryDetailViewProps {
  leaderboardEntry: $Domain.LeaderboardEntry | null;
  players?: $Domain.Player[];
  games?: $Domain.GameType[];
  open: boolean;
  onClose: () => void;
  embedded?: boolean;
  bare?: boolean;
  onBack?: () => void;
  onEdit?: (leaderboardEntry: $Domain.LeaderboardEntry) => void;
  onDelete?: (id: string) => void;
  onTransactionSuccess?: () => void;
}

export function LeaderboardEntryDetailView({
  leaderboardEntry,
  open,
  onClose,
  onEdit,
  onDelete,
  embedded,
  bare,
  onBack,
}: LeaderboardEntryDetailViewProps): JSX.Element {
  if (!leaderboardEntry) {
    return <></>;
  }
  const content = (
    <LeaderboardEntryDetailBody
      leaderboardEntry={leaderboardEntry}
      onEdit={onEdit}
      onDelete={onDelete}
      onClose={onClose}
    />
  );
  const sheetContent = (
    <LeaderboardEntryDetailBody
      leaderboardEntry={leaderboardEntry}
      onEdit={onEdit}
      onDelete={onDelete}
      onClose={onClose}
      hideClose
    />
  );
  return (
    <>
      {bare ? (
        <div className="bg-background">{content}</div>
      ) : embedded ? (
        <div className="flex flex-col h-full min-h-0 bg-background">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="lg:hidden flex items-center gap-1.5 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b border-border"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span>Back</span>
            </button>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">{content}</div>
        </div>
      ) : (
        <Sheet
          open={open}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              onClose();
            }
          }}
        >
          <SheetContent variant="modal" aria-describedby={undefined}>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">{sheetContent}</div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

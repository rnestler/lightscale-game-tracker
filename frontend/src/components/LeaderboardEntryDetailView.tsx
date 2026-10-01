import { i18n } from '../i18n/text';
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
  page?: boolean;
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
  page,
}: LeaderboardEntryDetailViewProps): JSX.Element {
  if (!leaderboardEntry) {
    return <></>;
  }
  const sampleMarker = leaderboardEntry._sample ? (
    <div className="flex justify-end pl-4 pr-14 pt-4">
      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
        {i18n.chrome.sampleRecord}
      </span>
    </div>
  ) : null;
  const content = (
    <>
      {sampleMarker}
      <LeaderboardEntryDetailBody
        leaderboardEntry={leaderboardEntry}
        onEdit={onEdit}
        onDelete={onDelete}
        onClose={onClose}
        hideClose
      />
    </>
  );
  return page ? (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground self-start"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        <span>{i18n.chrome.back}</span>
      </button>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="rounded-xl border border-border bg-card overflow-hidden text-card-foreground">
          {content}
        </div>
      </div>
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
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">{content}</div>
      </SheetContent>
    </Sheet>
  );
}

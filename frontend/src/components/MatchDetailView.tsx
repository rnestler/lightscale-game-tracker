import type { JSX } from 'react';
import type * as $Domain from '../types/domain';
import { ChevronLeftIcon } from 'lucide-react';
import { Sheet, SheetContent } from './ui/sheet';
import { MatchDetailBody } from './MatchDetailBody';

interface MatchDetailViewProps {
  match: $Domain.Match | null;
  games?: $Domain.GameType[];
  players?: $Domain.Player[];
  open: boolean;
  onClose: () => void;
  embedded?: boolean;
  bare?: boolean;
  onBack?: () => void;
  onEdit?: (match: $Domain.Match) => void;
  onDelete?: (id: string) => void;
  onTransactionSuccess?: () => void;
}

export function MatchDetailView({
  match,
  open,
  onClose,
  onEdit,
  onDelete,
  embedded,
  bare,
  onBack,
  onTransactionSuccess,
}: MatchDetailViewProps): JSX.Element {
  if (!match) {
    return <></>;
  }
  const content = (
    <MatchDetailBody
      match={match}
      onEdit={onEdit}
      onDelete={onDelete}
      onClose={onClose}
      onTransactionSuccess={onTransactionSuccess}
    />
  );
  const sheetContent = (
    <MatchDetailBody
      match={match}
      onEdit={onEdit}
      onDelete={onDelete}
      onClose={onClose}
      onTransactionSuccess={onTransactionSuccess}
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

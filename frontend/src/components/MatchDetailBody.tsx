import { useState, type JSX } from 'react';
import { useGames } from '../hooks/useGames';
import { usePlayers } from '../hooks/usePlayers';
import {
  useCancelMatchTransaction,
  useCompleteMatchTransaction,
  useDisputeMatchTransaction,
  useStartMatchTransaction,
} from '../hooks/useTransactionMethods';
import { usePermissions, canReadField } from '../hooks/usePermissions';
import { TransactionArgsDialog } from './TransactionArgsDialog';
import { runWithToast } from '../utils/errorHandling';
import type * as $Domain from '../types/domain';
import {
  BanIcon,
  DicesIcon,
  PencilIcon,
  SwordsIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from 'lucide-react';
import { StaleDataPanel } from './StaleDataPanel';
import { RichTextDisplay } from '../components/ui/form-field';
import { RecordChip } from '../components/ui/record-chip';
import { relativeTime } from '../utils/relativeTime';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { Skeleton } from './ui/skeleton';

export function MatchDetailBody({
  match,
  onEdit,
  onDelete,
  onClose,
  hideClose,
  onTransactionSuccess,
}: {
  match: $Domain.Match;
  onEdit?: (record: $Domain.Match) => void;
  onDelete?: (id: string) => void;
  onClose?: () => void;
  hideClose?: boolean;
  onTransactionSuccess?: () => void;
}): JSX.Element {
  const { games, isInitializing: gamesInitializing, reloadGames } = useGames();
  const { players, isInitializing: playersInitializing, reloadPlayers } = usePlayers();
  const { execute: executeCancelMatch, isBusy: isCancelMatchBusy } = useCancelMatchTransaction();
  const {
    execute: executeCompleteMatch,
    isBusy: isCompleteMatchBusy,
    errorMessage: completeMatchErrorMessage,
  } = useCompleteMatchTransaction();
  const { execute: executeDisputeMatch, isBusy: isDisputeMatchBusy } = useDisputeMatchTransaction();
  const { execute: executeStartMatch, isBusy: isStartMatchBusy } = useStartMatchTransaction();
  const { permissions, hasManagementAccess } = usePermissions();
  const canCancelMatch = permissions?.['*']?.call?.['cancelMatch'] ?? false;
  const canCompleteMatch = permissions?.['*']?.call?.['completeMatch'] ?? false;
  const canDisputeMatch = permissions?.['*']?.call?.['disputeMatch'] ?? false;
  const canStartMatch = permissions?.['*']?.call?.['startMatch'] ?? false;
  const refreshWidget = (): void => {
    runWithToast(reloadGames());
    runWithToast(reloadPlayers());
    onTransactionSuccess?.();
  };
  const [completeMatchDialogOpen, setCompleteMatchDialogOpen] = useState(false);
  if (gamesInitializing || playersInitializing) {
    return (
      <div
        role="status"
        aria-label={'Loading…'}
        className="rounded-xl border border-border bg-card p-4 space-y-3"
      >
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  return (
    <>
      <div className="flex flex-col" aria-label="" data-ls="5546432c87">
        <div
          className="flex flex-row items-start gap-4 border-b border-border p-6"
          data-ls="c2679972d5"
        >
          <div
            className="w-11 h-11 rounded-lg bg-primary/10 text-foreground flex items-center justify-center flex-shrink-0"
            data-ls="04e17af205"
          >
            <SwordsIcon className="h-5 w-5" />
          </div>
          <div
            className="flex flex-col gap-1 flex-1 min-w-0 flex-wrap [&>*]:max-w-full"
            data-ls="43487ad8ae"
          >
            <span
              className="break-words text-sm uppercase tracking-wide font-semibold text-muted-foreground"
              data-ls="b59336900e"
            >
              {'Match'}
            </span>
            <span className="break-words text-2xl font-semibold" data-ls="a0bce708ba">
              {match.title}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-5 p-6" data-ls="745144e309">
          <div
            className="flex flex-col gap-4 p-5 rounded-xl border border-border bg-card"
            data-ls="ed71da0c9f"
          >
            <div className="grid grid-cols-2 gap-x-8 gap-y-5" data-ls="1e4b7130cd">
              {canReadField(permissions, 'matches', 'gameId') &&
              games.find((gameType) => gameType.id === match.gameId)?.name ? (
                <div className="flex flex-col gap-1" data-ls="ddf93c2aa9">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="76edae0240"
                  >
                    {'Game'}
                  </span>
                  {games.find((gameType) => gameType.id === match.gameId) !== undefined ? (
                    <>
                      <RecordChip
                        collection="games"
                        id={match.gameId}
                        label={String(
                          games.find((gameType) => gameType.id === match.gameId)?.name ?? ''
                        )}
                        icon={<DicesIcon className="h-3.5 w-3.5" />}
                        className="break-words text-sm"
                        data-ls="b1bf9e39e9"
                      />
                    </>
                  ) : (
                    <span className="break-words text-sm" data-ls="b1bf9e39e9">
                      {'—'}
                    </span>
                  )}
                </div>
              ) : null}
              {canReadField(permissions, 'matches', 'scheduledAt') && match.scheduledAt ? (
                <div className="flex flex-col gap-1" data-ls="f2abfa11d9">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="fb4eab9344"
                  >
                    {'Date & Time'}
                  </span>
                  <span className="whitespace-nowrap text-sm" data-ls="8b694b7958">
                    {match.scheduledAt
                      ? new Date(match.scheduledAt).toLocaleString('en', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : ''}
                  </span>
                </div>
              ) : null}
              {canReadField(permissions, 'matches', 'playerOneId') &&
              players.find((player) => player.id === match.playerOneId)?.nickname ? (
                <div className="flex flex-col gap-1" data-ls="adc129ef8e">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="6c76587d6e"
                  >
                    {'Player 1'}
                  </span>
                  {players.find((player) => player.id === match.playerOneId) !== undefined ? (
                    <>
                      <RecordChip
                        collection="players"
                        id={match.playerOneId}
                        label={String(
                          players.find((player) => player.id === match.playerOneId)?.nickname ?? ''
                        )}
                        icon={<UserIcon className="h-3.5 w-3.5" />}
                        className="break-words text-sm"
                        data-ls="7efd236eae"
                      />
                    </>
                  ) : (
                    <span className="break-words text-sm" data-ls="7efd236eae">
                      {'—'}
                    </span>
                  )}
                </div>
              ) : null}
              {canReadField(permissions, 'matches', 'playerTwoId') &&
              players.find((player) => player.id === match.playerTwoId)?.nickname ? (
                <div className="flex flex-col gap-1" data-ls="5368f73bba">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="ce5ca9bfb3"
                  >
                    {'Player 2'}
                  </span>
                  {players.find((player) => player.id === match.playerTwoId) !== undefined ? (
                    <>
                      <RecordChip
                        collection="players"
                        id={match.playerTwoId}
                        label={String(
                          players.find((player) => player.id === match.playerTwoId)?.nickname ?? ''
                        )}
                        icon={<UserIcon className="h-3.5 w-3.5" />}
                        className="break-words text-sm"
                        data-ls="1a6e441595"
                      />
                    </>
                  ) : (
                    <span className="break-words text-sm" data-ls="1a6e441595">
                      {'—'}
                    </span>
                  )}
                </div>
              ) : null}
              {canReadField(permissions, 'matches', 'status') && match.status ? (
                <div className="flex flex-col gap-1" data-ls="bbe16c69a7">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="eb53b96de3"
                  >
                    {'Status'}
                  </span>
                  <span className="break-words text-sm" data-ls="769dbc79dc">
                    {new Map([
                      ['scheduled', 'Scheduled'],
                      ['inProgress', 'In Progress'],
                      ['completed', 'Completed'],
                      ['disputed', 'Disputed'],
                      ['cancelled', 'Cancelled'],
                    ]).get(match.status) ?? match.status}
                  </span>
                </div>
              ) : null}
              {canReadField(permissions, 'matches', 'outcome') && match.outcome ? (
                <div className="flex flex-col gap-1" data-ls="34df018fba">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="0d65bfbaaa"
                  >
                    {'Outcome'}
                  </span>
                  <span className="break-words text-sm" data-ls="c96b2b45e8">
                    {new Map([
                      ['playerOneWin', 'Player 1 Victory'],
                      ['playerTwoWin', 'Player 2 Victory'],
                      ['draw', 'Draw'],
                    ]).get(match.outcome) ?? match.outcome}
                  </span>
                </div>
              ) : null}
              {canReadField(permissions, 'matches', 'playerOneScore') && (
                <div className="flex flex-col gap-1" data-ls="ef136064d8">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="a7f95c8a2f"
                  >
                    {'P1 Score'}
                  </span>
                  <span className="whitespace-nowrap text-sm" data-ls="fa4a3c49ae">
                    {match.playerOneScore}
                  </span>
                </div>
              )}
              {canReadField(permissions, 'matches', 'playerTwoScore') && (
                <div className="flex flex-col gap-1" data-ls="670e0ab6e2">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="b0db1a68e0"
                  >
                    {'P2 Score'}
                  </span>
                  <span className="whitespace-nowrap text-sm" data-ls="adbc106705">
                    {match.playerTwoScore}
                  </span>
                </div>
              )}
              {canReadField(permissions, 'matches', 'playerOneRatingDelta') && (
                <div className="flex flex-col gap-1" data-ls="d1944508ef">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="9396433220"
                  >
                    {'P1 Rating Change'}
                  </span>
                  <span className="break-words text-sm" data-ls="d6329d68ef">
                    {match.playerOneRatingDelta}
                  </span>
                </div>
              )}
              {canReadField(permissions, 'matches', 'playerTwoRatingDelta') && (
                <div className="flex flex-col gap-1" data-ls="ed75a586cf">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="f997e81b49"
                  >
                    {'P2 Rating Change'}
                  </span>
                  <span className="break-words text-sm" data-ls="949519ee88">
                    {match.playerTwoRatingDelta}
                  </span>
                </div>
              )}
              {canReadField(permissions, 'matches', 'notes') && match.notes ? (
                <div className="flex flex-col gap-1 col-span-2" data-ls="158e49de36">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="6ffef2d01c"
                  >
                    {'Match Notes'}
                  </span>
                  <RichTextDisplay
                    value={match.notes}
                    className="break-words text-sm"
                    data-ls="d45de8835c"
                  />
                </div>
              ) : null}
            </div>
          </div>
          {hasManagementAccess && (
            <div className="pt-5 border-t border-border">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {'Created At'}
                  </dt>
                  <dd
                    className="mt-1 text-sm text-foreground"
                    title={
                      match.createdAt
                        ? new Date(match.createdAt).toLocaleString('en', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : undefined
                    }
                  >
                    {match.createdAt ? relativeTime(match.createdAt) : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )}
          <StaleDataPanel
            table="Match"
            recordId={match.id}
            visibleColumns={[
              'gameId',
              'playerOneId',
              'playerTwoId',
              'scheduledAt',
              'status',
              'outcome',
              'notes',
              'createdAt',
            ]}
          />
          <div
            className="flex flex-row min-w-0 flex-wrap [&>*]:max-w-full items-center justify-end gap-3"
            data-ls="d31a1872d8"
          >
            {onClose && !hideClose && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md hover:bg-secondary hover:text-secondary-foreground"
                onClick={() => {
                  onClose();
                }}
              >
                <XIcon className="h-4 w-4" />
                {'Close'}
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground"
                onClick={() => {
                  onEdit(match);
                  onClose?.();
                }}
              >
                <PencilIcon className="h-4 w-4" />
                {'Edit'}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md text-destructive-text hover:bg-destructive/10"
                onClick={() => {
                  onDelete(match.id);
                  onClose?.();
                }}
              >
                <Trash2Icon className="h-4 w-4" />
                {'Delete'}
              </button>
            )}
            {canStartMatch && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground"
                      onClick={() => {
                        executeStartMatch(match, refreshWidget);
                      }}
                      disabled={isStartMatchBusy || match.status !== 'scheduled'}
                    >
                      {'Start Match'}
                    </button>
                  </span>
                </TooltipTrigger>
                {(match.status !== 'scheduled' ? 'Match must be scheduled to start' : null) !==
                  null && (
                  <TooltipContent>
                    {' '}
                    <BanIcon className="h-3.5 w-3.5 text-destructive-text" />{' '}
                    {match.status !== 'scheduled' ? 'Match must be scheduled to start' : null}
                  </TooltipContent>
                )}
              </Tooltip>
            )}
            {canCompleteMatch && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground"
                onClick={() => {
                  setCompleteMatchDialogOpen(true);
                }}
                disabled={isCompleteMatchBusy}
              >
                {'Record & Complete Match'}
              </button>
            )}
            {canDisputeMatch && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground"
                      onClick={() => {
                        executeDisputeMatch(match, refreshWidget);
                      }}
                      disabled={isDisputeMatchBusy || match.status !== 'completed'}
                    >
                      {'Dispute Result'}
                    </button>
                  </span>
                </TooltipTrigger>
                {(match.status !== 'completed'
                  ? 'Only completed matches can be disputed'
                  : null) !== null && (
                  <TooltipContent>
                    {' '}
                    <BanIcon className="h-3.5 w-3.5 text-destructive-text" />{' '}
                    {match.status !== 'completed' ? 'Only completed matches can be disputed' : null}
                  </TooltipContent>
                )}
              </Tooltip>
            )}
            {canCancelMatch && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground"
                onClick={() => {
                  executeCancelMatch(match, refreshWidget);
                }}
                disabled={isCancelMatchBusy}
              >
                {'Cancel Match'}
              </button>
            )}
          </div>
        </div>
      </div>
      <TransactionArgsDialog
        open={completeMatchDialogOpen}
        title={'Record & Complete Match'}
        submitLabel={'Record & Complete Match'}
        cancelLabel={'Cancel'}
        isBusy={isCompleteMatchBusy}
        fields={[
          {
            kind: 'select',
            name: 'outcome',
            label: 'Outcome',
            options: [
              { value: 'playerOneWin', label: 'Player 1 Victory' },
              { value: 'playerTwoWin', label: 'Player 2 Victory' },
              { value: 'draw', label: 'Draw' },
            ],
            placeholder: 'Outcome',
          },
        ]}
        errorMessage={completeMatchErrorMessage}
        onClose={() => {
          setCompleteMatchDialogOpen(false);
        }}
        onSubmit={(values) => {
          executeCompleteMatch(match, String(values['outcome']), () => {
            setCompleteMatchDialogOpen(false);
            refreshWidget();
          });
        }}
      />
    </>
  );
}

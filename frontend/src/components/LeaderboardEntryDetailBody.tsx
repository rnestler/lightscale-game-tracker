import type { JSX } from 'react';
import { useGames } from '../hooks/useGames';
import { usePlayers } from '../hooks/usePlayers';
import { usePermissions, canReadField } from '../hooks/usePermissions';
import type * as $Domain from '../types/domain';
import { DicesIcon, PencilIcon, Trash2Icon, TrophyIcon, UserIcon, XIcon } from 'lucide-react';
import { StaleDataPanel } from './StaleDataPanel';
import { RecordChip } from '../components/ui/record-chip';
import { Skeleton } from './ui/skeleton';

export function LeaderboardEntryDetailBody({
  leaderboardEntry,
  onEdit,
  onDelete,
  onClose,
  hideClose,
}: {
  leaderboardEntry: $Domain.LeaderboardEntry;
  onEdit?: (record: $Domain.LeaderboardEntry) => void;
  onDelete?: (id: string) => void;
  onClose?: () => void;
  hideClose?: boolean;
  onTransactionSuccess?: () => void;
}): JSX.Element {
  const { games, isInitializing: gamesInitializing } = useGames();
  const { players, isInitializing: playersInitializing } = usePlayers();
  const { permissions } = usePermissions();
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
    <div className="flex flex-col" aria-label="" data-ls="c83eb6bddd">
      <div
        className="flex flex-row items-start gap-4 border-b border-border p-6"
        data-ls="bd8182b988"
      >
        <div
          className="w-11 h-11 rounded-lg bg-primary/10 text-foreground flex items-center justify-center flex-shrink-0"
          data-ls="73faae045e"
        >
          <TrophyIcon className="h-5 w-5" />
        </div>
        <div
          className="flex flex-col gap-1 flex-1 min-w-0 flex-wrap [&>*]:max-w-full"
          data-ls="22cfcca841"
        >
          <span
            className="break-words text-sm uppercase tracking-wide font-semibold text-muted-foreground"
            data-ls="b6f37f4eb7"
          >
            {'Leaderboard Entry'}
          </span>
          <span className="break-words text-2xl font-semibold" data-ls="54aa190d76">
            {leaderboardEntry.rating}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-5 p-6" data-ls="97edec5b69">
        <div
          className="flex flex-col gap-4 p-5 rounded-xl border border-border bg-card"
          data-ls="e09bede022"
        >
          <div className="grid grid-cols-2 gap-x-8 gap-y-5" data-ls="7d2f1e343b">
            {canReadField(permissions, 'leaderboards', 'playerId') &&
            players.find((player) => player.id === leaderboardEntry.playerId)?.nickname ? (
              <div className="flex flex-col gap-1" data-ls="eb6c3d1158">
                <span
                  className="break-words text-xs font-medium text-muted-foreground"
                  data-ls="a223f91c1e"
                >
                  {'Player'}
                </span>
                {players.find((player) => player.id === leaderboardEntry.playerId) !== undefined ? (
                  <>
                    <RecordChip
                      collection="players"
                      id={leaderboardEntry.playerId}
                      label={String(
                        players.find((player) => player.id === leaderboardEntry.playerId)
                          ?.nickname ?? ''
                      )}
                      icon={<UserIcon className="h-3.5 w-3.5" />}
                      className="break-words text-sm"
                      data-ls="a02ef9fb59"
                    />
                  </>
                ) : (
                  <span className="break-words text-sm" data-ls="a02ef9fb59">
                    {'—'}
                  </span>
                )}
              </div>
            ) : null}
            {canReadField(permissions, 'leaderboards', 'gameId') &&
            games.find((gameType) => gameType.id === leaderboardEntry.gameId)?.name ? (
              <div className="flex flex-col gap-1" data-ls="ec38180f9e">
                <span
                  className="break-words text-xs font-medium text-muted-foreground"
                  data-ls="57313fef09"
                >
                  {'Game'}
                </span>
                {games.find((gameType) => gameType.id === leaderboardEntry.gameId) !== undefined ? (
                  <>
                    <RecordChip
                      collection="games"
                      id={leaderboardEntry.gameId}
                      label={String(
                        games.find((gameType) => gameType.id === leaderboardEntry.gameId)?.name ??
                          ''
                      )}
                      icon={<DicesIcon className="h-3.5 w-3.5" />}
                      className="break-words text-sm"
                      data-ls="aa54e7da25"
                    />
                  </>
                ) : (
                  <span className="break-words text-sm" data-ls="aa54e7da25">
                    {'—'}
                  </span>
                )}
              </div>
            ) : null}
            {canReadField(permissions, 'leaderboards', 'matchesPlayed') && (
              <div className="flex flex-col gap-1" data-ls="4ce0175d38">
                <span
                  className="break-words text-xs font-medium text-muted-foreground"
                  data-ls="4aac8a8b89"
                >
                  {'Matches Played'}
                </span>
                <span className="break-words text-sm" data-ls="0d9373c8ae">
                  {leaderboardEntry.matchesPlayed}
                </span>
              </div>
            )}
            {canReadField(permissions, 'leaderboards', 'wins') && (
              <div className="flex flex-col gap-1" data-ls="f300e63bbd">
                <span
                  className="break-words text-xs font-medium text-muted-foreground"
                  data-ls="afa8604428"
                >
                  {'Wins'}
                </span>
                <span className="break-words text-sm" data-ls="d6b666e84a">
                  {leaderboardEntry.wins}
                </span>
              </div>
            )}
            {canReadField(permissions, 'leaderboards', 'losses') && (
              <div className="flex flex-col gap-1" data-ls="16a11513f2">
                <span
                  className="break-words text-xs font-medium text-muted-foreground"
                  data-ls="cc85f47c16"
                >
                  {'Losses'}
                </span>
                <span className="break-words text-sm" data-ls="3f2537d752">
                  {leaderboardEntry.losses}
                </span>
              </div>
            )}
            {canReadField(permissions, 'leaderboards', 'draws') && (
              <div className="flex flex-col gap-1" data-ls="09fc9203d5">
                <span
                  className="break-words text-xs font-medium text-muted-foreground"
                  data-ls="cd83fdf276"
                >
                  {'Draws'}
                </span>
                <span className="break-words text-sm" data-ls="55a24375fe">
                  {leaderboardEntry.draws}
                </span>
              </div>
            )}
            {canReadField(permissions, 'leaderboards', 'lastPlayedAt') &&
            leaderboardEntry.lastPlayedAt ? (
              <div className="flex flex-col gap-1" data-ls="953a37d321">
                <span
                  className="break-words text-xs font-medium text-muted-foreground"
                  data-ls="524685ffcd"
                >
                  {'Last Activity'}
                </span>
                <span className="whitespace-nowrap text-sm" data-ls="75e2f5c46c">
                  {leaderboardEntry.lastPlayedAt
                    ? new Date(leaderboardEntry.lastPlayedAt).toLocaleString('en', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : ''}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <StaleDataPanel
          table="LeaderboardEntry"
          recordId={leaderboardEntry.id}
          visibleColumns={[
            'playerId',
            'gameId',
            'rating',
            'matchesPlayed',
            'wins',
            'losses',
            'draws',
            'lastPlayedAt',
          ]}
        />
        <div
          className="flex flex-row min-w-0 flex-wrap [&>*]:max-w-full items-center justify-end gap-3"
          data-ls="9c28ace1de"
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
                onEdit(leaderboardEntry);
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
                onDelete(leaderboardEntry.id);
                onClose?.();
              }}
            >
              <Trash2Icon className="h-4 w-4" />
              {'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

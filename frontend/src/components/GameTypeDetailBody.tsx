import { useState, useEffect, type JSX } from 'react';
import { useGames } from '../hooks/useGames';
import { usePlayers } from '../hooks/usePlayers';
import { usePermissions, canReadField } from '../hooks/usePermissions';
import { leaderboardsApi } from '../api/leaderboardsApi';
import { getErrorMessage } from '../utils/errorHandling';
import { ErrorMessage } from './ui/error-message';
import type * as $Domain from '../types/domain';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DicesIcon,
  PencilIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from 'lucide-react';
import { StaleDataPanel } from './StaleDataPanel';
import { RichTextDisplay } from '../components/ui/form-field';
import { RecordChip } from '../components/ui/record-chip';
import { Skeleton } from './ui/skeleton';

export function GameTypeDetailBody({
  gameType,
  onEdit,
  onDelete,
  onClose,
  hideClose,
}: {
  gameType: $Domain.GameType;
  onEdit?: (record: $Domain.GameType) => void;
  onDelete?: (id: string) => void;
  onClose?: () => void;
  hideClose?: boolean;
  onTransactionSuccess?: () => void;
}): JSX.Element {
  const { games, isInitializing: gamesInitializing } = useGames();
  const { players, isInitializing: playersInitializing } = usePlayers();
  const { permissions } = usePermissions();
  const [gameTypeLeaderboard, setGameTypeLeaderboard] = useState<$Domain.LeaderboardEntry[]>([]);
  const [gameTypeLeaderboardError, setGameTypeLeaderboardError] = useState<string | null>(null);
  const gameTypeLeaderboardParent = gameType.id;
  useEffect(() => {
    if (!(permissions?.['leaderboards']?.read ?? false)) {
      return;
    }
    leaderboardsApi
      .list()
      .then((ids) => leaderboardsApi.multiGet(ids))
      .then((entries) => {
        setGameTypeLeaderboard(
          entries.filter((entry) => entry.gameId === gameTypeLeaderboardParent)
        );
        setGameTypeLeaderboardError(null);
      })
      .catch((error: unknown) => {
        setGameTypeLeaderboardError(getErrorMessage(error));
      });
  }, [gameTypeLeaderboardParent, permissions]);
  const [gameTypeLeaderboardPage, setGameTypeLeaderboardPage] = useState(0);
  const gameTypeLeaderboardPageCount = Math.max(1, Math.ceil(gameTypeLeaderboard.length / 10));
  const gameTypeLeaderboardPageSafe = Math.min(
    gameTypeLeaderboardPage,
    gameTypeLeaderboardPageCount - 1
  );
  const pagedGameTypeLeaderboard = gameTypeLeaderboard.slice(
    gameTypeLeaderboardPageSafe * 10,
    gameTypeLeaderboardPageSafe * 10 + 10
  );
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
      {gameTypeLeaderboardError !== null && <ErrorMessage message={gameTypeLeaderboardError} />}
      <div className="flex flex-col" aria-label="" data-ls="b890a9d1b6">
        <div
          className="flex flex-row items-start gap-4 border-b border-border p-6"
          data-ls="44eab9786d"
        >
          <div
            className="w-11 h-11 rounded-lg bg-primary/10 text-foreground flex items-center justify-center flex-shrink-0"
            data-ls="c030d384b5"
          >
            <DicesIcon className="h-5 w-5" />
          </div>
          <div
            className="flex flex-col gap-1 flex-1 min-w-0 flex-wrap [&>*]:max-w-full"
            data-ls="77558cf25a"
          >
            <span
              className="break-words text-sm uppercase tracking-wide font-semibold text-muted-foreground"
              data-ls="c983b5e847"
            >
              {'Game'}
            </span>
            <span className="break-words text-2xl font-semibold" data-ls="d2998ed658">
              {gameType.name}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-5 p-6" data-ls="f3504a53ef">
          <div
            className="flex flex-col gap-4 p-5 rounded-xl border border-border bg-card"
            data-ls="67c462f74e"
          >
            <div className="grid grid-cols-2 gap-x-8 gap-y-5" data-ls="b2a1f9d3f9">
              {canReadField(permissions, 'games', 'category') && gameType.category ? (
                <div className="flex flex-col gap-1" data-ls="35f99af781">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="91d09ced6a"
                  >
                    {'Category'}
                  </span>
                  <span className="break-words text-sm" data-ls="e1b2ba914a">
                    {new Map([
                      ['chess', 'Chess & Variants'],
                      ['billiards', 'Billiards / Pool'],
                      ['tableTennis', 'Table Tennis'],
                      ['darts', 'Darts'],
                      ['boardGames', 'Board Games'],
                      ['cardGames', 'Card Games'],
                      ['custom', 'Custom / Other'],
                    ]).get(gameType.category) ?? gameType.category}
                  </span>
                </div>
              ) : null}
              {canReadField(permissions, 'games', 'rulesVariant') && gameType.rulesVariant ? (
                <div className="flex flex-col gap-1" data-ls="bc2db77af7">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="2a0a3113e3"
                  >
                    {'Variant / Ruleset'}
                  </span>
                  <span className="break-words text-sm" data-ls="9c83426a27">
                    {gameType.rulesVariant}
                  </span>
                </div>
              ) : null}
              {canReadField(permissions, 'games', 'defaultRating') && (
                <div className="flex flex-col gap-1" data-ls="5785f7ebad">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="c18d19b654"
                  >
                    {'Starting Rating (Default 1200)'}
                  </span>
                  <span className="break-words text-sm" data-ls="43c74b0d6d">
                    {gameType.defaultRating}
                  </span>
                </div>
              )}
              {canReadField(permissions, 'games', 'description') && gameType.description ? (
                <div className="flex flex-col gap-1 col-span-2" data-ls="d23d31c05a">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="e820920fe1"
                  >
                    {'Overview & Rules'}
                  </span>
                  <RichTextDisplay
                    value={gameType.description}
                    className="break-words text-sm"
                    data-ls="b17e4c75c2"
                  />
                </div>
              ) : null}
              {(permissions?.['leaderboards']?.read ?? false) && (
                <div className="flex flex-col gap-2 col-span-2" data-ls="fcf06eee7b">
                  <span
                    className="break-words text-xs font-medium text-muted-foreground"
                    data-ls="b7e95ddd23"
                  >
                    {'Game Leaderboard'}
                  </span>
                  <div className="min-w-0 overflow-auto bg-card border border-border rounded-md">
                    <table className="ui-table w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          {canReadField(permissions, 'leaderboards', 'playerId') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {'Player'}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'gameId') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {'Game'}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'rating') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {'Current Rating'}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'matchesPlayed') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {'Matches Played'}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'wins') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {'Wins'}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'losses') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {'Losses'}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'draws') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {'Draws'}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'lastPlayedAt') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {'Last Activity'}
                            </th>
                          )}
                          <th
                            scope="col"
                            className="w-px px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                          ></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedGameTypeLeaderboard.length === 0 && (
                          <tr>
                            <td
                              colSpan={9}
                              className="px-4 py-8 text-center text-muted-foreground"
                              role="status"
                            >
                              {'No data yet'}
                            </td>
                          </tr>
                        )}
                        {pagedGameTypeLeaderboard.map((leaderboardEntry) => (
                          <tr
                            key={leaderboardEntry.id}
                            className="group/row border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
                          >
                            {canReadField(permissions, 'leaderboards', 'playerId') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={'Player'}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  {players.find(
                                    (player) => player.id === leaderboardEntry.playerId
                                  ) !== undefined ? (
                                    <>
                                      <RecordChip
                                        collection="players"
                                        id={leaderboardEntry.playerId}
                                        label={String(
                                          players.find(
                                            (player) => player.id === leaderboardEntry.playerId
                                          )?.nickname ?? ''
                                        )}
                                        icon={<UserIcon className="h-3.5 w-3.5" />}
                                        className="break-words text-sm"
                                        data-ls="842ff4e534"
                                      />
                                    </>
                                  ) : (
                                    <span className="break-words text-sm" data-ls="842ff4e534">
                                      {'—'}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'gameId') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={'Game'}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  {games.find(
                                    (gameTypeOption) =>
                                      gameTypeOption.id === leaderboardEntry.gameId
                                  ) !== undefined ? (
                                    <>
                                      <RecordChip
                                        collection="games"
                                        id={leaderboardEntry.gameId}
                                        label={String(
                                          games.find(
                                            (gameTypeOption) =>
                                              gameTypeOption.id === leaderboardEntry.gameId
                                          )?.name ?? ''
                                        )}
                                        icon={<DicesIcon className="h-3.5 w-3.5" />}
                                        className="break-words text-sm"
                                        data-ls="858cc2b46f"
                                      />
                                    </>
                                  ) : (
                                    <span className="break-words text-sm" data-ls="858cc2b46f">
                                      {'—'}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'rating') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={'Current Rating'}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  <span className="break-words text-sm" data-ls="b393c9b22b">
                                    {leaderboardEntry.rating}
                                  </span>
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'matchesPlayed') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={'Matches Played'}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  <span className="break-words text-sm" data-ls="ce1b851cb9">
                                    {leaderboardEntry.matchesPlayed}
                                  </span>
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'wins') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={'Wins'}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  <span className="break-words text-sm" data-ls="83f449fbe4">
                                    {leaderboardEntry.wins}
                                  </span>
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'losses') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={'Losses'}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  <span className="break-words text-sm" data-ls="8636678a90">
                                    {leaderboardEntry.losses}
                                  </span>
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'draws') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={'Draws'}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  <span className="break-words text-sm" data-ls="3c3ba6f05c">
                                    {leaderboardEntry.draws}
                                  </span>
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'lastPlayedAt') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={'Last Activity'}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  <span className="whitespace-nowrap text-sm" data-ls="122e5d5f44">
                                    {leaderboardEntry.lastPlayedAt
                                      ? new Date(leaderboardEntry.lastPlayedAt).toLocaleString(
                                          'en',
                                          { dateStyle: 'medium', timeStyle: 'short' }
                                        )
                                      : ''}
                                  </span>
                                </div>
                              </td>
                            )}
                            <td className="w-px" />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {gameTypeLeaderboardPageCount > 1 && (
                      <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border text-sm text-muted-foreground print:hidden">
                        <span>{`Page ${gameTypeLeaderboardPageSafe + 1} of ${gameTypeLeaderboardPageCount}`}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={'Previous page'}
                            onClick={() => {
                              setGameTypeLeaderboardPage(
                                Math.max(0, gameTypeLeaderboardPageSafe - 1)
                              );
                            }}
                            disabled={gameTypeLeaderboardPageSafe <= 0}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 transition-colors"
                          >
                            <ChevronLeftIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={'Next page'}
                            onClick={() => {
                              setGameTypeLeaderboardPage(
                                Math.min(
                                  gameTypeLeaderboardPageCount - 1,
                                  gameTypeLeaderboardPageSafe + 1
                                )
                              );
                            }}
                            disabled={
                              gameTypeLeaderboardPageSafe >= gameTypeLeaderboardPageCount - 1
                            }
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 transition-colors"
                          >
                            <ChevronRightIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <StaleDataPanel
            table="GameType"
            recordId={gameType.id}
            visibleColumns={['name', 'category', 'rulesVariant', 'defaultRating', 'description']}
          />
          <div
            className="flex flex-row min-w-0 flex-wrap [&>*]:max-w-full items-center justify-end gap-3"
            data-ls="2a34d9f6a0"
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
                  onEdit(gameType);
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
                  onDelete(gameType.id);
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
    </>
  );
}

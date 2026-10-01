import { i18n } from '../i18n/text';
import { useState, useEffect, useSyncExternalStore, type JSX } from 'react';
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
import { CalculatedMark } from './CalculatedMark';
import { RichTextDisplay } from '../components/ui/form-field';
import { RecordChip } from '../components/ui/record-chip';
import { referenceStore } from '../api/referenceStore';
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
  const { permissions } = usePermissions();
  const {
    isInitializing: gamesInitializing,
    errorMessage: gamesError,
    games: gamesComplete,
  } = useGames();
  const {
    isInitializing: playersInitializing,
    errorMessage: playersError,
    players: playersComplete,
  } = usePlayers();
  const storeRevision = useSyncExternalStore(referenceStore.subscribe, referenceStore.revision);
  const [gameTypeLeaderboard, setGameTypeLeaderboard] = useState<$Domain.LeaderboardEntry[]>([]);
  const [gameTypeLeaderboardError, setGameTypeLeaderboardError] = useState<string | null>(null);
  const gameTypeLeaderboardParent = gameType.id;
  useEffect(() => {
    if (!(permissions?.['leaderboards']?.read ?? false)) {
      return;
    }
    let current = true;
    leaderboardsApi
      .list()
      .then((ids) => leaderboardsApi.multiGet(ids))
      .then((entries) => {
        if (!current) {
          return;
        }
        setGameTypeLeaderboard(
          entries.filter((entry) => entry.gameId === gameTypeLeaderboardParent)
        );
        setGameTypeLeaderboardError(null);
      })
      .catch((error: unknown) => {
        if (!current) {
          return;
        }
        setGameTypeLeaderboardError(getErrorMessage(error));
      });
    return (): void => {
      current = false;
    };
  }, [gameTypeLeaderboardParent, storeRevision, permissions]);
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
        aria-label={i18n.chrome.loading}
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
      {gamesError !== null && <ErrorMessage message={gamesError} />}
      {playersError !== null && <ErrorMessage message={playersError} />}
      <div className="flex flex-col" aria-label={''} data-ls="b890a9d1b6">
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
              className="min-w-min text-sm uppercase tracking-wide font-semibold text-muted-foreground"
              data-ls="c983b5e847"
            >
              {i18n.word('GameType')}
            </span>
            <span className="min-w-min text-2xl font-semibold" data-ls="d2998ed658">
              {gameType.name}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-5 p-6" data-ls="f3504a53ef">
          <div
            className="@container overflow-x-auto flex flex-col gap-4 p-5 rounded-xl border border-border bg-card"
            data-ls="67c462f74e"
          >
            <div
              className="grid @container grid-cols-1 gap-x-8 gap-y-5 @md:grid-cols-2"
              data-ls="b2a1f9d3f9"
            >
              {canReadField(permissions, 'games', 'category') && gameType.category ? (
                <div className="flex flex-col gap-1" data-ls="35f99af781">
                  <span
                    className="min-w-min text-xs font-medium text-muted-foreground"
                    data-ls="91d09ced6a"
                  >
                    {i18n.word('GameType.category')}
                  </span>
                  <span className="min-w-min text-sm" data-ls="e1b2ba914a">
                    {new Map([
                      ['chess', i18n.word("'Chess & Variants'")],
                      ['billiards', i18n.word("'Billiards / Pool'")],
                      ['tableTennis', i18n.word("'Table Tennis'")],
                      ['darts', i18n.word("'Darts'")],
                      ['boardGames', i18n.word("'Board Games'")],
                      ['cardGames', i18n.word("'Card Games'")],
                      ['custom', i18n.word("'Custom / Other'")],
                    ]).get(gameType.category) ?? gameType.category}
                  </span>
                </div>
              ) : null}
              {canReadField(permissions, 'games', 'rulesVariant') && gameType.rulesVariant ? (
                <div className="flex flex-col gap-1" data-ls="bc2db77af7">
                  <span
                    className="min-w-min text-xs font-medium text-muted-foreground"
                    data-ls="2a0a3113e3"
                  >
                    {i18n.word('GameType.rulesVariant')}
                  </span>
                  <span className="min-w-min text-sm" data-ls="9c83426a27">
                    {gameType.rulesVariant}
                  </span>
                </div>
              ) : null}
              {canReadField(permissions, 'games', 'defaultRating') && (
                <div className="flex flex-col gap-1" data-ls="5785f7ebad">
                  <span
                    className="min-w-min text-xs font-medium text-muted-foreground"
                    data-ls="c18d19b654"
                  >
                    {i18n.word('GameType.defaultRating')}
                  </span>
                  <span className="min-w-min text-sm" data-ls="43c74b0d6d">
                    {gameType.defaultRating}
                  </span>
                </div>
              )}
              {canReadField(permissions, 'games', 'description') && gameType.description ? (
                <div className="flex flex-col gap-1 @md:col-span-2" data-ls="d23d31c05a">
                  <span
                    className="min-w-min text-xs font-medium text-muted-foreground"
                    data-ls="e820920fe1"
                  >
                    {i18n.word('GameType.description')}
                  </span>
                  <RichTextDisplay
                    value={gameType.description}
                    className="min-w-min text-sm"
                    data-ls="b17e4c75c2"
                  />
                </div>
              ) : null}
              {(permissions?.['leaderboards']?.read ?? false) && (
                <div className="flex flex-col gap-2 @md:col-span-2" data-ls="fcf06eee7b">
                  <span
                    className="min-w-min text-xs font-medium text-muted-foreground"
                    data-ls="b7e95ddd23"
                  >
                    {i18n.word('GameType.leaderboard')}
                  </span>
                  <div className="min-w-0 overflow-auto bg-card overflow-x-auto border border-border rounded-md">
                    <table className="ui-table w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          {canReadField(permissions, 'leaderboards', 'playerId') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {i18n.word('LeaderboardEntry.player')}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'gameId') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {i18n.word('LeaderboardEntry.game')}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'rating') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {i18n.word('LeaderboardEntry.rating')}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'matchesPlayed') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {i18n.word('LeaderboardEntry.matchesPlayed')}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'wins') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {i18n.word('LeaderboardEntry.wins')}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'losses') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {i18n.word('LeaderboardEntry.losses')}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'draws') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {i18n.word('LeaderboardEntry.draws')}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'lastPlayedAt') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {i18n.word('LeaderboardEntry.lastPlayedAt')}
                            </th>
                          )}
                          {canReadField(permissions, 'leaderboards', 'playerNickname') && (
                            <th
                              scope="col"
                              className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {i18n.word('LeaderboardEntry.playerNickname')}
                              <CalculatedMark id="LeaderboardEntry.playerNickname" />
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
                              colSpan={10}
                              className="px-4 py-8 text-center text-muted-foreground"
                              role="status"
                            >
                              {i18n.chrome.noDataYet}
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
                                data-label={i18n.word('LeaderboardEntry.player')}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  {playersComplete.find(
                                    (player) => player.id === leaderboardEntry.playerId
                                  ) !== undefined ? (
                                    <>
                                      <RecordChip
                                        collection="players"
                                        id={leaderboardEntry.playerId}
                                        label={String(
                                          playersComplete.find(
                                            (player) => player.id === leaderboardEntry.playerId
                                          )?.nickname ?? ''
                                        )}
                                        icon={<UserIcon className="h-3.5 w-3.5" />}
                                        className="min-w-min text-sm"
                                        data-ls="842ff4e534"
                                      />
                                    </>
                                  ) : (
                                    <span className="min-w-min text-sm" data-ls="842ff4e534">
                                      {i18n.chrome.unresolvedReference}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'gameId') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={i18n.word('LeaderboardEntry.game')}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  {gamesComplete.find(
                                    (gameTypeOption) =>
                                      gameTypeOption.id === leaderboardEntry.gameId
                                  ) !== undefined ? (
                                    <>
                                      <RecordChip
                                        collection="games"
                                        id={leaderboardEntry.gameId}
                                        label={String(
                                          gamesComplete.find(
                                            (gameTypeOption) =>
                                              gameTypeOption.id === leaderboardEntry.gameId
                                          )?.name ?? ''
                                        )}
                                        icon={<DicesIcon className="h-3.5 w-3.5" />}
                                        className="min-w-min text-sm"
                                        data-ls="858cc2b46f"
                                      />
                                    </>
                                  ) : (
                                    <span className="min-w-min text-sm" data-ls="858cc2b46f">
                                      {i18n.chrome.unresolvedReference}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'rating') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={i18n.word('LeaderboardEntry.rating')}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  <span className="min-w-min text-sm" data-ls="b393c9b22b">
                                    {leaderboardEntry.rating}
                                  </span>
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'matchesPlayed') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={i18n.word('LeaderboardEntry.matchesPlayed')}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  <span className="min-w-min text-sm" data-ls="ce1b851cb9">
                                    {leaderboardEntry.matchesPlayed}
                                  </span>
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'wins') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={i18n.word('LeaderboardEntry.wins')}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  <span className="min-w-min text-sm" data-ls="83f449fbe4">
                                    {leaderboardEntry.wins}
                                  </span>
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'losses') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={i18n.word('LeaderboardEntry.losses')}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  <span className="min-w-min text-sm" data-ls="8636678a90">
                                    {leaderboardEntry.losses}
                                  </span>
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'draws') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={i18n.word('LeaderboardEntry.draws')}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  <span className="min-w-min text-sm" data-ls="3c3ba6f05c">
                                    {leaderboardEntry.draws}
                                  </span>
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'lastPlayedAt') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={i18n.word('LeaderboardEntry.lastPlayedAt')}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  <span
                                    className="shrink-0 whitespace-nowrap text-sm"
                                    data-ls="122e5d5f44"
                                  >
                                    {leaderboardEntry.lastPlayedAt
                                      ? new Date(leaderboardEntry.lastPlayedAt).toLocaleString(
                                          i18n.locale,
                                          { dateStyle: 'medium', timeStyle: 'short' }
                                        )
                                      : ''}
                                  </span>
                                </div>
                              </td>
                            )}
                            {canReadField(permissions, 'leaderboards', 'playerNickname') && (
                              <td
                                className="px-4 py-3 align-middle whitespace-nowrap"
                                data-label={i18n.word('LeaderboardEntry.playerNickname')}
                              >
                                <div className="ui-cell max-w-xs truncate">
                                  <span className="min-w-min text-sm" data-ls="2a34d9f6a0">
                                    {leaderboardEntry.playerNickname}
                                  </span>
                                </div>
                              </td>
                            )}
                            <td className="w-px">
                              {'_sample' in leaderboardEntry &&
                                leaderboardEntry._sample === true && (
                                  <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                    {i18n.chrome.sampleRecord}
                                  </span>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {gameTypeLeaderboardPageCount > 1 && (
                      <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border text-sm text-muted-foreground print:hidden">
                        <span>
                          {i18n.fill(i18n.chrome.pageIndicator, {
                            page: gameTypeLeaderboardPageSafe + 1,
                            count: gameTypeLeaderboardPageCount,
                          })}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={i18n.chrome.previousPage}
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
                            aria-label={i18n.chrome.nextPage}
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
            visibleColumns={[
              'name',
              'category',
              'rulesVariant',
              'defaultRating',
              'description',
              'displayName',
            ]}
          />
          <div
            className="flex flex-row min-w-0 flex-wrap [&>*]:max-w-full items-center justify-end gap-3"
            data-ls="0c41b4dcc5"
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
                {i18n.chrome.close}
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md hover:bg-secondary hover:text-secondary-foreground"
                onClick={() => {
                  onEdit(gameType);
                  onClose?.();
                }}
              >
                <PencilIcon className="h-4 w-4" />
                {i18n.chrome.edit}
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
                {i18n.chrome.delete}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

import { i18n } from '../i18n/text';
import { Fragment, useState, useEffect, type JSX, type ComponentProps } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useGames } from '../hooks/useGames';
import { useLeaderboards } from '../hooks/useLeaderboards';
import { usePlayers } from '../hooks/usePlayers';
import { usePermissions, canReadField } from '../hooks/usePermissions';
import { LeaderboardEntryDetailView } from './LeaderboardEntryDetailView';
import { ConfirmDeleteDialog } from './ui/ConfirmDelete';
import { LeaderboardEntryEditDialog } from './LeaderboardEntryEditDialog';
import { runWithToast } from '../utils/errorHandling';
import { ErrorMessage } from './ui/error-message';
import type * as $Domain from '../types/domain';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DicesIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SearchXIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  TrophyIcon,
  UserIcon,
  XIcon,
} from 'lucide-react';
import {
  getStoredHiddenColumns,
  isLastShownColumn,
  setStoredHiddenColumns,
} from '../api/pagination';
import { CalculatedMark } from './CalculatedMark';
import { useRuleViolations } from '../hooks/useRuleViolations';
import { RuleViolationMarker, RuleViolationsBanner } from './RuleViolationsNotice';
import { RecordChip } from '../components/ui/record-chip';
import { onNavigationTo } from '../utils/recordNavigation';
import { isOwnClick } from '../utils/ownClick';
import { SelectCards } from './ui/card-select';
import { Skeleton, SkeletonCardGrid } from './ui/skeleton';

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

function cycleSort(state: SortState, key: string): SortState {
  if (state?.key !== key) {
    return { key, dir: 'asc' };
  }
  if (state.dir === 'asc') {
    return { key, dir: 'desc' };
  }
  return null;
}

export function LeaderboardsList(_props: { onNavigate?: (view: string) => void }): JSX.Element {
  const { permissions } = usePermissions();
  const {
    isInitializing: gamesInitializing,
    errorMessage: gamesError,
    games: gamesComplete,
  } = useGames();
  const {
    leaderboards,
    isInitializing: leaderboardsInitializing,
    reloadLeaderboards,
    deleteLeaderboardEntry,
    isBusy: leaderboardsBusy,
    errorMessage: leaderboardsError,
    total: leaderboardsTotal,
    hasMore: leaderboardsHasMore,
    isLoadingMore: leaderboardsLoadingMore,
    loadMore: loadMoreLeaderboards,
    loadAll: loadAllLeaderboards,
  } = useLeaderboards({
    paged: true,
    pageSize: 24,
    sort: [{ field: 'rating', direction: 'descending' }],
  });
  const {
    isInitializing: playersInitializing,
    errorMessage: playersError,
    players: playersComplete,
  } = usePlayers();
  const leaderboardsRuleViolations = useRuleViolations('leaderboards');
  const [leaderboardsRuleFilter, setLeaderboardsRuleFilter] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = leaderboards.find((each) => each.id === selectedId) ?? null;
  const [pendingNavId, setPendingNavId] = useState<string | null>(null);
  useEffect(
    () =>
      onNavigationTo('leaderboards', (id) => {
        setPendingNavId(id);
      }),
    []
  );
  useEffect(() => {
    if (pendingNavId !== null && leaderboards.some((each) => each.id === pendingNavId)) {
      setSelectedId(pendingNavId);
      setPendingNavId(null);
    }
  }, [pendingNavId, leaderboards]);
  const [leaderboardsQuery, setLeaderboardsQuery] = useState('');
  const leaderboardsMatches = leaderboards;
  useEffect(() => {
    if (leaderboardsQuery !== '') {
      runWithToast(loadAllLeaderboards());
    }
  }, [leaderboardsQuery, loadAllLeaderboards]);
  const ruleFilteredLeaderboards = leaderboardsRuleFilter
    ? leaderboardsMatches.filter((row) => leaderboardsRuleViolations.rows.has(row.id))
    : leaderboardsMatches;
  const [leaderboardsSort, setLeaderboardsSort] = useState<SortState>({
    key: 'rating',
    dir: 'desc',
  });
  const sortedLeaderboards =
    leaderboardsSort === null
      ? ruleFilteredLeaderboards
      : [...ruleFilteredLeaderboards].sort((a, b) => {
          const dir = leaderboardsSort.dir === 'asc' ? 1 : -1;
          switch (leaderboardsSort.key) {
            case 'playerNickname':
              return (
                dir * String(a.playerNickname).localeCompare(String(b.playerNickname)) ||
                Number(b.rating) - Number(a.rating)
              );
            case 'rating':
              return dir * (Number(a.rating) - Number(b.rating));
            case 'wins':
              return dir * (Number(a.wins) - Number(b.wins)) || Number(b.rating) - Number(a.rating);
            case 'losses':
              return (
                dir * (Number(a.losses) - Number(b.losses)) || Number(b.rating) - Number(a.rating)
              );
            case 'draws':
              return (
                dir * (Number(a.draws) - Number(b.draws)) || Number(b.rating) - Number(a.rating)
              );
            case 'matchesPlayed':
              return (
                dir * (Number(a.matchesPlayed) - Number(b.matchesPlayed)) ||
                Number(b.rating) - Number(a.rating)
              );
            case 'lastPlayedAt':
              return (
                dir * String(a.lastPlayedAt).localeCompare(String(b.lastPlayedAt)) ||
                Number(b.rating) - Number(a.rating)
              );
            default:
              return Number(b.rating) - Number(a.rating);
          }
        });
  const [leaderboardsPage, setLeaderboardsPage] = useState(0);
  const leaderboardsPageCount = Math.max(1, Math.ceil(sortedLeaderboards.length / 24));
  const leaderboardsPageSafe = Math.min(leaderboardsPage, leaderboardsPageCount - 1);
  const pagedLeaderboards = sortedLeaderboards.slice(
    leaderboardsPageSafe * 24,
    leaderboardsPageSafe * 24 + 24
  );
  const leaderboardsColumnKeys: readonly string[] = [
    'playerNickname',
    'rating',
    'game.displayName',
    'wins',
    'losses',
    'draws',
    'matchesPlayed',
    'player',
    'game',
    'lastPlayedAt',
  ];
  const leaderboardsReadableColumns: readonly boolean[] = [
    canReadField(permissions, 'leaderboards', 'playerNickname'),
    canReadField(permissions, 'leaderboards', 'rating'),
    canReadField(permissions, 'leaderboards', 'gameId') &&
      canReadField(permissions, 'games', 'displayName'),
    canReadField(permissions, 'leaderboards', 'wins'),
    canReadField(permissions, 'leaderboards', 'losses'),
    canReadField(permissions, 'leaderboards', 'draws'),
    canReadField(permissions, 'leaderboards', 'matchesPlayed'),
    canReadField(permissions, 'leaderboards', 'playerId'),
    canReadField(permissions, 'leaderboards', 'gameId'),
    canReadField(permissions, 'leaderboards', 'lastPlayedAt'),
  ];
  const [leaderboardsHiddenColumns, setLeaderboardsHiddenColumns] = useState<Set<number>>(() =>
    getStoredHiddenColumns('leaderboards', leaderboardsColumnKeys, [7, 8, 9])
  );
  function filterLeaderboardsRuleViolations(only: boolean): void {
    if (only !== leaderboardsRuleFilter) {
      if (only) {
        loadAllLeaderboards()
          .then(() => {
            setLeaderboardsPage(0);
            setLeaderboardsRuleFilter(only);
          })
          .catch(() => {
            leaderboardsRuleViolations.reportUnavailable();
          });
      } else {
        setLeaderboardsPage(0);
        setLeaderboardsRuleFilter(only);
      }
    }
  }
  const [editingLeaderboards, setEditingLeaderboards] = useState<$Domain.LeaderboardEntry | null>(
    null
  );
  const [editingSelected, setEditingSelected] = useState<$Domain.LeaderboardEntry | null>(null);
  const [creatingLeaderboards, setCreatingLeaderboards] = useState<NonNullable<
    ComponentProps<typeof LeaderboardEntryEditDialog>['defaults']
  > | null>(null);
  const [deleteConfirmLeaderboardEntry, setDeleteConfirmLeaderboardEntry] = useState<{
    id: string;
    label: string;
  } | null>(null);
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
      {gamesError !== null && <ErrorMessage message={gamesError} />}
      {playersError !== null && <ErrorMessage message={playersError} />}
      <SelectCards
        selectedId={selected?.id ?? null}
        onSelect={setSelectedId}
        className="flex flex-col @container"
      >
        <div className="flex flex-col gap-4 p-4 @md:p-8" data-ls="9d1f682dfb">
          {!(permissions?.['leaderboards']?.read ?? false) ? (
            <div
              className="overflow-x-auto flex flex-col items-center p-12 rounded-xl border border-border bg-card shadow-sm"
              data-ls="60ec610d5a"
            >
              <span className="min-w-min text-muted-foreground" data-ls="9f34fedc77">
                {i18n.chrome.noPermission}
              </span>
            </div>
          ) : null}
          {(permissions?.['leaderboards']?.read ?? false) ? (
            <Fragment>
              <div
                className="flex flex-row items-center gap-3 min-w-0 flex-wrap [&>*]:max-w-full py-1"
                data-ls="69f60d8624"
              >
                {!(leaderboardsMatches.length < leaderboardsTotal) ? (
                  <Fragment>
                    {leaderboardsMatches.length === 1 ? (
                      <span
                        className="min-w-min text-sm text-muted-foreground shrink-0"
                        data-ls="894263c117"
                      >
                        {i18n.fill(
                          `{count} ${i18n.fill(i18n.chrome.countNoun, { name: i18n.word('LeaderboardEntry') })}`,
                          { count: leaderboardsMatches.length }
                        )}
                      </span>
                    ) : null}
                    {!(leaderboardsMatches.length === 1) ? (
                      <span
                        className="min-w-min text-sm text-muted-foreground shrink-0"
                        data-ls="d636a445d6"
                      >
                        {i18n.fill(
                          `{count} ${i18n.fill(i18n.chrome.countNoun, { name: i18n.word('LeaderboardEntry', 1) })}`,
                          { count: leaderboardsMatches.length }
                        )}
                      </span>
                    ) : null}
                  </Fragment>
                ) : null}
                {leaderboardsMatches.length < leaderboardsTotal ? (
                  <Fragment>
                    {leaderboardsTotal === 1 ? (
                      <span
                        className="min-w-min text-sm text-muted-foreground shrink-0"
                        data-ls="415b4a33ea"
                      >
                        {i18n.fill(
                          `${i18n.chrome.countOfTotal} ${i18n.fill(i18n.chrome.countNoun, { name: i18n.word('LeaderboardEntry') })}`,
                          { shown: leaderboardsMatches.length, total: leaderboardsTotal }
                        )}
                      </span>
                    ) : null}
                    {!(leaderboardsTotal === 1) ? (
                      <span
                        className="min-w-min text-sm text-muted-foreground shrink-0"
                        data-ls="877d09c4c1"
                      >
                        {i18n.fill(
                          `${i18n.chrome.countOfTotal} ${i18n.fill(i18n.chrome.countNoun, { name: i18n.word('LeaderboardEntry', 1) })}`,
                          { shown: leaderboardsMatches.length, total: leaderboardsTotal }
                        )}
                      </span>
                    ) : null}
                  </Fragment>
                ) : null}
                <div className="flex-1" data-ls="7cbf58898d" />
                <div className="relative min-w-[12rem] flex-1" data-ls="90016ac741">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={leaderboardsQuery}
                    onChange={(event) => {
                      setLeaderboardsQuery(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape' && leaderboardsQuery !== '') {
                        event.preventDefault();
                        setLeaderboardsQuery('');
                      }
                    }}
                    placeholder={i18n.chrome.search}
                    aria-label={i18n.fill(i18n.chrome.searchLabel, {
                      name: i18n.word('leaderboards'),
                    })}
                    className={`h-10 w-full rounded-md border pl-9 pr-9 text-sm transition-colors focus:border-primary focus:outline-none ${leaderboardsQuery === '' ? 'border-border bg-transparent' : 'border-primary bg-primary/5'}`}
                  />
                  {leaderboardsQuery !== '' && (
                    <button
                      type="button"
                      onClick={() => {
                        setLeaderboardsQuery('');
                      }}
                      aria-label={i18n.chrome.clearSearch}
                      title={i18n.chrome.clearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {(permissions?.['leaderboards']?.create ?? false) && (
                  <button
                    type="button"
                    data-ls="f97b4ea31d"
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    onClick={() => {
                      setCreatingLeaderboards({});
                    }}
                  >
                    <PlusIcon className="h-4 w-4" />
                    {i18n.fill(i18n.chrome.addItem, { name: i18n.word('LeaderboardEntry') })}
                  </button>
                )}
              </div>
              {leaderboardsError !== null ? (
                <div
                  className="flex flex-col overflow-x-auto p-3 rounded-md border border-border bg-secondary"
                  data-ls="6c5dfee844"
                >
                  <span className="min-w-min text-sm" data-ls="e0a31b7f71">
                    {leaderboardsError}
                  </span>
                </div>
              ) : null}
              {leaderboardsInitializing ? <SkeletonCardGrid data-ls="00081e726f" /> : null}
              {leaderboardsTotal === 0 &&
              !leaderboardsInitializing &&
              !(leaderboardsError !== null) ? (
                <div
                  className="overflow-x-auto flex flex-col items-center gap-2 p-12 rounded-xl border border-border bg-card shadow-sm"
                  data-ls="188dd883cf"
                >
                  <TrophyIcon
                    className="shrink-0 h-8 w-8 text-muted-foreground"
                    data-ls="dc725c9e37"
                  />
                  <span className="min-w-min text-base font-medium" data-ls="e243b0b121">
                    {i18n.fill(i18n.chrome.noEntriesTitle, { name: i18n.word('leaderboards') })}
                  </span>
                  {(permissions?.['leaderboards']?.create ?? false) ? (
                    <span className="min-w-min text-sm text-muted-foreground" data-ls="594ac4e175">
                      {i18n.fill(i18n.chrome.noEntriesGetStarted, {
                        name: i18n.word('LeaderboardEntry'),
                      })}
                    </span>
                  ) : null}
                  {(permissions?.['leaderboards']?.create ?? false) && (
                    <button
                      type="button"
                      data-ls="99cf4baf02"
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                      onClick={() => {
                        setCreatingLeaderboards({});
                      }}
                    >
                      <PlusIcon className="h-4 w-4" />
                      {i18n.fill(i18n.chrome.addItem, { name: i18n.word('LeaderboardEntry') })}
                    </button>
                  )}
                </div>
              ) : null}
              {leaderboardsMatches.length === 0 &&
              !(leaderboardsTotal === 0) &&
              leaderboardsBusy ? (
                <SkeletonCardGrid data-ls="59189ca53a" />
              ) : null}
              {leaderboardsMatches.length === 0 &&
              !(leaderboardsTotal === 0) &&
              !leaderboardsBusy ? (
                <div
                  className="overflow-x-auto flex flex-col items-center gap-2 p-12 rounded-xl border border-border bg-card shadow-sm"
                  data-ls="73a80a2eba"
                >
                  <SearchXIcon
                    className="shrink-0 h-8 w-8 text-muted-foreground"
                    data-ls="8c5b48ff8b"
                  />
                  <span className="min-w-min text-base font-medium" data-ls="123dec3ec4">
                    {i18n.chrome.noMatches}
                  </span>
                  {(permissions?.['leaderboards']?.create ?? false) ? (
                    <span className="min-w-min text-sm text-muted-foreground" data-ls="57ba10a690">
                      {i18n.fill(i18n.chrome.noEntriesSearchCreate, {
                        name: i18n.word('LeaderboardEntry'),
                      })}
                    </span>
                  ) : null}
                  {!(permissions?.['leaderboards']?.create ?? false) ? (
                    <span className="min-w-min text-sm text-muted-foreground" data-ls="d4bf963829">
                      {i18n.chrome.noEntriesSearch}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    data-ls="ffab1ecc9a"
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    onClick={() => {
                      setLeaderboardsQuery('');
                    }}
                  >
                    <RotateCcwIcon className="h-4 w-4" />
                    {i18n.chrome.showAll}
                  </button>
                </div>
              ) : null}
              {leaderboardsMatches.length > 0 ? (
                <div
                  className="ui-table-surface flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                  data-ls="b05aeaada7"
                >
                  <div className="flex flex-col gap-2">
                    <RuleViolationsBanner
                      collection="leaderboards"
                      violations={leaderboardsRuleViolations}
                      filtering={leaderboardsRuleFilter}
                      onFilter={filterLeaderboardsRuleViolations}
                    />
                    <div className="min-w-0 overflow-auto">
                      <table className="ui-table w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            {leaderboardsRuleViolations.rows.size > 0 && (
                              <th scope="col" className="w-6 pl-4 pr-0 py-2.5" />
                            )}
                            {!leaderboardsHiddenColumns.has(0) &&
                              canReadField(permissions, 'leaderboards', 'playerNickname') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    leaderboardsSort?.key === 'playerNickname'
                                      ? leaderboardsSort.dir === 'asc'
                                        ? 'ascending'
                                        : 'descending'
                                      : 'none'
                                  }
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  <span className="inline-flex items-center">
                                    <button
                                      type="button"
                                      className="flex items-center gap-1 font-medium hover:text-foreground"
                                      onClick={() => {
                                        runWithToast(loadAllLeaderboards());
                                        setLeaderboardsSort(
                                          cycleSort(leaderboardsSort, 'playerNickname')
                                        );
                                      }}
                                    >
                                      {'Player Nickname'}
                                      <span aria-hidden="true">
                                        {leaderboardsSort?.key === 'playerNickname'
                                          ? leaderboardsSort.dir === 'asc'
                                            ? ' \u25b2'
                                            : ' \u25bc'
                                          : ''}
                                      </span>
                                    </button>
                                    <CalculatedMark id="LeaderboardEntry.playerNickname" />
                                  </span>
                                </th>
                              )}
                            {!leaderboardsHiddenColumns.has(1) &&
                              canReadField(permissions, 'leaderboards', 'rating') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    leaderboardsSort?.key === 'rating'
                                      ? leaderboardsSort.dir === 'asc'
                                        ? 'ascending'
                                        : 'descending'
                                      : 'none'
                                  }
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  <button
                                    type="button"
                                    className="flex items-center gap-1 font-medium hover:text-foreground"
                                    onClick={() => {
                                      runWithToast(loadAllLeaderboards());
                                      setLeaderboardsSort(cycleSort(leaderboardsSort, 'rating'));
                                    }}
                                  >
                                    {'Current Rating'}
                                    <span aria-hidden="true">
                                      {leaderboardsSort?.key === 'rating'
                                        ? leaderboardsSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!leaderboardsHiddenColumns.has(2) &&
                              canReadField(permissions, 'leaderboards', 'gameId') &&
                              canReadField(permissions, 'games', 'displayName') && (
                                <th
                                  scope="col"
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  {i18n.word("'Game & Variant'")}
                                </th>
                              )}
                            {!leaderboardsHiddenColumns.has(3) &&
                              canReadField(permissions, 'leaderboards', 'wins') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    leaderboardsSort?.key === 'wins'
                                      ? leaderboardsSort.dir === 'asc'
                                        ? 'ascending'
                                        : 'descending'
                                      : 'none'
                                  }
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  <button
                                    type="button"
                                    className="flex items-center gap-1 font-medium hover:text-foreground"
                                    onClick={() => {
                                      runWithToast(loadAllLeaderboards());
                                      setLeaderboardsSort(cycleSort(leaderboardsSort, 'wins'));
                                    }}
                                  >
                                    {'Wins'}
                                    <span aria-hidden="true">
                                      {leaderboardsSort?.key === 'wins'
                                        ? leaderboardsSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!leaderboardsHiddenColumns.has(4) &&
                              canReadField(permissions, 'leaderboards', 'losses') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    leaderboardsSort?.key === 'losses'
                                      ? leaderboardsSort.dir === 'asc'
                                        ? 'ascending'
                                        : 'descending'
                                      : 'none'
                                  }
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  <button
                                    type="button"
                                    className="flex items-center gap-1 font-medium hover:text-foreground"
                                    onClick={() => {
                                      runWithToast(loadAllLeaderboards());
                                      setLeaderboardsSort(cycleSort(leaderboardsSort, 'losses'));
                                    }}
                                  >
                                    {'Losses'}
                                    <span aria-hidden="true">
                                      {leaderboardsSort?.key === 'losses'
                                        ? leaderboardsSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!leaderboardsHiddenColumns.has(5) &&
                              canReadField(permissions, 'leaderboards', 'draws') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    leaderboardsSort?.key === 'draws'
                                      ? leaderboardsSort.dir === 'asc'
                                        ? 'ascending'
                                        : 'descending'
                                      : 'none'
                                  }
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  <button
                                    type="button"
                                    className="flex items-center gap-1 font-medium hover:text-foreground"
                                    onClick={() => {
                                      runWithToast(loadAllLeaderboards());
                                      setLeaderboardsSort(cycleSort(leaderboardsSort, 'draws'));
                                    }}
                                  >
                                    {'Draws'}
                                    <span aria-hidden="true">
                                      {leaderboardsSort?.key === 'draws'
                                        ? leaderboardsSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!leaderboardsHiddenColumns.has(6) &&
                              canReadField(permissions, 'leaderboards', 'matchesPlayed') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    leaderboardsSort?.key === 'matchesPlayed'
                                      ? leaderboardsSort.dir === 'asc'
                                        ? 'ascending'
                                        : 'descending'
                                      : 'none'
                                  }
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  <button
                                    type="button"
                                    className="flex items-center gap-1 font-medium hover:text-foreground"
                                    onClick={() => {
                                      runWithToast(loadAllLeaderboards());
                                      setLeaderboardsSort(
                                        cycleSort(leaderboardsSort, 'matchesPlayed')
                                      );
                                    }}
                                  >
                                    {'Matches Played'}
                                    <span aria-hidden="true">
                                      {leaderboardsSort?.key === 'matchesPlayed'
                                        ? leaderboardsSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!leaderboardsHiddenColumns.has(7) &&
                              canReadField(permissions, 'leaderboards', 'playerId') && (
                                <th
                                  scope="col"
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  {i18n.word('LeaderboardEntry.player')}
                                </th>
                              )}
                            {!leaderboardsHiddenColumns.has(8) &&
                              canReadField(permissions, 'leaderboards', 'gameId') && (
                                <th
                                  scope="col"
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  {i18n.word('LeaderboardEntry.game')}
                                </th>
                              )}
                            {!leaderboardsHiddenColumns.has(9) &&
                              canReadField(permissions, 'leaderboards', 'lastPlayedAt') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    leaderboardsSort?.key === 'lastPlayedAt'
                                      ? leaderboardsSort.dir === 'asc'
                                        ? 'ascending'
                                        : 'descending'
                                      : 'none'
                                  }
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  <button
                                    type="button"
                                    className="flex items-center gap-1 font-medium hover:text-foreground"
                                    onClick={() => {
                                      runWithToast(loadAllLeaderboards());
                                      setLeaderboardsSort(
                                        cycleSort(leaderboardsSort, 'lastPlayedAt')
                                      );
                                    }}
                                  >
                                    {i18n.word('LeaderboardEntry.lastPlayedAt')}
                                    <span aria-hidden="true">
                                      {leaderboardsSort?.key === 'lastPlayedAt'
                                        ? leaderboardsSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            <th
                              scope="col"
                              className="w-px px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap text-right"
                            >
                              <span className="print:hidden">
                                <Popover.Root>
                                  <Popover.Trigger asChild>
                                    <button
                                      type="button"
                                      className="h-8 px-1.5 inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                      aria-label={i18n.chrome.toggleColumns}
                                    >
                                      <SlidersHorizontalIcon className="h-4 w-4" />
                                    </button>
                                  </Popover.Trigger>
                                  <Popover.Portal>
                                    <Popover.Content
                                      sideOffset={8}
                                      align="end"
                                      className="z-50 min-w-[10rem] rounded-lg border border-border bg-card text-card-foreground shadow-xl p-1"
                                    >
                                      {canReadField(
                                        permissions,
                                        'leaderboards',
                                        'playerNickname'
                                      ) && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!leaderboardsHiddenColumns.has(0)}
                                            disabled={isLastShownColumn(
                                              leaderboardsHiddenColumns,
                                              leaderboardsReadableColumns,
                                              0
                                            )}
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(0)) {
                                                next.delete(0);
                                              } else {
                                                next.add(0);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnKeys,
                                                next
                                              );
                                              setLeaderboardsHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Player Nickname'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'leaderboards', 'rating') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!leaderboardsHiddenColumns.has(1)}
                                            disabled={isLastShownColumn(
                                              leaderboardsHiddenColumns,
                                              leaderboardsReadableColumns,
                                              1
                                            )}
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(1)) {
                                                next.delete(1);
                                              } else {
                                                next.add(1);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnKeys,
                                                next
                                              );
                                              setLeaderboardsHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Current Rating'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'leaderboards', 'gameId') &&
                                        canReadField(permissions, 'games', 'displayName') && (
                                          <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                            <input
                                              type="checkbox"
                                              className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                              checked={!leaderboardsHiddenColumns.has(2)}
                                              disabled={isLastShownColumn(
                                                leaderboardsHiddenColumns,
                                                leaderboardsReadableColumns,
                                                2
                                              )}
                                              onChange={() => {
                                                const next = new Set(leaderboardsHiddenColumns);
                                                if (next.has(2)) {
                                                  next.delete(2);
                                                } else {
                                                  next.add(2);
                                                }
                                                setStoredHiddenColumns(
                                                  'leaderboards',
                                                  leaderboardsColumnKeys,
                                                  next
                                                );
                                                setLeaderboardsHiddenColumns(next);
                                              }}
                                            />
                                            <span>{i18n.word("'Game & Variant'")}</span>
                                          </label>
                                        )}
                                      {canReadField(permissions, 'leaderboards', 'wins') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!leaderboardsHiddenColumns.has(3)}
                                            disabled={isLastShownColumn(
                                              leaderboardsHiddenColumns,
                                              leaderboardsReadableColumns,
                                              3
                                            )}
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(3)) {
                                                next.delete(3);
                                              } else {
                                                next.add(3);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnKeys,
                                                next
                                              );
                                              setLeaderboardsHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Wins'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'leaderboards', 'losses') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!leaderboardsHiddenColumns.has(4)}
                                            disabled={isLastShownColumn(
                                              leaderboardsHiddenColumns,
                                              leaderboardsReadableColumns,
                                              4
                                            )}
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(4)) {
                                                next.delete(4);
                                              } else {
                                                next.add(4);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnKeys,
                                                next
                                              );
                                              setLeaderboardsHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Losses'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'leaderboards', 'draws') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!leaderboardsHiddenColumns.has(5)}
                                            disabled={isLastShownColumn(
                                              leaderboardsHiddenColumns,
                                              leaderboardsReadableColumns,
                                              5
                                            )}
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(5)) {
                                                next.delete(5);
                                              } else {
                                                next.add(5);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnKeys,
                                                next
                                              );
                                              setLeaderboardsHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Draws'}</span>
                                        </label>
                                      )}
                                      {canReadField(
                                        permissions,
                                        'leaderboards',
                                        'matchesPlayed'
                                      ) && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!leaderboardsHiddenColumns.has(6)}
                                            disabled={isLastShownColumn(
                                              leaderboardsHiddenColumns,
                                              leaderboardsReadableColumns,
                                              6
                                            )}
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(6)) {
                                                next.delete(6);
                                              } else {
                                                next.add(6);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnKeys,
                                                next
                                              );
                                              setLeaderboardsHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Matches Played'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'leaderboards', 'playerId') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!leaderboardsHiddenColumns.has(7)}
                                            disabled={isLastShownColumn(
                                              leaderboardsHiddenColumns,
                                              leaderboardsReadableColumns,
                                              7
                                            )}
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(7)) {
                                                next.delete(7);
                                              } else {
                                                next.add(7);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnKeys,
                                                next
                                              );
                                              setLeaderboardsHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('LeaderboardEntry.player')}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'leaderboards', 'gameId') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!leaderboardsHiddenColumns.has(8)}
                                            disabled={isLastShownColumn(
                                              leaderboardsHiddenColumns,
                                              leaderboardsReadableColumns,
                                              8
                                            )}
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(8)) {
                                                next.delete(8);
                                              } else {
                                                next.add(8);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnKeys,
                                                next
                                              );
                                              setLeaderboardsHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('LeaderboardEntry.game')}</span>
                                        </label>
                                      )}
                                      {canReadField(
                                        permissions,
                                        'leaderboards',
                                        'lastPlayedAt'
                                      ) && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!leaderboardsHiddenColumns.has(9)}
                                            disabled={isLastShownColumn(
                                              leaderboardsHiddenColumns,
                                              leaderboardsReadableColumns,
                                              9
                                            )}
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(9)) {
                                                next.delete(9);
                                              } else {
                                                next.add(9);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnKeys,
                                                next
                                              );
                                              setLeaderboardsHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('LeaderboardEntry.lastPlayedAt')}</span>
                                        </label>
                                      )}
                                    </Popover.Content>
                                  </Popover.Portal>
                                </Popover.Root>
                              </span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedLeaderboards.length === 0 && (
                            <tr>
                              <td
                                colSpan={12}
                                className="px-4 py-8 text-center text-muted-foreground"
                                role="status"
                              >
                                {leaderboards.length === 0
                                  ? i18n.chrome.noDataYet
                                  : i18n.chrome.noMatches}
                              </td>
                            </tr>
                          )}
                          {pagedLeaderboards.map((item) => (
                            <tr
                              key={item.id}
                              onClick={(clickEvent) => {
                                if (isOwnClick(clickEvent)) {
                                  setSelectedId(item.id);
                                }
                              }}
                              className="group/row border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                            >
                              {leaderboardsRuleViolations.rows.size > 0 && (
                                <td className="w-6 pl-4 pr-0 py-3 align-middle">
                                  <RuleViolationMarker
                                    groups={leaderboardsRuleViolations.rows.get(item.id) ?? []}
                                  />
                                </td>
                              )}
                              {!leaderboardsHiddenColumns.has(0) &&
                                canReadField(permissions, 'leaderboards', 'playerNickname') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Player Nickname'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <RecordChip
                                        label={String(item.playerNickname)}
                                        icon={<TrophyIcon className="h-3.5 w-3.5" />}
                                        className="min-w-min text-sm"
                                        data-ls="dad1987e34"
                                      />
                                    </div>
                                  </td>
                                )}
                              {!leaderboardsHiddenColumns.has(1) &&
                                canReadField(permissions, 'leaderboards', 'rating') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Current Rating'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="min-w-min text-sm" data-ls="a80b071ba9">
                                        {item.rating}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!leaderboardsHiddenColumns.has(2) &&
                                canReadField(permissions, 'leaderboards', 'gameId') &&
                                canReadField(permissions, 'games', 'displayName') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word("'Game & Variant'")}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="min-w-min text-sm" data-ls="13543d9f16">
                                        {gamesComplete.find(
                                          (gameType) => gameType.id === item.gameId
                                        )?.displayName !== undefined
                                          ? gamesComplete.find(
                                              (gameType) => gameType.id === item.gameId
                                            )?.displayName
                                          : i18n.chrome.unresolvedReference}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!leaderboardsHiddenColumns.has(3) &&
                                canReadField(permissions, 'leaderboards', 'wins') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Wins'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="min-w-min text-sm" data-ls="4575f19ac3">
                                        {item.wins}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!leaderboardsHiddenColumns.has(4) &&
                                canReadField(permissions, 'leaderboards', 'losses') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Losses'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="min-w-min text-sm" data-ls="e60c7a077f">
                                        {item.losses}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!leaderboardsHiddenColumns.has(5) &&
                                canReadField(permissions, 'leaderboards', 'draws') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Draws'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="min-w-min text-sm" data-ls="dd50cee419">
                                        {item.draws}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!leaderboardsHiddenColumns.has(6) &&
                                canReadField(permissions, 'leaderboards', 'matchesPlayed') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Matches Played'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="min-w-min text-sm" data-ls="d69e52c3c9">
                                        {item.matchesPlayed}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!leaderboardsHiddenColumns.has(7) &&
                                canReadField(permissions, 'leaderboards', 'playerId') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word('LeaderboardEntry.player')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {playersComplete.find(
                                        (player) => player.id === item.playerId
                                      ) !== undefined ? (
                                        <>
                                          <RecordChip
                                            collection="players"
                                            id={item.playerId}
                                            label={String(
                                              playersComplete.find(
                                                (player) => player.id === item.playerId
                                              )?.nickname ?? ''
                                            )}
                                            icon={<UserIcon className="h-3.5 w-3.5" />}
                                            className="min-w-min text-sm"
                                            data-ls="aa3591792e"
                                          />
                                        </>
                                      ) : (
                                        <span className="min-w-min text-sm" data-ls="aa3591792e">
                                          {i18n.chrome.unresolvedReference}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                              {!leaderboardsHiddenColumns.has(8) &&
                                canReadField(permissions, 'leaderboards', 'gameId') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word('LeaderboardEntry.game')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {gamesComplete.find(
                                        (gameType) => gameType.id === item.gameId
                                      ) !== undefined ? (
                                        <>
                                          <RecordChip
                                            collection="games"
                                            id={item.gameId}
                                            label={String(
                                              gamesComplete.find(
                                                (gameType) => gameType.id === item.gameId
                                              )?.name ?? ''
                                            )}
                                            icon={<DicesIcon className="h-3.5 w-3.5" />}
                                            className="min-w-min text-sm"
                                            data-ls="8f992dd31b"
                                          />
                                        </>
                                      ) : (
                                        <span className="min-w-min text-sm" data-ls="8f992dd31b">
                                          {i18n.chrome.unresolvedReference}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                              {!leaderboardsHiddenColumns.has(9) &&
                                canReadField(permissions, 'leaderboards', 'lastPlayedAt') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word('LeaderboardEntry.lastPlayedAt')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span
                                        className="shrink-0 whitespace-nowrap text-sm"
                                        data-ls="9675ad2138"
                                      >
                                        {item.lastPlayedAt
                                          ? new Date(item.lastPlayedAt).toLocaleString(
                                              i18n.locale,
                                              { dateStyle: 'medium', timeStyle: 'short' }
                                            )
                                          : ''}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              <td
                                className={
                                  item._sample
                                    ? 'w-px px-3 py-2 text-right align-middle whitespace-nowrap'
                                    : 'w-px px-3 py-2 text-right align-middle whitespace-nowrap opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 transition-opacity'
                                }
                              >
                                <div className="inline-flex items-center gap-1">
                                  {item._sample && (
                                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                      {i18n.chrome.sampleRecord}
                                    </span>
                                  )}
                                  {(permissions?.['leaderboards']?.update ?? false) && (
                                    <button
                                      type="button"
                                      aria-label={i18n.chrome.edit}
                                      onClick={(clickEvent) => {
                                        clickEvent.stopPropagation();
                                        setEditingLeaderboards(item);
                                      }}
                                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                    >
                                      <PencilIcon className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {(permissions?.['leaderboards']?.delete ?? false) && (
                                    <button
                                      type="button"
                                      aria-label={i18n.chrome.delete}
                                      onClick={(clickEvent) => {
                                        clickEvent.stopPropagation();
                                        runWithToast(
                                          deleteLeaderboardEntry(item.id).then(() => {
                                            leaderboardsRuleViolations.reload();
                                          })
                                        );
                                      }}
                                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                    >
                                      <Trash2Icon className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(leaderboardsPageCount > 1 || leaderboardsHasMore) && (
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border text-sm text-muted-foreground print:hidden">
                          <span>
                            {i18n.fill(i18n.chrome.pageIndicator, {
                              page: leaderboardsPageSafe + 1,
                              count: leaderboardsPageCount,
                            })}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={i18n.chrome.previousPage}
                              onClick={() => {
                                setLeaderboardsPage(Math.max(0, leaderboardsPageSafe - 1));
                              }}
                              disabled={leaderboardsPageSafe <= 0}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 transition-colors"
                            >
                              <ChevronLeftIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={i18n.chrome.nextPage}
                              onClick={() => {
                                if (
                                  leaderboardsPageSafe >= leaderboardsPageCount - 1 &&
                                  leaderboardsHasMore
                                ) {
                                  runWithToast(
                                    loadMoreLeaderboards().then(() => {
                                      setLeaderboardsPage(leaderboardsPageSafe + 1);
                                    })
                                  );
                                } else {
                                  setLeaderboardsPage(
                                    Math.min(leaderboardsPageCount - 1, leaderboardsPageSafe + 1)
                                  );
                                }
                              }}
                              disabled={
                                leaderboardsLoadingMore ||
                                (leaderboardsPageSafe >= leaderboardsPageCount - 1 &&
                                  !leaderboardsHasMore)
                              }
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 transition-colors"
                            >
                              <ChevronRightIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <LeaderboardEntryEditDialog
                      open={editingLeaderboards !== null}
                      editing={editingLeaderboards}
                      isBusy={false}
                      onSaved={() => {
                        leaderboardsRuleViolations.reload();
                      }}
                      onClose={() => {
                        setEditingLeaderboards(null);
                      }}
                    />
                  </div>
                </div>
              ) : null}
              {selected ? (
                <LeaderboardEntryDetailView
                  leaderboardEntry={selected}
                  open
                  onEdit={
                    (permissions?.['leaderboards']?.update ?? false)
                      ? (record: $Domain.LeaderboardEntry): void => {
                          setEditingSelected(record);
                        }
                      : undefined
                  }
                  onDelete={
                    (permissions?.['leaderboards']?.delete ?? false)
                      ? (id: string): void => {
                          setDeleteConfirmLeaderboardEntry({
                            id,
                            label: String(selected.playerNickname).trim() || 'LeaderboardEntry',
                          });
                        }
                      : undefined
                  }
                  onClose={() => {
                    setSelectedId(null);
                  }}
                />
              ) : null}
            </Fragment>
          ) : null}
        </div>
      </SelectCards>
      <LeaderboardEntryEditDialog
        open={editingSelected !== null}
        editing={editingSelected}
        isBusy={false}
        onSaved={() => {
          leaderboardsRuleViolations.reload();
        }}
        onClose={() => {
          setEditingSelected(null);
          runWithToast(reloadLeaderboards());
        }}
      />
      <LeaderboardEntryEditDialog
        open={creatingLeaderboards !== null}
        editing={null}
        isBusy={false}
        defaults={creatingLeaderboards ?? {}}
        onSaved={() => {
          leaderboardsRuleViolations.reload();
        }}
        onClose={() => {
          setCreatingLeaderboards(null);
          runWithToast(reloadLeaderboards());
        }}
      />
      <ConfirmDeleteDialog
        open={deleteConfirmLeaderboardEntry !== null}
        title={i18n.fill(i18n.chrome.deleteTitle, { name: i18n.word('LeaderboardEntry') })}
        description={i18n.fill(i18n.chrome.deleteConfirm, {
          item: deleteConfirmLeaderboardEntry?.label ?? '',
        })}
        cancelLabel={i18n.chrome.cancel}
        deleteLabel={i18n.chrome.delete}
        onCancel={() => {
          setDeleteConfirmLeaderboardEntry(null);
        }}
        onConfirm={() => {
          if (deleteConfirmLeaderboardEntry !== null) {
            runWithToast(
              deleteLeaderboardEntry(deleteConfirmLeaderboardEntry.id).then(() => {
                leaderboardsRuleViolations.reload();
              })
            );
          }
          setDeleteConfirmLeaderboardEntry(null);
        }}
      />
    </>
  );
}

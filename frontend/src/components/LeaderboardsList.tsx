import { Fragment, useState, useEffect, type JSX } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useGames } from '../hooks/useGames';
import { useLeaderboards } from '../hooks/useLeaderboards';
import { usePlayers } from '../hooks/usePlayers';
import { usePermissions, canReadField } from '../hooks/usePermissions';
import { LeaderboardEntryDetailView } from './LeaderboardEntryDetailView';
import { ConfirmDeleteDialog } from './ui/ConfirmDelete';
import { LeaderboardEntryEditDialog } from './LeaderboardEntryEditDialog';
import { runWithToast } from '../utils/errorHandling';
import type * as $Domain from '../types/domain';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DicesIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  TrophyIcon,
  UserIcon,
} from 'lucide-react';
import { getStoredHiddenColumns, setStoredHiddenColumns } from '../api/pagination';
import { useRuleViolations } from '../hooks/useRuleViolations';
import { RuleViolationMarker, RuleViolationsBanner } from './RuleViolationsNotice';
import { RecordChip } from '../components/ui/record-chip';
import { onNavigationTo } from '../utils/recordNavigation';
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
  const { games, isInitializing: gamesInitializing } = useGames();
  const {
    leaderboards,
    isInitializing: leaderboardsInitializing,
    reloadLeaderboards,
    deleteLeaderboardEntry,
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
  const { players, isInitializing: playersInitializing } = usePlayers();
  const { permissions } = usePermissions();
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
  const leaderboardsColumnLabels: readonly string[] = [
    'Player Nickname',
    'Current Rating',
    'Game & Variant',
    'Wins',
    'Losses',
    'Draws',
    'Matches Played',
    'Player',
    'Game',
    'Last Activity',
  ];
  const [leaderboardsHiddenColumns, setLeaderboardsHiddenColumns] = useState<Set<number>>(() =>
    getStoredHiddenColumns('leaderboards', leaderboardsColumnLabels, [7, 8, 9])
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
  const [creatingLeaderboards, setCreatingLeaderboards] = useState(false);
  const [deleteConfirmLeaderboardEntry, setDeleteConfirmLeaderboardEntry] = useState<{
    id: string;
    label: string;
  } | null>(null);
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
      <SelectCards
        selectedId={selected?.id ?? null}
        onSelect={setSelectedId}
        className="flex flex-col @container"
      >
        <div className="flex flex-col gap-4 p-4 @md:p-8" data-ls="9d1f682dfb">
          {!(permissions?.['leaderboards']?.read ?? false) ? (
            <div
              className="flex flex-col items-center p-12 rounded-xl border border-border bg-card shadow-sm"
              data-ls="60ec610d5a"
            >
              <span className="break-words text-muted-foreground" data-ls="9f34fedc77">
                {"You don't have permission to view this content."}
              </span>
            </div>
          ) : null}
          {(permissions?.['leaderboards']?.read ?? false) ? (
            <Fragment>
              <div
                className="flex flex-row items-center gap-3 min-w-0 flex-wrap [&>*]:max-w-full py-1"
                data-ls="69f60d8624"
              >
                {leaderboardsMatches.length === 1 ? (
                  <span
                    className="break-words text-sm text-muted-foreground shrink-0"
                    data-ls="a8e275d7cd"
                  >{`${leaderboardsMatches.length} leaderboard entry`}</span>
                ) : null}
                {!(leaderboardsMatches.length === 1) ? (
                  <span
                    className="break-words text-sm text-muted-foreground shrink-0"
                    data-ls="391f26683a"
                  >{`${leaderboardsMatches.length} leaderboards`}</span>
                ) : null}
                <div className="flex-1" data-ls="d636a445d6" />
                <div className="relative min-w-[12rem] flex-1" data-ls="9993f56bd8">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={leaderboardsQuery}
                    onChange={(event) => {
                      setLeaderboardsQuery(event.target.value);
                    }}
                    placeholder="Search…"
                    aria-label="Search leaderboards by name"
                    className="h-10 w-full rounded-md border border-border bg-transparent pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                {(permissions?.['leaderboards']?.create ?? false) && (
                  <button
                    type="button"
                    data-ls="f97b4ea31d"
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    onClick={() => {
                      setCreatingLeaderboards(true);
                    }}
                  >
                    <PlusIcon className="h-4 w-4" />
                    {'Add leaderboard entry'}
                  </button>
                )}
              </div>
              {leaderboardsError !== null ? (
                <div
                  className="flex flex-col p-3 rounded-md border border-border bg-secondary"
                  data-ls="415b4a33ea"
                >
                  <span className="break-words text-sm" data-ls="ee23d32320">
                    {leaderboardsError}
                  </span>
                </div>
              ) : null}
              {leaderboardsInitializing ? <SkeletonCardGrid data-ls="7cbf58898d" /> : null}
              {leaderboardsTotal === 0 &&
              !leaderboardsInitializing &&
              !(leaderboardsError !== null) ? (
                <div
                  className="flex flex-col items-center gap-2 p-12 rounded-xl border border-border bg-card shadow-sm"
                  data-ls="f4532cb8af"
                >
                  <TrophyIcon
                    className="shrink-0 h-8 w-8 text-muted-foreground"
                    data-ls="6c5dfee844"
                  />
                  <span className="break-words text-base font-medium" data-ls="e0a31b7f71">
                    {'No leaderboards yet'}
                  </span>
                  {(permissions?.['leaderboards']?.create ?? false) ? (
                    <span
                      className="break-words text-sm text-muted-foreground"
                      data-ls="00081e726f"
                    >
                      {'Get started by adding your first leaderboard entry.'}
                    </span>
                  ) : null}
                  {(permissions?.['leaderboards']?.create ?? false) && (
                    <button
                      type="button"
                      data-ls="7c6ca83d7f"
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                      onClick={() => {
                        setCreatingLeaderboards(true);
                      }}
                    >
                      <PlusIcon className="h-4 w-4" />
                      {'Add leaderboard entry'}
                    </button>
                  )}
                </div>
              ) : null}
              {leaderboardsMatches.length === 0 && !(leaderboardsTotal === 0) ? (
                <div
                  className="flex flex-col items-center p-12 rounded-xl border border-border bg-card shadow-sm"
                  data-ls="dc725c9e37"
                >
                  {(permissions?.['leaderboards']?.create ?? false) ? (
                    <span
                      className="break-words text-sm text-muted-foreground"
                      data-ls="29290cd2c9"
                    >
                      {'Try adjusting your search or add a new leaderboard entry.'}
                    </span>
                  ) : null}
                  {!(permissions?.['leaderboards']?.create ?? false) ? (
                    <span
                      className="break-words text-sm text-muted-foreground"
                      data-ls="99cf4baf02"
                    >
                      {'Try adjusting your search.'}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {leaderboardsMatches.length > 0 ? (
                <div
                  className="ui-table-surface flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                  data-ls="59189ca53a"
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
                                  {'Game & Variant'}
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
                                  {'Player'}
                                </th>
                              )}
                            {!leaderboardsHiddenColumns.has(8) &&
                              canReadField(permissions, 'leaderboards', 'gameId') && (
                                <th
                                  scope="col"
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  {'Game'}
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
                                    {'Last Activity'}
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
                                      aria-label={'Toggle columns'}
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
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(0)) {
                                                next.delete(0);
                                              } else {
                                                next.add(0);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnLabels,
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
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(1)) {
                                                next.delete(1);
                                              } else {
                                                next.add(1);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnLabels,
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
                                              onChange={() => {
                                                const next = new Set(leaderboardsHiddenColumns);
                                                if (next.has(2)) {
                                                  next.delete(2);
                                                } else {
                                                  next.add(2);
                                                }
                                                setStoredHiddenColumns(
                                                  'leaderboards',
                                                  leaderboardsColumnLabels,
                                                  next
                                                );
                                                setLeaderboardsHiddenColumns(next);
                                              }}
                                            />
                                            <span>{'Game & Variant'}</span>
                                          </label>
                                        )}
                                      {canReadField(permissions, 'leaderboards', 'wins') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!leaderboardsHiddenColumns.has(3)}
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(3)) {
                                                next.delete(3);
                                              } else {
                                                next.add(3);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnLabels,
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
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(4)) {
                                                next.delete(4);
                                              } else {
                                                next.add(4);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnLabels,
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
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(5)) {
                                                next.delete(5);
                                              } else {
                                                next.add(5);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnLabels,
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
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(6)) {
                                                next.delete(6);
                                              } else {
                                                next.add(6);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnLabels,
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
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(7)) {
                                                next.delete(7);
                                              } else {
                                                next.add(7);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnLabels,
                                                next
                                              );
                                              setLeaderboardsHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Player'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'leaderboards', 'gameId') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!leaderboardsHiddenColumns.has(8)}
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(8)) {
                                                next.delete(8);
                                              } else {
                                                next.add(8);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnLabels,
                                                next
                                              );
                                              setLeaderboardsHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Game'}</span>
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
                                            onChange={() => {
                                              const next = new Set(leaderboardsHiddenColumns);
                                              if (next.has(9)) {
                                                next.delete(9);
                                              } else {
                                                next.add(9);
                                              }
                                              setStoredHiddenColumns(
                                                'leaderboards',
                                                leaderboardsColumnLabels,
                                                next
                                              );
                                              setLeaderboardsHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Last Activity'}</span>
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
                                {leaderboards.length === 0 ? 'No data yet' : 'No matches'}
                              </td>
                            </tr>
                          )}
                          {pagedLeaderboards.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() => {
                                setSelectedId(item.id);
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
                                        className="break-words text-sm"
                                        data-ls="8c5b48ff8b"
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
                                      <span className="break-words text-sm" data-ls="1a2852fd91">
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
                                    data-label={'Game & Variant'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="break-words text-sm" data-ls="dc255202d9">
                                        {games.find((gameType) => gameType.id === item.gameId)
                                          ?.displayName !== undefined
                                          ? games.find((gameType) => gameType.id === item.gameId)
                                              ?.displayName
                                          : '—'}
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
                                      <span className="break-words text-sm" data-ls="ffab1ecc9a">
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
                                      <span className="break-words text-sm" data-ls="b05aeaada7">
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
                                      <span className="break-words text-sm" data-ls="d60181518b">
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
                                      <span className="break-words text-sm" data-ls="3c34462910">
                                        {item.matchesPlayed}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!leaderboardsHiddenColumns.has(7) &&
                                canReadField(permissions, 'leaderboards', 'playerId') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Player'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {players.find((player) => player.id === item.playerId) !==
                                      undefined ? (
                                        <>
                                          <RecordChip
                                            collection="players"
                                            id={item.playerId}
                                            label={String(
                                              players.find((player) => player.id === item.playerId)
                                                ?.nickname ?? ''
                                            )}
                                            icon={<UserIcon className="h-3.5 w-3.5" />}
                                            className="break-words text-sm"
                                            data-ls="4b1d675f21"
                                          />
                                        </>
                                      ) : (
                                        <span className="break-words text-sm" data-ls="4b1d675f21">
                                          {'—'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                              {!leaderboardsHiddenColumns.has(8) &&
                                canReadField(permissions, 'leaderboards', 'gameId') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Game'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {games.find((gameType) => gameType.id === item.gameId) !==
                                      undefined ? (
                                        <>
                                          <RecordChip
                                            collection="games"
                                            id={item.gameId}
                                            label={String(
                                              games.find((gameType) => gameType.id === item.gameId)
                                                ?.name ?? ''
                                            )}
                                            icon={<DicesIcon className="h-3.5 w-3.5" />}
                                            className="break-words text-sm"
                                            data-ls="744c2c0793"
                                          />
                                        </>
                                      ) : (
                                        <span className="break-words text-sm" data-ls="744c2c0793">
                                          {'—'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                              {!leaderboardsHiddenColumns.has(9) &&
                                canReadField(permissions, 'leaderboards', 'lastPlayedAt') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Last Activity'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span
                                        className="whitespace-nowrap text-sm"
                                        data-ls="2c64cc0b64"
                                      >
                                        {item.lastPlayedAt
                                          ? new Date(item.lastPlayedAt).toLocaleString('en', {
                                              dateStyle: 'medium',
                                              timeStyle: 'short',
                                            })
                                          : ''}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              <td className="w-px px-3 py-2 text-right align-middle whitespace-nowrap opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 transition-opacity">
                                <div className="inline-flex items-center gap-1">
                                  {(permissions?.['leaderboards']?.update ?? false) && (
                                    <button
                                      type="button"
                                      aria-label={'Edit'}
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
                                      aria-label={'Delete'}
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
                          <span>{`Page ${leaderboardsPageSafe + 1} of ${leaderboardsPageCount}`}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={'Previous page'}
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
                              aria-label={'Next page'}
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
        open={creatingLeaderboards}
        editing={null}
        isBusy={false}
        onSaved={() => {
          leaderboardsRuleViolations.reload();
        }}
        onClose={() => {
          setCreatingLeaderboards(false);
          runWithToast(reloadLeaderboards());
        }}
      />
      <ConfirmDeleteDialog
        open={deleteConfirmLeaderboardEntry !== null}
        title="Delete leaderboard entry"
        description={`Are you sure you want to delete "${deleteConfirmLeaderboardEntry?.label ?? ''}"? This action cannot be undone.`}
        cancelLabel="Cancel"
        deleteLabel="Delete"
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

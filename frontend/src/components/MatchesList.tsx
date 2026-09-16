import { Fragment, useState, useEffect, type JSX } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useGames } from '../hooks/useGames';
import { useMatches } from '../hooks/useMatches';
import { usePlayers } from '../hooks/usePlayers';
import { usePermissions, canReadField } from '../hooks/usePermissions';
import { textValue } from '../utils/recordValues';
import { MatchDetailView } from './MatchDetailView';
import { ConfirmDeleteDialog } from './ui/ConfirmDelete';
import { MatchEditDialog } from './MatchEditDialog';
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
  SwordsIcon,
  Trash2Icon,
  UserIcon,
} from 'lucide-react';
import { getStoredHiddenColumns, setStoredHiddenColumns } from '../api/pagination';
import { CalculatedMark } from './CalculatedMark';
import { useRuleViolations } from '../hooks/useRuleViolations';
import { RuleViolationMarker, RuleViolationsBanner } from './RuleViolationsNotice';
import { RecordChip } from '../components/ui/record-chip';
import { relativeTime } from '../utils/relativeTime';
import { onNavigationTo } from '../utils/recordNavigation';
import { useUsers } from '../hooks/useUsers';
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

export function MatchesList(_props: { onNavigate?: (view: string) => void }): JSX.Element {
  const { games, isInitializing: gamesInitializing, reloadGames } = useGames();
  const {
    matches,
    isInitializing: matchesInitializing,
    reloadMatches,
    deleteMatch,
    errorMessage: matchesError,
    total: matchesTotal,
    hasMore: matchesHasMore,
    isLoadingMore: matchesLoadingMore,
    loadMore: loadMoreMatches,
    loadAll: loadAllMatches,
  } = useMatches({ paged: true, pageSize: 24 });
  const { players, isInitializing: playersInitializing, reloadPlayers } = usePlayers();
  const { permissions } = usePermissions();
  const { userLabel } = useUsers();
  const matchesRuleViolations = useRuleViolations('matches');
  const [matchesRuleFilter, setMatchesRuleFilter] = useState(false);
  const refreshWidget = (): void => {
    runWithToast(reloadGames());
    runWithToast(reloadMatches());
    runWithToast(reloadPlayers());
    matchesRuleViolations.reload();
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = matches.find((each) => each.id === selectedId) ?? null;
  const [pendingNavId, setPendingNavId] = useState<string | null>(null);
  useEffect(
    () =>
      onNavigationTo('matches', (id) => {
        setPendingNavId(id);
      }),
    []
  );
  useEffect(() => {
    if (pendingNavId !== null && matches.some((each) => each.id === pendingNavId)) {
      setSelectedId(pendingNavId);
      setPendingNavId(null);
    }
  }, [pendingNavId, matches]);
  const [matchesQuery, setMatchesQuery] = useState('');
  const matchesStatusLabels = new Map<string, string>([
    ['scheduled', 'Scheduled'],
    ['inProgress', 'In Progress'],
    ['completed', 'Completed'],
    ['disputed', 'Disputed'],
    ['cancelled', 'Cancelled'],
  ]);
  const matchesOutcomeLabels = new Map<string, string>([
    ['playerOneWin', 'Player 1 Victory'],
    ['playerTwoWin', 'Player 2 Victory'],
    ['draw', 'Draw'],
  ]);
  const matchesSearchTerm = matchesQuery.trim().toLowerCase();
  const matchesMatches =
    matchesSearchTerm === ''
      ? matches
      : matches.filter((each) =>
          [
            matchesStatusLabels.get(each.status) ?? textValue(each.status),
            matchesOutcomeLabels.get(each.outcome) ?? textValue(each.outcome),
          ].some((value) => value.toLowerCase().includes(matchesSearchTerm))
        );
  useEffect(() => {
    if (matchesQuery !== '') {
      runWithToast(loadAllMatches());
    }
  }, [matchesQuery, loadAllMatches]);
  const ruleFilteredMatches = matchesRuleFilter
    ? matchesMatches.filter((row) => matchesRuleViolations.rows.has(row.id))
    : matchesMatches;
  const [matchesSort, setMatchesSort] = useState<SortState>(null);
  const sortedMatches =
    matchesSort === null
      ? ruleFilteredMatches
      : [...ruleFilteredMatches].sort((a, b) => {
          const dir = matchesSort.dir === 'asc' ? 1 : -1;
          switch (matchesSort.key) {
            case 'title':
              return dir * String(a.title).localeCompare(String(b.title));
            case 'status':
              return dir * String(a.status).localeCompare(String(b.status));
            case 'scheduledAt':
              return dir * String(a.scheduledAt).localeCompare(String(b.scheduledAt));
            case 'outcome':
              return dir * String(a.outcome).localeCompare(String(b.outcome));
            case 'playerOneScore':
              return dir * (Number(a.playerOneScore) - Number(b.playerOneScore));
            case 'playerTwoScore':
              return dir * (Number(a.playerTwoScore) - Number(b.playerTwoScore));
            case 'playerOneRatingDelta':
              return dir * (Number(a.playerOneRatingDelta) - Number(b.playerOneRatingDelta));
            case 'playerTwoRatingDelta':
              return dir * (Number(a.playerTwoRatingDelta) - Number(b.playerTwoRatingDelta));
            case 'recordedBy':
              return dir * String(a.recordedById).localeCompare(String(b.recordedById));
            case 'createdAt':
              return dir * String(a.createdAt).localeCompare(String(b.createdAt));
            case 'gameDisplayName':
              return dir * String(a.gameDisplayName).localeCompare(String(b.gameDisplayName));
            default:
              return 0;
          }
        });
  const [matchesPage, setMatchesPage] = useState(0);
  const matchesPageCount = Math.max(1, Math.ceil(sortedMatches.length / 24));
  const matchesPageSafe = Math.min(matchesPage, matchesPageCount - 1);
  const pagedMatches = sortedMatches.slice(matchesPageSafe * 24, matchesPageSafe * 24 + 24);
  const matchesColumnLabels: readonly string[] = [
    'Match Matchup',
    'Game & Variant',
    'Status',
    'Date & Time',
    'Game',
    'Player 1',
    'Player 2',
    'Outcome',
    'P1 Score',
    'P2 Score',
    'P1 Rating Change',
    'P2 Rating Change',
    'Recorder',
    'Created At',
    'Game Display Name',
  ];
  const [matchesHiddenColumns, setMatchesHiddenColumns] = useState<Set<number>>(() =>
    getStoredHiddenColumns('matches', matchesColumnLabels, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  );
  function filterMatchesRuleViolations(only: boolean): void {
    if (only !== matchesRuleFilter) {
      if (only) {
        loadAllMatches()
          .then(() => {
            setMatchesPage(0);
            setMatchesRuleFilter(only);
          })
          .catch(() => {
            matchesRuleViolations.reportUnavailable();
          });
      } else {
        setMatchesPage(0);
        setMatchesRuleFilter(only);
      }
    }
  }
  const [editingMatches, setEditingMatches] = useState<$Domain.Match | null>(null);
  const [editingSelected, setEditingSelected] = useState<$Domain.Match | null>(null);
  const [creatingMatches, setCreatingMatches] = useState(false);
  const [deleteConfirmMatch, setDeleteConfirmMatch] = useState<{
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
        <div className="flex flex-col gap-4 p-4 @md:p-8" data-ls="b46d0d1c43">
          {!(permissions?.['matches']?.read ?? false) ? (
            <div
              className="flex flex-col items-center p-12 rounded-xl border border-border bg-card shadow-sm"
              data-ls="0e8b4b1715"
            >
              <span className="break-words text-muted-foreground" data-ls="caa82dbbfe">
                {"You don't have permission to view this content."}
              </span>
            </div>
          ) : null}
          {(permissions?.['matches']?.read ?? false) ? (
            <Fragment>
              <div
                className="flex flex-row items-center gap-3 min-w-0 flex-wrap [&>*]:max-w-full py-1"
                data-ls="8f40c7c4be"
              >
                {matchesMatches.length === 1 ? (
                  <span
                    className="break-words text-sm text-muted-foreground shrink-0"
                    data-ls="cbea46458b"
                  >{`${matchesMatches.length} match`}</span>
                ) : null}
                {!(matchesMatches.length === 1) ? (
                  <span
                    className="break-words text-sm text-muted-foreground shrink-0"
                    data-ls="e9d3b3fac4"
                  >{`${matchesMatches.length} matches`}</span>
                ) : null}
                <div className="flex-1" data-ls="83795e96a1" />
                <div className="relative min-w-[12rem] flex-1" data-ls="8e4ba9899f">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={matchesQuery}
                    onChange={(event) => {
                      setMatchesQuery(event.target.value);
                    }}
                    placeholder="Search…"
                    aria-label="Search matches by name"
                    className="h-10 w-full rounded-md border border-border bg-transparent pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                {(permissions?.['matches']?.create ?? false) && (
                  <button
                    type="button"
                    data-ls="fe87297586"
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    onClick={() => {
                      setCreatingMatches(true);
                    }}
                  >
                    <PlusIcon className="h-4 w-4" />
                    {'Add match'}
                  </button>
                )}
              </div>
              {matchesError !== null ? (
                <div
                  className="flex flex-col p-3 rounded-md border border-border bg-secondary"
                  data-ls="16b45c02f1"
                >
                  <span className="break-words text-sm" data-ls="0d3e7a657a">
                    {matchesError}
                  </span>
                </div>
              ) : null}
              {matchesInitializing ? <SkeletonCardGrid data-ls="5902821ecb" /> : null}
              {matchesTotal === 0 && !matchesInitializing && !(matchesError !== null) ? (
                <div
                  className="flex flex-col items-center gap-2 p-12 rounded-xl border border-border bg-card shadow-sm"
                  data-ls="8f81820116"
                >
                  <SwordsIcon
                    className="shrink-0 h-8 w-8 text-muted-foreground"
                    data-ls="49a5f5b25a"
                  />
                  <span className="break-words text-base font-medium" data-ls="4eac1f6cac">
                    {'No matches yet'}
                  </span>
                  {(permissions?.['matches']?.create ?? false) ? (
                    <span
                      className="break-words text-sm text-muted-foreground"
                      data-ls="8ce7cab615"
                    >
                      {'Get started by adding your first match.'}
                    </span>
                  ) : null}
                  {(permissions?.['matches']?.create ?? false) && (
                    <button
                      type="button"
                      data-ls="0cc1b55bc0"
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                      onClick={() => {
                        setCreatingMatches(true);
                      }}
                    >
                      <PlusIcon className="h-4 w-4" />
                      {'Add match'}
                    </button>
                  )}
                </div>
              ) : null}
              {matchesMatches.length === 0 && !(matchesTotal === 0) ? (
                <div
                  className="flex flex-col items-center p-12 rounded-xl border border-border bg-card shadow-sm"
                  data-ls="eed25f0952"
                >
                  {(permissions?.['matches']?.create ?? false) ? (
                    <span
                      className="break-words text-sm text-muted-foreground"
                      data-ls="882a45dfd3"
                    >
                      {'Try adjusting your search or add a new match.'}
                    </span>
                  ) : null}
                  {!(permissions?.['matches']?.create ?? false) ? (
                    <span
                      className="break-words text-sm text-muted-foreground"
                      data-ls="55f823a9cb"
                    >
                      {'Try adjusting your search.'}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {matchesMatches.length > 0 ? (
                <div
                  className="ui-table-surface flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                  data-ls="d70f5f2a59"
                >
                  <div className="flex flex-col gap-2">
                    <RuleViolationsBanner
                      collection="matches"
                      violations={matchesRuleViolations}
                      filtering={matchesRuleFilter}
                      onFilter={filterMatchesRuleViolations}
                    />
                    <div className="min-w-0 overflow-auto">
                      <table className="ui-table w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            {matchesRuleViolations.rows.size > 0 && (
                              <th scope="col" className="w-6 pl-4 pr-0 py-2.5" />
                            )}
                            {!matchesHiddenColumns.has(0) &&
                              canReadField(permissions, 'matches', 'title') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    matchesSort?.key === 'title'
                                      ? matchesSort.dir === 'asc'
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
                                      runWithToast(loadAllMatches());
                                      setMatchesSort(cycleSort(matchesSort, 'title'));
                                    }}
                                  >
                                    {'Match Matchup'}
                                    <span aria-hidden="true">
                                      {matchesSort?.key === 'title'
                                        ? matchesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!matchesHiddenColumns.has(1) &&
                              canReadField(permissions, 'matches', 'gameId') &&
                              canReadField(permissions, 'games', 'displayName') && (
                                <th
                                  scope="col"
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  {'Game & Variant'}
                                </th>
                              )}
                            {!matchesHiddenColumns.has(2) &&
                              canReadField(permissions, 'matches', 'status') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    matchesSort?.key === 'status'
                                      ? matchesSort.dir === 'asc'
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
                                      runWithToast(loadAllMatches());
                                      setMatchesSort(cycleSort(matchesSort, 'status'));
                                    }}
                                  >
                                    {'Status'}
                                    <span aria-hidden="true">
                                      {matchesSort?.key === 'status'
                                        ? matchesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!matchesHiddenColumns.has(3) &&
                              canReadField(permissions, 'matches', 'scheduledAt') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    matchesSort?.key === 'scheduledAt'
                                      ? matchesSort.dir === 'asc'
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
                                      runWithToast(loadAllMatches());
                                      setMatchesSort(cycleSort(matchesSort, 'scheduledAt'));
                                    }}
                                  >
                                    {'Date & Time'}
                                    <span aria-hidden="true">
                                      {matchesSort?.key === 'scheduledAt'
                                        ? matchesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!matchesHiddenColumns.has(4) &&
                              canReadField(permissions, 'matches', 'gameId') && (
                                <th
                                  scope="col"
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  {'Game'}
                                </th>
                              )}
                            {!matchesHiddenColumns.has(5) &&
                              canReadField(permissions, 'matches', 'playerOneId') && (
                                <th
                                  scope="col"
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  {'Player 1'}
                                </th>
                              )}
                            {!matchesHiddenColumns.has(6) &&
                              canReadField(permissions, 'matches', 'playerTwoId') && (
                                <th
                                  scope="col"
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  {'Player 2'}
                                </th>
                              )}
                            {!matchesHiddenColumns.has(7) &&
                              canReadField(permissions, 'matches', 'outcome') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    matchesSort?.key === 'outcome'
                                      ? matchesSort.dir === 'asc'
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
                                      runWithToast(loadAllMatches());
                                      setMatchesSort(cycleSort(matchesSort, 'outcome'));
                                    }}
                                  >
                                    {'Outcome'}
                                    <span aria-hidden="true">
                                      {matchesSort?.key === 'outcome'
                                        ? matchesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!matchesHiddenColumns.has(8) &&
                              canReadField(permissions, 'matches', 'playerOneScore') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    matchesSort?.key === 'playerOneScore'
                                      ? matchesSort.dir === 'asc'
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
                                      runWithToast(loadAllMatches());
                                      setMatchesSort(cycleSort(matchesSort, 'playerOneScore'));
                                    }}
                                  >
                                    {'P1 Score'}
                                    <span aria-hidden="true">
                                      {matchesSort?.key === 'playerOneScore'
                                        ? matchesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!matchesHiddenColumns.has(9) &&
                              canReadField(permissions, 'matches', 'playerTwoScore') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    matchesSort?.key === 'playerTwoScore'
                                      ? matchesSort.dir === 'asc'
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
                                      runWithToast(loadAllMatches());
                                      setMatchesSort(cycleSort(matchesSort, 'playerTwoScore'));
                                    }}
                                  >
                                    {'P2 Score'}
                                    <span aria-hidden="true">
                                      {matchesSort?.key === 'playerTwoScore'
                                        ? matchesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!matchesHiddenColumns.has(10) &&
                              canReadField(permissions, 'matches', 'playerOneRatingDelta') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    matchesSort?.key === 'playerOneRatingDelta'
                                      ? matchesSort.dir === 'asc'
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
                                      runWithToast(loadAllMatches());
                                      setMatchesSort(
                                        cycleSort(matchesSort, 'playerOneRatingDelta')
                                      );
                                    }}
                                  >
                                    {'P1 Rating Change'}
                                    <span aria-hidden="true">
                                      {matchesSort?.key === 'playerOneRatingDelta'
                                        ? matchesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!matchesHiddenColumns.has(11) &&
                              canReadField(permissions, 'matches', 'playerTwoRatingDelta') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    matchesSort?.key === 'playerTwoRatingDelta'
                                      ? matchesSort.dir === 'asc'
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
                                      runWithToast(loadAllMatches());
                                      setMatchesSort(
                                        cycleSort(matchesSort, 'playerTwoRatingDelta')
                                      );
                                    }}
                                  >
                                    {'P2 Rating Change'}
                                    <span aria-hidden="true">
                                      {matchesSort?.key === 'playerTwoRatingDelta'
                                        ? matchesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!matchesHiddenColumns.has(12) &&
                              canReadField(permissions, 'matches', 'recordedById') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    matchesSort?.key === 'recordedBy'
                                      ? matchesSort.dir === 'asc'
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
                                      runWithToast(loadAllMatches());
                                      setMatchesSort(cycleSort(matchesSort, 'recordedBy'));
                                    }}
                                  >
                                    {'Recorder'}
                                    <span aria-hidden="true">
                                      {matchesSort?.key === 'recordedBy'
                                        ? matchesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!matchesHiddenColumns.has(13) &&
                              canReadField(permissions, 'matches', 'createdAt') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    matchesSort?.key === 'createdAt'
                                      ? matchesSort.dir === 'asc'
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
                                      runWithToast(loadAllMatches());
                                      setMatchesSort(cycleSort(matchesSort, 'createdAt'));
                                    }}
                                  >
                                    {'Created At'}
                                    <span aria-hidden="true">
                                      {matchesSort?.key === 'createdAt'
                                        ? matchesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!matchesHiddenColumns.has(14) &&
                              canReadField(permissions, 'matches', 'gameDisplayName') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    matchesSort?.key === 'gameDisplayName'
                                      ? matchesSort.dir === 'asc'
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
                                        runWithToast(loadAllMatches());
                                        setMatchesSort(cycleSort(matchesSort, 'gameDisplayName'));
                                      }}
                                    >
                                      {'Game Display Name'}
                                      <span aria-hidden="true">
                                        {matchesSort?.key === 'gameDisplayName'
                                          ? matchesSort.dir === 'asc'
                                            ? ' \u25b2'
                                            : ' \u25bc'
                                          : ''}
                                      </span>
                                    </button>
                                    <CalculatedMark id="Match.gameDisplayName" />
                                  </span>
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
                                      {canReadField(permissions, 'matches', 'title') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(0)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(0)) {
                                                next.delete(0);
                                              } else {
                                                next.add(0);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Match Matchup'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'gameId') &&
                                        canReadField(permissions, 'games', 'displayName') && (
                                          <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                            <input
                                              type="checkbox"
                                              className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                              checked={!matchesHiddenColumns.has(1)}
                                              onChange={() => {
                                                const next = new Set(matchesHiddenColumns);
                                                if (next.has(1)) {
                                                  next.delete(1);
                                                } else {
                                                  next.add(1);
                                                }
                                                setStoredHiddenColumns(
                                                  'matches',
                                                  matchesColumnLabels,
                                                  next
                                                );
                                                setMatchesHiddenColumns(next);
                                              }}
                                            />
                                            <span>{'Game & Variant'}</span>
                                          </label>
                                        )}
                                      {canReadField(permissions, 'matches', 'status') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(2)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(2)) {
                                                next.delete(2);
                                              } else {
                                                next.add(2);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Status'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'scheduledAt') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(3)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(3)) {
                                                next.delete(3);
                                              } else {
                                                next.add(3);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Date & Time'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'gameId') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(4)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(4)) {
                                                next.delete(4);
                                              } else {
                                                next.add(4);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Game'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'playerOneId') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(5)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(5)) {
                                                next.delete(5);
                                              } else {
                                                next.add(5);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Player 1'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'playerTwoId') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(6)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(6)) {
                                                next.delete(6);
                                              } else {
                                                next.add(6);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Player 2'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'outcome') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(7)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(7)) {
                                                next.delete(7);
                                              } else {
                                                next.add(7);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Outcome'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'playerOneScore') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(8)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(8)) {
                                                next.delete(8);
                                              } else {
                                                next.add(8);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'P1 Score'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'playerTwoScore') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(9)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(9)) {
                                                next.delete(9);
                                              } else {
                                                next.add(9);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'P2 Score'}</span>
                                        </label>
                                      )}
                                      {canReadField(
                                        permissions,
                                        'matches',
                                        'playerOneRatingDelta'
                                      ) && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(10)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(10)) {
                                                next.delete(10);
                                              } else {
                                                next.add(10);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'P1 Rating Change'}</span>
                                        </label>
                                      )}
                                      {canReadField(
                                        permissions,
                                        'matches',
                                        'playerTwoRatingDelta'
                                      ) && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(11)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(11)) {
                                                next.delete(11);
                                              } else {
                                                next.add(11);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'P2 Rating Change'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'recordedById') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(12)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(12)) {
                                                next.delete(12);
                                              } else {
                                                next.add(12);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Recorder'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'createdAt') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(13)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(13)) {
                                                next.delete(13);
                                              } else {
                                                next.add(13);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Created At'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'gameDisplayName') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(14)}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(14)) {
                                                next.delete(14);
                                              } else {
                                                next.add(14);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnLabels,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Game Display Name'}</span>
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
                          {pagedMatches.length === 0 && (
                            <tr>
                              <td
                                colSpan={17}
                                className="px-4 py-8 text-center text-muted-foreground"
                                role="status"
                              >
                                {matchesMatches.length === 0 ? 'No data yet' : 'No matches'}
                              </td>
                            </tr>
                          )}
                          {pagedMatches.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() => {
                                setSelectedId(item.id);
                              }}
                              className="group/row border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                            >
                              {matchesRuleViolations.rows.size > 0 && (
                                <td className="w-6 pl-4 pr-0 py-3 align-middle">
                                  <RuleViolationMarker
                                    groups={matchesRuleViolations.rows.get(item.id) ?? []}
                                  />
                                </td>
                              )}
                              {!matchesHiddenColumns.has(0) &&
                                canReadField(permissions, 'matches', 'title') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Match Matchup'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <RecordChip
                                        label={String(item.title)}
                                        icon={<SwordsIcon className="h-3.5 w-3.5" />}
                                        className="break-words text-sm"
                                        data-ls="e3a248f1d8"
                                      />
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(1) &&
                                canReadField(permissions, 'matches', 'gameId') &&
                                canReadField(permissions, 'games', 'displayName') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Game & Variant'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="break-words text-sm" data-ls="4456f8f632">
                                        {games.find((gameType) => gameType.id === item.gameId)
                                          ?.displayName !== undefined
                                          ? games.find((gameType) => gameType.id === item.gameId)
                                              ?.displayName
                                          : '—'}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(2) &&
                                canReadField(permissions, 'matches', 'status') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Status'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {item.status && (
                                        <span
                                          className={`inline-flex self-start items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${item.status === 'scheduled' ? 'bg-[color-mix(in_oklch,var(--series-1)_12%,transparent)] text-[color-mix(in_oklch,var(--series-1)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-1)_28%,transparent)]' : item.status === 'inProgress' ? 'bg-[color-mix(in_oklch,var(--series-2)_12%,transparent)] text-[color-mix(in_oklch,var(--series-2)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-2)_28%,transparent)]' : item.status === 'completed' ? 'bg-[color-mix(in_oklch,var(--series-3)_12%,transparent)] text-[color-mix(in_oklch,var(--series-3)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-3)_28%,transparent)]' : item.status === 'disputed' ? 'bg-[color-mix(in_oklch,var(--series-4)_12%,transparent)] text-[color-mix(in_oklch,var(--series-4)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-4)_28%,transparent)]' : item.status === 'cancelled' ? 'bg-[color-mix(in_oklch,var(--series-5)_12%,transparent)] text-[color-mix(in_oklch,var(--series-5)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-5)_28%,transparent)]' : 'bg-muted text-foreground ring-border'}`}
                                        >
                                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                                          {new Map([
                                            ['scheduled', 'Scheduled'],
                                            ['inProgress', 'In Progress'],
                                            ['completed', 'Completed'],
                                            ['disputed', 'Disputed'],
                                            ['cancelled', 'Cancelled'],
                                          ]).get(item.status) ?? item.status}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(3) &&
                                canReadField(permissions, 'matches', 'scheduledAt') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Date & Time'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span
                                        className="whitespace-nowrap text-sm"
                                        data-ls="15b39d6959"
                                      >
                                        {item.scheduledAt
                                          ? new Date(item.scheduledAt).toLocaleString('en', {
                                              dateStyle: 'medium',
                                              timeStyle: 'short',
                                            })
                                          : ''}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(4) &&
                                canReadField(permissions, 'matches', 'gameId') && (
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
                                            data-ls="3e620ab5a0"
                                          />
                                        </>
                                      ) : (
                                        <span className="break-words text-sm" data-ls="3e620ab5a0">
                                          {'—'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(5) &&
                                canReadField(permissions, 'matches', 'playerOneId') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Player 1'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {players.find((player) => player.id === item.playerOneId) !==
                                      undefined ? (
                                        <>
                                          <RecordChip
                                            collection="players"
                                            id={item.playerOneId}
                                            label={String(
                                              players.find(
                                                (player) => player.id === item.playerOneId
                                              )?.nickname ?? ''
                                            )}
                                            icon={<UserIcon className="h-3.5 w-3.5" />}
                                            className="break-words text-sm"
                                            data-ls="60fb12dbf7"
                                          />
                                        </>
                                      ) : (
                                        <span className="break-words text-sm" data-ls="60fb12dbf7">
                                          {'—'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(6) &&
                                canReadField(permissions, 'matches', 'playerTwoId') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Player 2'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {players.find((player) => player.id === item.playerTwoId) !==
                                      undefined ? (
                                        <>
                                          <RecordChip
                                            collection="players"
                                            id={item.playerTwoId}
                                            label={String(
                                              players.find(
                                                (player) => player.id === item.playerTwoId
                                              )?.nickname ?? ''
                                            )}
                                            icon={<UserIcon className="h-3.5 w-3.5" />}
                                            className="break-words text-sm"
                                            data-ls="32d18ca20d"
                                          />
                                        </>
                                      ) : (
                                        <span className="break-words text-sm" data-ls="32d18ca20d">
                                          {'—'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(7) &&
                                canReadField(permissions, 'matches', 'outcome') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Outcome'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="break-words text-sm" data-ls="36e484389e">
                                        {new Map([
                                          ['playerOneWin', 'Player 1 Victory'],
                                          ['playerTwoWin', 'Player 2 Victory'],
                                          ['draw', 'Draw'],
                                        ]).get(item.outcome) ?? item.outcome}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(8) &&
                                canReadField(permissions, 'matches', 'playerOneScore') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'P1 Score'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span
                                        className="whitespace-nowrap text-sm"
                                        data-ls="a23faa50f1"
                                      >
                                        {item.playerOneScore}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(9) &&
                                canReadField(permissions, 'matches', 'playerTwoScore') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'P2 Score'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span
                                        className="whitespace-nowrap text-sm"
                                        data-ls="724724c0da"
                                      >
                                        {item.playerTwoScore}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(10) &&
                                canReadField(permissions, 'matches', 'playerOneRatingDelta') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'P1 Rating Change'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="break-words text-sm" data-ls="bbfaacdc33">
                                        {item.playerOneRatingDelta}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(11) &&
                                canReadField(permissions, 'matches', 'playerTwoRatingDelta') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'P2 Rating Change'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="break-words text-sm" data-ls="63c5437f90">
                                        {item.playerTwoRatingDelta}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(12) &&
                                canReadField(permissions, 'matches', 'recordedById') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Recorder'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {item.recordedById ? (
                                        <RecordChip
                                          label={userLabel(item.recordedById)}
                                          initials
                                          className="break-words text-sm"
                                          data-ls="4898f39da7"
                                        />
                                      ) : null}
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(13) &&
                                canReadField(permissions, 'matches', 'createdAt') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Created At'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span
                                        className="whitespace-nowrap text-sm"
                                        data-ls="75ef79dae3"
                                      >
                                        {item.createdAt ? relativeTime(item.createdAt) : ''}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(14) &&
                                canReadField(permissions, 'matches', 'gameDisplayName') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Game Display Name'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="break-words text-sm" data-ls="026a68e4bd">
                                        {item.gameDisplayName}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              <td className="w-px px-3 py-2 text-right align-middle whitespace-nowrap opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 transition-opacity">
                                <div className="inline-flex items-center gap-1">
                                  {(permissions?.['matches']?.update ?? false) && (
                                    <button
                                      type="button"
                                      aria-label={'Edit'}
                                      onClick={(clickEvent) => {
                                        clickEvent.stopPropagation();
                                        setEditingMatches(item);
                                      }}
                                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                    >
                                      <PencilIcon className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {(permissions?.['matches']?.delete ?? false) && (
                                    <button
                                      type="button"
                                      aria-label={'Delete'}
                                      onClick={(clickEvent) => {
                                        clickEvent.stopPropagation();
                                        runWithToast(
                                          deleteMatch(item.id).then(() => {
                                            matchesRuleViolations.reload();
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
                      {(matchesPageCount > 1 || matchesHasMore) && (
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border text-sm text-muted-foreground print:hidden">
                          <span>{`Page ${matchesPageSafe + 1} of ${matchesPageCount}`}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={'Previous page'}
                              onClick={() => {
                                setMatchesPage(Math.max(0, matchesPageSafe - 1));
                              }}
                              disabled={matchesPageSafe <= 0}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 transition-colors"
                            >
                              <ChevronLeftIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={'Next page'}
                              onClick={() => {
                                if (matchesPageSafe >= matchesPageCount - 1 && matchesHasMore) {
                                  runWithToast(
                                    loadMoreMatches().then(() => {
                                      setMatchesPage(matchesPageSafe + 1);
                                    })
                                  );
                                } else {
                                  setMatchesPage(
                                    Math.min(matchesPageCount - 1, matchesPageSafe + 1)
                                  );
                                }
                              }}
                              disabled={
                                matchesLoadingMore ||
                                (matchesPageSafe >= matchesPageCount - 1 && !matchesHasMore)
                              }
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 transition-colors"
                            >
                              <ChevronRightIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <MatchEditDialog
                      open={editingMatches !== null}
                      editing={editingMatches}
                      isBusy={false}
                      onSaved={() => {
                        matchesRuleViolations.reload();
                      }}
                      onClose={() => {
                        setEditingMatches(null);
                      }}
                    />
                  </div>
                </div>
              ) : null}
              {selected ? (
                <MatchDetailView
                  match={selected}
                  open
                  onEdit={
                    (permissions?.['matches']?.update ?? false)
                      ? (record: $Domain.Match): void => {
                          setEditingSelected(record);
                        }
                      : undefined
                  }
                  onDelete={
                    (permissions?.['matches']?.delete ?? false)
                      ? (id: string): void => {
                          setDeleteConfirmMatch({
                            id,
                            label: String(selected.title).trim() || 'Match',
                          });
                        }
                      : undefined
                  }
                  onTransactionSuccess={refreshWidget}
                  onClose={() => {
                    setSelectedId(null);
                  }}
                />
              ) : null}
            </Fragment>
          ) : null}
        </div>
      </SelectCards>
      <MatchEditDialog
        open={editingSelected !== null}
        editing={editingSelected}
        isBusy={false}
        onSaved={() => {
          matchesRuleViolations.reload();
        }}
        onClose={() => {
          setEditingSelected(null);
          runWithToast(reloadMatches());
        }}
      />
      <MatchEditDialog
        open={creatingMatches}
        editing={null}
        isBusy={false}
        onSaved={() => {
          matchesRuleViolations.reload();
        }}
        onClose={() => {
          setCreatingMatches(false);
          runWithToast(reloadMatches());
        }}
      />
      <ConfirmDeleteDialog
        open={deleteConfirmMatch !== null}
        title="Delete match"
        description={`Are you sure you want to delete "${deleteConfirmMatch?.label ?? ''}"? This action cannot be undone.`}
        cancelLabel="Cancel"
        deleteLabel="Delete"
        onCancel={() => {
          setDeleteConfirmMatch(null);
        }}
        onConfirm={() => {
          if (deleteConfirmMatch !== null) {
            runWithToast(
              deleteMatch(deleteConfirmMatch.id).then(() => {
                matchesRuleViolations.reload();
              })
            );
          }
          setDeleteConfirmMatch(null);
        }}
      />
    </>
  );
}

import { i18n } from '../i18n/text';
import { Fragment, useState, useEffect, type JSX, type ComponentProps } from 'react';
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
  SwordsIcon,
  Trash2Icon,
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
import { relativeTime } from '../utils/relativeTime';
import { onNavigationTo } from '../utils/recordNavigation';
import { isOwnClick } from '../utils/ownClick';
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
  const { permissions } = usePermissions();
  const {
    isInitializing: gamesInitializing,
    reloadGames,
    errorMessage: gamesError,
    games: gamesComplete,
  } = useGames();
  const {
    matches,
    isInitializing: matchesInitializing,
    reloadMatches,
    deleteMatch,
    isBusy: matchesBusy,
    errorMessage: matchesError,
    total: matchesTotal,
    hasMore: matchesHasMore,
    isLoadingMore: matchesLoadingMore,
    loadMore: loadMoreMatches,
    loadAll: loadAllMatches,
  } = useMatches({ paged: true, pageSize: 24 });
  const {
    isInitializing: playersInitializing,
    reloadPlayers,
    errorMessage: playersError,
    players: playersComplete,
  } = usePlayers();
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
    ['scheduled', i18n.word('MatchStatus.scheduled')],
    ['inProgress', i18n.word('MatchStatus.inProgress')],
    ['completed', i18n.word('MatchStatus.completed')],
    ['disputed', i18n.word('MatchStatus.disputed')],
    ['cancelled', i18n.word('MatchStatus.cancelled')],
  ]);
  const matchesOutcomeLabels = new Map<string, string>([
    ['playerOneWin', i18n.word('MatchOutcome.playerOneWin')],
    ['playerTwoWin', i18n.word('MatchOutcome.playerTwoWin')],
    ['draw', i18n.word('MatchOutcome.draw')],
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
  const matchesColumnKeys: readonly string[] = [
    'title',
    'game.displayName',
    'status',
    'scheduledAt',
    'game',
    'playerOne',
    'playerTwo',
    'outcome',
    'playerOneScore',
    'playerTwoScore',
    'playerOneRatingDelta',
    'playerTwoRatingDelta',
    'recordedBy',
    'createdAt',
    'gameDisplayName',
  ];
  const matchesReadableColumns: readonly boolean[] = [
    canReadField(permissions, 'matches', 'title'),
    canReadField(permissions, 'matches', 'gameId') &&
      canReadField(permissions, 'games', 'displayName'),
    canReadField(permissions, 'matches', 'status'),
    canReadField(permissions, 'matches', 'scheduledAt'),
    canReadField(permissions, 'matches', 'gameId'),
    canReadField(permissions, 'matches', 'playerOneId'),
    canReadField(permissions, 'matches', 'playerTwoId'),
    canReadField(permissions, 'matches', 'outcome'),
    canReadField(permissions, 'matches', 'playerOneScore'),
    canReadField(permissions, 'matches', 'playerTwoScore'),
    canReadField(permissions, 'matches', 'playerOneRatingDelta'),
    canReadField(permissions, 'matches', 'playerTwoRatingDelta'),
    canReadField(permissions, 'matches', 'recordedById'),
    canReadField(permissions, 'matches', 'createdAt'),
    canReadField(permissions, 'matches', 'gameDisplayName'),
  ];
  const [matchesHiddenColumns, setMatchesHiddenColumns] = useState<Set<number>>(() =>
    getStoredHiddenColumns('matches', matchesColumnKeys, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
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
  const [creatingMatches, setCreatingMatches] = useState<NonNullable<
    ComponentProps<typeof MatchEditDialog>['defaults']
  > | null>(null);
  const [deleteConfirmMatch, setDeleteConfirmMatch] = useState<{
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
        <div className="flex flex-col gap-4 p-4 @md:p-8" data-ls="b46d0d1c43">
          {!(permissions?.['matches']?.read ?? false) ? (
            <div
              className="overflow-x-auto flex flex-col items-center p-12 rounded-xl border border-border bg-card shadow-sm"
              data-ls="0e8b4b1715"
            >
              <span className="min-w-min text-muted-foreground" data-ls="caa82dbbfe">
                {i18n.chrome.noPermission}
              </span>
            </div>
          ) : null}
          {(permissions?.['matches']?.read ?? false) ? (
            <Fragment>
              <div
                className="flex flex-row items-center gap-3 min-w-0 flex-wrap [&>*]:max-w-full py-1"
                data-ls="8f40c7c4be"
              >
                {!(matchesMatches.length < matchesTotal) ? (
                  <Fragment>
                    {matchesMatches.length === 1 ? (
                      <span
                        className="min-w-min text-sm text-muted-foreground shrink-0"
                        data-ls="978525f1c3"
                      >
                        {i18n.fill(
                          `{count} ${i18n.fill(i18n.chrome.countNoun, { name: i18n.word('Match') })}`,
                          { count: matchesMatches.length }
                        )}
                      </span>
                    ) : null}
                    {!(matchesMatches.length === 1) ? (
                      <span
                        className="min-w-min text-sm text-muted-foreground shrink-0"
                        data-ls="83795e96a1"
                      >
                        {i18n.fill(
                          `{count} ${i18n.fill(i18n.chrome.countNoun, { name: i18n.word('Match', 1) })}`,
                          { count: matchesMatches.length }
                        )}
                      </span>
                    ) : null}
                  </Fragment>
                ) : null}
                {matchesMatches.length < matchesTotal ? (
                  <Fragment>
                    {matchesTotal === 1 ? (
                      <span
                        className="min-w-min text-sm text-muted-foreground shrink-0"
                        data-ls="16b45c02f1"
                      >
                        {i18n.fill(
                          `${i18n.chrome.countOfTotal} ${i18n.fill(i18n.chrome.countNoun, { name: i18n.word('Match') })}`,
                          { shown: matchesMatches.length, total: matchesTotal }
                        )}
                      </span>
                    ) : null}
                    {!(matchesTotal === 1) ? (
                      <span
                        className="min-w-min text-sm text-muted-foreground shrink-0"
                        data-ls="4baccd0b43"
                      >
                        {i18n.fill(
                          `${i18n.chrome.countOfTotal} ${i18n.fill(i18n.chrome.countNoun, { name: i18n.word('Match', 1) })}`,
                          { shown: matchesMatches.length, total: matchesTotal }
                        )}
                      </span>
                    ) : null}
                  </Fragment>
                ) : null}
                <div className="flex-1" data-ls="5902821ecb" />
                <div className="relative min-w-[12rem] flex-1" data-ls="9f897f0198">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={matchesQuery}
                    onChange={(event) => {
                      setMatchesQuery(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape' && matchesQuery !== '') {
                        event.preventDefault();
                        setMatchesQuery('');
                      }
                    }}
                    placeholder={i18n.chrome.search}
                    aria-label={i18n.fill(i18n.chrome.searchLabel, { name: i18n.word('matches') })}
                    className={`h-10 w-full rounded-md border pl-9 pr-9 text-sm transition-colors focus:border-primary focus:outline-none ${matchesQuery === '' ? 'border-border bg-transparent' : 'border-primary bg-primary/5'}`}
                  />
                  {matchesQuery !== '' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMatchesQuery('');
                      }}
                      aria-label={i18n.chrome.clearSearch}
                      title={i18n.chrome.clearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {(permissions?.['matches']?.create ?? false) && (
                  <button
                    type="button"
                    data-ls="fe87297586"
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    onClick={() => {
                      setCreatingMatches({});
                    }}
                  >
                    <PlusIcon className="h-4 w-4" />
                    {i18n.fill(i18n.chrome.addItem, { name: i18n.word('Match') })}
                  </button>
                )}
              </div>
              {matchesError !== null ? (
                <div
                  className="flex flex-col overflow-x-auto p-3 rounded-md border border-border bg-secondary"
                  data-ls="49a5f5b25a"
                >
                  <span className="min-w-min text-sm" data-ls="4eac1f6cac">
                    {matchesError}
                  </span>
                </div>
              ) : null}
              {matchesInitializing ? <SkeletonCardGrid data-ls="8ce7cab615" /> : null}
              {matchesTotal === 0 && !matchesInitializing && !(matchesError !== null) ? (
                <div
                  className="overflow-x-auto flex flex-col items-center gap-2 p-12 rounded-xl border border-border bg-card shadow-sm"
                  data-ls="f01a176e08"
                >
                  <SwordsIcon
                    className="shrink-0 h-8 w-8 text-muted-foreground"
                    data-ls="eed25f0952"
                  />
                  <span className="min-w-min text-base font-medium" data-ls="02b72b533c">
                    {i18n.fill(i18n.chrome.noEntriesTitle, { name: i18n.word('matches') })}
                  </span>
                  {(permissions?.['matches']?.create ?? false) ? (
                    <span className="min-w-min text-sm text-muted-foreground" data-ls="e886b65caf">
                      {i18n.fill(i18n.chrome.noEntriesGetStarted, { name: i18n.word('Match') })}
                    </span>
                  ) : null}
                  {(permissions?.['matches']?.create ?? false) && (
                    <button
                      type="button"
                      data-ls="55f823a9cb"
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                      onClick={() => {
                        setCreatingMatches({});
                      }}
                    >
                      <PlusIcon className="h-4 w-4" />
                      {i18n.fill(i18n.chrome.addItem, { name: i18n.word('Match') })}
                    </button>
                  )}
                </div>
              ) : null}
              {matchesMatches.length === 0 && !(matchesTotal === 0) && matchesBusy ? (
                <SkeletonCardGrid data-ls="d70f5f2a59" />
              ) : null}
              {matchesMatches.length === 0 && !(matchesTotal === 0) && !matchesBusy ? (
                <div
                  className="overflow-x-auto flex flex-col items-center gap-2 p-12 rounded-xl border border-border bg-card shadow-sm"
                  data-ls="2279d975ac"
                >
                  <SearchXIcon
                    className="shrink-0 h-8 w-8 text-muted-foreground"
                    data-ls="e3a248f1d8"
                  />
                  <span className="min-w-min text-base font-medium" data-ls="f6514dfcbf">
                    {i18n.chrome.noMatches}
                  </span>
                  {(permissions?.['matches']?.create ?? false) ? (
                    <span className="min-w-min text-sm text-muted-foreground" data-ls="2d6fe44cc1">
                      {i18n.fill(i18n.chrome.noEntriesSearchCreate, { name: i18n.word('Match') })}
                    </span>
                  ) : null}
                  {!(permissions?.['matches']?.create ?? false) ? (
                    <span className="min-w-min text-sm text-muted-foreground" data-ls="ddb3840c21">
                      {i18n.chrome.noEntriesSearch}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    data-ls="15b39d6959"
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    onClick={() => {
                      setMatchesQuery('');
                    }}
                  >
                    <RotateCcwIcon className="h-4 w-4" />
                    {i18n.chrome.showAll}
                  </button>
                </div>
              ) : null}
              {matchesMatches.length > 0 ? (
                <div
                  className="ui-table-surface flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                  data-ls="3e620ab5a0"
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
                                  <span className="inline-flex items-center">
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
                                    <CalculatedMark id="Match.title" />
                                  </span>
                                </th>
                              )}
                            {!matchesHiddenColumns.has(1) &&
                              canReadField(permissions, 'matches', 'gameId') &&
                              canReadField(permissions, 'games', 'displayName') && (
                                <th
                                  scope="col"
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  {i18n.word("'Game & Variant'")}
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
                                  {i18n.word('Match.game')}
                                </th>
                              )}
                            {!matchesHiddenColumns.has(5) &&
                              canReadField(permissions, 'matches', 'playerOneId') && (
                                <th
                                  scope="col"
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  {i18n.word('Match.playerOne')}
                                </th>
                              )}
                            {!matchesHiddenColumns.has(6) &&
                              canReadField(permissions, 'matches', 'playerTwoId') && (
                                <th
                                  scope="col"
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  {i18n.word('Match.playerTwo')}
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
                                    {i18n.word('Match.outcome')}
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
                                    {i18n.word('Match.playerOneScore')}
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
                                    {i18n.word('Match.playerTwoScore')}
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
                                    {i18n.word('Match.playerOneRatingDelta')}
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
                                    {i18n.word('Match.playerTwoRatingDelta')}
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
                                    {i18n.word('Match.recordedBy')}
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
                                    {i18n.word('Match.createdAt')}
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
                                      {i18n.word('Match.gameDisplayName')}
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
                                      {canReadField(permissions, 'matches', 'title') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(0)}
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              0
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(0)) {
                                                next.delete(0);
                                              } else {
                                                next.add(0);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
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
                                              disabled={isLastShownColumn(
                                                matchesHiddenColumns,
                                                matchesReadableColumns,
                                                1
                                              )}
                                              onChange={() => {
                                                const next = new Set(matchesHiddenColumns);
                                                if (next.has(1)) {
                                                  next.delete(1);
                                                } else {
                                                  next.add(1);
                                                }
                                                setStoredHiddenColumns(
                                                  'matches',
                                                  matchesColumnKeys,
                                                  next
                                                );
                                                setMatchesHiddenColumns(next);
                                              }}
                                            />
                                            <span>{i18n.word("'Game & Variant'")}</span>
                                          </label>
                                        )}
                                      {canReadField(permissions, 'matches', 'status') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(2)}
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              2
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(2)) {
                                                next.delete(2);
                                              } else {
                                                next.add(2);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
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
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              3
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(3)) {
                                                next.delete(3);
                                              } else {
                                                next.add(3);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
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
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              4
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(4)) {
                                                next.delete(4);
                                              } else {
                                                next.add(4);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('Match.game')}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'playerOneId') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(5)}
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              5
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(5)) {
                                                next.delete(5);
                                              } else {
                                                next.add(5);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('Match.playerOne')}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'playerTwoId') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(6)}
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              6
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(6)) {
                                                next.delete(6);
                                              } else {
                                                next.add(6);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('Match.playerTwo')}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'outcome') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(7)}
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              7
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(7)) {
                                                next.delete(7);
                                              } else {
                                                next.add(7);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('Match.outcome')}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'playerOneScore') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(8)}
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              8
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(8)) {
                                                next.delete(8);
                                              } else {
                                                next.add(8);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('Match.playerOneScore')}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'playerTwoScore') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(9)}
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              9
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(9)) {
                                                next.delete(9);
                                              } else {
                                                next.add(9);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('Match.playerTwoScore')}</span>
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
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              10
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(10)) {
                                                next.delete(10);
                                              } else {
                                                next.add(10);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('Match.playerOneRatingDelta')}</span>
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
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              11
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(11)) {
                                                next.delete(11);
                                              } else {
                                                next.add(11);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('Match.playerTwoRatingDelta')}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'recordedById') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(12)}
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              12
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(12)) {
                                                next.delete(12);
                                              } else {
                                                next.add(12);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('Match.recordedBy')}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'createdAt') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(13)}
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              13
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(13)) {
                                                next.delete(13);
                                              } else {
                                                next.add(13);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('Match.createdAt')}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'matches', 'gameDisplayName') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!matchesHiddenColumns.has(14)}
                                            disabled={isLastShownColumn(
                                              matchesHiddenColumns,
                                              matchesReadableColumns,
                                              14
                                            )}
                                            onChange={() => {
                                              const next = new Set(matchesHiddenColumns);
                                              if (next.has(14)) {
                                                next.delete(14);
                                              } else {
                                                next.add(14);
                                              }
                                              setStoredHiddenColumns(
                                                'matches',
                                                matchesColumnKeys,
                                                next
                                              );
                                              setMatchesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('Match.gameDisplayName')}</span>
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
                                {matchesMatches.length === 0
                                  ? i18n.chrome.noDataYet
                                  : i18n.chrome.noMatches}
                              </td>
                            </tr>
                          )}
                          {pagedMatches.map((item) => (
                            <tr
                              key={item.id}
                              onClick={(clickEvent) => {
                                if (isOwnClick(clickEvent)) {
                                  setSelectedId(item.id);
                                }
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
                                        className="min-w-min text-sm"
                                        data-ls="f9d8b14dc2"
                                      />
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(1) &&
                                canReadField(permissions, 'matches', 'gameId') &&
                                canReadField(permissions, 'games', 'displayName') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word("'Game & Variant'")}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="min-w-min text-sm" data-ls="849f40b845">
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
                                            ['scheduled', i18n.word("'Scheduled'")],
                                            ['inProgress', i18n.word("'In Progress'")],
                                            ['completed', i18n.word("'Completed'")],
                                            ['disputed', i18n.word("'Disputed'")],
                                            ['cancelled', i18n.word("'Cancelled'")],
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
                                        className="shrink-0 whitespace-nowrap text-sm"
                                        data-ls="62d951551f"
                                      >
                                        {item.scheduledAt
                                          ? new Date(item.scheduledAt).toLocaleString(i18n.locale, {
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
                                    data-label={i18n.word('Match.game')}
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
                                            data-ls="b649f5520f"
                                          />
                                        </>
                                      ) : (
                                        <span className="min-w-min text-sm" data-ls="b649f5520f">
                                          {i18n.chrome.unresolvedReference}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(5) &&
                                canReadField(permissions, 'matches', 'playerOneId') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word('Match.playerOne')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {playersComplete.find(
                                        (player) => player.id === item.playerOneId
                                      ) !== undefined ? (
                                        <>
                                          <RecordChip
                                            collection="players"
                                            id={item.playerOneId}
                                            label={String(
                                              playersComplete.find(
                                                (player) => player.id === item.playerOneId
                                              )?.nickname ?? ''
                                            )}
                                            icon={<UserIcon className="h-3.5 w-3.5" />}
                                            className="min-w-min text-sm"
                                            data-ls="3510ee9a50"
                                          />
                                        </>
                                      ) : (
                                        <span className="min-w-min text-sm" data-ls="3510ee9a50">
                                          {i18n.chrome.unresolvedReference}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(6) &&
                                canReadField(permissions, 'matches', 'playerTwoId') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word('Match.playerTwo')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {playersComplete.find(
                                        (player) => player.id === item.playerTwoId
                                      ) !== undefined ? (
                                        <>
                                          <RecordChip
                                            collection="players"
                                            id={item.playerTwoId}
                                            label={String(
                                              playersComplete.find(
                                                (player) => player.id === item.playerTwoId
                                              )?.nickname ?? ''
                                            )}
                                            icon={<UserIcon className="h-3.5 w-3.5" />}
                                            className="min-w-min text-sm"
                                            data-ls="f3d6e1cc06"
                                          />
                                        </>
                                      ) : (
                                        <span className="min-w-min text-sm" data-ls="f3d6e1cc06">
                                          {i18n.chrome.unresolvedReference}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(7) &&
                                canReadField(permissions, 'matches', 'outcome') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word('Match.outcome')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="min-w-min text-sm" data-ls="960baee1ed">
                                        {new Map([
                                          ['playerOneWin', i18n.word("'Player 1 Victory'")],
                                          ['playerTwoWin', i18n.word("'Player 2 Victory'")],
                                          ['draw', i18n.word("'Draw'")],
                                        ]).get(item.outcome) ?? item.outcome}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(8) &&
                                canReadField(permissions, 'matches', 'playerOneScore') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word('Match.playerOneScore')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span
                                        className="shrink-0 whitespace-nowrap text-sm"
                                        data-ls="c3979ff474"
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
                                    data-label={i18n.word('Match.playerTwoScore')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span
                                        className="shrink-0 whitespace-nowrap text-sm"
                                        data-ls="ddb1a21d14"
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
                                    data-label={i18n.word('Match.playerOneRatingDelta')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="min-w-min text-sm" data-ls="961598f50f">
                                        {item.playerOneRatingDelta}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(11) &&
                                canReadField(permissions, 'matches', 'playerTwoRatingDelta') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word('Match.playerTwoRatingDelta')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="min-w-min text-sm" data-ls="034716fda2">
                                        {item.playerTwoRatingDelta}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(12) &&
                                canReadField(permissions, 'matches', 'recordedById') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word('Match.recordedBy')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {item.recordedById ? (
                                        <RecordChip
                                          label={userLabel(item.recordedById)}
                                          initials
                                          className="min-w-min text-sm"
                                          data-ls="33fc2c9de7"
                                        />
                                      ) : null}
                                    </div>
                                  </td>
                                )}
                              {!matchesHiddenColumns.has(13) &&
                                canReadField(permissions, 'matches', 'createdAt') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word('Match.createdAt')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span
                                        className="shrink-0 whitespace-nowrap text-sm"
                                        data-ls="0cb8161398"
                                        title={
                                          item.createdAt
                                            ? new Date(item.createdAt).toLocaleString(i18n.locale, {
                                                dateStyle: 'medium',
                                                timeStyle: 'short',
                                              })
                                            : undefined
                                        }
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
                                    data-label={i18n.word('Match.gameDisplayName')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="min-w-min text-sm" data-ls="dc503ad5b0">
                                        {item.gameDisplayName}
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
                                  {(permissions?.['matches']?.update ?? false) && (
                                    <button
                                      type="button"
                                      aria-label={i18n.chrome.edit}
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
                                      aria-label={i18n.chrome.delete}
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
                          <span>
                            {i18n.fill(i18n.chrome.pageIndicator, {
                              page: matchesPageSafe + 1,
                              count: matchesPageCount,
                            })}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={i18n.chrome.previousPage}
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
                              aria-label={i18n.chrome.nextPage}
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
        open={creatingMatches !== null}
        editing={null}
        isBusy={false}
        defaults={creatingMatches ?? {}}
        onSaved={() => {
          matchesRuleViolations.reload();
        }}
        onClose={() => {
          setCreatingMatches(null);
          runWithToast(reloadMatches());
        }}
      />
      <ConfirmDeleteDialog
        open={deleteConfirmMatch !== null}
        title={i18n.fill(i18n.chrome.deleteTitle, { name: i18n.word('Match') })}
        description={i18n.fill(i18n.chrome.deleteConfirm, {
          item: deleteConfirmMatch?.label ?? '',
        })}
        cancelLabel={i18n.chrome.cancel}
        deleteLabel={i18n.chrome.delete}
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

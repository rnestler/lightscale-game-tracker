import { Fragment, useState, useEffect, type JSX } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useGames } from '../hooks/useGames';
import { usePermissions, canReadField } from '../hooks/usePermissions';
import { textValue } from '../utils/recordValues';
import { GameTypeDetailView } from './GameTypeDetailView';
import { ConfirmDeleteDialog } from './ui/ConfirmDelete';
import { GameTypeEditDialog } from './GameTypeEditDialog';
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
} from 'lucide-react';
import { getStoredHiddenColumns, setStoredHiddenColumns } from '../api/pagination';
import { useRuleViolations } from '../hooks/useRuleViolations';
import { RuleViolationMarker, RuleViolationsBanner } from './RuleViolationsNotice';
import { RecordChip } from '../components/ui/record-chip';
import { onNavigationTo } from '../utils/recordNavigation';
import { SelectCards } from './ui/card-select';
import { SkeletonCardGrid } from './ui/skeleton';

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

export function GamesList(_props: { onNavigate?: (view: string) => void }): JSX.Element {
  const {
    games,
    isInitializing: gamesInitializing,
    reloadGames,
    deleteGameType,
    errorMessage: gamesError,
    total: gamesTotal,
    hasMore: gamesHasMore,
    isLoadingMore: gamesLoadingMore,
    loadMore: loadMoreGames,
    loadAll: loadAllGames,
  } = useGames({ paged: true, pageSize: 24 });
  const { permissions } = usePermissions();
  const gamesRuleViolations = useRuleViolations('games');
  const [gamesRuleFilter, setGamesRuleFilter] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = games.find((each) => each.id === selectedId) ?? null;
  const [pendingNavId, setPendingNavId] = useState<string | null>(null);
  useEffect(
    () =>
      onNavigationTo('games', (id) => {
        setPendingNavId(id);
      }),
    []
  );
  useEffect(() => {
    if (pendingNavId !== null && games.some((each) => each.id === pendingNavId)) {
      setSelectedId(pendingNavId);
      setPendingNavId(null);
    }
  }, [pendingNavId, games]);
  const [gamesQuery, setGamesQuery] = useState('');
  const gamesCategoryLabels = new Map<string, string>([
    ['chess', 'Chess & Variants'],
    ['billiards', 'Billiards / Pool'],
    ['tableTennis', 'Table Tennis'],
    ['darts', 'Darts'],
    ['boardGames', 'Board Games'],
    ['cardGames', 'Card Games'],
    ['custom', 'Custom / Other'],
  ]);
  const gamesSearchTerm = gamesQuery.trim().toLowerCase();
  const gamesMatches =
    gamesSearchTerm === ''
      ? games
      : games.filter((each) =>
          [
            textValue(each.name),
            gamesCategoryLabels.get(each.category) ?? textValue(each.category),
            textValue(each.rulesVariant),
          ].some((value) => value.toLowerCase().includes(gamesSearchTerm))
        );
  useEffect(() => {
    if (gamesQuery !== '') {
      runWithToast(loadAllGames());
    }
  }, [gamesQuery, loadAllGames]);
  const ruleFilteredGames = gamesRuleFilter
    ? gamesMatches.filter((row) => gamesRuleViolations.rows.has(row.id))
    : gamesMatches;
  const [gamesSort, setGamesSort] = useState<SortState>(null);
  const sortedGames =
    gamesSort === null
      ? ruleFilteredGames
      : [...ruleFilteredGames].sort((a, b) => {
          const dir = gamesSort.dir === 'asc' ? 1 : -1;
          switch (gamesSort.key) {
            case 'displayName':
              return dir * String(a.displayName).localeCompare(String(b.displayName));
            case 'category':
              return dir * String(a.category).localeCompare(String(b.category));
            case 'rulesVariant':
              return dir * String(a.rulesVariant).localeCompare(String(b.rulesVariant));
            case 'name':
              return dir * String(a.name).localeCompare(String(b.name));
            case 'defaultRating':
              return dir * (Number(a.defaultRating) - Number(b.defaultRating));
            default:
              return 0;
          }
        });
  const [gamesPage, setGamesPage] = useState(0);
  const gamesPageCount = Math.max(1, Math.ceil(sortedGames.length / 24));
  const gamesPageSafe = Math.min(gamesPage, gamesPageCount - 1);
  const pagedGames = sortedGames.slice(gamesPageSafe * 24, gamesPageSafe * 24 + 24);
  const gamesColumnLabels: readonly string[] = [
    'Display Name',
    'Category',
    'Variant / Ruleset',
    'Game Name',
    'Starting Rating (Default 1200)',
  ];
  const [gamesHiddenColumns, setGamesHiddenColumns] = useState<Set<number>>(() =>
    getStoredHiddenColumns('games', gamesColumnLabels, [3, 4])
  );
  function filterGamesRuleViolations(only: boolean): void {
    if (only !== gamesRuleFilter) {
      if (only) {
        loadAllGames()
          .then(() => {
            setGamesPage(0);
            setGamesRuleFilter(only);
          })
          .catch(() => {
            gamesRuleViolations.reportUnavailable();
          });
      } else {
        setGamesPage(0);
        setGamesRuleFilter(only);
      }
    }
  }
  const [editingGames, setEditingGames] = useState<$Domain.GameType | null>(null);
  const [editingSelected, setEditingSelected] = useState<$Domain.GameType | null>(null);
  const [creatingGames, setCreatingGames] = useState(false);
  const [deleteConfirmGameType, setDeleteConfirmGameType] = useState<{
    id: string;
    label: string;
  } | null>(null);
  return (
    <>
      <SelectCards
        selectedId={selected?.id ?? null}
        onSelect={setSelectedId}
        className="flex flex-col @container"
      >
        <div className="flex flex-col gap-4 p-4 @md:p-8" data-ls="e943ea799a">
          {!(permissions?.['games']?.read ?? false) ? (
            <div
              className="flex flex-col items-center p-12 rounded-xl border border-border bg-card shadow-sm"
              data-ls="32bfc97a02"
            >
              <span className="break-words text-muted-foreground" data-ls="c48b35103d">
                {"You don't have permission to view this content."}
              </span>
            </div>
          ) : null}
          {(permissions?.['games']?.read ?? false) ? (
            <Fragment>
              <div
                className="flex flex-row items-center gap-3 min-w-0 flex-wrap [&>*]:max-w-full py-1"
                data-ls="e00e53aeac"
              >
                {gamesMatches.length === 1 ? (
                  <span
                    className="break-words text-sm text-muted-foreground shrink-0"
                    data-ls="f25abaff52"
                  >{`${gamesMatches.length} game`}</span>
                ) : null}
                {!(gamesMatches.length === 1) ? (
                  <span
                    className="break-words text-sm text-muted-foreground shrink-0"
                    data-ls="8c63c63ee7"
                  >{`${gamesMatches.length} games`}</span>
                ) : null}
                <div className="flex-1" data-ls="a0564affa0" />
                <div className="relative min-w-[12rem] flex-1" data-ls="2f48fc6184">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={gamesQuery}
                    onChange={(event) => {
                      setGamesQuery(event.target.value);
                    }}
                    placeholder="Search…"
                    aria-label="Search games by name"
                    className="h-10 w-full rounded-md border border-border bg-transparent pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                {(permissions?.['games']?.create ?? false) && (
                  <button
                    type="button"
                    data-ls="5a40735d8b"
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    onClick={() => {
                      setCreatingGames(true);
                    }}
                  >
                    <PlusIcon className="h-4 w-4" />
                    {'Add game'}
                  </button>
                )}
              </div>
              {gamesError !== null ? (
                <div
                  className="flex flex-col p-3 rounded-md border border-border bg-secondary"
                  data-ls="de3e3c1808"
                >
                  <span className="break-words text-sm" data-ls="1f67175096">
                    {gamesError}
                  </span>
                </div>
              ) : null}
              {gamesInitializing ? <SkeletonCardGrid data-ls="94966c459b" /> : null}
              {gamesTotal === 0 && !gamesInitializing && !(gamesError !== null) ? (
                <div
                  className="flex flex-col items-center gap-2 p-12 rounded-xl border border-border bg-card shadow-sm"
                  data-ls="419a451dd3"
                >
                  <DicesIcon
                    className="shrink-0 h-8 w-8 text-muted-foreground"
                    data-ls="ae6f8902c4"
                  />
                  <span className="break-words text-base font-medium" data-ls="0210f802f2">
                    {'No games yet'}
                  </span>
                  {(permissions?.['games']?.create ?? false) ? (
                    <span
                      className="break-words text-sm text-muted-foreground"
                      data-ls="9c1d0c8710"
                    >
                      {'Get started by adding your first game.'}
                    </span>
                  ) : null}
                  {(permissions?.['games']?.create ?? false) && (
                    <button
                      type="button"
                      data-ls="a475314c39"
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                      onClick={() => {
                        setCreatingGames(true);
                      }}
                    >
                      <PlusIcon className="h-4 w-4" />
                      {'Add game'}
                    </button>
                  )}
                </div>
              ) : null}
              {gamesMatches.length === 0 && !(gamesTotal === 0) ? (
                <div
                  className="flex flex-col items-center p-12 rounded-xl border border-border bg-card shadow-sm"
                  data-ls="bb5d16b4eb"
                >
                  {(permissions?.['games']?.create ?? false) ? (
                    <span
                      className="break-words text-sm text-muted-foreground"
                      data-ls="4e5ff93fd7"
                    >
                      {'Try adjusting your search or add a new game.'}
                    </span>
                  ) : null}
                  {!(permissions?.['games']?.create ?? false) ? (
                    <span
                      className="break-words text-sm text-muted-foreground"
                      data-ls="09a2e5bc2e"
                    >
                      {'Try adjusting your search.'}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {gamesMatches.length > 0 ? (
                <div
                  className="ui-table-surface flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                  data-ls="4a46b6d954"
                >
                  <div className="flex flex-col gap-2">
                    <RuleViolationsBanner
                      collection="games"
                      violations={gamesRuleViolations}
                      filtering={gamesRuleFilter}
                      onFilter={filterGamesRuleViolations}
                    />
                    <div className="min-w-0 overflow-auto">
                      <table className="ui-table w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            {gamesRuleViolations.rows.size > 0 && (
                              <th scope="col" className="w-6 pl-4 pr-0 py-2.5" />
                            )}
                            {!gamesHiddenColumns.has(0) &&
                              canReadField(permissions, 'games', 'displayName') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    gamesSort?.key === 'displayName'
                                      ? gamesSort.dir === 'asc'
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
                                      runWithToast(loadAllGames());
                                      setGamesSort(cycleSort(gamesSort, 'displayName'));
                                    }}
                                  >
                                    {'Display Name'}
                                    <span aria-hidden="true">
                                      {gamesSort?.key === 'displayName'
                                        ? gamesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!gamesHiddenColumns.has(1) &&
                              canReadField(permissions, 'games', 'category') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    gamesSort?.key === 'category'
                                      ? gamesSort.dir === 'asc'
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
                                      runWithToast(loadAllGames());
                                      setGamesSort(cycleSort(gamesSort, 'category'));
                                    }}
                                  >
                                    {'Category'}
                                    <span aria-hidden="true">
                                      {gamesSort?.key === 'category'
                                        ? gamesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!gamesHiddenColumns.has(2) &&
                              canReadField(permissions, 'games', 'rulesVariant') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    gamesSort?.key === 'rulesVariant'
                                      ? gamesSort.dir === 'asc'
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
                                      runWithToast(loadAllGames());
                                      setGamesSort(cycleSort(gamesSort, 'rulesVariant'));
                                    }}
                                  >
                                    {'Variant / Ruleset'}
                                    <span aria-hidden="true">
                                      {gamesSort?.key === 'rulesVariant'
                                        ? gamesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!gamesHiddenColumns.has(3) &&
                              canReadField(permissions, 'games', 'name') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    gamesSort?.key === 'name'
                                      ? gamesSort.dir === 'asc'
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
                                      runWithToast(loadAllGames());
                                      setGamesSort(cycleSort(gamesSort, 'name'));
                                    }}
                                  >
                                    {'Game Name'}
                                    <span aria-hidden="true">
                                      {gamesSort?.key === 'name'
                                        ? gamesSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!gamesHiddenColumns.has(4) &&
                              canReadField(permissions, 'games', 'defaultRating') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    gamesSort?.key === 'defaultRating'
                                      ? gamesSort.dir === 'asc'
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
                                      runWithToast(loadAllGames());
                                      setGamesSort(cycleSort(gamesSort, 'defaultRating'));
                                    }}
                                  >
                                    {'Starting Rating (Default 1200)'}
                                    <span aria-hidden="true">
                                      {gamesSort?.key === 'defaultRating'
                                        ? gamesSort.dir === 'asc'
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
                                      {canReadField(permissions, 'games', 'displayName') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!gamesHiddenColumns.has(0)}
                                            onChange={() => {
                                              const next = new Set(gamesHiddenColumns);
                                              if (next.has(0)) {
                                                next.delete(0);
                                              } else {
                                                next.add(0);
                                              }
                                              setStoredHiddenColumns(
                                                'games',
                                                gamesColumnLabels,
                                                next
                                              );
                                              setGamesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Display Name'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'games', 'category') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!gamesHiddenColumns.has(1)}
                                            onChange={() => {
                                              const next = new Set(gamesHiddenColumns);
                                              if (next.has(1)) {
                                                next.delete(1);
                                              } else {
                                                next.add(1);
                                              }
                                              setStoredHiddenColumns(
                                                'games',
                                                gamesColumnLabels,
                                                next
                                              );
                                              setGamesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Category'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'games', 'rulesVariant') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!gamesHiddenColumns.has(2)}
                                            onChange={() => {
                                              const next = new Set(gamesHiddenColumns);
                                              if (next.has(2)) {
                                                next.delete(2);
                                              } else {
                                                next.add(2);
                                              }
                                              setStoredHiddenColumns(
                                                'games',
                                                gamesColumnLabels,
                                                next
                                              );
                                              setGamesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Variant / Ruleset'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'games', 'name') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!gamesHiddenColumns.has(3)}
                                            onChange={() => {
                                              const next = new Set(gamesHiddenColumns);
                                              if (next.has(3)) {
                                                next.delete(3);
                                              } else {
                                                next.add(3);
                                              }
                                              setStoredHiddenColumns(
                                                'games',
                                                gamesColumnLabels,
                                                next
                                              );
                                              setGamesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Game Name'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'games', 'defaultRating') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!gamesHiddenColumns.has(4)}
                                            onChange={() => {
                                              const next = new Set(gamesHiddenColumns);
                                              if (next.has(4)) {
                                                next.delete(4);
                                              } else {
                                                next.add(4);
                                              }
                                              setStoredHiddenColumns(
                                                'games',
                                                gamesColumnLabels,
                                                next
                                              );
                                              setGamesHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Starting Rating (Default 1200)'}</span>
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
                          {pagedGames.length === 0 && (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-4 py-8 text-center text-muted-foreground"
                                role="status"
                              >
                                {games.length === 0 ? 'No data yet' : 'No matches'}
                              </td>
                            </tr>
                          )}
                          {pagedGames.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() => {
                                setSelectedId(item.id);
                              }}
                              className="group/row border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                            >
                              {gamesRuleViolations.rows.size > 0 && (
                                <td className="w-6 pl-4 pr-0 py-3 align-middle">
                                  <RuleViolationMarker
                                    groups={gamesRuleViolations.rows.get(item.id) ?? []}
                                  />
                                </td>
                              )}
                              {!gamesHiddenColumns.has(0) &&
                                canReadField(permissions, 'games', 'displayName') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Display Name'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="break-words text-sm" data-ls="eca495b9cb">
                                        {item.displayName}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!gamesHiddenColumns.has(1) &&
                                canReadField(permissions, 'games', 'category') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Category'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {item.category && (
                                        <span
                                          className={`inline-flex self-start items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${item.category === 'chess' ? 'bg-[color-mix(in_oklch,var(--series-1)_12%,transparent)] text-[color-mix(in_oklch,var(--series-1)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-1)_28%,transparent)]' : item.category === 'billiards' ? 'bg-[color-mix(in_oklch,var(--series-2)_12%,transparent)] text-[color-mix(in_oklch,var(--series-2)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-2)_28%,transparent)]' : item.category === 'tableTennis' ? 'bg-[color-mix(in_oklch,var(--series-3)_12%,transparent)] text-[color-mix(in_oklch,var(--series-3)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-3)_28%,transparent)]' : item.category === 'darts' ? 'bg-[color-mix(in_oklch,var(--series-4)_12%,transparent)] text-[color-mix(in_oklch,var(--series-4)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-4)_28%,transparent)]' : item.category === 'boardGames' ? 'bg-[color-mix(in_oklch,var(--series-5)_12%,transparent)] text-[color-mix(in_oklch,var(--series-5)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-5)_28%,transparent)]' : item.category === 'cardGames' ? 'bg-[color-mix(in_oklch,var(--series-6)_12%,transparent)] text-[color-mix(in_oklch,var(--series-6)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-6)_28%,transparent)]' : item.category === 'custom' ? 'bg-[color-mix(in_oklch,var(--series-7)_12%,transparent)] text-[color-mix(in_oklch,var(--series-7)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-7)_28%,transparent)]' : 'bg-muted text-foreground ring-border'}`}
                                        >
                                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                                          {new Map([
                                            ['chess', 'Chess & Variants'],
                                            ['billiards', 'Billiards / Pool'],
                                            ['tableTennis', 'Table Tennis'],
                                            ['darts', 'Darts'],
                                            ['boardGames', 'Board Games'],
                                            ['cardGames', 'Card Games'],
                                            ['custom', 'Custom / Other'],
                                          ]).get(item.category) ?? item.category}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                              {!gamesHiddenColumns.has(2) &&
                                canReadField(permissions, 'games', 'rulesVariant') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Variant / Ruleset'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="break-words text-sm" data-ls="d4e665bba0">
                                        {item.rulesVariant}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!gamesHiddenColumns.has(3) &&
                                canReadField(permissions, 'games', 'name') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Game Name'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <RecordChip
                                        label={String(item.name)}
                                        icon={<DicesIcon className="h-3.5 w-3.5" />}
                                        className="break-words text-sm"
                                        data-ls="bf73f34562"
                                      />
                                    </div>
                                  </td>
                                )}
                              {!gamesHiddenColumns.has(4) &&
                                canReadField(permissions, 'games', 'defaultRating') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Starting Rating (Default 1200)'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="break-words text-sm" data-ls="4a49faca4e">
                                        {item.defaultRating}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              <td className="w-px px-3 py-2 text-right align-middle whitespace-nowrap opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 transition-opacity">
                                <div className="inline-flex items-center gap-1">
                                  {(permissions?.['games']?.update ?? false) && (
                                    <button
                                      type="button"
                                      aria-label={'Edit'}
                                      onClick={(clickEvent) => {
                                        clickEvent.stopPropagation();
                                        setEditingGames(item);
                                      }}
                                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                    >
                                      <PencilIcon className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {(permissions?.['games']?.delete ?? false) && (
                                    <button
                                      type="button"
                                      aria-label={'Delete'}
                                      onClick={(clickEvent) => {
                                        clickEvent.stopPropagation();
                                        runWithToast(
                                          deleteGameType(item.id).then(() => {
                                            gamesRuleViolations.reload();
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
                      {(gamesPageCount > 1 || gamesHasMore) && (
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border text-sm text-muted-foreground print:hidden">
                          <span>{`Page ${gamesPageSafe + 1} of ${gamesPageCount}`}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={'Previous page'}
                              onClick={() => {
                                setGamesPage(Math.max(0, gamesPageSafe - 1));
                              }}
                              disabled={gamesPageSafe <= 0}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 transition-colors"
                            >
                              <ChevronLeftIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={'Next page'}
                              onClick={() => {
                                if (gamesPageSafe >= gamesPageCount - 1 && gamesHasMore) {
                                  runWithToast(
                                    loadMoreGames().then(() => {
                                      setGamesPage(gamesPageSafe + 1);
                                    })
                                  );
                                } else {
                                  setGamesPage(Math.min(gamesPageCount - 1, gamesPageSafe + 1));
                                }
                              }}
                              disabled={
                                gamesLoadingMore ||
                                (gamesPageSafe >= gamesPageCount - 1 && !gamesHasMore)
                              }
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 transition-colors"
                            >
                              <ChevronRightIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <GameTypeEditDialog
                      open={editingGames !== null}
                      editing={editingGames}
                      isBusy={false}
                      onSaved={() => {
                        gamesRuleViolations.reload();
                      }}
                      onClose={() => {
                        setEditingGames(null);
                      }}
                    />
                  </div>
                </div>
              ) : null}
              {selected ? (
                <GameTypeDetailView
                  gameType={selected}
                  open
                  onEdit={
                    (permissions?.['games']?.update ?? false)
                      ? (record: $Domain.GameType): void => {
                          setEditingSelected(record);
                        }
                      : undefined
                  }
                  onDelete={
                    (permissions?.['games']?.delete ?? false)
                      ? (id: string): void => {
                          setDeleteConfirmGameType({
                            id,
                            label: String(selected.name).trim() || 'GameType',
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
      <GameTypeEditDialog
        open={editingSelected !== null}
        editing={editingSelected}
        isBusy={false}
        onSaved={() => {
          gamesRuleViolations.reload();
        }}
        onClose={() => {
          setEditingSelected(null);
          runWithToast(reloadGames());
        }}
      />
      <GameTypeEditDialog
        open={creatingGames}
        editing={null}
        isBusy={false}
        onSaved={() => {
          gamesRuleViolations.reload();
        }}
        onClose={() => {
          setCreatingGames(false);
          runWithToast(reloadGames());
        }}
      />
      <ConfirmDeleteDialog
        open={deleteConfirmGameType !== null}
        title="Delete game"
        description={`Are you sure you want to delete "${deleteConfirmGameType?.label ?? ''}"? This action cannot be undone.`}
        cancelLabel="Cancel"
        deleteLabel="Delete"
        onCancel={() => {
          setDeleteConfirmGameType(null);
        }}
        onConfirm={() => {
          if (deleteConfirmGameType !== null) {
            runWithToast(
              deleteGameType(deleteConfirmGameType.id).then(() => {
                gamesRuleViolations.reload();
              })
            );
          }
          setDeleteConfirmGameType(null);
        }}
      />
    </>
  );
}

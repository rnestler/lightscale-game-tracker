import { i18n } from '../i18n/text';
import { Fragment, useState, useEffect, type JSX, type ComponentProps } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { usePlayers } from '../hooks/usePlayers';
import { usePermissions, canReadField } from '../hooks/usePermissions';
import { textValue } from '../utils/recordValues';
import { PlayerDetailView } from './PlayerDetailView';
import { ConfirmDeleteDialog } from './ui/ConfirmDelete';
import { PlayerEditDialog } from './PlayerEditDialog';
import { runWithToast } from '../utils/errorHandling';
import type * as $Domain from '../types/domain';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SearchXIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from 'lucide-react';
import {
  getStoredHiddenColumns,
  isLastShownColumn,
  setStoredHiddenColumns,
} from '../api/pagination';
import { apiBaseUrl } from '../config/apiConfig';
import { useRuleViolations } from '../hooks/useRuleViolations';
import { RuleViolationMarker, RuleViolationsBanner } from './RuleViolationsNotice';
import { RecordChip } from '../components/ui/record-chip';
import { onNavigationTo } from '../utils/recordNavigation';
import { isOwnClick } from '../utils/ownClick';
import { useUsers } from '../hooks/useUsers';
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

export function PlayersList(_props: { onNavigate?: (view: string) => void }): JSX.Element {
  const { permissions } = usePermissions();
  const {
    players,
    isInitializing: playersInitializing,
    reloadPlayers,
    deletePlayer,
    isBusy: playersBusy,
    errorMessage: playersError,
    total: playersTotal,
    hasMore: playersHasMore,
    isLoadingMore: playersLoadingMore,
    loadMore: loadMorePlayers,
    loadAll: loadAllPlayers,
  } = usePlayers({ paged: true, pageSize: 24 });
  const { userLabel } = useUsers();
  const playersRuleViolations = useRuleViolations('players');
  const [playersRuleFilter, setPlayersRuleFilter] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = players.find((each) => each.id === selectedId) ?? null;
  const [pendingNavId, setPendingNavId] = useState<string | null>(null);
  useEffect(
    () =>
      onNavigationTo('players', (id) => {
        setPendingNavId(id);
      }),
    []
  );
  useEffect(() => {
    if (pendingNavId !== null && players.some((each) => each.id === pendingNavId)) {
      setSelectedId(pendingNavId);
      setPendingNavId(null);
    }
  }, [pendingNavId, players]);
  const [playersQuery, setPlayersQuery] = useState('');
  const playersSearchTerm = playersQuery.trim().toLowerCase();
  const playersMatches =
    playersSearchTerm === ''
      ? players
      : players.filter((each) =>
          [textValue(each.nickname), textValue(each.fullName), textValue(each.emailAddress)].some(
            (value) => value.toLowerCase().includes(playersSearchTerm)
          )
        );
  useEffect(() => {
    if (playersQuery !== '') {
      runWithToast(loadAllPlayers());
    }
  }, [playersQuery, loadAllPlayers]);
  const ruleFilteredPlayers = playersRuleFilter
    ? playersMatches.filter((row) => playersRuleViolations.rows.has(row.id))
    : playersMatches;
  const [playersSort, setPlayersSort] = useState<SortState>(null);
  const sortedPlayers =
    playersSort === null
      ? ruleFilteredPlayers
      : [...ruleFilteredPlayers].sort((a, b) => {
          const dir = playersSort.dir === 'asc' ? 1 : -1;
          switch (playersSort.key) {
            case 'nickname':
              return dir * String(a.nickname).localeCompare(String(b.nickname));
            case 'fullName':
              return dir * String(a.fullName).localeCompare(String(b.fullName));
            case 'joinedDate':
              return dir * String(a.joinedDate).localeCompare(String(b.joinedDate));
            case 'emailAddress':
              return dir * String(a.emailAddress).localeCompare(String(b.emailAddress));
            case 'userAccount':
              return dir * String(a.userAccountId).localeCompare(String(b.userAccountId));
            default:
              return 0;
          }
        });
  const [playersPage, setPlayersPage] = useState(0);
  const playersPageCount = Math.max(1, Math.ceil(sortedPlayers.length / 24));
  const playersPageSafe = Math.min(playersPage, playersPageCount - 1);
  const pagedPlayers = sortedPlayers.slice(playersPageSafe * 24, playersPageSafe * 24 + 24);
  const playersColumnKeys: readonly string[] = [
    'avatar',
    'nickname',
    'fullName',
    'joinedDate',
    'emailAddress',
    'userAccount',
  ];
  const playersReadableColumns: readonly boolean[] = [
    canReadField(permissions, 'players', 'avatar'),
    canReadField(permissions, 'players', 'nickname'),
    canReadField(permissions, 'players', 'fullName'),
    canReadField(permissions, 'players', 'joinedDate'),
    canReadField(permissions, 'players', 'emailAddress'),
    canReadField(permissions, 'players', 'userAccountId'),
  ];
  const [playersHiddenColumns, setPlayersHiddenColumns] = useState<Set<number>>(() =>
    getStoredHiddenColumns('players', playersColumnKeys, [4, 5])
  );
  function filterPlayersRuleViolations(only: boolean): void {
    if (only !== playersRuleFilter) {
      if (only) {
        loadAllPlayers()
          .then(() => {
            setPlayersPage(0);
            setPlayersRuleFilter(only);
          })
          .catch(() => {
            playersRuleViolations.reportUnavailable();
          });
      } else {
        setPlayersPage(0);
        setPlayersRuleFilter(only);
      }
    }
  }
  const [editingPlayers, setEditingPlayers] = useState<$Domain.Player | null>(null);
  const [editingSelected, setEditingSelected] = useState<$Domain.Player | null>(null);
  const [creatingPlayers, setCreatingPlayers] = useState<NonNullable<
    ComponentProps<typeof PlayerEditDialog>['defaults']
  > | null>(null);
  const [deleteConfirmPlayer, setDeleteConfirmPlayer] = useState<{
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
        <div className="flex flex-col gap-4 p-4 @md:p-8" data-ls="76860a865a">
          {!(permissions?.['players']?.read ?? false) ? (
            <div
              className="overflow-x-auto flex flex-col items-center p-12 rounded-xl border border-border bg-card shadow-sm"
              data-ls="21f182aaf7"
            >
              <span className="min-w-min text-muted-foreground" data-ls="498592f143">
                {i18n.chrome.noPermission}
              </span>
            </div>
          ) : null}
          {(permissions?.['players']?.read ?? false) ? (
            <Fragment>
              <div
                className="flex flex-row items-center gap-3 min-w-0 flex-wrap [&>*]:max-w-full py-1"
                data-ls="0bc8cb7c95"
              >
                {!(playersMatches.length < playersTotal) ? (
                  <Fragment>
                    {playersMatches.length === 1 ? (
                      <span
                        className="min-w-min text-sm text-muted-foreground shrink-0"
                        data-ls="0a2360f5a7"
                      >
                        {i18n.fill(
                          `{count} ${i18n.fill(i18n.chrome.countNoun, { name: i18n.word('Player') })}`,
                          { count: playersMatches.length }
                        )}
                      </span>
                    ) : null}
                    {!(playersMatches.length === 1) ? (
                      <span
                        className="min-w-min text-sm text-muted-foreground shrink-0"
                        data-ls="f93e77cf4d"
                      >
                        {i18n.fill(
                          `{count} ${i18n.fill(i18n.chrome.countNoun, { name: i18n.word('Player', 1) })}`,
                          { count: playersMatches.length }
                        )}
                      </span>
                    ) : null}
                  </Fragment>
                ) : null}
                {playersMatches.length < playersTotal ? (
                  <Fragment>
                    {playersTotal === 1 ? (
                      <span
                        className="min-w-min text-sm text-muted-foreground shrink-0"
                        data-ls="8cb40e2743"
                      >
                        {i18n.fill(
                          `${i18n.chrome.countOfTotal} ${i18n.fill(i18n.chrome.countNoun, { name: i18n.word('Player') })}`,
                          { shown: playersMatches.length, total: playersTotal }
                        )}
                      </span>
                    ) : null}
                    {!(playersTotal === 1) ? (
                      <span
                        className="min-w-min text-sm text-muted-foreground shrink-0"
                        data-ls="0ace02c124"
                      >
                        {i18n.fill(
                          `${i18n.chrome.countOfTotal} ${i18n.fill(i18n.chrome.countNoun, { name: i18n.word('Player', 1) })}`,
                          { shown: playersMatches.length, total: playersTotal }
                        )}
                      </span>
                    ) : null}
                  </Fragment>
                ) : null}
                <div className="flex-1" data-ls="e4870ddd8a" />
                <div className="relative min-w-[12rem] flex-1" data-ls="728a583fc1">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={playersQuery}
                    onChange={(event) => {
                      setPlayersQuery(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape' && playersQuery !== '') {
                        event.preventDefault();
                        setPlayersQuery('');
                      }
                    }}
                    placeholder={i18n.chrome.search}
                    aria-label={i18n.fill(i18n.chrome.searchLabel, { name: i18n.word('players') })}
                    className={`h-10 w-full rounded-md border pl-9 pr-9 text-sm transition-colors focus:border-primary focus:outline-none ${playersQuery === '' ? 'border-border bg-transparent' : 'border-primary bg-primary/5'}`}
                  />
                  {playersQuery !== '' && (
                    <button
                      type="button"
                      onClick={() => {
                        setPlayersQuery('');
                      }}
                      aria-label={i18n.chrome.clearSearch}
                      title={i18n.chrome.clearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {(permissions?.['players']?.create ?? false) && (
                  <button
                    type="button"
                    data-ls="a9e5e52677"
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    onClick={() => {
                      setCreatingPlayers({});
                    }}
                  >
                    <PlusIcon className="h-4 w-4" />
                    {i18n.fill(i18n.chrome.addItem, { name: i18n.word('Player') })}
                  </button>
                )}
              </div>
              {playersError !== null ? (
                <div
                  className="flex flex-col overflow-x-auto p-3 rounded-md border border-border bg-secondary"
                  data-ls="f499a18df1"
                >
                  <span className="min-w-min text-sm" data-ls="214c690f29">
                    {playersError}
                  </span>
                </div>
              ) : null}
              {playersInitializing ? <SkeletonCardGrid data-ls="b61a023348" /> : null}
              {playersTotal === 0 && !playersInitializing && !(playersError !== null) ? (
                <div
                  className="overflow-x-auto flex flex-col items-center gap-2 p-12 rounded-xl border border-border bg-card shadow-sm"
                  data-ls="9f59de559d"
                >
                  <UserIcon
                    className="shrink-0 h-8 w-8 text-muted-foreground"
                    data-ls="b6762fd6d0"
                  />
                  <span className="min-w-min text-base font-medium" data-ls="718bb78e57">
                    {i18n.fill(i18n.chrome.noEntriesTitle, { name: i18n.word('players') })}
                  </span>
                  {(permissions?.['players']?.create ?? false) ? (
                    <span className="min-w-min text-sm text-muted-foreground" data-ls="abae130867">
                      {i18n.fill(i18n.chrome.noEntriesGetStarted, { name: i18n.word('Player') })}
                    </span>
                  ) : null}
                  {(permissions?.['players']?.create ?? false) && (
                    <button
                      type="button"
                      data-ls="4375587474"
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                      onClick={() => {
                        setCreatingPlayers({});
                      }}
                    >
                      <PlusIcon className="h-4 w-4" />
                      {i18n.fill(i18n.chrome.addItem, { name: i18n.word('Player') })}
                    </button>
                  )}
                </div>
              ) : null}
              {playersMatches.length === 0 && !(playersTotal === 0) && playersBusy ? (
                <SkeletonCardGrid data-ls="f4be65fe99" />
              ) : null}
              {playersMatches.length === 0 && !(playersTotal === 0) && !playersBusy ? (
                <div
                  className="overflow-x-auto flex flex-col items-center gap-2 p-12 rounded-xl border border-border bg-card shadow-sm"
                  data-ls="212b85c413"
                >
                  <SearchXIcon
                    className="shrink-0 h-8 w-8 text-muted-foreground"
                    data-ls="e330ae1265"
                  />
                  <span className="min-w-min text-base font-medium" data-ls="305481eeb5">
                    {i18n.chrome.noMatches}
                  </span>
                  {(permissions?.['players']?.create ?? false) ? (
                    <span className="min-w-min text-sm text-muted-foreground" data-ls="09e73fe043">
                      {i18n.fill(i18n.chrome.noEntriesSearchCreate, { name: i18n.word('Player') })}
                    </span>
                  ) : null}
                  {!(permissions?.['players']?.create ?? false) ? (
                    <span className="min-w-min text-sm text-muted-foreground" data-ls="6e48cf8e6b">
                      {i18n.chrome.noEntriesSearch}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    data-ls="976bc577b1"
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    onClick={() => {
                      setPlayersQuery('');
                    }}
                  >
                    <RotateCcwIcon className="h-4 w-4" />
                    {i18n.chrome.showAll}
                  </button>
                </div>
              ) : null}
              {playersMatches.length > 0 ? (
                <div
                  className="ui-table-surface flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                  data-ls="4a85cf3312"
                >
                  <div className="flex flex-col gap-2">
                    <RuleViolationsBanner
                      collection="players"
                      violations={playersRuleViolations}
                      filtering={playersRuleFilter}
                      onFilter={filterPlayersRuleViolations}
                    />
                    <div className="min-w-0 overflow-auto">
                      <table className="ui-table w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            {playersRuleViolations.rows.size > 0 && (
                              <th scope="col" className="w-6 pl-4 pr-0 py-2.5" />
                            )}
                            {!playersHiddenColumns.has(0) &&
                              canReadField(permissions, 'players', 'avatar') && (
                                <th
                                  scope="col"
                                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                                >
                                  {'Avatar'}
                                </th>
                              )}
                            {!playersHiddenColumns.has(1) &&
                              canReadField(permissions, 'players', 'nickname') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    playersSort?.key === 'nickname'
                                      ? playersSort.dir === 'asc'
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
                                      runWithToast(loadAllPlayers());
                                      setPlayersSort(cycleSort(playersSort, 'nickname'));
                                    }}
                                  >
                                    {'Nickname / Handle'}
                                    <span aria-hidden="true">
                                      {playersSort?.key === 'nickname'
                                        ? playersSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!playersHiddenColumns.has(2) &&
                              canReadField(permissions, 'players', 'fullName') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    playersSort?.key === 'fullName'
                                      ? playersSort.dir === 'asc'
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
                                      runWithToast(loadAllPlayers());
                                      setPlayersSort(cycleSort(playersSort, 'fullName'));
                                    }}
                                  >
                                    {'Full Name'}
                                    <span aria-hidden="true">
                                      {playersSort?.key === 'fullName'
                                        ? playersSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!playersHiddenColumns.has(3) &&
                              canReadField(permissions, 'players', 'joinedDate') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    playersSort?.key === 'joinedDate'
                                      ? playersSort.dir === 'asc'
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
                                      runWithToast(loadAllPlayers());
                                      setPlayersSort(cycleSort(playersSort, 'joinedDate'));
                                    }}
                                  >
                                    {'Member Since'}
                                    <span aria-hidden="true">
                                      {playersSort?.key === 'joinedDate'
                                        ? playersSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!playersHiddenColumns.has(4) &&
                              canReadField(permissions, 'players', 'emailAddress') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    playersSort?.key === 'emailAddress'
                                      ? playersSort.dir === 'asc'
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
                                      runWithToast(loadAllPlayers());
                                      setPlayersSort(cycleSort(playersSort, 'emailAddress'));
                                    }}
                                  >
                                    {i18n.word('Player.emailAddress')}
                                    <span aria-hidden="true">
                                      {playersSort?.key === 'emailAddress'
                                        ? playersSort.dir === 'asc'
                                          ? ' \u25b2'
                                          : ' \u25bc'
                                        : ''}
                                    </span>
                                  </button>
                                </th>
                              )}
                            {!playersHiddenColumns.has(5) &&
                              canReadField(permissions, 'players', 'userAccountId') && (
                                <th
                                  scope="col"
                                  aria-sort={
                                    playersSort?.key === 'userAccount'
                                      ? playersSort.dir === 'asc'
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
                                      runWithToast(loadAllPlayers());
                                      setPlayersSort(cycleSort(playersSort, 'userAccount'));
                                    }}
                                  >
                                    {i18n.word('Player.userAccount')}
                                    <span aria-hidden="true">
                                      {playersSort?.key === 'userAccount'
                                        ? playersSort.dir === 'asc'
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
                                      {canReadField(permissions, 'players', 'avatar') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!playersHiddenColumns.has(0)}
                                            disabled={isLastShownColumn(
                                              playersHiddenColumns,
                                              playersReadableColumns,
                                              0
                                            )}
                                            onChange={() => {
                                              const next = new Set(playersHiddenColumns);
                                              if (next.has(0)) {
                                                next.delete(0);
                                              } else {
                                                next.add(0);
                                              }
                                              setStoredHiddenColumns(
                                                'players',
                                                playersColumnKeys,
                                                next
                                              );
                                              setPlayersHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Avatar'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'players', 'nickname') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!playersHiddenColumns.has(1)}
                                            disabled={isLastShownColumn(
                                              playersHiddenColumns,
                                              playersReadableColumns,
                                              1
                                            )}
                                            onChange={() => {
                                              const next = new Set(playersHiddenColumns);
                                              if (next.has(1)) {
                                                next.delete(1);
                                              } else {
                                                next.add(1);
                                              }
                                              setStoredHiddenColumns(
                                                'players',
                                                playersColumnKeys,
                                                next
                                              );
                                              setPlayersHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Nickname / Handle'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'players', 'fullName') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!playersHiddenColumns.has(2)}
                                            disabled={isLastShownColumn(
                                              playersHiddenColumns,
                                              playersReadableColumns,
                                              2
                                            )}
                                            onChange={() => {
                                              const next = new Set(playersHiddenColumns);
                                              if (next.has(2)) {
                                                next.delete(2);
                                              } else {
                                                next.add(2);
                                              }
                                              setStoredHiddenColumns(
                                                'players',
                                                playersColumnKeys,
                                                next
                                              );
                                              setPlayersHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Full Name'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'players', 'joinedDate') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!playersHiddenColumns.has(3)}
                                            disabled={isLastShownColumn(
                                              playersHiddenColumns,
                                              playersReadableColumns,
                                              3
                                            )}
                                            onChange={() => {
                                              const next = new Set(playersHiddenColumns);
                                              if (next.has(3)) {
                                                next.delete(3);
                                              } else {
                                                next.add(3);
                                              }
                                              setStoredHiddenColumns(
                                                'players',
                                                playersColumnKeys,
                                                next
                                              );
                                              setPlayersHiddenColumns(next);
                                            }}
                                          />
                                          <span>{'Member Since'}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'players', 'emailAddress') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!playersHiddenColumns.has(4)}
                                            disabled={isLastShownColumn(
                                              playersHiddenColumns,
                                              playersReadableColumns,
                                              4
                                            )}
                                            onChange={() => {
                                              const next = new Set(playersHiddenColumns);
                                              if (next.has(4)) {
                                                next.delete(4);
                                              } else {
                                                next.add(4);
                                              }
                                              setStoredHiddenColumns(
                                                'players',
                                                playersColumnKeys,
                                                next
                                              );
                                              setPlayersHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('Player.emailAddress')}</span>
                                        </label>
                                      )}
                                      {canReadField(permissions, 'players', 'userAccountId') && (
                                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-secondary">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                            checked={!playersHiddenColumns.has(5)}
                                            disabled={isLastShownColumn(
                                              playersHiddenColumns,
                                              playersReadableColumns,
                                              5
                                            )}
                                            onChange={() => {
                                              const next = new Set(playersHiddenColumns);
                                              if (next.has(5)) {
                                                next.delete(5);
                                              } else {
                                                next.add(5);
                                              }
                                              setStoredHiddenColumns(
                                                'players',
                                                playersColumnKeys,
                                                next
                                              );
                                              setPlayersHiddenColumns(next);
                                            }}
                                          />
                                          <span>{i18n.word('Player.userAccount')}</span>
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
                          {pagedPlayers.length === 0 && (
                            <tr>
                              <td
                                colSpan={8}
                                className="px-4 py-8 text-center text-muted-foreground"
                                role="status"
                              >
                                {players.length === 0
                                  ? i18n.chrome.noDataYet
                                  : i18n.chrome.noMatches}
                              </td>
                            </tr>
                          )}
                          {pagedPlayers.map((item) => (
                            <tr
                              key={item.id}
                              onClick={(clickEvent) => {
                                if (isOwnClick(clickEvent)) {
                                  setSelectedId(item.id);
                                }
                              }}
                              className="group/row border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                            >
                              {playersRuleViolations.rows.size > 0 && (
                                <td className="w-6 pl-4 pr-0 py-3 align-middle">
                                  <RuleViolationMarker
                                    groups={playersRuleViolations.rows.get(item.id) ?? []}
                                  />
                                </td>
                              )}
                              {!playersHiddenColumns.has(0) &&
                                canReadField(permissions, 'players', 'avatar') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Avatar'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {item.avatar &&
                                        (item.avatar.mimeType.startsWith('image/') ? (
                                          <img
                                            src={`${apiBaseUrl}/api/files/${item.avatar.id}/download?v=${encodeURIComponent(item.avatar.fileName)}`}
                                            alt={item.avatar.fileName}
                                            loading="lazy"
                                            className="h-10 w-10 rounded-md object-cover"
                                          />
                                        ) : (
                                          <a
                                            href={`${apiBaseUrl}/api/files/${item.avatar.id}/download?v=${encodeURIComponent(item.avatar.fileName)}`}
                                            download
                                            className="min-w-min text-sm"
                                            data-ls="cfff4c4350"
                                          >
                                            {item.avatar.fileName}
                                          </a>
                                        ))}
                                    </div>
                                  </td>
                                )}
                              {!playersHiddenColumns.has(1) &&
                                canReadField(permissions, 'players', 'nickname') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Nickname / Handle'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <RecordChip
                                        label={String(item.nickname)}
                                        icon={<UserIcon className="h-3.5 w-3.5" />}
                                        className="min-w-min text-sm"
                                        data-ls="9a4d95366f"
                                      />
                                    </div>
                                  </td>
                                )}
                              {!playersHiddenColumns.has(2) &&
                                canReadField(permissions, 'players', 'fullName') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Full Name'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span className="min-w-min text-sm" data-ls="1d88fb694a">
                                        {item.fullName}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!playersHiddenColumns.has(3) &&
                                canReadField(permissions, 'players', 'joinedDate') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={'Member Since'}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      <span
                                        className="shrink-0 whitespace-nowrap text-sm"
                                        data-ls="65e6a2c91a"
                                      >
                                        {item.joinedDate
                                          ? new Date(
                                              `${item.joinedDate}T00:00:00`
                                            ).toLocaleDateString(i18n.locale)
                                          : ''}
                                      </span>
                                    </div>
                                  </td>
                                )}
                              {!playersHiddenColumns.has(4) &&
                                canReadField(permissions, 'players', 'emailAddress') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word('Player.emailAddress')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {item.emailAddress && (
                                        <a
                                          href={`mailto:${item.emailAddress}`}
                                          className="min-w-0 break-all text-sm"
                                          data-ls="dfb2747e9c"
                                        >
                                          {item.emailAddress}
                                        </a>
                                      )}
                                    </div>
                                  </td>
                                )}
                              {!playersHiddenColumns.has(5) &&
                                canReadField(permissions, 'players', 'userAccountId') && (
                                  <td
                                    className="px-4 py-3 align-middle whitespace-nowrap"
                                    data-label={i18n.word('Player.userAccount')}
                                  >
                                    <div className="ui-cell max-w-xs truncate">
                                      {item.userAccountId ? (
                                        <RecordChip
                                          label={userLabel(item.userAccountId)}
                                          initials
                                          className="min-w-min text-sm"
                                          data-ls="b815586719"
                                        />
                                      ) : null}
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
                                  {(permissions?.['players']?.update ?? false) && (
                                    <button
                                      type="button"
                                      aria-label={i18n.chrome.edit}
                                      onClick={(clickEvent) => {
                                        clickEvent.stopPropagation();
                                        setEditingPlayers(item);
                                      }}
                                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                    >
                                      <PencilIcon className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {(permissions?.['players']?.delete ?? false) && (
                                    <button
                                      type="button"
                                      aria-label={i18n.chrome.delete}
                                      onClick={(clickEvent) => {
                                        clickEvent.stopPropagation();
                                        runWithToast(
                                          deletePlayer(item.id).then(() => {
                                            playersRuleViolations.reload();
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
                      {(playersPageCount > 1 || playersHasMore) && (
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border text-sm text-muted-foreground print:hidden">
                          <span>
                            {i18n.fill(i18n.chrome.pageIndicator, {
                              page: playersPageSafe + 1,
                              count: playersPageCount,
                            })}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={i18n.chrome.previousPage}
                              onClick={() => {
                                setPlayersPage(Math.max(0, playersPageSafe - 1));
                              }}
                              disabled={playersPageSafe <= 0}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 transition-colors"
                            >
                              <ChevronLeftIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={i18n.chrome.nextPage}
                              onClick={() => {
                                if (playersPageSafe >= playersPageCount - 1 && playersHasMore) {
                                  runWithToast(
                                    loadMorePlayers().then(() => {
                                      setPlayersPage(playersPageSafe + 1);
                                    })
                                  );
                                } else {
                                  setPlayersPage(
                                    Math.min(playersPageCount - 1, playersPageSafe + 1)
                                  );
                                }
                              }}
                              disabled={
                                playersLoadingMore ||
                                (playersPageSafe >= playersPageCount - 1 && !playersHasMore)
                              }
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 transition-colors"
                            >
                              <ChevronRightIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <PlayerEditDialog
                      open={editingPlayers !== null}
                      editing={editingPlayers}
                      isBusy={false}
                      onSaved={() => {
                        playersRuleViolations.reload();
                      }}
                      onClose={() => {
                        setEditingPlayers(null);
                      }}
                    />
                  </div>
                </div>
              ) : null}
              {selected ? (
                <PlayerDetailView
                  player={selected}
                  open
                  onEdit={
                    (permissions?.['players']?.update ?? false)
                      ? (record: $Domain.Player): void => {
                          setEditingSelected(record);
                        }
                      : undefined
                  }
                  onDelete={
                    (permissions?.['players']?.delete ?? false)
                      ? (id: string): void => {
                          setDeleteConfirmPlayer({
                            id,
                            label: String(selected.nickname).trim() || 'Player',
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
      <PlayerEditDialog
        open={editingSelected !== null}
        editing={editingSelected}
        isBusy={false}
        onSaved={() => {
          playersRuleViolations.reload();
        }}
        onClose={() => {
          setEditingSelected(null);
          runWithToast(reloadPlayers());
        }}
      />
      <PlayerEditDialog
        open={creatingPlayers !== null}
        editing={null}
        isBusy={false}
        defaults={creatingPlayers ?? {}}
        onSaved={() => {
          playersRuleViolations.reload();
        }}
        onClose={() => {
          setCreatingPlayers(null);
          runWithToast(reloadPlayers());
        }}
      />
      <ConfirmDeleteDialog
        open={deleteConfirmPlayer !== null}
        title={i18n.fill(i18n.chrome.deleteTitle, { name: i18n.word('Player') })}
        description={i18n.fill(i18n.chrome.deleteConfirm, {
          item: deleteConfirmPlayer?.label ?? '',
        })}
        cancelLabel={i18n.chrome.cancel}
        deleteLabel={i18n.chrome.delete}
        onCancel={() => {
          setDeleteConfirmPlayer(null);
        }}
        onConfirm={() => {
          if (deleteConfirmPlayer !== null) {
            runWithToast(
              deletePlayer(deleteConfirmPlayer.id).then(() => {
                playersRuleViolations.reload();
              })
            );
          }
          setDeleteConfirmPlayer(null);
        }}
      />
    </>
  );
}

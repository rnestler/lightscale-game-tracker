import { i18n } from '../i18n/text';
import { useState, useEffect, type JSX } from 'react';
import { BarChart, Bar, Cell, LabelList, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '../components/ui/chart';
import { useGames } from '../hooks/useGames';
import { useLeaderboards } from '../hooks/useLeaderboards';
import { useMatches } from '../hooks/useMatches';
import { usePlayers } from '../hooks/usePlayers';
import { GameTypeDetailView } from './GameTypeDetailView';
import { LeaderboardEntryDetailView } from './LeaderboardEntryDetailView';
import { MatchDetailView } from './MatchDetailView';
import { PlayerDetailView } from './PlayerDetailView';
import { runWithToast } from '../utils/errorHandling';
import { ErrorMessage } from './ui/error-message';
import { DicesIcon, SwordsIcon, TrophyIcon, UserIcon } from 'lucide-react';
import { MetricValue } from '../components/ui/MetricValue';
import { LinkSurface } from '../components/ui/link-surface';
import { RecordChip } from '../components/ui/record-chip';
import { canReachPage, navigateToPage } from '../utils/recordNavigation';
import { isOwnClick } from '../utils/ownClick';
import { SelectCards } from './ui/card-select';
import { Skeleton } from './ui/skeleton';
import { useAuth } from '../hooks/useAuth';

const chartSwatches = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
  'var(--series-8)',
  'var(--series-9)',
  'var(--series-10)',
];

function chartSwatch(index: number): string {
  return chartSwatches[index % chartSwatches.length] ?? 'var(--series-1)';
}

function chartCategories<T extends { name: string }>(
  rows: T[],
  order: readonly string[],
  labels: Record<string, string>,
  colors: Record<string, string>
): Array<T & { color: string }> {
  const ordered =
    order.length === 0
      ? rows
      : [...rows].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  return ordered.map((row, index) => ({
    ...row,
    name: labels[row.name] ?? row.name,
    color: colors[row.name] ?? chartSwatch(index),
  }));
}

function chartValueLabel(value: unknown): string {
  return typeof value === 'number'
    ? new Intl.NumberFormat(i18n.locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
        value
      )
    : typeof value === 'string'
      ? value
      : '';
}

function chartGroupCount<T>(
  items: readonly T[],
  key: (item: T) => string
): Array<{ name: string; value: number }> {
  const groups = new Map<string, number>();
  for (const item of items) {
    const name = key(item);
    groups.set(name, (groups.get(name) ?? 0) + 1);
  }
  return Array.from(groups.entries()).map(([name, total]) => ({ name, value: total }));
}

function chartLaneData<T>(
  axis: readonly string[] | null,
  lanes: readonly string[],
  items: readonly T[],
  xKey: (item: T) => string,
  laneKey: (item: T) => string,
  value: ((item: T) => number) | null,
  reduce: string,
  fill: number | null,
  sortAxis: boolean
): Array<Record<string, string | number | null>> {
  const cells = new Map<string, { sum: number; count: number; min: number; max: number }>();
  const discovered: string[] = [];
  for (const item of items) {
    const name = xKey(item);
    if (axis === null && !discovered.includes(name)) {
      discovered.push(name);
    }
    const cellKey = `${name}\u0000${laneKey(item)}`;
    const amount = value === null ? 0 : value(item);
    const cell = cells.get(cellKey) ?? { sum: 0, count: 0, min: Infinity, max: -Infinity };
    cell.sum += amount;
    cell.count += 1;
    cell.min = Math.min(cell.min, amount);
    cell.max = Math.max(cell.max, amount);
    cells.set(cellKey, cell);
  }
  const names =
    axis !== null
      ? [...axis]
      : sortAxis
        ? discovered.sort((a, b) => a.localeCompare(b))
        : discovered;
  return names.map((name) => {
    const row: Record<string, string | number | null> = { name };
    for (const lane of lanes) {
      const cell = cells.get(`${name}\u0000${lane}`);
      if (cell === undefined) {
        row[lane] = fill;
      } else if (reduce === 'any') {
        row[lane] = 1;
      } else if (reduce === 'count') {
        row[lane] = cell.count;
      } else if (reduce === 'average') {
        row[lane] = cell.sum / cell.count;
      } else if (reduce === 'min') {
        row[lane] = cell.min;
      } else if (reduce === 'max') {
        row[lane] = cell.max;
      } else {
        row[lane] = cell.sum;
      }
    }
    return row;
  });
}

export function DashboardPanel({
  onNavigate,
}: {
  onNavigate?: (view: string) => void;
}): JSX.Element {
  const {
    games,
    isInitializing: gamesInitializing,
    reloadGames,
    errorMessage: gamesError,
    total: gamesTotal,
  } = useGames({ paged: true, pageSize: 5 });
  const { games: gamesComplete, errorMessage: gamesCompleteError } = useGames();
  const {
    leaderboards,
    isInitializing: leaderboardsInitializing,
    reloadLeaderboards,
    errorMessage: leaderboardsError,
    total: leaderboardsTotal,
  } = useLeaderboards({ paged: true, pageSize: 5 });
  const { leaderboards: leaderboardsComplete, errorMessage: leaderboardsCompleteError } =
    useLeaderboards();
  const {
    matches,
    isInitializing: matchesInitializing,
    reloadMatches,
    errorMessage: matchesError,
    total: matchesTotal,
  } = useMatches({
    paged: true,
    pageSize: 5,
    sort: [{ field: 'createdAt', direction: 'descending' }],
  });
  const { matches: matchesComplete, errorMessage: matchesCompleteError } = useMatches();
  const {
    players,
    isInitializing: playersInitializing,
    reloadPlayers,
    errorMessage: playersError,
    total: playersTotal,
  } = usePlayers({ paged: true, pageSize: 5 });
  const { players: playersComplete, errorMessage: playersCompleteError } = usePlayers();
  const gamesFailure = gamesError ?? gamesCompleteError;
  const leaderboardsFailure = leaderboardsError ?? leaderboardsCompleteError;
  const matchesFailure = matchesError ?? matchesCompleteError;
  const playersFailure = playersError ?? playersCompleteError;
  const viewerAccountUser = useAuth().user;
  const viewerName = viewerAccountUser?.name ?? viewerAccountUser?.email ?? '';
  const refreshWidget = (): void => {
    runWithToast(reloadGames());
    runWithToast(reloadLeaderboards());
    runWithToast(reloadMatches());
    runWithToast(reloadPlayers());
  };
  const [selectedGamesId, setSelectedGamesId] = useState<string | null>(null);
  const selectedGames = games.find((each) => each.id === selectedGamesId) ?? null;
  const [selectedPlayersId, setSelectedPlayersId] = useState<string | null>(null);
  const selectedPlayers = players.find((each) => each.id === selectedPlayersId) ?? null;
  const [selectedMatchesId, setSelectedMatchesId] = useState<string | null>(null);
  const selectedMatches = matches.find((each) => each.id === selectedMatchesId) ?? null;
  const [selectedLeaderboardsId, setSelectedLeaderboardsId] = useState<string | null>(null);
  const selectedLeaderboards =
    leaderboards.find((each) => each.id === selectedLeaderboardsId) ?? null;
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => {
    const handle = setInterval(() => {
      setClockNow(new Date());
    }, 1000);
    return (): void => {
      clearInterval(handle);
    };
  }, []);
  const clock = {
    time: clockNow.toLocaleTimeString(i18n.locale),
    date: clockNow.toLocaleDateString(i18n.locale),
    hour: clockNow.getHours(),
    running: true,
  };
  if (gamesInitializing || leaderboardsInitializing || matchesInitializing || playersInitializing) {
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
      {gamesFailure !== null && <ErrorMessage message={gamesFailure} />}
      {leaderboardsFailure !== null && <ErrorMessage message={leaderboardsFailure} />}
      {matchesFailure !== null && <ErrorMessage message={matchesFailure} />}
      {playersFailure !== null && <ErrorMessage message={playersFailure} />}
      <div
        className="@container flex flex-col h-full min-h-0 min-w-0 overflow-auto"
        aria-label={i18n.chrome.dashboard}
        data-ls="812d4b567f"
      >
        <div className="@container flex flex-col gap-6 p-4 @md:p-8">
          <div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-row min-w-0 flex-wrap [&>*]:max-w-full">
                {clock.hour < 12 ? (
                  <span className="min-w-min text-2xl font-semibold tracking-tight">
                    {i18n.chrome.greetingMorning}
                  </span>
                ) : null}
                {clock.hour >= 12 && clock.hour < 18 ? (
                  <span className="min-w-min text-2xl font-semibold tracking-tight">
                    {i18n.chrome.greetingAfternoon}
                  </span>
                ) : null}
                {clock.hour >= 18 ? (
                  <span className="min-w-min text-2xl font-semibold tracking-tight">
                    {i18n.chrome.greetingEvening}
                  </span>
                ) : null}
                <span className="min-w-min text-2xl font-semibold tracking-tight">
                  {i18n.fill(', {name}', { name: viewerName })}
                </span>
              </div>
              <span className="min-w-min text-sm text-muted-foreground">
                {i18n.fill('GameRank Tracker · {date}', { date: clock.date })}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 @max-md:grid-cols-2">
            <LinkSurface
              isAvailable={() => canReachPage('games', onNavigate !== undefined)}
              onActivate={() => {
                navigateToPage('games', onNavigate);
              }}
              signInTo={() => '/app'}
              keepsContent
              className="grid w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="@container overflow-x-auto flex flex-col rounded-xl border border-border bg-card shadow-sm p-4 gap-1 min-w-[10rem]">
                <div className="flex flex-row items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground truncate min-w-0">
                    {i18n.word('games')}
                  </span>
                  <div className="flex flex-row items-center justify-center h-8 w-8 shrink-0 rounded-md bg-primary/10">
                    <DicesIcon className="shrink-0 h-4 w-4 text-primary" />
                  </div>
                </div>
                <MetricValue
                  className="shrink-0 whitespace-nowrap text-[length:clamp(1.5rem,calc((100cqi_-_2rem)/var(--metric-length,12)_*_1.7),2.25rem)] leading-tight font-semibold tracking-tight tabular-nums"
                  value={gamesTotal.toLocaleString(i18n.locale)}
                  raw={Number(gamesTotal)}
                  format={{ kind: 'number', locale: i18n.locale }}
                />
              </div>
            </LinkSurface>
            <LinkSurface
              isAvailable={() => canReachPage('players', onNavigate !== undefined)}
              onActivate={() => {
                navigateToPage('players', onNavigate);
              }}
              signInTo={() => '/app'}
              keepsContent
              className="grid w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="@container overflow-x-auto flex flex-col rounded-xl border border-border bg-card shadow-sm p-4 gap-1 min-w-[10rem]">
                <div className="flex flex-row items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground truncate min-w-0">
                    {i18n.word('players')}
                  </span>
                  <div className="flex flex-row items-center justify-center h-8 w-8 shrink-0 rounded-md bg-primary/10">
                    <UserIcon className="shrink-0 h-4 w-4 text-primary" />
                  </div>
                </div>
                <MetricValue
                  className="shrink-0 whitespace-nowrap text-[length:clamp(1.5rem,calc((100cqi_-_2rem)/var(--metric-length,12)_*_1.7),2.25rem)] leading-tight font-semibold tracking-tight tabular-nums"
                  value={playersTotal.toLocaleString(i18n.locale)}
                  raw={Number(playersTotal)}
                  format={{ kind: 'number', locale: i18n.locale }}
                />
              </div>
            </LinkSurface>
            <LinkSurface
              isAvailable={() => canReachPage('matches', onNavigate !== undefined)}
              onActivate={() => {
                navigateToPage('matches', onNavigate);
              }}
              signInTo={() => '/app'}
              keepsContent
              className="grid w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="@container overflow-x-auto flex flex-col rounded-xl border border-border bg-card shadow-sm p-4 gap-1 min-w-[10rem]">
                <div className="flex flex-row items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground truncate min-w-0">
                    {i18n.word('matches')}
                  </span>
                  <div className="flex flex-row items-center justify-center h-8 w-8 shrink-0 rounded-md bg-primary/10">
                    <SwordsIcon className="shrink-0 h-4 w-4 text-primary" />
                  </div>
                </div>
                <MetricValue
                  className="shrink-0 whitespace-nowrap text-[length:clamp(1.5rem,calc((100cqi_-_2rem)/var(--metric-length,12)_*_1.7),2.25rem)] leading-tight font-semibold tracking-tight tabular-nums"
                  value={matchesTotal.toLocaleString(i18n.locale)}
                  raw={Number(matchesTotal)}
                  format={{ kind: 'number', locale: i18n.locale }}
                />
              </div>
            </LinkSurface>
            <LinkSurface
              isAvailable={() => canReachPage('leaderboards', onNavigate !== undefined)}
              onActivate={() => {
                navigateToPage('leaderboards', onNavigate);
              }}
              signInTo={() => '/app'}
              keepsContent
              className="grid w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="@container overflow-x-auto flex flex-col rounded-xl border border-border bg-card shadow-sm p-4 gap-1 min-w-[10rem]">
                <div className="flex flex-row items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground truncate min-w-0">
                    {i18n.word('leaderboards')}
                  </span>
                  <div className="flex flex-row items-center justify-center h-8 w-8 shrink-0 rounded-md bg-primary/10">
                    <TrophyIcon className="shrink-0 h-4 w-4 text-primary" />
                  </div>
                </div>
                <MetricValue
                  className="shrink-0 whitespace-nowrap text-[length:clamp(1.5rem,calc((100cqi_-_2rem)/var(--metric-length,12)_*_1.7),2.25rem)] leading-tight font-semibold tracking-tight tabular-nums"
                  value={leaderboardsTotal.toLocaleString(i18n.locale)}
                  raw={Number(leaderboardsTotal)}
                  format={{ kind: 'number', locale: i18n.locale }}
                />
              </div>
            </LinkSurface>
          </div>
          <div className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-4">
            <div className="overflow-x-auto flex flex-col gap-3 rounded-xl border border-border bg-card shadow-sm p-4">
              <span className="min-w-min text-sm font-semibold">{i18n.word('MatchesByGame')}</span>
              {((): JSX.Element => {
                const chartRows = chartGroupCount(matchesComplete, (item) =>
                  String(item.gameDisplayName)
                );
                if (
                  !chartRows.some((row) =>
                    Object.values(row).some((value) => typeof value === 'number')
                  )
                ) {
                  return (
                    <div
                      role="status"
                      className="flex min-h-32 items-center justify-center p-6 text-sm text-muted-foreground"
                    >
                      {i18n.chrome.noDataYet}
                    </div>
                  );
                }
                return (
                  <>
                    <ChartContainer
                      config={{
                        value: { label: i18n.word('MatchesByGame'), color: 'var(--series-1)' },
                      }}
                      className="aspect-auto h-[280px] min-h-[280px] w-full bg-card"
                    >
                      {((): JSX.Element => {
                        const chartData = chartCategories(chartRows, [], {}, {});
                        return (
                          <BarChart
                            data={chartData}
                            margin={{ top: 20, right: 16, left: 0, bottom: 4 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="color-mix(in oklch, var(--border), transparent 50%)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                              stroke="var(--border)"
                              tickLine={false}
                            />
                            <YAxis
                              width="auto"
                              tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                              stroke="var(--border)"
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={chartValueLabel}
                              allowDecimals={false}
                            />
                            <ChartTooltip
                              cursor={false}
                              content={
                                <ChartTooltipContent
                                  colorKey="color"
                                  formatValue={chartValueLabel}
                                />
                              }
                            />
                            <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]}>
                              {chartData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                              <LabelList
                                dataKey="value"
                                position="top"
                                offset={6}
                                className="fill-foreground"
                                fontSize={11}
                                formatter={chartValueLabel}
                              />
                            </Bar>
                          </BarChart>
                        );
                      })()}
                    </ChartContainer>
                  </>
                );
              })()}
            </div>
            <div className="overflow-x-auto flex flex-col gap-3 rounded-xl border border-border bg-card shadow-sm p-4">
              <span className="min-w-min text-sm font-semibold">
                {i18n.word('TopPlayerRatings')}
              </span>
              {((): JSX.Element => {
                const laneKeys = gamesComplete
                  .map((entity) => String(String(entity.name).trim() || 'GameType'))
                  .sort((a, b) => a.localeCompare(b));
                const chartRows = chartLaneData(
                  null,
                  laneKeys,
                  leaderboardsComplete,
                  (item) => {
                    const resolvedPlayer = playersComplete.find(
                      (entity) => entity.id === item.playerId
                    );
                    return String(String(resolvedPlayer?.nickname ?? '').trim() || 'Player');
                  },
                  (item) => {
                    const laneRecord = gamesComplete.find((entity) => entity.id === item.gameId);
                    return laneRecord === undefined
                      ? ''
                      : String(String(laneRecord.name).trim() || 'GameType');
                  },
                  (item) => item.rating,
                  'max',
                  null,
                  false
                );
                if (
                  !chartRows.some((row) =>
                    Object.values(row).some((value) => typeof value === 'number')
                  )
                ) {
                  return (
                    <div
                      role="status"
                      className="flex min-h-32 items-center justify-center p-6 text-sm text-muted-foreground"
                    >
                      {i18n.chrome.noDataYet}
                    </div>
                  );
                }
                return (
                  <>
                    {((): JSX.Element => {
                      const lanedRows = chartRows;
                      const shownLanes = laneKeys.filter((lane) =>
                        lanedRows.some((row) => typeof row[lane] === 'number' && row[lane] !== 0)
                      );
                      const laneColors: Record<string, string> = {};
                      const laneLabels: Record<string, string> = {};
                      const laneColorOf = (lane: string, index: number): string =>
                        laneColors[lane] ?? chartSwatch(index);
                      const laneConfig = Object.fromEntries(
                        shownLanes.map((lane, index) => [
                          lane,
                          { label: laneLabels[lane] ?? lane, color: laneColorOf(lane, index) },
                        ])
                      );
                      return (
                        <ChartContainer
                          config={laneConfig}
                          className="aspect-auto h-[280px] min-h-[280px] w-full bg-card"
                        >
                          <BarChart
                            data={lanedRows}
                            margin={{ top: 20, right: 16, left: 0, bottom: 4 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="color-mix(in oklch, var(--border), transparent 50%)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                              stroke="var(--border)"
                              tickLine={false}
                            />
                            <YAxis
                              width="auto"
                              tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                              stroke="var(--border)"
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={chartValueLabel}
                            />
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent formatValue={chartValueLabel} />}
                            />
                            {shownLanes.map((lane, index) => (
                              <Bar
                                key={lane}
                                dataKey={lane}
                                fill={laneColorOf(lane, index)}
                                radius={[6, 6, 0, 0]}
                              />
                            ))}
                            <ChartLegend content={<ChartLegendContent />} />
                          </BarChart>
                        </ChartContainer>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
          </div>
          <div className="grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,30rem),1fr))] gap-4">
            {gamesTotal > 0 ? (
              <SelectCards
                selectedId={selectedGames?.id ?? null}
                onSelect={setSelectedGamesId}
                className="overflow-x-auto flex flex-col gap-3 rounded-xl border border-border bg-card shadow-sm p-4"
              >
                <div className="flex flex-row items-center justify-between gap-2">
                  <span className="min-w-min text-sm font-semibold">{i18n.word('games')}</span>
                  <LinkSurface
                    isAvailable={() => canReachPage('games', onNavigate !== undefined)}
                    onActivate={() => {
                      navigateToPage('games', onNavigate);
                    }}
                    signInTo={() => '/app'}
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 gap-1 text-primary-text underline-offset-4 hover:underline"
                  >
                    {i18n.chrome.viewAll}
                    <span aria-hidden="true"> ›</span>
                  </LinkSurface>
                </div>
                <div className="min-w-0 overflow-auto">
                  <table className="ui-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th
                          scope="col"
                          className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {i18n.word('GameType.name')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {i18n.word('GameType.category')}
                        </th>
                        <th
                          scope="col"
                          className="w-px px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        ></th>
                      </tr>
                    </thead>
                    <tbody>
                      {games.slice(0, 5).length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-8 text-center text-muted-foreground"
                            role="status"
                          >
                            {i18n.chrome.noDataYet}
                          </td>
                        </tr>
                      )}
                      {games.slice(0, 5).map((item) => (
                        <tr
                          key={item.id}
                          onClick={(clickEvent) => {
                            if (isOwnClick(clickEvent)) {
                              setSelectedGamesId(item.id);
                            }
                          }}
                          className="group/row border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <td
                            className="px-4 py-3 align-middle whitespace-nowrap"
                            data-label={i18n.word('GameType.name')}
                          >
                            <div className="ui-cell max-w-xs truncate">
                              <span className="min-w-min text-sm">{item.name}</span>
                            </div>
                          </td>
                          <td
                            className="px-4 py-3 align-middle whitespace-nowrap"
                            data-label={i18n.word('GameType.category')}
                          >
                            <div className="ui-cell max-w-xs truncate">
                              {item.category && (
                                <span
                                  className={`inline-flex self-start items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${item.category === 'chess' ? 'bg-[color-mix(in_oklch,var(--series-1)_12%,transparent)] text-[color-mix(in_oklch,var(--series-1)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-1)_28%,transparent)]' : item.category === 'billiards' ? 'bg-[color-mix(in_oklch,var(--series-2)_12%,transparent)] text-[color-mix(in_oklch,var(--series-2)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-2)_28%,transparent)]' : item.category === 'tableTennis' ? 'bg-[color-mix(in_oklch,var(--series-3)_12%,transparent)] text-[color-mix(in_oklch,var(--series-3)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-3)_28%,transparent)]' : item.category === 'darts' ? 'bg-[color-mix(in_oklch,var(--series-4)_12%,transparent)] text-[color-mix(in_oklch,var(--series-4)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-4)_28%,transparent)]' : item.category === 'boardGames' ? 'bg-[color-mix(in_oklch,var(--series-5)_12%,transparent)] text-[color-mix(in_oklch,var(--series-5)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-5)_28%,transparent)]' : item.category === 'cardGames' ? 'bg-[color-mix(in_oklch,var(--series-6)_12%,transparent)] text-[color-mix(in_oklch,var(--series-6)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-6)_28%,transparent)]' : item.category === 'custom' ? 'bg-[color-mix(in_oklch,var(--series-7)_12%,transparent)] text-[color-mix(in_oklch,var(--series-7)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-7)_28%,transparent)]' : 'bg-muted text-foreground ring-border'}`}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                                  {new Map([
                                    ['chess', i18n.word("'Chess & Variants'")],
                                    ['billiards', i18n.word("'Billiards / Pool'")],
                                    ['tableTennis', i18n.word("'Table Tennis'")],
                                    ['darts', i18n.word("'Darts'")],
                                    ['boardGames', i18n.word("'Board Games'")],
                                    ['cardGames', i18n.word("'Card Games'")],
                                    ['custom', i18n.word("'Custom / Other'")],
                                  ]).get(item.category) ?? item.category}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="w-px">
                            {'_sample' in item && item._sample === true && (
                              <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                {i18n.chrome.sampleRecord}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selectedGames ? (
                  <GameTypeDetailView
                    gameType={selectedGames}
                    open
                    onClose={() => {
                      setSelectedGamesId(null);
                    }}
                  />
                ) : null}
              </SelectCards>
            ) : null}
            {playersTotal > 0 ? (
              <SelectCards
                selectedId={selectedPlayers?.id ?? null}
                onSelect={setSelectedPlayersId}
                className="overflow-x-auto flex flex-col gap-3 rounded-xl border border-border bg-card shadow-sm p-4"
              >
                <div className="flex flex-row items-center justify-between gap-2">
                  <span className="min-w-min text-sm font-semibold">{i18n.word('players')}</span>
                  <LinkSurface
                    isAvailable={() => canReachPage('players', onNavigate !== undefined)}
                    onActivate={() => {
                      navigateToPage('players', onNavigate);
                    }}
                    signInTo={() => '/app'}
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 gap-1 text-primary-text underline-offset-4 hover:underline"
                  >
                    {i18n.chrome.viewAll}
                    <span aria-hidden="true"> ›</span>
                  </LinkSurface>
                </div>
                <div className="min-w-0 overflow-auto">
                  <table className="ui-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th
                          scope="col"
                          className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {i18n.word('Player.nickname')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {i18n.word('Player.joinedDate')}
                        </th>
                        <th
                          scope="col"
                          className="w-px px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        ></th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.slice(0, 5).length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-8 text-center text-muted-foreground"
                            role="status"
                          >
                            {i18n.chrome.noDataYet}
                          </td>
                        </tr>
                      )}
                      {players.slice(0, 5).map((item) => (
                        <tr
                          key={item.id}
                          onClick={(clickEvent) => {
                            if (isOwnClick(clickEvent)) {
                              setSelectedPlayersId(item.id);
                            }
                          }}
                          className="group/row border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <td
                            className="px-4 py-3 align-middle whitespace-nowrap"
                            data-label={i18n.word('Player.nickname')}
                          >
                            <div className="ui-cell max-w-xs truncate">
                              <span className="min-w-min text-sm">{item.nickname}</span>
                            </div>
                          </td>
                          <td
                            className="px-4 py-3 align-middle whitespace-nowrap"
                            data-label={i18n.word('Player.joinedDate')}
                          >
                            <div className="ui-cell max-w-xs truncate">
                              <span className="shrink-0 whitespace-nowrap text-sm">
                                {item.joinedDate
                                  ? new Date(`${item.joinedDate}T00:00:00`).toLocaleDateString(
                                      i18n.locale
                                    )
                                  : ''}
                              </span>
                            </div>
                          </td>
                          <td className="w-px">
                            {'_sample' in item && item._sample === true && (
                              <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                {i18n.chrome.sampleRecord}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selectedPlayers ? (
                  <PlayerDetailView
                    player={selectedPlayers}
                    open
                    onClose={() => {
                      setSelectedPlayersId(null);
                    }}
                  />
                ) : null}
              </SelectCards>
            ) : null}
            {matchesTotal > 0 ? (
              <SelectCards
                selectedId={selectedMatches?.id ?? null}
                onSelect={setSelectedMatchesId}
                className="overflow-x-auto flex flex-col gap-3 rounded-xl border border-border bg-card shadow-sm p-4"
              >
                <div className="flex flex-row items-center justify-between gap-2">
                  <span className="min-w-min text-sm font-semibold">{i18n.word('matches')}</span>
                  <LinkSurface
                    isAvailable={() => canReachPage('matches', onNavigate !== undefined)}
                    onActivate={() => {
                      navigateToPage('matches', onNavigate);
                    }}
                    signInTo={() => '/app'}
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 gap-1 text-primary-text underline-offset-4 hover:underline"
                  >
                    {i18n.chrome.viewAll}
                    <span aria-hidden="true"> ›</span>
                  </LinkSurface>
                </div>
                <div className="min-w-0 overflow-auto">
                  <table className="ui-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th
                          scope="col"
                          className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {i18n.word('Match.game')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {i18n.word('Match.status')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {i18n.word('Match.scheduledAt')}
                        </th>
                        <th
                          scope="col"
                          className="w-px px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        ></th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.slice(0, 5).length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-8 text-center text-muted-foreground"
                            role="status"
                          >
                            {i18n.chrome.noDataYet}
                          </td>
                        </tr>
                      )}
                      {matches.slice(0, 5).map((item) => (
                        <tr
                          key={item.id}
                          onClick={(clickEvent) => {
                            if (isOwnClick(clickEvent)) {
                              setSelectedMatchesId(item.id);
                            }
                          }}
                          className="group/row border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <td
                            className="px-4 py-3 align-middle whitespace-nowrap"
                            data-label={i18n.word('Match.game')}
                          >
                            <div className="ui-cell max-w-xs truncate">
                              {gamesComplete.find((gameType) => gameType.id === item.gameId) !==
                              undefined ? (
                                <>
                                  <RecordChip
                                    collection="games"
                                    id={item.gameId}
                                    label={String(
                                      gamesComplete.find((gameType) => gameType.id === item.gameId)
                                        ?.name ?? ''
                                    )}
                                    icon={<DicesIcon className="h-3.5 w-3.5" />}
                                    className="min-w-min text-sm"
                                  />
                                </>
                              ) : (
                                <span className="min-w-min text-sm">
                                  {i18n.chrome.unresolvedReference}
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className="px-4 py-3 align-middle whitespace-nowrap"
                            data-label={i18n.word('Match.status')}
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
                          <td
                            className="px-4 py-3 align-middle whitespace-nowrap"
                            data-label={i18n.word('Match.scheduledAt')}
                          >
                            <div className="ui-cell max-w-xs truncate">
                              <span className="shrink-0 whitespace-nowrap text-sm">
                                {item.scheduledAt
                                  ? new Date(item.scheduledAt).toLocaleString(i18n.locale, {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })
                                  : ''}
                              </span>
                            </div>
                          </td>
                          <td className="w-px">
                            {'_sample' in item && item._sample === true && (
                              <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                {i18n.chrome.sampleRecord}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selectedMatches ? (
                  <MatchDetailView
                    match={selectedMatches}
                    open
                    onTransactionSuccess={refreshWidget}
                    onClose={() => {
                      setSelectedMatchesId(null);
                    }}
                  />
                ) : null}
              </SelectCards>
            ) : null}
            {leaderboardsTotal > 0 ? (
              <SelectCards
                selectedId={selectedLeaderboards?.id ?? null}
                onSelect={setSelectedLeaderboardsId}
                className="overflow-x-auto flex flex-col gap-3 rounded-xl border border-border bg-card shadow-sm p-4"
              >
                <div className="flex flex-row items-center justify-between gap-2">
                  <span className="min-w-min text-sm font-semibold">
                    {i18n.word('leaderboards')}
                  </span>
                  <LinkSurface
                    isAvailable={() => canReachPage('leaderboards', onNavigate !== undefined)}
                    onActivate={() => {
                      navigateToPage('leaderboards', onNavigate);
                    }}
                    signInTo={() => '/app'}
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 gap-1 text-primary-text underline-offset-4 hover:underline"
                  >
                    {i18n.chrome.viewAll}
                    <span aria-hidden="true"> ›</span>
                  </LinkSurface>
                </div>
                <div className="min-w-0 overflow-auto">
                  <table className="ui-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th
                          scope="col"
                          className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {i18n.word('LeaderboardEntry.player')}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {i18n.word('LeaderboardEntry.lastPlayedAt')}
                        </th>
                        <th
                          scope="col"
                          className="w-px px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        ></th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboards.slice(0, 5).length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-8 text-center text-muted-foreground"
                            role="status"
                          >
                            {i18n.chrome.noDataYet}
                          </td>
                        </tr>
                      )}
                      {leaderboards.slice(0, 5).map((item) => (
                        <tr
                          key={item.id}
                          onClick={(clickEvent) => {
                            if (isOwnClick(clickEvent)) {
                              setSelectedLeaderboardsId(item.id);
                            }
                          }}
                          className="group/row border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <td
                            className="px-4 py-3 align-middle whitespace-nowrap"
                            data-label={i18n.word('LeaderboardEntry.player')}
                          >
                            <div className="ui-cell max-w-xs truncate">
                              {playersComplete.find((player) => player.id === item.playerId) !==
                              undefined ? (
                                <>
                                  <RecordChip
                                    collection="players"
                                    id={item.playerId}
                                    label={String(
                                      playersComplete.find((player) => player.id === item.playerId)
                                        ?.nickname ?? ''
                                    )}
                                    icon={<UserIcon className="h-3.5 w-3.5" />}
                                    className="min-w-min text-sm"
                                  />
                                </>
                              ) : (
                                <span className="min-w-min text-sm">
                                  {i18n.chrome.unresolvedReference}
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className="px-4 py-3 align-middle whitespace-nowrap"
                            data-label={i18n.word('LeaderboardEntry.lastPlayedAt')}
                          >
                            <div className="ui-cell max-w-xs truncate">
                              <span className="shrink-0 whitespace-nowrap text-sm">
                                {item.lastPlayedAt
                                  ? new Date(item.lastPlayedAt).toLocaleString(i18n.locale, {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })
                                  : ''}
                              </span>
                            </div>
                          </td>
                          <td className="w-px">
                            {'_sample' in item && item._sample === true && (
                              <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                {i18n.chrome.sampleRecord}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selectedLeaderboards ? (
                  <LeaderboardEntryDetailView
                    leaderboardEntry={selectedLeaderboards}
                    open
                    onClose={() => {
                      setSelectedLeaderboardsId(null);
                    }}
                  />
                ) : null}
              </SelectCards>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

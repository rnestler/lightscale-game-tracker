import { useState, type JSX } from 'react';
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
import { DicesIcon, SwordsIcon, TrophyIcon, UserIcon } from 'lucide-react';
import { MetricValue } from '../components/ui/MetricValue';
import { RecordChip } from '../components/ui/record-chip';
import { Greeting } from '../components/ui/greeting';
import { SelectCards } from './ui/card-select';
import { Skeleton } from './ui/skeleton';

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
  return chartSwatches[index % chartSwatches.length] ?? 'var(--chart-1)';
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

const chartValueFormat = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function chartValueLabel(value: unknown): string {
  return typeof value === 'number'
    ? chartValueFormat.format(value)
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
    total: gamesTotal,
  } = useGames({ paged: true, pageSize: 5 });
  const {
    leaderboards,
    isInitializing: leaderboardsInitializing,
    reloadLeaderboards,
    total: leaderboardsTotal,
  } = useLeaderboards({ paged: true, pageSize: 5 });
  const { leaderboards: leaderboardsComplete } = useLeaderboards();
  const {
    matches,
    isInitializing: matchesInitializing,
    reloadMatches,
    total: matchesTotal,
  } = useMatches({
    paged: true,
    pageSize: 5,
    sort: [{ field: 'createdAt', direction: 'descending' }],
  });
  const { matches: matchesComplete } = useMatches();
  const {
    players,
    isInitializing: playersInitializing,
    reloadPlayers,
    total: playersTotal,
  } = usePlayers({ paged: true, pageSize: 5 });
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
  if (gamesInitializing || leaderboardsInitializing || matchesInitializing || playersInitializing) {
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
    <div
      className="@container flex flex-col h-full min-h-0 min-w-0 overflow-auto"
      aria-label="Dashboard"
      data-ls="812d4b567f"
    >
      <div className="@container flex flex-col gap-6 p-4 @md:p-8">
        <Greeting title="GameRank Tracker" />
        <div className="grid grid-cols-5 gap-4 @max-md:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              onNavigate?.('games');
            }}
            className="grid w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring col-span-2"
          >
            <div className="flex flex-col rounded-xl border border-border bg-card shadow-sm p-4 gap-1 @container">
              <div className="flex flex-row items-center justify-between gap-2">
                <span className="break-words text-sm text-muted-foreground">{'Games'}</span>
                <div className="flex flex-row items-center justify-center h-8 w-8 rounded-md bg-primary/10 shrink-0">
                  <DicesIcon className="shrink-0 h-4 w-4 text-primary" />
                </div>
              </div>
              <MetricValue
                className="break-words text-[length:clamp(0.875rem,calc((100cqi_-_2rem)/var(--metric-length,12)_*_1.7),2.25rem)] leading-tight font-semibold tracking-tight tabular-nums"
                value={gamesTotal.toLocaleString('en')}
              />
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigate?.('players');
            }}
            className="grid w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex flex-col rounded-xl border border-border bg-card shadow-sm p-4 gap-1 @container">
              <div className="flex flex-row items-center justify-between gap-2">
                <span className="break-words text-sm text-muted-foreground">{'Players'}</span>
                <div className="flex flex-row items-center justify-center h-8 w-8 rounded-md bg-primary/10 shrink-0">
                  <UserIcon className="shrink-0 h-4 w-4 text-primary" />
                </div>
              </div>
              <MetricValue
                className="break-words text-[length:clamp(0.875rem,calc((100cqi_-_2rem)/var(--metric-length,12)_*_1.7),2.25rem)] leading-tight font-semibold tracking-tight tabular-nums"
                value={playersTotal.toLocaleString('en')}
              />
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigate?.('matches');
            }}
            className="grid w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex flex-col rounded-xl border border-border bg-card shadow-sm p-4 gap-1 @container">
              <div className="flex flex-row items-center justify-between gap-2">
                <span className="break-words text-sm text-muted-foreground">{'Matches'}</span>
                <div className="flex flex-row items-center justify-center h-8 w-8 rounded-md bg-primary/10 shrink-0">
                  <SwordsIcon className="shrink-0 h-4 w-4 text-primary" />
                </div>
              </div>
              <MetricValue
                className="break-words text-[length:clamp(0.875rem,calc((100cqi_-_2rem)/var(--metric-length,12)_*_1.7),2.25rem)] leading-tight font-semibold tracking-tight tabular-nums"
                value={matchesTotal.toLocaleString('en')}
              />
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigate?.('leaderboards');
            }}
            className="grid w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex flex-col rounded-xl border border-border bg-card shadow-sm p-4 gap-1 @container">
              <div className="flex flex-row items-center justify-between gap-2">
                <span className="break-words text-sm text-muted-foreground">{'Leaderboards'}</span>
                <div className="flex flex-row items-center justify-center h-8 w-8 rounded-md bg-primary/10 shrink-0">
                  <TrophyIcon className="shrink-0 h-4 w-4 text-primary" />
                </div>
              </div>
              <MetricValue
                className="break-words text-[length:clamp(0.875rem,calc((100cqi_-_2rem)/var(--metric-length,12)_*_1.7),2.25rem)] leading-tight font-semibold tracking-tight tabular-nums"
                value={leaderboardsTotal.toLocaleString('en')}
              />
            </div>
          </button>
        </div>
        <div className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card shadow-sm p-4">
            <span className="break-words text-sm font-semibold">{'Match Activity per Game'}</span>
            {((): JSX.Element => {
              const chartRows = chartGroupCount(matchesComplete, (item) =>
                String(item.gameDisplayName)
              );
              if (chartRows.length === 0) {
                return (
                  <div
                    role="status"
                    className="flex min-h-32 items-center justify-center p-6 text-sm text-muted-foreground"
                  >
                    {'No data yet'}
                  </div>
                );
              }
              return (
                <>
                  <ChartContainer
                    config={{
                      value: { label: 'Match Activity per Game', color: 'var(--chart-1)' },
                    }}
                    className="aspect-auto h-[280px] w-full bg-card"
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
                            cursor={{ fill: 'color-mix(in oklch, var(--accent), transparent 85%)' }}
                            content={<ChartTooltipContent formatValue={chartValueLabel} />}
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
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card shadow-sm p-4">
            <span className="break-words text-sm font-semibold">
              {'Top Player Ratings by Game & Variant'}
            </span>
            {((): JSX.Element => {
              const laneKeys = games
                .map((entity) => String(String(entity.name).trim() || 'GameType'))
                .sort((a, b) => a.localeCompare(b));
              const chartRows = chartLaneData(
                null,
                laneKeys,
                leaderboardsComplete,
                (item) => {
                  const resolvedPlayer = players.find((entity) => entity.id === item.playerId);
                  return String(String(resolvedPlayer?.nickname ?? '').trim() || 'Player');
                },
                (item) => {
                  const laneRecord = games.find((entity) => entity.id === item.gameId);
                  return laneRecord === undefined
                    ? ''
                    : String(String(laneRecord.name).trim() || 'GameType');
                },
                (item) => item.rating,
                'max',
                null,
                false
              );
              if (chartRows.length === 0) {
                return (
                  <div
                    role="status"
                    className="flex min-h-32 items-center justify-center p-6 text-sm text-muted-foreground"
                  >
                    {'No data yet'}
                  </div>
                );
              }
              return (
                <>
                  {((): JSX.Element => {
                    const laneColors: Record<string, string> = {};
                    const laneLabels: Record<string, string> = {};
                    const laneColorOf = (lane: string, index: number): string =>
                      laneColors[lane] ?? chartSwatch(index);
                    const laneConfig = Object.fromEntries(
                      laneKeys.map((lane, index) => [
                        lane,
                        { label: laneLabels[lane] ?? lane, color: laneColorOf(lane, index) },
                      ])
                    );
                    return (
                      <ChartContainer
                        config={laneConfig}
                        className="aspect-auto h-[280px] w-full bg-card"
                      >
                        <BarChart
                          data={chartRows}
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
                            cursor={{ fill: 'color-mix(in oklch, var(--accent), transparent 85%)' }}
                            content={<ChartTooltipContent formatValue={chartValueLabel} />}
                          />
                          {laneKeys.map((lane, index) => (
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
              className="flex flex-col gap-3 rounded-xl border border-border bg-card shadow-sm p-4"
            >
              <div className="flex flex-row items-center justify-between gap-2">
                <span className="break-words text-sm font-semibold">{'Games'}</span>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate?.('games');
                  }}
                  className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 gap-1 text-primary-text underline-offset-4 hover:underline"
                >
                  {'All'}
                  <span aria-hidden="true"> ›</span>
                </button>
              </div>
              <div className="min-w-0 overflow-auto">
                <table className="ui-table w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {'Game Name'}
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {'Category'}
                      </th>
                      <th
                        scope="col"
                        className="w-px px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      ></th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-8 text-center text-muted-foreground"
                          role="status"
                        >
                          {'No data yet'}
                        </td>
                      </tr>
                    )}
                    {games.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedGamesId(item.id);
                        }}
                        className="group/row border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <td
                          className="px-4 py-3 align-middle whitespace-nowrap"
                          data-label={'Game Name'}
                        >
                          <div className="ui-cell max-w-xs truncate">
                            <span className="break-words text-sm">{item.name}</span>
                          </div>
                        </td>
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
                        <td className="w-px" />
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
              className="flex flex-col gap-3 rounded-xl border border-border bg-card shadow-sm p-4"
            >
              <div className="flex flex-row items-center justify-between gap-2">
                <span className="break-words text-sm font-semibold">{'Players'}</span>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate?.('players');
                  }}
                  className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 gap-1 text-primary-text underline-offset-4 hover:underline"
                >
                  {'All'}
                  <span aria-hidden="true"> ›</span>
                </button>
              </div>
              <div className="min-w-0 overflow-auto">
                <table className="ui-table w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {'Nickname / Handle'}
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {'Member Since'}
                      </th>
                      <th
                        scope="col"
                        className="w-px px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      ></th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-8 text-center text-muted-foreground"
                          role="status"
                        >
                          {'No data yet'}
                        </td>
                      </tr>
                    )}
                    {players.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedPlayersId(item.id);
                        }}
                        className="group/row border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <td
                          className="px-4 py-3 align-middle whitespace-nowrap"
                          data-label={'Nickname / Handle'}
                        >
                          <div className="ui-cell max-w-xs truncate">
                            <span className="break-words text-sm">{item.nickname}</span>
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 align-middle whitespace-nowrap"
                          data-label={'Member Since'}
                        >
                          <div className="ui-cell max-w-xs truncate">
                            <span className="whitespace-nowrap text-sm">
                              {item.joinedDate
                                ? new Date(`${item.joinedDate}T00:00:00`).toLocaleDateString('en')
                                : ''}
                            </span>
                          </div>
                        </td>
                        <td className="w-px" />
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
              className="flex flex-col gap-3 rounded-xl border border-border bg-card shadow-sm p-4"
            >
              <div className="flex flex-row items-center justify-between gap-2">
                <span className="break-words text-sm font-semibold">{'Matches'}</span>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate?.('matches');
                  }}
                  className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 gap-1 text-primary-text underline-offset-4 hover:underline"
                >
                  {'All'}
                  <span aria-hidden="true"> ›</span>
                </button>
              </div>
              <div className="min-w-0 overflow-auto">
                <table className="ui-table w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {'Game'}
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {'Status'}
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {'Date & Time'}
                      </th>
                      <th
                        scope="col"
                        className="w-px px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      ></th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-muted-foreground"
                          role="status"
                        >
                          {'No data yet'}
                        </td>
                      </tr>
                    )}
                    {matches.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedMatchesId(item.id);
                        }}
                        className="group/row border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <td
                          className="px-4 py-3 align-middle whitespace-nowrap"
                          data-label={'Game'}
                        >
                          <div className="ui-cell max-w-xs truncate">
                            {games.find((gameType) => gameType.id === item.gameId) !== undefined ? (
                              <>
                                <RecordChip
                                  collection="games"
                                  id={item.gameId}
                                  label={String(
                                    games.find((gameType) => gameType.id === item.gameId)?.name ??
                                      ''
                                  )}
                                  icon={<DicesIcon className="h-3.5 w-3.5" />}
                                  className="break-words text-sm"
                                />
                              </>
                            ) : (
                              <span className="break-words text-sm">{'—'}</span>
                            )}
                          </div>
                        </td>
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
                        <td
                          className="px-4 py-3 align-middle whitespace-nowrap"
                          data-label={'Date & Time'}
                        >
                          <div className="ui-cell max-w-xs truncate">
                            <span className="whitespace-nowrap text-sm">
                              {item.scheduledAt
                                ? new Date(item.scheduledAt).toLocaleString('en', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })
                                : ''}
                            </span>
                          </div>
                        </td>
                        <td className="w-px" />
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
              className="flex flex-col gap-3 rounded-xl border border-border bg-card shadow-sm p-4"
            >
              <div className="flex flex-row items-center justify-between gap-2">
                <span className="break-words text-sm font-semibold">{'Leaderboards'}</span>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate?.('leaderboards');
                  }}
                  className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 gap-1 text-primary-text underline-offset-4 hover:underline"
                >
                  {'All'}
                  <span aria-hidden="true"> ›</span>
                </button>
              </div>
              <div className="min-w-0 overflow-auto">
                <table className="ui-table w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {'Player'}
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {'Last Activity'}
                      </th>
                      <th
                        scope="col"
                        className="w-px px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      ></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboards.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-8 text-center text-muted-foreground"
                          role="status"
                        >
                          {'No data yet'}
                        </td>
                      </tr>
                    )}
                    {leaderboards.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedLeaderboardsId(item.id);
                        }}
                        className="group/row border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <td
                          className="px-4 py-3 align-middle whitespace-nowrap"
                          data-label={'Player'}
                        >
                          <div className="ui-cell max-w-xs truncate">
                            {players.find((player) => player.id === item.playerId) !== undefined ? (
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
                                />
                              </>
                            ) : (
                              <span className="break-words text-sm">{'—'}</span>
                            )}
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 align-middle whitespace-nowrap"
                          data-label={'Last Activity'}
                        >
                          <div className="ui-cell max-w-xs truncate">
                            <span className="whitespace-nowrap text-sm">
                              {item.lastPlayedAt
                                ? new Date(item.lastPlayedAt).toLocaleString('en', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })
                                : ''}
                            </span>
                          </div>
                        </td>
                        <td className="w-px" />
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
  );
}

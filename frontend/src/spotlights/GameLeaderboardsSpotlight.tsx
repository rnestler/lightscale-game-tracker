import { i18n } from '../i18n/text';
import { Fragment, useState, useEffect, useSyncExternalStore, type JSX } from 'react';
import { BarChart, Bar, Cell, LabelList, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../components/ui/chart';
import { useGames } from '../hooks/useGames';
import { leaderboardsApi } from '../api/leaderboardsApi';
import { getErrorMessage } from '../utils/errorHandling';
import { ErrorMessage } from '../components/ui/error-message';
import type * as $Domain from '../types/domain';
import { DicesIcon } from 'lucide-react';
import { MetricValue } from '../components/ui/MetricValue';
import { RichTextDisplay } from '../components/ui/form-field';
import { referenceStore } from '../api/referenceStore';
import { SelectCard, SelectCards } from '../components/ui/card-select';

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

function chartGroupMax<T>(
  items: readonly T[],
  key: (item: T) => string,
  value: (item: T) => number
): Array<{ name: string; value: number }> {
  const groups = new Map<string, number>();
  for (const item of items) {
    const name = key(item);
    const current = groups.get(name);
    const next = value(item);
    groups.set(name, current === undefined ? next : Math.max(current, next));
  }
  return Array.from(groups.entries()).map(([name, total]) => ({ name, value: total }));
}

export function GameLeaderboardsSpotlight(_props: {
  onNavigate?: (view: string) => void;
}): JSX.Element {
  const {
    games,
    isInitializing: gamesInitializing,
    errorMessage: gamesError,
    total: gamesTotal,
  } = useGames();
  const storeRevision = useSyncExternalStore(referenceStore.subscribe, referenceStore.revision);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    games.find((each) => each.id === selectedId) ??
    [...games].sort((a, b) => String(a.name).localeCompare(String(b.name))).at(0) ??
    null;
  const [selectedLeaderboard, setSelectedLeaderboard] = useState<$Domain.LeaderboardEntry[]>([]);
  const [selectedLeaderboardError, setSelectedLeaderboardError] = useState<string | null>(null);
  const selectedLeaderboardParent = selected?.id ?? null;
  useEffect(() => {
    if (selectedLeaderboardParent === null) {
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
        setSelectedLeaderboard(
          entries.filter((entry) => entry.gameId === selectedLeaderboardParent)
        );
        setSelectedLeaderboardError(null);
      })
      .catch((error: unknown) => {
        if (!current) {
          return;
        }
        setSelectedLeaderboardError(getErrorMessage(error));
      });
    return (): void => {
      current = false;
    };
  }, [selectedLeaderboardParent, storeRevision]);
  return (
    <>
      {selectedLeaderboardError !== null && <ErrorMessage message={selectedLeaderboardError} />}
      <div className="@container flex flex-col w-full" aria-label={i18n.word('gameLeaderboards')}>
        {gamesTotal === 0 && !gamesInitializing && !(gamesError !== null) ? (
          <span className="min-w-min text-base font-medium text-muted-foreground p-12">
            {i18n.fill(i18n.chrome.noEntriesTitle, { name: i18n.word('GameType', 1) })}
          </span>
        ) : null}
        <SelectCards
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          className="@container flex flex-row gap-6 items-start w-full @max-md:flex @max-md:flex-col"
        >
          <div className="flex flex-col gap-2 w-64 shrink-0 min-w-0 @max-md:flex @max-md:flex-row @max-md:w-full @max-md:min-w-0 @max-md:overflow-auto">
            {[...games]
              .sort((a, b) => String(a.name).localeCompare(String(b.name)))
              .map((gameType) => (
                <Fragment key={gameType.id}>
                  <SelectCard
                    id={gameType.id}
                    className="overflow-x-auto flex flex-col gap-3 p-4 rounded-xl bg-card shadow-sm border border-border @max-md:shrink-0"
                  >
                    <div className="flex flex-row items-start gap-3">
                      <div className="w-11 h-11 rounded-lg bg-primary/10 text-foreground flex items-center justify-center flex-shrink-0">
                        <DicesIcon className="h-5 w-5" />
                      </div>
                      <span className="min-w-min text-lg font-medium tracking-tight line-clamp-2 flex-1">
                        {gameType.displayName}
                      </span>
                    </div>
                    {gameType.category ? (
                      <div className="flex flex-row items-center gap-1.5 overflow-hidden">
                        {gameType.category && (
                          <span
                            className={`inline-flex self-start items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${gameType.category === 'chess' ? 'bg-[color-mix(in_oklch,var(--series-1)_12%,transparent)] text-[color-mix(in_oklch,var(--series-1)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-1)_28%,transparent)]' : gameType.category === 'billiards' ? 'bg-[color-mix(in_oklch,var(--series-2)_12%,transparent)] text-[color-mix(in_oklch,var(--series-2)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-2)_28%,transparent)]' : gameType.category === 'tableTennis' ? 'bg-[color-mix(in_oklch,var(--series-3)_12%,transparent)] text-[color-mix(in_oklch,var(--series-3)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-3)_28%,transparent)]' : gameType.category === 'darts' ? 'bg-[color-mix(in_oklch,var(--series-4)_12%,transparent)] text-[color-mix(in_oklch,var(--series-4)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-4)_28%,transparent)]' : gameType.category === 'boardGames' ? 'bg-[color-mix(in_oklch,var(--series-5)_12%,transparent)] text-[color-mix(in_oklch,var(--series-5)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-5)_28%,transparent)]' : gameType.category === 'cardGames' ? 'bg-[color-mix(in_oklch,var(--series-6)_12%,transparent)] text-[color-mix(in_oklch,var(--series-6)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-6)_28%,transparent)]' : gameType.category === 'custom' ? 'bg-[color-mix(in_oklch,var(--series-7)_12%,transparent)] text-[color-mix(in_oklch,var(--series-7)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-7)_28%,transparent)]' : 'bg-muted text-foreground ring-border'}`}
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
                            ]).get(gameType.category) ?? gameType.category}
                          </span>
                        )}
                      </div>
                    ) : null}
                    {gameType.rulesVariant ? (
                      <div className="flex flex-row items-center gap-1.5 overflow-hidden">
                        <span className="text-sm text-muted-foreground truncate min-w-0">
                          {gameType.rulesVariant}
                        </span>
                      </div>
                    ) : null}
                  </SelectCard>
                </Fragment>
              ))}
          </div>
          <div className="flex flex-col flex-1 min-w-0 @max-md:w-full">
            {selected ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-6 p-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-row items-center justify-between">
                      <span className="min-w-min text-lg font-semibold tracking-tight">
                        {selected.name}
                      </span>
                      {selected.category && (
                        <span
                          className={`inline-flex self-start items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${selected.category === 'chess' ? 'bg-[color-mix(in_oklch,var(--series-1)_12%,transparent)] text-[color-mix(in_oklch,var(--series-1)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-1)_28%,transparent)]' : selected.category === 'billiards' ? 'bg-[color-mix(in_oklch,var(--series-2)_12%,transparent)] text-[color-mix(in_oklch,var(--series-2)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-2)_28%,transparent)]' : selected.category === 'tableTennis' ? 'bg-[color-mix(in_oklch,var(--series-3)_12%,transparent)] text-[color-mix(in_oklch,var(--series-3)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-3)_28%,transparent)]' : selected.category === 'darts' ? 'bg-[color-mix(in_oklch,var(--series-4)_12%,transparent)] text-[color-mix(in_oklch,var(--series-4)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-4)_28%,transparent)]' : selected.category === 'boardGames' ? 'bg-[color-mix(in_oklch,var(--series-5)_12%,transparent)] text-[color-mix(in_oklch,var(--series-5)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-5)_28%,transparent)]' : selected.category === 'cardGames' ? 'bg-[color-mix(in_oklch,var(--series-6)_12%,transparent)] text-[color-mix(in_oklch,var(--series-6)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-6)_28%,transparent)]' : selected.category === 'custom' ? 'bg-[color-mix(in_oklch,var(--series-7)_12%,transparent)] text-[color-mix(in_oklch,var(--series-7)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-7)_28%,transparent)]' : 'bg-muted text-foreground ring-border'}`}
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
                          ]).get(selected.category) ?? selected.category}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-row items-center gap-2">
                      <span className="min-w-min text-sm text-muted-foreground">
                        {i18n.word("'Variant / Ruleset:'")}
                      </span>
                      <span className="min-w-min text-sm font-semibold">
                        {selected.rulesVariant}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto flex flex-col gap-2 p-4 rounded-lg bg-muted/30 border border-border">
                    <span className="min-w-min text-base font-medium">
                      {i18n.word("'Overview & Rules'")}
                    </span>
                    <RichTextDisplay value={selected.description} className="min-w-min text-sm" />
                  </div>
                  <div className="overflow-x-auto flex flex-row gap-6 p-4 rounded-lg bg-card border border-border">
                    <div className="@container flex-1 flex flex-col gap-1 min-w-[10rem]">
                      <span className="min-w-min text-sm text-muted-foreground">
                        {i18n.word("'Starting Rating'")}
                      </span>
                      <MetricValue
                        className="min-w-min text-[length:clamp(1.5rem,calc((100cqi_-_2rem)/var(--metric-length,12)_*_1.7),2.25rem)] leading-tight font-semibold tracking-tight tabular-nums"
                        value={selected.defaultRating}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <span className="min-w-min text-base font-medium">
                      {i18n.word("'Standings & Player Ratings'")}
                    </span>
                    <div className="overflow-x-auto flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                      <span className="min-w-min text-sm uppercase tracking-wide text-muted-foreground">
                        {i18n.word("'Player Ratings'")}
                      </span>
                      {((): JSX.Element => {
                        const chartRows = chartGroupMax(
                          selectedLeaderboard,
                          (item) => String(item.playerNickname),
                          (item) => item.rating
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
                                value: {
                                  label: i18n.word("'Player Ratings'"),
                                  color: 'var(--series-1)',
                                },
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
                                    <Bar
                                      dataKey="value"
                                      fill="var(--color-value)"
                                      radius={[6, 6, 0, 0]}
                                    >
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
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </SelectCards>
      </div>
    </>
  );
}

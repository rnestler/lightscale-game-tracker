import { Fragment, useState, useEffect, type JSX } from 'react';
import { BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../components/ui/chart';
import { useGames } from '../hooks/useGames';
import { leaderboardsApi } from '../api/leaderboardsApi';
import { getErrorMessage } from '../utils/errorHandling';
import { ErrorMessage } from '../components/ui/error-message';
import type * as $Domain from '../types/domain';
import { DicesIcon } from 'lucide-react';
import { MetricValue } from '../components/ui/MetricValue';
import { RichTextDisplay } from '../components/ui/form-field';
import { SelectCard, SelectCards } from '../components/ui/card-select';

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
    leaderboardsApi
      .list()
      .then((ids) => leaderboardsApi.multiGet(ids))
      .then((entries) => {
        setSelectedLeaderboard(
          entries.filter((entry) => entry.gameId === selectedLeaderboardParent)
        );
        setSelectedLeaderboardError(null);
      })
      .catch((error: unknown) => {
        setSelectedLeaderboardError(getErrorMessage(error));
      });
  }, [selectedLeaderboardParent]);
  return (
    <>
      {selectedLeaderboardError !== null && <ErrorMessage message={selectedLeaderboardError} />}
      <div className="@container flex flex-col w-full" aria-label="Leaderboards by Game">
        {gamesTotal === 0 && !gamesInitializing && !(gamesError !== null) ? (
          <span className="break-words text-base font-medium text-muted-foreground p-12">
            {'No games yet'}
          </span>
        ) : null}
        <SelectCards
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          className="@container flex flex-row gap-6 items-start w-full @max-md:flex @max-md:flex-col"
        >
          <div className="flex flex-col gap-2 w-64 shrink-0 @max-md:flex @max-md:flex-row @max-md:w-full @max-md:min-w-0 @max-md:overflow-auto">
            {[...games]
              .sort((a, b) => String(a.name).localeCompare(String(b.name)))
              .map((gameType) => (
                <Fragment key={gameType.id}>
                  <SelectCard
                    id={gameType.id}
                    className="flex flex-col gap-3 p-4 rounded-xl bg-card shadow-sm border border-border @max-md:shrink-0"
                  >
                    <div className="flex flex-row items-start gap-3">
                      <div className="w-11 h-11 rounded-lg bg-primary/10 text-foreground flex items-center justify-center flex-shrink-0">
                        <DicesIcon className="h-5 w-5" />
                      </div>
                      <span className="break-words text-lg font-medium tracking-tight flex-1">
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
                              ['chess', 'Chess & Variants'],
                              ['billiards', 'Billiards / Pool'],
                              ['tableTennis', 'Table Tennis'],
                              ['darts', 'Darts'],
                              ['boardGames', 'Board Games'],
                              ['cardGames', 'Card Games'],
                              ['custom', 'Custom / Other'],
                            ]).get(gameType.category) ?? gameType.category}
                          </span>
                        )}
                      </div>
                    ) : null}
                    {gameType.rulesVariant ? (
                      <div className="flex flex-row items-center gap-1.5 overflow-hidden">
                        <span className="break-words text-sm text-muted-foreground truncate">
                          {gameType.rulesVariant}
                        </span>
                      </div>
                    ) : null}
                  </SelectCard>
                </Fragment>
              ))}
          </div>
          <div className="flex flex-col flex-1 @max-md:w-full">
            {selected ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-6 p-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-row items-center justify-between">
                      <span className="break-words text-lg font-semibold tracking-tight">
                        {selected.name}
                      </span>
                      {selected.category && (
                        <span
                          className={`inline-flex self-start items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${selected.category === 'chess' ? 'bg-[color-mix(in_oklch,var(--series-1)_12%,transparent)] text-[color-mix(in_oklch,var(--series-1)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-1)_28%,transparent)]' : selected.category === 'billiards' ? 'bg-[color-mix(in_oklch,var(--series-2)_12%,transparent)] text-[color-mix(in_oklch,var(--series-2)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-2)_28%,transparent)]' : selected.category === 'tableTennis' ? 'bg-[color-mix(in_oklch,var(--series-3)_12%,transparent)] text-[color-mix(in_oklch,var(--series-3)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-3)_28%,transparent)]' : selected.category === 'darts' ? 'bg-[color-mix(in_oklch,var(--series-4)_12%,transparent)] text-[color-mix(in_oklch,var(--series-4)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-4)_28%,transparent)]' : selected.category === 'boardGames' ? 'bg-[color-mix(in_oklch,var(--series-5)_12%,transparent)] text-[color-mix(in_oklch,var(--series-5)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-5)_28%,transparent)]' : selected.category === 'cardGames' ? 'bg-[color-mix(in_oklch,var(--series-6)_12%,transparent)] text-[color-mix(in_oklch,var(--series-6)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-6)_28%,transparent)]' : selected.category === 'custom' ? 'bg-[color-mix(in_oklch,var(--series-7)_12%,transparent)] text-[color-mix(in_oklch,var(--series-7)_45%,var(--foreground))] ring-[color-mix(in_oklch,var(--series-7)_28%,transparent)]' : 'bg-muted text-foreground ring-border'}`}
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
                          ]).get(selected.category) ?? selected.category}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-row items-center gap-2">
                      <span className="break-words text-sm text-muted-foreground">
                        {'Variant / Ruleset:'}
                      </span>
                      <span className="break-words text-sm font-semibold">
                        {selected.rulesVariant}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 p-4 rounded-lg bg-muted/30 border border-border">
                    <span className="break-words text-base font-medium">{'Overview & Rules'}</span>
                    <RichTextDisplay value={selected.description} className="break-words text-sm" />
                  </div>
                  <div className="flex flex-row gap-6 p-4 rounded-lg bg-card border border-border">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="break-words text-sm text-muted-foreground">
                        {'Starting Rating'}
                      </span>
                      <MetricValue
                        className="break-words text-[length:clamp(0.875rem,calc((100cqi_-_2rem)/var(--metric-length,12)_*_1.7),2.25rem)] leading-tight font-semibold tracking-tight tabular-nums"
                        value={selected.defaultRating}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <span className="break-words text-base font-medium">
                      {'Standings & Player Ratings'}
                    </span>
                    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                      <div className="text-sm uppercase tracking-wide text-muted-foreground">
                        {'Player Ratings'}
                      </div>
                      {((): JSX.Element => {
                        const chartRows = chartGroupMax(
                          selectedLeaderboard,
                          (entry) => String(entry.playerNickname),
                          (entry) => entry.rating
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
                                value: { label: 'Current Rating', color: 'var(--chart-1)' },
                              }}
                              className="aspect-auto h-[280px] w-full bg-card"
                            >
                              {((): JSX.Element => {
                                const chartData = chartRows;
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
                                      cursor={{
                                        fill: 'color-mix(in oklch, var(--accent), transparent 85%)',
                                      }}
                                      content={
                                        <ChartTooltipContent formatValue={chartValueLabel} />
                                      }
                                    />
                                    <Bar
                                      dataKey="value"
                                      fill="var(--color-value)"
                                      radius={[6, 6, 0, 0]}
                                    >
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

import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from '../../utils/cn';

export interface ChartConfigItem {
  label?: React.ReactNode;
  icon?: React.ComponentType;
  color?: string;
}

export type ChartConfig = Record<string, ChartConfigItem>;

interface ChartContextValue {
  config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextValue | null>(null);

export function useChart(): ChartContextValue {
  const context = React.useContext(ChartContext);
  if (context === null) {
    throw new Error('useChart must be used within a ChartContainer');
  }
  return context;
}

export interface ChartContainerProps extends React.ComponentProps<'div'> {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
}

let chartIdCounter = 0;

function nextChartId(): string {
  chartIdCounter += 1;
  return `chart-${chartIdCounter}`;
}

const CHART_PROPERTY_PATTERN = /^[a-zA-Z0-9_-]+$/;
const CHART_COLOR_PATTERN = /^[#a-zA-Z0-9(),.%/\s-]+$/;

export function ChartStyle({
  id,
  config,
}: {
  id: string;
  config: ChartConfig;
}): React.JSX.Element | null {
  const colorEntries = Object.entries(config).filter(
    ([key, item]) =>
      CHART_PROPERTY_PATTERN.test(key) &&
      item.color !== undefined &&
      CHART_COLOR_PATTERN.test(item.color)
  );
  if (colorEntries.length === 0) {
    return null;
  }
  const declarations = colorEntries
    .map(([key, item]) => `  --color-${key}: ${item.color};`)
    .join('\n');
  return <style dangerouslySetInnerHTML={{ __html: `[data-chart=${id}] {\n${declarations}\n}` }} />;
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: ChartContainerProps): React.JSX.Element {
  const generatedId = React.useMemo(() => nextChartId(), []);
  const chartId = `ls-${id ?? generatedId}`;
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

interface TooltipEntry {
  name?: string | number;
  value?: string | number;
  dataKey?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipContentProps extends React.ComponentProps<'div'> {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  nameKey?: string;
  colorKey?: string;
  formatValue?: (value: number) => string;
}

function configEntry(config: ChartConfig, key: string): ChartConfigItem | undefined {
  return config[key];
}

function indicatorColorOf(
  entry: TooltipEntry,
  entryConfig: ChartConfigItem | undefined,
  colorKey: string | undefined
): string | undefined {
  if (colorKey === undefined) {
    return entry.color ?? entryConfig?.color;
  }
  const rowColor = entry.payload?.[colorKey];
  if (typeof rowColor !== 'string') {
    throw new Error(`The chart row carries no '${colorKey}' color`);
  }
  return rowColor;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  hideLabel,
  hideIndicator,
  nameKey,
  colorKey,
  formatValue,
}: ChartTooltipContentProps): React.JSX.Element | null {
  const { config } = useChart();
  if (active !== true || payload === undefined || payload.length === 0) {
    return null;
  }
  const firstEntry = payload[0];
  const resolvedLabel = label ?? firstEntry.name;
  const namesShown = payload.length > 1;
  return (
    <div
      className={cn(
        'grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border bg-popover text-popover-foreground px-2.5 py-1.5 text-xs shadow-md',
        className
      )}
    >
      {hideLabel !== true && resolvedLabel !== undefined ? (
        <div className="font-medium text-foreground">{resolvedLabel}</div>
      ) : null}
      <div className="grid gap-1.5">
        {payload.map((entry, index) => {
          const entryKey = nameKey ?? String(entry.dataKey ?? entry.name ?? `item-${index}`);
          const entryConfig = configEntry(config, entryKey);
          const indicatorColor = indicatorColorOf(entry, entryConfig, colorKey);
          return (
            <div key={index} className="flex w-full items-center gap-2">
              {hideIndicator !== true ? (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: indicatorColor }}
                />
              ) : null}
              {namesShown ? (
                <span className="text-muted-foreground">{entryConfig?.label ?? entry.name}</span>
              ) : null}
              {entry.value !== undefined ? (
                <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                  {typeof entry.value === 'number' && formatValue !== undefined
                    ? formatValue(entry.value)
                    : entry.value}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ChartLegend = RechartsPrimitive.Legend;

interface LegendEntry {
  value?: string | number;
  dataKey?: string | number;
  color?: string;
}

export interface ChartLegendContentProps extends React.ComponentProps<'div'> {
  payload?: LegendEntry[];
  hideIcon?: boolean;
  nameKey?: string;
}

export function ChartLegendContent({
  className,
  payload,
  hideIcon,
  nameKey,
}: ChartLegendContentProps): React.JSX.Element | null {
  const { config } = useChart();
  if (payload === undefined || payload.length === 0) {
    return null;
  }
  return (
    <div
      className={cn('flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3', className)}
    >
      {payload.map((entry, index) => {
        const entryKey = nameKey ?? String(entry.dataKey ?? entry.value ?? `item-${index}`);
        const entryConfig = configEntry(config, entryKey);
        return (
          <div
            key={index}
            className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"
          >
            {hideIcon !== true ? (
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: entry.color }}
              />
            ) : null}
            {entryConfig?.label ?? entry.value}
          </div>
        );
      })}
    </div>
  );
}

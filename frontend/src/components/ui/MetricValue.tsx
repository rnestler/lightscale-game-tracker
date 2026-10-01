// Generated with Lightscale AI. This file belongs to the owner of the generated application. See LICENSE.
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type JSX,
} from 'react';
import { currencyCode } from '../../config/currency';

export interface MetricFormat {
  kind: 'money' | 'number';
  locale: string;
}

interface MetricValueProps extends HTMLAttributes<HTMLSpanElement> {
  value: string | number;
  raw?: number;
  format?: MetricFormat;
}

interface MetricValueStyle extends CSSProperties {
  '--metric-length'?: number;
}

const METRIC_FLOOR = '1.5rem';

const RULER_STYLE: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  visibility: 'hidden',
  whiteSpace: 'nowrap',
  width: 'max-content',
  fontSize: METRIC_FLOOR,
};

function numberFormat(format: MetricFormat, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const money: Intl.NumberFormatOptions =
    format.kind === 'money' ? { style: 'currency', currency: currencyCode() } : {};
  return new Intl.NumberFormat(format.locale, { ...money, ...options });
}

function ladder(full: string, raw: number, format: MetricFormat): string[] {
  const whole = numberFormat(format, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
    raw
  );
  const compact = numberFormat(format, { notation: 'compact', maximumFractionDigits: 1 }).format(
    raw
  );
  return [...new Set([full, whole, compact])];
}

function availableWidth(element: HTMLElement, tile: HTMLElement): number {
  const style = getComputedStyle(tile);
  if (style.display.includes('grid')) {
    return element.getBoundingClientRect().width;
  }
  return tile.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
}

function longestFitting(
  candidates: readonly string[],
  measure: (text: string) => number,
  width: number
): string {
  for (const candidate of candidates) {
    if (measure(candidate) <= width) {
      return candidate;
    }
  }
  const shortest = candidates.at(-1);
  if (shortest === undefined) {
    throw new Error('A metric has no variant to show');
  }
  return shortest;
}

export function MetricValue({ value, raw, format, ...attributes }: MetricValueProps): JSX.Element {
  const full = String(value);
  const element = useRef<HTMLSpanElement>(null);
  const ruler = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(full);
  const kind = format?.kind;
  const locale = format?.locale;
  useLayoutEffect(() => {
    const own = element.current;
    const tile = own?.parentElement ?? null;
    const measure = ruler.current;
    if (
      own === null ||
      tile === null ||
      measure === null ||
      raw === undefined ||
      kind === undefined ||
      locale === undefined ||
      !Number.isFinite(raw)
    ) {
      setShown(full);
      return undefined;
    }
    const candidates = ladder(full, raw, { kind, locale });
    const textWidth = (text: string): number => {
      measure.textContent = text;
      return measure.offsetWidth;
    };
    const pick = (): void => {
      setShown(longestFitting(candidates, textWidth, availableWidth(own, tile)));
    };
    pick();
    const observer = new ResizeObserver(pick);
    observer.observe(tile);
    return (): void => {
      observer.disconnect();
    };
  }, [full, raw, kind, locale]);
  const style: MetricValueStyle = { '--metric-length': shown.length };
  return (
    <span
      {...attributes}
      ref={element}
      style={style}
      title={shown === full ? attributes.title : full}
    >
      {shown}
      <span ref={ruler} aria-hidden="true" style={RULER_STYLE} />
    </span>
  );
}

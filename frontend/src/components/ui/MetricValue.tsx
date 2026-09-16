// Generated with Lightscale AI. This file belongs to the owner of the generated application. See LICENSE.
import type { CSSProperties, HTMLAttributes, JSX } from 'react';

interface MetricValueProps extends HTMLAttributes<HTMLSpanElement> {
  value: string | number;
}

interface MetricValueStyle extends CSSProperties {
  '--metric-length'?: number;
}

export function MetricValue({ value, ...attributes }: MetricValueProps): JSX.Element {
  const text = String(value);
  const style: MetricValueStyle = { '--metric-length': text.length };
  return (
    <span {...attributes} style={style}>
      {text}
    </span>
  );
}

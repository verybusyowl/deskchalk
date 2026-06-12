import React from 'react';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  tone?: 'neutral' | 'good' | 'bad' | 'info';
  fill?: boolean;
  dot?: boolean;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

/** Tiny hand-drawn SVG trend line, auto-scaled. */
export function Sparkline(props: SparklineProps): JSX.Element;

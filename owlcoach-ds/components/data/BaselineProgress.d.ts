import React from 'react';

export interface BaselineProgressProps {
  /** metric value when the focus was assigned */
  baseline: number;
  current: number;
  target: number;
  unit?: string;
  /** 'down' when lower is better (untraded%, time-to-damage) */
  goodDirection?: 'up' | 'down';
  label?: string;
  height?: number;
  style?: React.CSSProperties;
}

/** Three-point track (baseline · current · target) showing focus progress. */
export function BaselineProgress(props: BaselineProgressProps): JSX.Element;

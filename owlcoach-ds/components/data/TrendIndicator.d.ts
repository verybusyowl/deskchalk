import React from 'react';

export interface TrendIndicatorProps {
  /** signed change, recent-10 vs previous-10 */
  delta: number;
  /** which direction counts as improvement for THIS metric */
  goodDirection?: 'up' | 'down';
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  showArrow?: boolean;
  style?: React.CSSProperties;
}

/** Signed delta coloured by meaning (mint=better, orange=worse). */
export function TrendIndicator(props: TrendIndicatorProps): JSX.Element;

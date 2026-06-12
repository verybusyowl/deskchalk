import React from 'react';

export interface StatCardProps {
  label: string;
  /** pre-formatted value, e.g. "1.18", "72%", "84" */
  value: string | number;
  unit?: string;
  /** signed delta vs previous window; omit to hide trend row */
  delta?: number | null;
  goodDirection?: 'up' | 'down';
  /** optional sparkline series */
  spark?: number[] | null;
  emphasis?: 'normal' | 'hero';
  style?: React.CSSProperties;
}

/**
 * Compact metric tile — label, big number, trend, optional sparkline.
 * @startingPoint section="Data" subtitle="Metric tile with trend + sparkline" viewport="700x150"
 */
export function StatCard(props: StatCardProps): JSX.Element;

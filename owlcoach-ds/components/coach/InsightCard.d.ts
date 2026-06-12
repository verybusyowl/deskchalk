import React from 'react';

export interface InsightCardProps {
  rank?: number | null;
  kind?: 'fix' | 'strength';
  title: string;
  detail?: string;
  /** supporting metric, pre-formatted */
  metric?: string | null;
  delta?: number | null;
  goodDirection?: 'up' | 'down';
  style?: React.CSSProperties;
}

/** Ranked AI coaching insight — a fix (orange) or strength (mint). */
export function InsightCard(props: InsightCardProps): JSX.Element;

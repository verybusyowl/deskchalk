import React from 'react';

export interface FocusSupportingStat { label: string; value: string; }

export interface FocusCardProps {
  /** the blunt one-line verdict, e.g. "You're dying untraded far too often." */
  verdict: string;
  /** the one headline number, pre-formatted */
  metricValue: string | number;
  metricUnit?: string;
  /** e.g. "vs 55% target" */
  targetLabel?: string;
  /** why it costs rounds — one sentence of supporting reasoning */
  costLine?: string;
  baseline: number;
  current: number;
  target: number;
  goodDirection?: 'up' | 'down';
  drillName: string;
  drillDuration?: string;
  /** improving = mint, regressing = orange */
  status?: 'improving' | 'regressing';
  assignedAgo?: string;
  onStartDrill?: () => void;
  /** small supporting stat cluster (proof riding along) */
  supporting?: FocusSupportingStat[];
  style?: React.CSSProperties;
}

/**
 * The Overview hero — verdict + one number + drill + baseline progress.
 * @startingPoint section="Coach" subtitle="The one-thing-to-fix hero card" viewport="900x340"
 */
export function FocusCard(props: FocusCardProps): JSX.Element;

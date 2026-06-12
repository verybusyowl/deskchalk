import React from 'react';

export interface EloRingProps {
  elo?: number;
  /** 0–1 fraction through the current level band */
  progress?: number;
  size?: number;
  level?: number;
  animate?: boolean;
  style?: React.CSSProperties;
}

/**
 * Animated ELO ring with count-up centre number (orange = ELO/heat).
 * @startingPoint section="Identity" subtitle="Animated ELO progress ring" viewport="700x220"
 */
export function EloRing(props: EloRingProps): JSX.Element;

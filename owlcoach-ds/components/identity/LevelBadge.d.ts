import React from 'react';

export interface LevelBadgeProps {
  /** FACEIT level 1–10 */
  level?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  style?: React.CSSProperties;
}

/** FACEIT skill-level chip with tier colour ramp. */
export function LevelBadge(props: LevelBadgeProps): JSX.Element;

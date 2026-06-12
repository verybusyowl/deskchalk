import React from 'react';

export interface BadgeProps {
  children?: React.ReactNode;
  tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'info';
  variant?: 'soft' | 'solid' | 'outline';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Small uppercase status/category token. */
export function Badge(props: BadgeProps): JSX.Element;

import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  action?: React.ReactNode;
  compact?: boolean;
  style?: React.CSSProperties;
}

/** "No data yet" panel that reads as pending, not broken. */
export function EmptyState(props: EmptyStateProps): JSX.Element;

import React from 'react';

declare module 'react';

export interface ButtonProps {
  children?: React.ReactNode;
  /** primary = mint commit, secondary = neutral surface, ghost = low-emphasis, danger = orange */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Primary action / control button. Uppercase Chakra Petch label.
 * @startingPoint section="Core" subtitle="Mint / surface / ghost / danger actions" viewport="700x180"
 */
export function Button(props: ButtonProps): JSX.Element;

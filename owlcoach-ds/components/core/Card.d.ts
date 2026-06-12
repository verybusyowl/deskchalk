import React from 'react';

export interface CardProps {
  children?: React.ReactNode;
  /** 2px top edge accent for at-a-glance good/bad signalling */
  accent?: 'none' | 'mint' | 'orange' | 'neutral';
  padding?: string | number;
  interactive?: boolean;
  as?: any;
  style?: React.CSSProperties;
}

/** The house surface container — hairline border, md radius, quiet inset light. */
export function Card(props: CardProps): JSX.Element;

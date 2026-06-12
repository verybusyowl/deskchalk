import React from 'react';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  shape?: 'rounded' | 'circle';
  ring?: 'none' | 'mint' | 'orange' | 'neutral';
  style?: React.CSSProperties;
}

/** Player avatar with initials fallback and optional accent ring. */
export function Avatar(props: AvatarProps): JSX.Element;

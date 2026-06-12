import React from 'react';

/**
 * Player avatar. Square-rounded by default (esports feel); circle optional.
 * Falls back to initials on a cool surface when no src. Optional accent ring.
 */
export function Avatar({ src = null, name = 'Player', size = 44, shape = 'rounded', ring = 'none', style = {}, ...rest }) {
  const ringColor = { none: 'transparent', mint: 'var(--mint)', orange: 'var(--orange)', neutral: 'var(--line-strong)' }[ring] || 'transparent';
  const radius = shape === 'circle' ? '50%' : 'var(--radius-sm)';
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: radius, overflow: 'hidden',
        background: 'var(--surface-3)', flexShrink: 0,
        border: ring === 'none' ? 'var(--border)' : `2px solid ${ringColor}`,
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: size * 0.38, color: 'var(--text-2)',
        ...style,
      }}
      {...rest}
    >
      {src
        ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </span>
  );
}

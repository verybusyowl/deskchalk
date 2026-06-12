import React from 'react';

/**
 * FACEIT level badge (1–10). Colour ramp keyed to skill tier — info only,
 * never decorative. Chevron glyph echoes the FACEIT mark without copying it.
 */
export function LevelBadge({ level = 1, size = 'md', showLabel = false, style = {}, ...rest }) {
  const color =
    level >= 10 ? 'var(--lvl-max)' :
    level >= 8 ? 'var(--lvl-high)' :
    level >= 4 ? 'var(--lvl-mid)' : 'var(--lvl-low)';

  const dim = size === 'sm' ? 22 : size === 'lg' ? 34 : 28;
  const fs = size === 'sm' ? 11 : size === 'lg' ? 16 : 13;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...style }} {...rest}>
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: dim, height: dim, position: 'relative',
          background: 'var(--surface-2)', border: `1.5px solid ${color}`,
          borderRadius: 'var(--radius-xs)',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: fs,
          color, lineHeight: 1,
        }}
      >
        {level}
      </span>
      {showLabel && <span className="owl-label" style={{ color: 'var(--text-3)' }}>LVL {level}</span>}
    </span>
  );
}

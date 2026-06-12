import React from 'react';

/**
 * Trend delta indicator. Colour is keyed to MEANING, not arrow direction:
 * mint = improvement, orange = regression. Because some metrics improve by
 * going DOWN (untraded-death %, time-to-damage), pass `goodDirection`.
 * `delta` is the signed change (recent-10 vs previous-10).
 */
export function TrendIndicator({
  delta,
  goodDirection = 'up',
  unit = '',
  size = 'md',
  showArrow = true,
  style = {},
  ...rest
}) {
  const isUp = delta > 0;
  const isFlat = delta === 0;
  const improved = isFlat ? null : (goodDirection === 'up' ? isUp : !isUp);

  const color = improved === null ? 'var(--text-3)'
    : improved ? 'var(--mint)' : 'var(--orange-bright)';

  const arrow = isFlat ? '→' : isUp ? '▲' : '▼';
  const fs = size === 'sm' ? 'var(--fs-2xs)' : size === 'lg' ? 'var(--fs-md)' : 'var(--fs-xs)';
  const mag = Math.abs(delta);
  const num = Number.isInteger(mag) ? mag : mag.toFixed(mag < 1 ? 2 : 1);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        color,
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: fs,
        fontWeight: 'var(--fw-medium)',
        ...style,
      }}
      title={improved === null ? 'No change' : improved ? 'Improving' : 'Regressing'}
      {...rest}
    >
      {showArrow && <span style={{ fontSize: '0.85em' }}>{arrow}</span>}
      {num}{unit}
    </span>
  );
}

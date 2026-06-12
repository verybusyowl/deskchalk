import React from 'react';
import { TrendIndicator } from '../data/TrendIndicator.jsx';

/**
 * A ranked coaching insight — either a FIX (orange tick) or a STRENGTH
 * (mint tick). Compact row: rank, title, one-line rationale, supporting
 * metric + trend. These are the bench behind Today's Focus, listed in
 * priority order. AI-generated copy goes in `detail`.
 */
export function InsightCard({
  rank = null,
  kind = 'fix',
  title,
  detail,
  metric = null,
  delta = null,
  goodDirection = 'up',
  style = {},
  ...rest
}) {
  const isStrength = kind === 'strength';
  const accent = isStrength ? 'var(--mint)' : 'var(--orange)';

  return (
    <div
      style={{
        display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
        padding: 'var(--space-4)',
        background: 'var(--surface-card)', border: 'var(--border)',
        borderRadius: 'var(--radius-md)', borderLeft: `2px solid ${accent}`,
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 22, paddingTop: 1 }}>
        {rank != null
          ? <span className="owl-stat" style={{ fontSize: 'var(--fs-lg)', color: accent }}>{rank}</span>
          : <span style={{ fontSize: 14, color: accent }}>{isStrength ? '✓' : '!'}</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="owl-label" style={{ color: accent }}>{isStrength ? 'Strength' : 'Fix'}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-md)', color: 'var(--text-1)' }}>{title}</span>
        </div>
        {detail && <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', color: 'var(--text-2)', lineHeight: 'var(--lh-normal)' }}>{detail}</p>}
      </div>

      {(metric != null) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          <span className="owl-num" style={{ fontSize: 'var(--fs-md)', color: 'var(--text-1)', fontWeight: 600 }}>{metric}</span>
          {delta != null && <TrendIndicator delta={delta} goodDirection={goodDirection} size="sm" />}
        </div>
      )}
    </div>
  );
}

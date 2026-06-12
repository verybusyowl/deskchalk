import React from 'react';
import { Card } from '../core/Card.jsx';
import { TrendIndicator } from './TrendIndicator.jsx';
import { Sparkline } from './Sparkline.jsx';

/**
 * Compact metric tile: tracked label, big Chakra-Petch value, signed trend,
 * optional sparkline. Supporting evidence — never the page headline. Value
 * is shown verbatim (already formatted), so pass "1.18" / "72%" / "84ms".
 */
export function StatCard({
  label,
  value,
  unit = '',
  delta = null,
  goodDirection = 'up',
  spark = null,
  emphasis = 'normal',
  style = {},
  ...rest
}) {
  return (
    <Card padding="var(--space-4)" style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style }} {...rest}>
      <div className="owl-label" style={{ color: 'var(--text-3)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span
            className="owl-stat"
            style={{ fontSize: emphasis === 'hero' ? 'var(--fs-3xl)' : 'var(--fs-2xl)', color: 'var(--text-1)' }}
          >
            {value}
          </span>
          {unit && <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)', color: 'var(--text-3)', fontWeight: 600 }}>{unit}</span>}
        </div>
        {spark && <Sparkline data={spark} tone={delta == null ? 'neutral' : (goodDirection === 'up' ? (delta >= 0 ? 'good' : 'bad') : (delta <= 0 ? 'good' : 'bad'))} width={72} height={24} />}
      </div>
      {delta != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendIndicator delta={delta} goodDirection={goodDirection} unit={unit} size="sm" />
          <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-4)', fontFamily: 'var(--font-body)' }}>vs prev 10</span>
        </div>
      )}
    </Card>
  );
}

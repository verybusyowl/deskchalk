import React from 'react';

/**
 * Progress-vs-baseline track. Plots three points on one axis — BASELINE
 * (value when the focus was assigned), CURRENT, and TARGET — so you can
 * see whether you're closing the gap. The fill runs baseline→current and
 * is mint when moving toward target, orange when moving away. Handles
 * metrics where lower is better (goodDirection="down").
 */
export function BaselineProgress({
  baseline,
  current,
  target,
  unit = '',
  goodDirection = 'down',
  label = 'vs baseline',
  height = 8,
  style = {},
  ...rest
}) {
  const vals = [baseline, current, target];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo || 1) * 0.18;
  const dMin = lo - pad;
  const dMax = hi + pad;
  const pos = (v) => ((v - dMin) / (dMax - dMin)) * 100;

  const improvedAmt = goodDirection === 'down' ? baseline - current : current - baseline;
  const improving = improvedAmt > 0;
  const accent = improving ? 'var(--mint)' : 'var(--orange)';

  const bPos = pos(baseline);
  const cPos = pos(current);
  const tPos = pos(target);
  const fillLeft = Math.min(bPos, cPos);
  const fillW = Math.abs(cPos - bPos);

  const fmt = (v) => (Number.isInteger(v) ? v : v.toFixed(v < 1 ? 2 : 1)) + unit;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }} {...rest}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="owl-label">{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: accent, fontWeight: 600 }}>
          {improving ? '−' : '+'}{fmt(Math.abs(improvedAmt)).replace(unit, '')}{unit} {improving ? 'closer' : 'further'}
        </span>
      </div>

      <div style={{ position: 'relative', height: height + 18 }}>
        {/* track */}
        <div style={{ position: 'absolute', top: 9, left: 0, right: 0, height, background: 'var(--surface-3)', borderRadius: 99 }} />
        {/* progress fill baseline→current */}
        <div style={{ position: 'absolute', top: 9, left: `${fillLeft}%`, width: `${fillW}%`, height, background: accent, borderRadius: 99, transition: 'all var(--dur-slow) var(--ease-out)' }} />
        {/* baseline tick (ghost) */}
        <div style={{ position: 'absolute', top: 5, left: `${bPos}%`, transform: 'translateX(-50%)', width: 2, height: height + 8, background: 'var(--text-4)', borderRadius: 2 }} title={`Baseline ${fmt(baseline)}`} />
        {/* target flag (mint) */}
        <div style={{ position: 'absolute', top: 3, left: `${tPos}%`, transform: 'translateX(-50%)', width: 2, height: height + 12, background: 'var(--mint)', borderRadius: 2 }} title={`Target ${fmt(target)}`} />
        {/* current knob */}
        <div style={{ position: 'absolute', top: 9 + height / 2, left: `${cPos}%`, transform: 'translate(-50%,-50%)', width: height + 6, height: height + 6, borderRadius: 99, background: accent, boxShadow: '0 0 0 3px var(--surface-card)' }} title={`Current ${fmt(current)}`} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-4)' }}>
        <span>base {fmt(baseline)}</span>
        <span style={{ color: 'var(--mint)' }}>target {fmt(target)}</span>
      </div>
    </div>
  );
}

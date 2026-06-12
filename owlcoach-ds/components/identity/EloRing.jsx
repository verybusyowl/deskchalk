import React from 'react';

/**
 * Animated ELO ring. SVG arc that sweeps to `progress` (0–1 through the
 * current level band) on mount, with the ELO number counting up in the
 * centre. Ring tone is orange (ELO = heat). Honours reduced-motion.
 */
export function EloRing({
  elo = 1350,
  progress = 0.5,
  size = 132,
  level = 6,
  animate = true,
  style = {},
  ...rest
}) {
  const stroke = 8;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = React.useState(animate ? 0 : progress);
  const [num, setNum] = React.useState(animate ? 0 : elo);

  React.useEffect(() => {
    if (!animate) { setShown(progress); setNum(elo); return; }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(progress); setNum(elo); return; }
    let raf; const t0 = performance.now(); const dur = 900;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(progress * e);
      setNum(Math.round(elo * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [elo, progress, animate]);

  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }} {...rest}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--orange)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown)}
          style={{ filter: 'drop-shadow(0 0 6px var(--orange-glow))' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <span className="owl-label" style={{ color: 'var(--text-3)', fontSize: '9px' }}>ELO</span>
        <span className="owl-stat" style={{ fontSize: size * 0.27, color: 'var(--text-1)' }}>{num}</span>
        <span className="owl-label" style={{ color: 'var(--orange)', fontSize: '9px' }}>LVL {level}</span>
      </div>
    </div>
  );
}

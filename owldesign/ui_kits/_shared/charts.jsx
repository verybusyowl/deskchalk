/* ============================================================================
   OWL.COACH — Charts & stat tiles (shared)
============================================================================ */

/* Build a smooth-ish polyline path from values normalized into a box */
function buildPath(values, w, h, pad = 2) {
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);
  return values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - (v - min) / span);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

/* ---------------------------------------------------------------- Sparkline */
function Sparkline({ data, w = 96, h = 32, color = 'var(--fg-2)', strokeWidth = 2, style }) {
  const d = buildPath(data, w, h, 3);
  const up = data[data.length - 1] >= data[0];
  const col = color === 'auto' ? (up ? 'var(--win)' : 'var(--loss)') : color;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible', ...style }}>
      <path d={d} fill="none" stroke={col} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------------------------------------------------------- AreaChart (ELO history style) */
function AreaChart({ data, w = 640, h = 200, color = 'var(--heat)', yTicks = [], markers = [] }) {
  const pad = 4;
  const line = buildPath(data, w, h, pad);
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const step = (w - pad * 2) / (data.length - 1);
  const lastX = pad + (data.length - 1) * step;
  const area = `${line} L${lastX},${h} L${pad},${h} Z`;
  const gid = 'g' + Math.round(Math.random() * 1e6);
  const [draw, setDraw] = useState(0);
  useEffect(() => { const t = setTimeout(() => setDraw(1), 80); return () => clearTimeout(t); }, []);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <clipPath id={gid + 'c'}><rect x="0" y="0" width={w * draw} height={h} style={{ transition: 'width 900ms var(--ease-out)' }} /></clipPath>
      </defs>
      {/* grid */}
      {yTicks.map((t, i) => {
        const y = pad + (h - pad * 2) * (1 - (t.v - min) / span);
        return <g key={i}>
          <line x1="0" x2={w} y1={y} y2={y} stroke="var(--viz-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </g>;
      })}
      {/* season markers (dashed verticals) */}
      {markers.map((m, i) => {
        const x = pad + m.i * step;
        return <line key={i} x1={x} x2={x} y1="0" y2={h} stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />;
      })}
      <g clipPath={`url(#${gid}c)`}>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={lastX} cy={pad + (h - pad * 2) * (1 - (data[data.length - 1] - min) / span)} r="3.5" fill={color} stroke="var(--bg-3)" strokeWidth="2" />
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------- StatTile (label / big number / spark) */
function StatTile({ label, value, sub, spark, sparkColor = 'auto', ring, tone, icon, cut, style }) {
  const accent = tone === 'heat' ? 'var(--heat)' : tone === 'win' ? 'var(--win)' : tone === 'loss' ? 'var(--loss)' : 'var(--fg-1)';
  return (
    <div className={cut ? 'cut-corner' : ''} style={{
      background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: cut ? 0 : 'var(--r-md)',
      padding: 'var(--s-4) var(--s-5)', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <Icon name={icon} size={15} style={{ color: 'var(--fg-3)' }} />}
        <span style={{ font: 'var(--label)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: 'var(--stat-lg)', color: accent, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{value}</div>
          {sub && <div style={{ marginTop: 4 }}>{sub}</div>}
        </div>
        {spark && <Sparkline data={spark} color={sparkColor} w={60} h={26} style={{ flex: '0 0 auto' }} />}
        {ring}
      </div>
    </div>
  );
}

Object.assign(window, { Sparkline, AreaChart, StatTile, buildPath });

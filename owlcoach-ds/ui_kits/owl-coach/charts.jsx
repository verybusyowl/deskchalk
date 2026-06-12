/* Hand-drawn SVG charts + small data displays for the kit. No chart libs. */
const { Badge: _CBadge } = window.OWLCOACHDesignSystem_013434;

/* ELO / rating trend line ---------------------------------------- */
function EloTrendChart({ data, height = 120 }) {
  const w = 100, pad = 6;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [pad + i * stepX, pad + (height - pad * 2) * (1 - (v - min) / span)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`;
  const up = data[data.length - 1] >= data[0];
  const col = up ? 'var(--mint)' : 'var(--orange)';
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
        <defs>
          <linearGradient id="eloFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={col} stopOpacity="0.20" />
            <stop offset="1" stopColor={col} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#eloFill)" />
        <path d={line} fill="none" stroke={col} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.4" fill={col} />
      </svg>
      <div style={{ position: 'absolute', top: 0, right: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: col }}>{max}</div>
      <div style={{ position: 'absolute', bottom: 0, right: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-4)' }}>{min}</div>
    </div>
  );
}

/* Recent form W/L strip ------------------------------------------ */
function FormStrip({ form }) {
  const wins = form.filter((f) => f.result === 'W').length;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span className="owl-label">Recent form</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)' }}>
          <span style={{ color: 'var(--mint)' }}>{wins}W</span> · <span style={{ color: 'var(--orange)' }}>{form.length - wins}L</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {form.map((f, i) => {
          const win = f.result === 'W';
          return (
            <div key={i} title={`${f.map} · ${f.elo > 0 ? '+' : ''}${f.elo} ELO · ${f.kd} K/D`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 44, borderRadius: 'var(--radius-sm)',
                background: win ? 'var(--mint-ghost)' : 'var(--orange-ghost)',
                border: `1px solid ${win ? 'var(--mint-line)' : 'var(--orange-line)'}`,
              }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: win ? 'var(--mint)' : 'var(--orange-bright)' }}>{f.result}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-4)' }}>{f.elo > 0 ? '+' : ''}{f.elo}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Map strength table best -> worst ------------------------------- */
function MapStrengthTable({ winRates, onPick }) {
  const rows = Object.entries(winRates).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows.map(([map, wr]) => {
        const tone = wr >= 55 ? 'var(--mint)' : wr < 45 ? 'var(--orange)' : 'var(--text-2)';
        return (
          <button key={map} className="owl-maprow" onClick={() => onPick && onPick(map)}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text-1)', width: 78, textAlign: 'left' }}>{map}</span>
            <span style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${wr}%`, background: tone, borderRadius: 99 }} />
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: tone, width: 38, textAlign: 'right' }}>{wr}%</span>
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, { EloTrendChart, FormStrip, MapStrengthTable });

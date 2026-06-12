import React from 'react';

/**
 * Hand-drawn SVG sparkline. No chart libs. Renders a polyline (optional
 * area fill + last-point dot) from an array of numbers, auto-scaled.
 * Colour defaults to neutral; pass tone to tint mint/orange.
 */
export function Sparkline({
  data = [],
  width = 96,
  height = 28,
  tone = 'neutral',
  fill = true,
  dot = true,
  strokeWidth = 1.75,
  style = {},
  ...rest
}) {
  const colors = {
    neutral: 'var(--text-3)',
    good: 'var(--mint)',
    bad: 'var(--orange)',
    info: 'var(--info)',
  };
  const stroke = colors[tone] || colors.neutral;
  const uid = React.useMemo(() => 'spk' + Math.random().toString(36).slice(2, 8), []);

  if (!data.length) return <svg width={width} height={height} style={style} {...rest} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = strokeWidth + 1;
  const stepX = (width - pad * 2) / (data.length - 1 || 1);
  const pts = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return [x, y];
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible', ...style }} {...rest}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${uid})`} />}
      <path d={line} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {dot && <circle cx={last[0]} cy={last[1]} r={strokeWidth + 0.5} fill={stroke} />}
    </svg>
  );
}

/* ============================================================================
   OWL.COACH — Primitive components (shared UI kit)
   Cosmetic recreations, not production code. Exports to window for cross-file use.
============================================================================ */
const { useState, useEffect, useRef } = React;

/* ---------------------------------------------------------------- Icon */
function Icon({ name, size = 18, stroke = 2, style, className }) {
  const inner = window.OWL_ICONS[name] || window.OWL_ICONS.dot || '<circle cx="12" cy="12" r="2"/>';
  return (
    <span className={className} style={{ display: 'inline-flex', width: size, height: size, flex: '0 0 auto', ...style }}
      dangerouslySetInnerHTML={{ __html:
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>` }} />
  );
}

/* ---------------------------------------------------------------- Button */
function Button({ children, variant = 'primary', size = 'md', icon, iconRight, cut, onClick, style, title }) {
  const [press, setPress] = useState(false);
  const sizes = {
    sm: { padding: '0 12px', height: 30, font: '600 12.5px/1 var(--font-display)', gap: 6, iconSize: 15 },
    md: { padding: '0 16px', height: 38, font: '600 13.5px/1 var(--font-display)', gap: 8, iconSize: 17 },
    lg: { padding: '0 22px', height: 46, font: '700 15px/1 var(--font-display)', gap: 9, iconSize: 19 },
  }[size];
  const variants = {
    primary: { background: 'var(--brand)', color: 'var(--brand-fg)', border: '1px solid transparent' },
    heat: { background: 'var(--heat)', color: 'var(--heat-fg)', border: '1px solid transparent' },
    ghost: { background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--line-2)' },
    solid: { background: 'var(--bg-4)', color: 'var(--fg-1)', border: '1px solid var(--line-2)' },
    danger: { background: 'transparent', color: 'var(--loss)', border: '1px solid var(--loss-soft)' },
  }[variant];
  const [hover, setHover] = useState(false);
  const hoverFx = hover ? (variant === 'primary' ? { background: 'var(--brand-bright)' }
    : variant === 'heat' ? { background: 'var(--heat-bright)' }
    : { borderColor: 'var(--line-3)', color: 'var(--fg-1)', background: variant === 'ghost' ? 'var(--bg-3)' : 'var(--bg-5)' }) : {};
  return (
    <button title={title} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)} onMouseUp={() => setPress(false)}
      className={cut ? 'cut-corner' : ''}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: sizes.gap,
        height: sizes.height, padding: sizes.padding, font: sizes.font, letterSpacing: '0.04em',
        textTransform: 'uppercase', borderRadius: cut ? 0 : 'var(--r-sm)', cursor: 'pointer',
        transition: 'all var(--dur-1) var(--ease-out)', whiteSpace: 'nowrap',
        transform: press ? 'scale(0.975)' : 'none', ...variants, ...hoverFx, ...style,
      }}>
      {icon && <Icon name={icon} size={sizes.iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={sizes.iconSize} />}
    </button>
  );
}

/* ---------------------------------------------------------------- Card */
function Card({ children, pad = 'var(--s-5)', cut, glow, style, hover: hoverable, onClick, className }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={(cut ? 'cut-corner ' : '') + (className || '')}
      style={{
        background: 'var(--bg-3)', border: '1px solid var(--line-2)',
        borderRadius: cut ? 0 : 'var(--r-md)', padding: pad,
        boxShadow: glow === 'brand' ? 'var(--glow-brand)' : glow === 'heat' ? 'var(--glow-heat)' : 'var(--shadow-card)',
        transition: 'border-color var(--dur-2) var(--ease), background var(--dur-2) var(--ease)',
        cursor: onClick ? 'pointer' : 'default',
        borderColor: hoverable && hover ? 'var(--line-3)' : (glow ? 'transparent' : 'var(--line-2)'),
        ...style,
      }}>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- Eyebrow / SectionTitle */
function Eyebrow({ icon, children, right, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--s-4)', ...style }}>
      {icon && <Icon name={icon} size={16} style={{ color: 'var(--fg-3)' }} />}
      <span style={{ font: 'var(--label)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg-2)' }}>{children}</span>
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
}

/* ---------------------------------------------------------------- Pill / Chip / Tag */
function Pill({ children, tone = 'neutral', icon, size = 'md', style }) {
  const tones = {
    neutral: { bg: 'var(--bg-4)', fg: 'var(--fg-2)', bd: 'var(--line-2)' },
    brand: { bg: 'var(--brand-soft)', fg: 'var(--brand)', bd: 'var(--brand-line)' },
    heat: { bg: 'var(--heat-soft)', fg: 'var(--heat-bright)', bd: 'var(--heat-line)' },
    win: { bg: 'var(--win-soft)', fg: 'var(--win)', bd: 'rgba(25,229,155,0.3)' },
    loss: { bg: 'var(--loss-soft)', fg: 'var(--loss)', bd: 'rgba(255,59,84,0.3)' },
    warn: { bg: 'var(--warn-soft)', fg: 'var(--warn)', bd: 'rgba(255,194,75,0.3)' },
    info: { bg: 'var(--info-soft)', fg: 'var(--info)', bd: 'rgba(77,158,255,0.3)' },
  }[tone];
  const h = size === 'sm' ? 20 : 24;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, height: h, padding: `0 ${size === 'sm' ? 8 : 10}px`,
      background: tones.bg, color: tones.fg, border: `1px solid ${tones.bd}`, borderRadius: 'var(--r-pill)',
      font: `600 ${size === 'sm' ? 10.5 : 11.5}px/1 var(--font-display)`, letterSpacing: '0.04em', textTransform: 'uppercase',
      whiteSpace: 'nowrap', ...style,
    }}>
      {icon && <Icon name={icon} size={size === 'sm' ? 11 : 13} />}
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Delta (signed, colored) */
function Delta({ value, suffix = '', size = 14, showIcon = true }) {
  const pos = value >= 0;
  const col = pos ? 'var(--win)' : 'var(--loss)';
  const txt = (pos ? '+' : '−') + Math.abs(value).toLocaleString() + suffix;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: col, font: `700 ${size}px/1 var(--font-display)`, fontVariantNumeric: 'tabular-nums' }}>
      {showIcon && <Icon name={pos ? 'trendUp' : 'trendDown'} size={size} stroke={2.4} />}
      {txt}
    </span>
  );
}

/* ---------------------------------------------------------------- SkillHex (FACEIT level 1-10) */
function SkillHex({ level = 6, size = 38 }) {
  const col = `var(--lvl-${level})`;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
      <svg width={size} height={size} viewBox="0 0 40 40" style={{ position: 'absolute', inset: 0 }}>
        <path d="M20 1.5 35.5 10.5 35.5 29.5 20 38.5 4.5 29.5 4.5 10.5Z" fill="rgba(0,0,0,0.35)" stroke={col} strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <span style={{ position: 'relative', font: `700 ${size * 0.4}px/1 var(--font-display)`, color: col, fontVariantNumeric: 'tabular-nums' }}>{level}</span>
    </span>
  );
}

/* ---------------------------------------------------------------- EloRing (orange arc + level) */
function EloRing({ elo = 1319, level = 6, size = 132, label }) {
  const r = size / 2 - 9, c = 2 * Math.PI * r;
  const pct = Math.min(1, ((elo % 250) || 250) / 250); // arc within current band
  const [arc, setArc] = useState(0);
  useEffect(() => { const t = setTimeout(() => setArc(pct), 60); return () => clearTimeout(t); }, [pct]);
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: -size * 0.18, background: 'radial-gradient(circle, rgba(255,106,44,0.22), transparent 65%)' }} />
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--heat)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - arc)} style={{ transition: 'stroke-dashoffset 900ms var(--ease-out)', filter: 'drop-shadow(0 0 6px rgba(255,106,44,0.55))' }} />
      </svg>
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <SkillHex level={level} size={size * 0.3} />
        <div style={{ font: '700 ' + (size * 0.24) + 'px/1 var(--font-display)', color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{elo.toLocaleString()}</div>
        {label && <div style={{ font: 'var(--label)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg-3)', marginTop: 4 }}>{label}</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- W/L pill row */
function WL({ result }) {
  const win = result === 'W';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22,
      borderRadius: 'var(--r-xs)', font: '700 11px/1 var(--font-display)',
      background: win ? 'var(--win-soft)' : 'var(--loss-soft)', color: win ? 'var(--win)' : 'var(--loss)',
      border: `1px solid ${win ? 'rgba(25,229,155,0.3)' : 'rgba(255,59,84,0.3)'}`,
    }}>{result}</span>
  );
}

/* ---------------------------------------------------------------- Source chip (FACEIT / Steam) */
function SourceChip({ source = 'faceit', size = 'md' }) {
  const cfg = source === 'steam'
    ? { icon: 'steam', label: 'STEAM', col: '#7bb3d6' }
    : { icon: 'crosshair', label: 'FACEIT', col: 'var(--heat-bright)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: size === 'sm' ? 18 : 22, padding: '0 8px',
      background: 'var(--bg-4)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)',
      font: '600 10px/1 var(--font-display)', letterSpacing: '0.1em', color: cfg.col }}>
      <Icon name={cfg.icon} size={size === 'sm' ? 11 : 12} />{cfg.label}
    </span>
  );
}

/* ---------------------------------------------------------------- Avatar */
function Avatar({ src, size = 40, ring, alt = '', round, name }) {
  return (
    <span style={{ display: 'inline-flex', width: size, height: size, borderRadius: round ? '50%' : 'var(--r-md)', overflow: 'hidden',
      background: 'var(--bg-4)', border: ring ? '2px solid var(--brand)' : '1px solid var(--line-2)', flex: '0 0 auto',
      alignItems: 'center', justifyContent: 'center' }}>
      {src ? <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: size > 80 ? '18%' : '0' }} />
        : name ? <span style={{ font: `700 ${size * 0.4}px/1 var(--font-display)`, color: 'var(--brand)' }}>{name[0].toUpperCase()}</span>
        : <Icon name="users" size={size * 0.5} style={{ color: 'var(--fg-3)' }} />}
    </span>
  );
}

Object.assign(window, { Icon, Button, Card, Eyebrow, Pill, Delta, SkillHex, EloRing, WL, SourceChip, Avatar });

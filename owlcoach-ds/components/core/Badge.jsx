import React from 'react';

/**
 * Small status / category token. Soft tint by default. Tone maps to the
 * semantic palette: good=mint, bad=orange, warn=amber, info=blue, neutral=slate.
 */
export function Badge({
  children,
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  icon = null,
  style = {},
  ...rest
}) {
  const tones = {
    neutral: { c: 'var(--text-2)', ghost: 'var(--surface-3)', line: 'var(--line-strong)', solidBg: 'var(--surface-3)', solidFg: 'var(--text-1)' },
    good:    { c: 'var(--mint)', ghost: 'var(--mint-ghost)', line: 'var(--mint-line)', solidBg: 'var(--mint)', solidFg: 'var(--text-on-accent)' },
    bad:     { c: 'var(--orange-bright)', ghost: 'var(--orange-ghost)', line: 'var(--orange-line)', solidBg: 'var(--orange)', solidFg: '#1a0c05' },
    warn:    { c: 'var(--warn)', ghost: 'var(--warn-ghost)', line: 'rgba(255,194,75,0.34)', solidBg: 'var(--warn)', solidFg: '#1d1503' },
    info:    { c: 'var(--info)', ghost: 'var(--info-ghost)', line: 'rgba(74,168,255,0.34)', solidBg: 'var(--info)', solidFg: '#04121f' },
  };
  const t = tones[tone] || tones.neutral;
  const pad = size === 'sm' ? '2px 7px' : '3px 9px';
  const fs = size === 'sm' ? '10px' : 'var(--fs-2xs)';

  const skin =
    variant === 'solid' ? { background: t.solidBg, color: t.solidFg, border: '1px solid transparent' }
    : variant === 'outline' ? { background: 'transparent', color: t.c, border: `1px solid ${t.line}` }
    : { background: t.ghost, color: t.c, border: `1px solid ${t.line}` };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: pad,
        borderRadius: 'var(--radius-xs)',
        fontFamily: 'var(--font-display)',
        fontSize: fs,
        fontWeight: 'var(--fw-semibold)',
        letterSpacing: 'var(--ls-wide)',
        textTransform: 'uppercase',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...skin,
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

import React from 'react';

/**
 * Graceful empty state for demo-derived panels with no data yet (common
 * on rarely-played maps). Reads as "nothing to show YET", never as broken:
 * dashed well, muted glyph, plain reason, optional nudge action.
 */
export function EmptyState({
  icon = null,
  title = 'No demo data yet',
  message = 'Play a few matches on this map and the breakdown will appear here.',
  action = null,
  compact = false,
  style = {},
  ...rest
}) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', gap: 'var(--space-3)',
        padding: compact ? 'var(--space-5)' : 'var(--space-8) var(--space-6)',
        background: 'transparent',
        border: '1px dashed var(--line-strong)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-3)',
        ...style,
      }}
      {...rest}
    >
      {icon && <div style={{ color: 'var(--text-4)', display: 'flex' }}>{icon}</div>}
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-md)', color: 'var(--text-2)' }}>{title}</div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', color: 'var(--text-3)', maxWidth: 300, lineHeight: 'var(--lh-normal)' }}>{message}</p>
      {action}
    </div>
  );
}

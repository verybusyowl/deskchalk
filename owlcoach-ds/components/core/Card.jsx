import React from 'react';

/**
 * Base surface container. The house card: 1px hairline, md radius, quiet
 * inset top-light. `accent` paints a 2px top edge (mint/orange) for the
 * rare card that needs to signal good/bad at a glance. `as` lets it be a
 * <section> etc. `interactive` adds hover lift.
 */
export function Card({
  children,
  accent = 'none',
  padding = 'var(--space-5)',
  interactive = false,
  as: Tag = 'div',
  style = {},
  ...rest
}) {
  const accents = {
    none: 'transparent',
    mint: 'var(--mint)',
    orange: 'var(--orange)',
    neutral: 'var(--line-strong)',
  };
  const edge = accents[accent] || 'transparent';

  return (
    <Tag
      style={{
        position: 'relative',
        background: 'var(--surface-card)',
        border: 'var(--border)',
        borderRadius: 'var(--radius-md)',
        padding,
        boxShadow: 'var(--inset-top)',
        transition: 'border-color var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
        ...(accent !== 'none'
          ? { borderTop: `2px solid ${edge}` }
          : {}),
        ...style,
      }}
      {...(interactive
        ? {
            onMouseEnter: (e) => { e.currentTarget.style.borderColor = 'var(--line-strong)'; e.currentTarget.style.transform = 'translateY(-2px)'; },
            onMouseLeave: (e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = 'translateY(0)'; },
          }
        : {})}
      {...rest}
    >
      {children}
    </Tag>
  );
}

import React from 'react';

/**
 * OWL.COACH primary action / control. Mint = commit/go, surface = neutral,
 * ghost = low-emphasis, danger = orange (regression/destructive).
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft = null,
  iconRight = null,
  fullWidth = false,
  disabled = false,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: { padding: '0 12px', height: 32, fontSize: 'var(--fs-xs)' },
    md: { padding: '0 16px', height: 40, fontSize: 'var(--fs-sm)' },
    lg: { padding: '0 22px', height: 48, fontSize: 'var(--fs-md)' },
  };

  const variants = {
    primary: {
      background: 'var(--mint)',
      color: 'var(--text-on-accent)',
      border: '1px solid transparent',
    },
    secondary: {
      background: 'var(--surface-2)',
      color: 'var(--text-1)',
      border: '1px solid var(--line-strong)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-2)',
      border: '1px solid transparent',
    },
    danger: {
      background: 'var(--orange-ghost)',
      color: 'var(--orange-bright)',
      border: '1px solid var(--orange-line)',
    },
  };

  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.primary;

  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: fullWidth ? '100%' : 'auto',
        height: s.height,
        padding: s.padding,
        fontFamily: 'var(--font-display)',
        fontSize: s.fontSize,
        fontWeight: 'var(--fw-semibold)',
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        whiteSpace: 'nowrap',
        transition: 'filter var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
        ...v,
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'translateY(1px)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.filter = 'none'; }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = 'brightness(1.12)'; }}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}

import React from 'react';

const MAP_ABBR = {
  'Mirage': 'MRG', 'Inferno': 'INF', 'Nuke': 'NUK', 'Ancient': 'ANC',
  'Anubis': 'ANB', 'Dust2': 'DU2', 'Vertigo': 'VTG', 'Train': 'TRN', 'Overpass': 'OVP',
};

/**
 * Always-visible map picker. Horizontal scroll row of pills; the selected
 * map gets a mint fill. Each pill can carry a tiny win% so the picker
 * doubles as a strength glance. Controlled via `value` + `onChange`.
 * Persist the last selection in localStorage at the call site.
 */
export function MapPills({
  maps = ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Dust2', 'Vertigo', 'Train'],
  value,
  winRates = {},
  onChange,
  style = {},
  ...rest
}) {
  return (
    <div
      role="tablist"
      style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 4, ...style }}
      {...rest}
    >
      {maps.map((m) => {
        const active = m === value;
        const wr = winRates[m];
        const wrTone = wr == null ? 'var(--text-4)' : wr >= 55 ? 'var(--mint)' : wr < 45 ? 'var(--orange)' : 'var(--text-3)';
        return (
          <button
            key={m}
            role="tab"
            aria-selected={active}
            onClick={() => onChange && onChange(m)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
              padding: '8px 14px', flexShrink: 0,
              background: active ? 'var(--mint)' : 'var(--surface-2)',
              border: active ? '1px solid var(--mint)' : '1px solid var(--line)',
              borderRadius: 'var(--radius-pill)',
              transition: 'all var(--dur-fast) var(--ease-out)',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--line-strong)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--line)'; }}
          >
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-sm)',
              letterSpacing: '0.02em', lineHeight: 1,
              color: active ? 'var(--text-on-accent)' : 'var(--text-1)',
            }}>{m}</span>
            {wr != null && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', lineHeight: 1,
                color: active ? 'rgba(7,18,12,0.7)' : wrTone,
              }}>{wr}% WR</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

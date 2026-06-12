/* App shell: slim left rail on desktop, top bar + bottom tab nav on mobile.
   Uses the design-system bundle for Avatar/LevelBadge/Button. */
const { Avatar: _Avatar, LevelBadge: _LevelBadge, Button: _SBtn } = window.OWLCOACHDesignSystem_013434;

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'layout-dashboard' },
  { id: 'maps', label: 'Maps', icon: 'map' },
  { id: 'replay', label: 'Replay', icon: 'play' },
];

function NavRail({ view, onView, onAsk }) {
  return (
    <nav className="owl-rail">
      <a className="owl-rail-logo" href="#" onClick={(e) => { e.preventDefault(); onView('overview'); }}>
        <img src="../../assets/owl-mark.svg" alt="OWL.COACH" width="34" height="34" />
      </a>
      <div className="owl-rail-items">
        {NAV.map((n) => (
          <button key={n.id} className={'owl-rail-btn' + (view === n.id ? ' is-active' : '')} onClick={() => onView(n.id)}>
            <Icon name={n.icon} size={20} />
            <span>{n.label}</span>
          </button>
        ))}
      </div>
      <button className="owl-rail-ask" onClick={onAsk} title="Ask the coach">
        <Icon name="message-square-text" size={20} />
        <span>Ask</span>
      </button>
    </nav>
  );
}

function TopBar({ onAsk }) {
  const d = window.OWL_DATA;
  return (
    <header className="owl-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <img src="../../assets/owl-mark.svg" alt="" width="28" height="28" />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-1)', letterSpacing: '.03em' }}>OWL<span style={{ color: 'var(--mint)' }}>.</span>COACH</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)' }}>
          <Icon name="flame" size={14} />{d.player.elo}
        </span>
        <button className="owl-icon-btn" onClick={onAsk} aria-label="Ask the coach"><Icon name="message-square-text" size={20} /></button>
      </div>
    </header>
  );
}

function BottomNav({ view, onView, onAsk }) {
  return (
    <nav className="owl-bottomnav">
      {NAV.map((n) => (
        <button key={n.id} className={'owl-bn-btn' + (view === n.id ? ' is-active' : '')} onClick={() => onView(n.id)}>
          <Icon name={n.icon} size={22} />
          <span>{n.label}</span>
        </button>
      ))}
      <button className="owl-bn-btn owl-bn-ask" onClick={onAsk}>
        <Icon name="message-square-text" size={22} />
        <span>Ask</span>
      </button>
    </nav>
  );
}

Object.assign(window, { NavRail, TopBar, BottomNav });

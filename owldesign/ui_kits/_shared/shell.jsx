/* ============================================================================
   OWL.COACH — App shell: left nav rail, right utility rail, scaffolding
============================================================================ */

const NAV_MAIN = [
  { id: 'coach', icon: 'target', label: 'Coach' },
  { id: 'track', icon: 'track', label: 'Track' },
  { id: 'matches', icon: 'swords', label: 'Matches' },
  { id: 'profile', icon: 'award', label: 'Profile' },
  { id: 'feed', icon: 'feed', label: 'Feed' },
];
const NAV_SECTION = [
  { id: 'party', icon: 'users', label: 'Party Finder' },
  { id: 'clubs', icon: 'shield', label: 'Clubs' },
];
const NAV_BOTTOM = [
  { id: 'missions', icon: 'crosshair', label: 'Missions' },
  { id: 'premium', icon: 'star', label: 'Premium' },
  { id: 'settings', icon: 'sliders', label: 'Settings' },
];

function NavItem({ item, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 13, width: '100%',
        padding: '9px 14px 9px 16px', background: active ? 'var(--brand-soft)' : hover ? 'var(--bg-3)' : 'transparent',
        border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', textAlign: 'left',
        color: active ? 'var(--fg-1)' : hover ? 'var(--fg-1)' : 'var(--fg-2)', transition: 'all var(--dur-1) var(--ease-out)',
      }}>
      {active && <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, background: 'var(--brand)', boxShadow: '0 0 10px var(--brand)' }} />}
      <Icon name={item.icon} size={19} style={{ color: active ? 'var(--brand)' : 'inherit' }} />
      <span style={{ font: '600 14px/1 var(--font-display)', letterSpacing: '0.02em' }}>{item.label}</span>
    </button>
  );
}

function LeftRail({ active = 'coach', onNav = () => {} }) {
  return (
    <nav style={{
      width: 232, flex: '0 0 232px', height: '100%', background: 'var(--bg-1)', borderRight: '1px solid var(--line-1)',
      display: 'flex', flexDirection: 'column', padding: '18px 12px 16px', gap: 4, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 8px 16px' }}>
        <img src="../_shared/owl-mark.svg" width="30" height="30" alt="" />
        <div style={{ font: '700 18px/1 var(--font-display)', color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>
          OWL<span style={{ color: 'var(--brand)' }}>.</span>COACH
        </div>
      </div>
      {/* fake search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', height: 38, margin: '0 0 10px',
        background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)', color: 'var(--fg-3)' }}>
        <Icon name="search" size={17} /><span style={{ font: 'var(--ui-sm)' }}>Search</span>
      </div>
      {NAV_MAIN.map(i => <NavItem key={i.id} item={i} active={active === i.id} onClick={() => onNav(i.id)} />)}
      <div style={{ height: 1, background: 'var(--line-1)', margin: '10px 12px' }} />
      {NAV_SECTION.map(i => <NavItem key={i.id} item={i} active={active === i.id} onClick={() => onNav(i.id)} />)}
      <div style={{ flex: 1 }} />
      {NAV_BOTTOM.map(i => <NavItem key={i.id} item={i} active={active === i.id} onClick={() => onNav(i.id)} />)}
    </nav>
  );
}

function RailIcon({ icon, badge, active, title }) {
  const [hover, setHover] = useState(false);
  return (
    <button title={title} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      position: 'relative', width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: hover ? 'var(--bg-3)' : 'transparent', border: '1px solid ' + (hover ? 'var(--line-2)' : 'transparent'),
      borderRadius: 'var(--r-sm)', cursor: 'pointer', color: active || hover ? 'var(--fg-1)' : 'var(--fg-3)', transition: 'all var(--dur-1)',
    }}>
      <Icon name={icon} size={19} />
      {badge && <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 15, height: 15, padding: '0 3px',
        background: 'var(--heat)', color: 'var(--heat-fg)', borderRadius: 999, font: '700 9px/15px var(--font-display)',
        textAlign: 'center', border: '2px solid var(--bg-1)' }}>{badge}</span>}
    </button>
  );
}

function RightRail({ avatar }) {
  return (
    <aside style={{
      width: 60, flex: '0 0 60px', height: '100%', background: 'var(--bg-1)', borderLeft: '1px solid var(--line-1)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 8,
    }}>
      <Avatar src={avatar} size={36} ring />
      <div style={{ width: 24, height: 1, background: 'var(--line-2)', margin: '4px 0' }} />
      <RailIcon icon="swords" title="Quick match" />
      <RailIcon icon="bell" badge="1" title="Notifications" />
      <RailIcon icon="users" title="Party" />
      <RailIcon icon="rank" badge="1" title="Stats" />
      <RailIcon icon="plusCircle" title="Add friend" />
      <div style={{ flex: 1 }} />
      <RailIcon icon="headphones" title="Voice" />
    </aside>
  );
}

/* AppShell: fixed rails + scrollable center column */
function AppShell({ active, onNav, avatar, children, maxWidth = 1180 }) {
  return (
    <div className="owl" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-0)' }}>
      <LeftRail active={active} onNav={onNav} />
      <main style={{ flex: 1, height: '100%', overflowY: 'auto', overflowX: 'hidden', background: 'var(--bg-1)' }}>
        <div style={{ maxWidth, margin: '0 auto', padding: '24px 32px 64px' }}>{children}</div>
      </main>
      <RightRail avatar={avatar} />
    </div>
  );
}

/* Tab bar used inside screens */
function TabBar({ tabs, active, onChange, style }) {
  return (
    <div style={{ display: 'flex', gap: 4, ...style }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            position: 'relative', padding: '9px 16px', background: on ? 'var(--bg-3)' : 'transparent',
            border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer',
            color: on ? 'var(--fg-1)' : 'var(--fg-3)', font: '600 13px/1 var(--font-display)',
            letterSpacing: '0.03em', transition: 'all var(--dur-1)',
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

Object.assign(window, { LeftRail, RightRail, AppShell, NavItem, TabBar, RailIcon, Segmented });

/* Segmented control (shared) */
function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', padding: 3, gap: 2, background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)' }}>
      {options.map(o => {
        const on = value === o.id;
        return <button key={o.id} onClick={() => onChange(o.id)} style={{
          padding: '6px 14px', background: on ? 'var(--bg-4)' : 'transparent', border: 'none', borderRadius: 'var(--r-xs)',
          cursor: 'pointer', color: on ? 'var(--fg-1)' : 'var(--fg-3)', font: '600 12px/1 var(--font-display)',
          letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'all var(--dur-1)',
        }}>{o.label}</button>;
      })}
    </div>
  );
}
window.Segmented = Segmented;

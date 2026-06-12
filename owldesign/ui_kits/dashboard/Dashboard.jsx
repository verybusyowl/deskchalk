/* ============================================================================
   OWL.COACH — Coaching Dashboard screen + components
   "Fix these things" — blunt, ranked, actionable. 3 layout variations.
============================================================================ */
const D = window.OWL_DATA;

const SEV = {
  high: { label: 'High impact', tone: 'heat', col: 'var(--heat)' },
  med: { label: 'Medium', tone: 'warn', col: 'var(--warn)' },
  low: { label: 'Low', tone: 'info', col: 'var(--info)' },
};

/* Rank chip — big tactical numeral */
function RankChip({ n, col }) {
  return (
    <span className="cut-corner" style={{ '--cut': '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 40, height: 40, flex: '0 0 auto', background: 'var(--bg-2)', border: `1px solid ${col}`,
      font: '700 20px/1 var(--font-display)', color: col, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
  );
}

/* The core coaching card */
function CoachCard({ fix, n, compact }) {
  const sev = SEV[fix.severity];
  const [done, setDone] = useState(false);
  return (
    <Card pad={compact ? 'var(--s-4)' : 'var(--s-5)'} hover style={{ display: 'flex', flexDirection: 'column', gap: compact ? 12 : 14, opacity: done ? 0.5 : 1, transition: 'opacity var(--dur-2)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <RankChip n={n} col={sev.col} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
            <Pill tone={sev.tone} size="sm" icon={fix.severity === 'high' ? 'flame' : 'alert'}>{sev.label}</Pill>
            <Pill tone="brand" size="sm">{fix.impact}</Pill>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--fg-3)', font: 'var(--ui-sm)', whiteSpace: 'nowrap' }}>
              <Icon name="mapPin" size={12} />{fix.map} · {fix.side}-side
            </span>
          </div>
          <h3 style={{ font: '700 19px/1.18 var(--font-display)', letterSpacing: '-0.01em', color: 'var(--fg-1)' }}>{fix.cue}</h3>
        </div>
      </div>
      {!compact && <p style={{ font: 'var(--body-sm)', color: 'var(--fg-2)', paddingLeft: 54 }}>{fix.why}</p>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingLeft: compact ? 0 : 54 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ font: 'var(--label)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 5, whiteSpace: 'nowrap' }}>{fix.stat.label}</div>
            <div style={{ font: '700 18px/1 var(--font-display)', color: sev.col, fontVariantNumeric: 'tabular-nums' }}>{fix.stat.value}</div>
          </div>
          <Sparkline data={fix.stat.spark} color={sev.col} w={70} h={26} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" icon={done ? 'check' : 'target'} onClick={() => setDone(!done)}>{done ? 'Got it' : 'Drill'}</Button>
          <Button variant="solid" size="sm" iconRight="chevronRight">Demo</Button>
        </div>
      </div>
    </Card>
  );
}

/* Positive reinforcement card (mint) */
function WinCard({ win }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: 'var(--s-4)', background: 'var(--brand-soft)', border: '1px solid var(--brand-line)', borderRadius: 'var(--r-md)' }}>
      <Icon name="check" size={18} style={{ color: 'var(--brand)', marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
          <h3 style={{ font: '700 15px/1.2 var(--font-display)', color: 'var(--fg-1)' }}>{win.cue}</h3>
          <span style={{ font: '700 13px/1 var(--font-display)', color: 'var(--brand)', whiteSpace: 'nowrap' }}>{win.stat}</span>
        </div>
        <p style={{ font: 'var(--body-sm)', color: 'var(--fg-2)', marginTop: 4 }}>{win.why}</p>
      </div>
    </div>
  );
}

/* Recent form strip */
function FormStrip({ compact }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 8 }}>
      {D.player.form.map((r, i) => <WL key={i} result={r} />)}
    </div>
  );
}

/* Header: who, ELO, last-match summary */
function DashHeader({ layout, setLayout }) {
  const p = D.player;
  return (
    <div style={{ marginBottom: 'var(--s-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Coach · Last 30 matches</div>
          <h1 style={{ font: 'var(--h1)', letterSpacing: '-0.015em' }}>Fix these 3 things, {p.handle.replace('VeryBusy', '')}.</h1>
          <p style={{ marginTop: 8, maxWidth: 540 }}>You've dropped {Math.abs(p.eloDelta)} ELO this season. Three habits are doing most of the damage. Drill them and you climb.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow" style={{ marginBottom: 6, justifyContent: 'flex-end' }}>Season 8 · ELO</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FormStrip />
              <Delta value={p.eloDelta} size={16} />
            </div>
          </div>
          <EloRing elo={p.elo} level={p.level} size={104} />
        </div>
      </div>
      {/* layout switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'var(--s-5)' }}>
        <span className="eyebrow">Layout</span>
        <Segmented options={[{ id: 'briefing', label: 'Briefing' }, { id: 'board', label: 'Triage board' }, { id: 'hud', label: 'HUD' }]} value={layout} onChange={setLayout} />
      </div>
    </div>
  );
}

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

/* ---- Metric strip (shared by HUD + board) ---- */
function MetricStrip() {
  const p = D.player;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(176px,1fr))', gap: 'var(--s-3)', marginBottom: 'var(--s-5)' }}>
      <StatTile label="K / D" value={p.kd.toFixed(2)} spark={p.kdSpark} sparkColor="auto" icon="crosshair" />
      <StatTile label="Avg swing" value={p.avgSwing} tone="loss" spark={p.swingSpark} sparkColor="var(--loss)" icon="activity" />
      <StatTile label="Consistency" value={p.consistency + '%'} tone="win" icon="gauge"
        ring={<svg width="40" height="40" style={{ transform: 'rotate(-90deg)' }}><circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" /><circle cx="20" cy="20" r="15" fill="none" stroke="var(--win)" strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15 * (1 - p.consistency / 100)} /></svg>} />
      <StatTile label="Win rate" value={p.winRate.toFixed(0) + '%'} sub={<span style={{ font: 'var(--ui-sm)', color: 'var(--fg-3)' }}>{p.matches} matches</span>} icon="award" />
    </div>
  );
}

/* ====================================================== LAYOUT VARIATIONS */
function LayoutBriefing() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 'var(--s-6)', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
        <Eyebrow icon="flame">Priority fixes</Eyebrow>
        {D.fixes.map((f, i) => <CoachCard key={f.id} fix={f} n={i + 1} />)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', position: 'sticky', top: 0 }}>
        <Eyebrow icon="check">What's working</Eyebrow>
        {D.wins.map((w, i) => <WinCard key={i} win={w} />)}
        <Card pad="var(--s-4)" style={{ marginTop: 4 }}>
          <Eyebrow icon="track" style={{ marginBottom: 12 }}>ELO · season 8</Eyebrow>
          <AreaChart data={D.player.eloHistory} h={120} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, font: 'var(--ui-sm)', color: 'var(--fg-3)' }}>
            <span>1,201</span><Delta value={D.player.eloDelta} size={12} /><span>1,319</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function LayoutBoard() {
  return (
    <div>
      <MetricStrip />
      <Eyebrow icon="flame" right={<span style={{ font: 'var(--ui-sm)', color: 'var(--fg-3)' }}>Ranked by ELO impact</span>}>Priority fixes</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))', gap: 'var(--s-3)' }}>
        {D.fixes.map((f, i) => <CoachCard key={f.id} fix={f} n={i + 1} />)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          {D.wins.map((w, i) => <WinCard key={i} win={w} />)}
        </div>
      </div>
    </div>
  );
}

function LayoutHud() {
  return (
    <div>
      <MetricStrip />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 'var(--s-3)' }}>
        <Eyebrow icon="flame">Drill queue</Eyebrow>
        {D.fixes.map((f, i) => (
          <div key={f.id} className="cut-corner" style={{ '--cut': '12px', background: 'var(--bg-3)', border: `1px solid ${SEV[f.severity].col}33`, padding: 'var(--s-4) var(--s-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <RankChip n={i + 1} col={SEV[f.severity].col} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ font: '700 17px/1.2 var(--font-display)', color: 'var(--fg-1)' }}>{f.cue}</h3>
                  <Pill tone={SEV[f.severity].tone} size="sm">{f.impact}</Pill>
                </div>
                <p style={{ font: 'var(--body-sm)', color: 'var(--fg-3)', marginTop: 4 }}>{f.why}</p>
              </div>
              <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                <div style={{ font: 'var(--label)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-3)', marginBottom: 4 }}>{f.stat.label}</div>
                <div style={{ font: '700 22px/1 var(--font-display)', color: SEV[f.severity].col, fontVariantNumeric: 'tabular-nums' }}>{f.stat.value}</div>
              </div>
              <Button variant="solid" size="sm" iconRight="arrowRight" cut>Drill</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  const [layout, setLayout] = useState('briefing');
  const [nav, setNav] = useState('coach');
  return (
    <AppShell active={nav} onNav={setNav} avatar="../_shared/owl-mark.svg">
      <DashHeader layout={layout} setLayout={setLayout} />
      {layout === 'briefing' && <LayoutBriefing />}
      {layout === 'board' && <LayoutBoard />}
      {layout === 'hud' && <LayoutHud />}
    </AppShell>
  );
}

Object.assign(window, { Dashboard, CoachCard, WinCard, FormStrip, Segmented, MetricStrip });

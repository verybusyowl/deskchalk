/* ============================================================================
   OWL.COACH — Match history list + single-match breakdown (scoreboard + rounds)
============================================================================ */
const M = window.OWL_DATA;

/* Map tile — no fake render; map name on a tactical dark tile */
function MapTile({ map, size = 52, result }) {
  return (
    <div className="cut-corner" style={{ '--cut': '7px', width: size * 1.5, height: size, flex: '0 0 auto', position: 'relative',
      background: 'linear-gradient(135deg, var(--bg-4), var(--bg-2))', border: '1px solid var(--line-2)', overflow: 'hidden',
      display: 'flex', alignItems: 'flex-end', padding: 6 }}>
      <span style={{ position: 'absolute', top: 5, left: 7 }}><Icon name="mapPin" size={13} style={{ color: 'var(--fg-4)' }} /></span>
      <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 3, background: result === 'W' ? 'var(--win)' : 'var(--loss)' }} />
      <span style={{ font: '700 13px/1 var(--font-display)', color: 'var(--fg-1)', letterSpacing: '0.02em' }}>{map}</span>
    </div>
  );
}

function MatchRow({ m, onOpen }) {
  const win = m.result === 'W';
  return (
    <button onClick={onOpen} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}>
      <div className="match-row" style={{ display: 'grid', gridTemplateColumns: '64px 56px minmax(82px,1fr) 66px 50px 48px 48px 58px 20px', alignItems: 'center', gap: 10,
        padding: '12px 16px', background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', transition: 'border-color var(--dur-1), background var(--dur-1)' }}>
        <MapTile map={m.map} result={m.result} size={40} />
        <div>
          <div style={{ font: '700 15px/1 var(--font-display)', color: win ? 'var(--win)' : 'var(--loss)' }}>{m.result === 'W' ? 'WIN' : 'LOSS'}</div>
          <div className="num" style={{ fontSize: 14, color: 'var(--fg-2)', marginTop: 4 }}>{m.score}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: 'var(--ui-sm)', color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.mode}</div>
          <div style={{ font: 'var(--ui-sm)', color: 'var(--fg-4)', marginTop: 3 }}>{m.when}</div>
        </div>
        <Col label="K-D-A" value={`${m.kills}/${m.deaths}/${m.assists}`} />
        <Col label="K/D" value={m.kd.toFixed(2)} tone={m.kd >= 1 ? 'win' : 'loss'} />
        <Col label="ADR" value={m.adr.toFixed(0)} />
        <Col label="HS%" value={m.hs + '%'} />
        <div style={{ textAlign: 'center' }}><Delta value={m.elo} size={14} showIcon={false} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Icon name="chevronRight" size={18} style={{ color: 'var(--fg-4)' }} /></div>
      </div>
    </button>
  );
}

function Col({ label, value, tone }) {
  const col = tone === 'win' ? 'var(--win)' : tone === 'loss' ? 'var(--loss)' : 'var(--fg-1)';
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="num" style={{ fontSize: 15, color: col, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ font: '600 9.5px/1 var(--font-display)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-4)', marginTop: 5 }}>{label}</div>
    </div>
  );
}

function MatchList({ onOpen }) {
  const [filter, setFilter] = useState('all');
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s-5)' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Profile · VeryBusyOwl</div>
          <h1 style={{ font: 'var(--h1)' }}>Match history</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="solid" size="sm" icon="filter">Filter</Button>
          <Button variant="solid" size="sm" icon="calendar">Last 30 days</Button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--s-4)' }}>
        <Segmented options={[{ id: 'all', label: 'All' }, { id: 'mm', label: 'Matchmaking' }, { id: 'prem', label: 'Premier' }]} value={filter} onChange={setFilter} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
        {M.matches.map(m => <MatchRow key={m.id} m={m} onOpen={() => onOpen(m)} />)}
      </div>
    </div>
  );
}

/* ----------------------------------------------------- BREAKDOWN */
function RoundTimeline({ rounds }) {
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {rounds.map((r, i) => (
        <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {i === 12 && <span style={{ position: 'absolute', left: -3, top: -2, bottom: 14, width: 1, background: 'var(--line-3)' }} />}
          <span style={{ width: 20, height: 26, borderRadius: 'var(--r-xs)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: r ? 'var(--win-soft)' : 'var(--loss-soft)', border: `1px solid ${r ? 'rgba(25,229,155,0.3)' : 'rgba(255,59,84,0.3)'}` }}>
            <Icon name={r ? 'check' : 'x'} size={11} style={{ color: r ? 'var(--win)' : 'var(--loss)' }} />
          </span>
          <span style={{ font: 'var(--mono-sm)', fontSize: 9, color: 'var(--fg-4)' }}>{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreCell({ value, tone, bold }) {
  const col = tone === 'win' ? 'var(--win)' : tone === 'loss' ? 'var(--loss)' : tone === 'heat' ? 'var(--heat-bright)' : 'var(--fg-1)';
  return <td style={{ textAlign: 'center', padding: '10px 6px', font: `${bold ? 700 : 500} 14px/1 var(--font-display)`, color: col, fontVariantNumeric: 'tabular-nums' }}>{value}</td>;
}

function ScoreboardTable({ rows, title, tone }) {
  const heads = ['K', 'D', 'A', 'K/D', 'ADR', 'HS%', 'KAST'];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: tone === 'win' ? 'var(--win)' : 'var(--loss)' }} />
        <span className="label" style={{ color: 'var(--fg-2)' }}>{title}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 10px', font: '600 10px/1 var(--font-display)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>Player</th>
            {heads.map(h => <th key={h} style={{ textAlign: 'center', padding: '6px', font: '600 10px/1 var(--font-display)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i} style={{ background: p.me ? 'var(--brand-soft)' : i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent', borderRadius: 'var(--r-sm)' }}>
              <td style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <SkillHex level={p.level} size={26} />
                  <span style={{ font: '600 14px/1 var(--font-body)', color: p.me ? 'var(--brand)' : 'var(--fg-1)' }}>{p.name}</span>
                  {p.me && <Icon name="target" size={13} style={{ color: 'var(--brand)' }} />}
                </div>
              </td>
              <ScoreCell value={p.k} bold />
              <ScoreCell value={p.d} />
              <ScoreCell value={p.a} />
              <ScoreCell value={p.kd.toFixed(2)} tone={p.kd >= 1 ? 'win' : 'loss'} />
              <ScoreCell value={p.adr.toFixed(1)} />
              <ScoreCell value={p.hs + '%'} />
              <ScoreCell value={p.kast + '%'} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchBreakdown({ m, onBack }) {
  const s = M.scoreboard;
  return (
    <div>
      <button onClick={onBack} style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--fg-3)', font: 'var(--label)', letterSpacing: '0.1em', marginBottom: 16 }}>
        <Icon name="chevronRight" size={14} style={{ transform: 'rotate(180deg)' }} />Back to matches
      </button>
      {/* hero */}
      <Card pad="0" style={{ overflow: 'hidden', marginBottom: 'var(--s-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: 'var(--s-5) var(--s-6)', background: 'linear-gradient(90deg, rgba(25,229,155,0.10), transparent 60%)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <MapTile map={s.map} result="W" size={56} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ font: '700 22px/1 var(--font-display)', color: 'var(--win)' }}>WON</span>
                <span className="num" style={{ fontSize: 30, color: 'var(--fg-1)' }}>13 <span style={{ color: 'var(--fg-4)' }}>–</span> 9</span>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8, font: 'var(--ui-sm)', color: 'var(--fg-3)' }}>
                <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Icon name="clock" size={13} />{s.duration}</span>
                <span>{s.mode}</span><span>{s.when}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" icon="play">Watch demo</Button>
            <Button variant="primary" size="sm" icon="target">Coach this match</Button>
          </div>
        </div>
      </Card>
      {/* round timeline */}
      <Card pad="var(--s-5)" style={{ marginBottom: 'var(--s-4)' }}>
        <Eyebrow icon="activity" right={<span style={{ display: 'flex', gap: 12, font: 'var(--ui-sm)' }}><span style={{ color: 'var(--win)' }}>CT 8</span><span style={{ color: 'var(--fg-4)' }}>·</span><span style={{ color: 'var(--win)' }}>T 5</span></span>}>Round timeline</Eyebrow>
        <RoundTimeline rounds={s.rounds} />
      </Card>
      {/* scoreboards */}
      <Card pad="var(--s-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
        <ScoreboardTable rows={s.team} title="Your team · 13" tone="win" />
        <div style={{ height: 1, background: 'var(--line-1)' }} />
        <ScoreboardTable rows={s.enemy} title="Enemy · 9" tone="loss" />
      </Card>
    </div>
  );
}

function Match() {
  const [nav, setNav] = useState('matches');
  const [open, setOpen] = useState(null);
  return (
    <AppShell active={nav} onNav={setNav} avatar="../_shared/owl-mark.svg" maxWidth={1180}>
      {open ? <MatchBreakdown m={open} onBack={() => setOpen(null)} /> : <MatchList onOpen={setOpen} />}
    </AppShell>
  );
}

Object.assign(window, { Match, MatchList, MatchBreakdown, MatchRow });

/* OVERVIEW — the recommended "Briefing" direction.
   Hierarchy (my IA challenge): identity is DEMOTED to a slim context bar;
   the FocusCard is the sole hero; overall stats are proof directly under
   it; coaching insights are the subordinate "bench"; form/trend/maps are
   context at the bottom. */
const _NS = window.OWLCOACHDesignSystem_013434;

function SectionLabel({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
      <span className="owl-label" style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-3)' }}>{children}</span>
      {action}
    </div>
  );
}

function IdentityBar() {
  const d = window.OWL_DATA.player;
  const { Avatar, LevelBadge, EloRing } = _NS;
  const delta = d.eloTrend[d.eloTrend.length - 1] - d.eloTrend[0];
  return (
    <div className="owl-identity">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <Avatar name="OW" size={50} ring="mint" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-lg)', color: 'var(--text-1)' }}>{d.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LevelBadge level={d.level} size="sm" />
            <span className="owl-label" style={{ color: 'var(--text-3)' }}>{d.region} · Solo queue</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="owl-label" style={{ color: 'var(--text-4)' }}>ELO · last 8</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="owl-num" style={{ fontSize: 'var(--fs-md)', color: 'var(--text-2)' }}>{d.elo}</span>
            <span className="owl-num" style={{ fontSize: 'var(--fs-sm)', color: delta >= 0 ? 'var(--mint)' : 'var(--orange)' }}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}</span>
          </span>
        </div>
        <EloRing elo={d.elo} level={d.level} progress={d.eloProgress} size={76} />
      </div>
    </div>
  );
}

function Overview({ onView, onAsk }) {
  useIcons();
  const d = window.OWL_DATA;
  const { FocusCard, StatCard, InsightCard, Card, Button } = _NS;

  return (
    <div className="owl-page">
      <div className="owl-page-head">
        <div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', color: 'var(--text-1)' }}>Overview</h1>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-3)', fontSize: 'var(--fs-sm)', marginTop: 2 }}>One thing to fix, with the proof. Updated after every match.</p>
        </div>
        <Button variant="secondary" size="sm" iconLeft={<Icon name="message-square-text" size={15} />} onClick={onAsk}>Ask the coach</Button>
      </div>

      <IdentityBar />

      <FocusCard {...d.focus} onStartDrill={() => {}} />

      {/* PROOF — overall stats directly under the verdict */}
      <div>
        <SectionLabel>Overall · recent 10 matches</SectionLabel>
        <div className="owl-stats-grid">
          {d.overallStats.map((s, i) => (
            <StatCard key={i} label={s.label} value={s.value} unit={s.unit || ''} delta={s.delta} goodDirection={s.goodDirection} spark={s.spark} />
          ))}
        </div>
      </div>

      {/* BENCH + CONTEXT */}
      <div className="owl-two-col">
        <div>
          <SectionLabel>Coaching insights · the bench</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.insights.map((it, i) => <InsightCard key={i} {...it} />)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <Card>
            <SectionLabel>ELO trend</SectionLabel>
            <EloTrendChart data={d.player.eloTrend} height={96} />
          </Card>
          <Card>
            <FormStrip form={d.recentForm} />
          </Card>
          <Card>
            <SectionLabel action={<button className="owl-link" onClick={() => onView('maps')}>All maps <Icon name="arrow-right" size={13} /></button>}>Map strength</SectionLabel>
            <MapStrengthTable winRates={d.mapWinRates} onPick={() => onView('maps')} />
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Overview, SectionLabel, IdentityBar });

/* MAPS — "how do I play this map better".
   Map picker persists last selection. The Map Fundamentals guide is the
   HERO; FACEIT stats are proof; demo-derived panels sit below and degrade
   to empty states on maps with thin demo data. */
const _MNS = window.OWLCOACHDesignSystem_013434;

function MapStat({ label, value, tone }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span className="owl-label" style={{ color: 'var(--text-4)' }}>{label}</span>
      <span className="owl-stat" style={{ fontSize: 'var(--fs-xl)', color: tone || 'var(--text-1)' }}>{value}</span>
    </div>
  );
}

function GuideBlock({ icon, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mint)' }}>
        <Icon name={icon} size={16} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-md)', color: 'var(--text-1)', marginBottom: 4 }}>{title}</div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', color: 'var(--text-2)', lineHeight: 'var(--lh-relaxed)' }}>{children}</p>
      </div>
    </div>
  );
}

function ActionChecklist({ items, mapName }) {
  const key = 'owl_actions_' + mapName;
  const [done, setDone] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; }
  });
  const toggle = (i) => {
    const next = { ...done, [i]: !done[i] };
    setDone(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch (e) {}
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <button key={i} onClick={() => toggle(i)} className="owl-action" data-done={!!done[i]}>
          <span className="owl-action-box">{done[i] && <Icon name="check" size={13} />}</span>
          <span style={{ textDecoration: done[i] ? 'line-through' : 'none', opacity: done[i] ? 0.5 : 1 }}>{it}</span>
        </button>
      ))}
    </div>
  );
}

function RadarPanel({ map, hasHeat }) {
  return (
    <div className="owl-radar">
      <div className="owl-radar-grid" />
      {hasHeat ? (
        <React.Fragment>
          <span className="owl-heat" style={{ left: '34%', top: '40%', background: 'var(--orange)' }} />
          <span className="owl-heat" style={{ left: '58%', top: '30%', background: 'var(--orange)', width: 30, height: 30 }} />
          <span className="owl-heat" style={{ left: '46%', top: '62%', background: 'var(--mint)' }} />
          <span className="owl-heat" style={{ left: '24%', top: '55%', background: 'var(--mint)', width: 22, height: 22 }} />
        </React.Fragment>
      ) : null}
      <div className="owl-radar-tag">{map} · radar</div>
    </div>
  );
}

function DemoPanel({ title, children, full }) {
  return (
    <div className="owl-demo-panel" style={full ? { gridColumn: '1 / -1' } : {}}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </div>
  );
}

function MapPage({ onAsk }) {
  useIcons();
  const d = window.OWL_DATA;
  const { MapPills, Card, EmptyState, Badge, Button } = _MNS;
  const [map, setMap] = React.useState(() => localStorage.getItem('owl_last_map') || 'Mirage');
  React.useEffect(() => { try { localStorage.setItem('owl_last_map', map); } catch (e) {} }, [map]);

  const detail = d.mapDetail[map] || { hasDemos: false, stats: { winRate: d.mapWinRates[map] || 50, kd: '—', adr: '—', openWin: '—', ctWin: '—', tWin: '—' }, guide: null };
  const wr = detail.stats.winRate;
  const wrTone = wr >= 55 ? 'var(--mint)' : wr < 45 ? 'var(--orange)' : 'var(--text-1)';

  return (
    <div className="owl-page">
      <div className="owl-page-head">
        <div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', color: 'var(--text-1)' }}>Maps</h1>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-3)', fontSize: 'var(--fs-sm)', marginTop: 2 }}>Your plan for the map, then the proof from your demos.</p>
        </div>
        <Button variant="secondary" size="sm" iconLeft={<Icon name="message-square-text" size={15} />} onClick={onAsk}>Ask the coach</Button>
      </div>

      <MapPills value={map} onChange={setMap} winRates={d.mapWinRates} />

      {/* Map header */}
      <div className="owl-map-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h2 style={{ fontSize: 'var(--fs-3xl)', color: 'var(--text-1)', letterSpacing: '-0.01em' }}>{map}</h2>
          <Badge tone={wr >= 55 ? 'good' : wr < 45 ? 'bad' : 'neutral'} variant="soft">{wr >= 55 ? 'Strong' : wr < 45 ? 'Weak' : 'Even'}</Badge>
        </div>
        <div className="owl-map-stats">
          <MapStat label="FACEIT Win %" value={wr + '%'} tone={wrTone} />
          <MapStat label="K / D" value={detail.stats.kd} />
          <MapStat label="ADR" value={detail.stats.adr} />
          <MapStat label="Opening duels" value={detail.stats.openWin === '—' ? '—' : detail.stats.openWin + '%'} tone={detail.stats.openWin !== '—' && detail.stats.openWin < 50 ? 'var(--orange)' : null} />
        </div>
      </div>

      {/* HERO — Map Fundamentals guide */}
      {detail.guide ? (
        <Card accent="mint" padding="var(--space-6)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Icon name="book-open" size={18} style={{ color: 'var(--mint)' }} />
            <span className="owl-label" style={{ color: 'var(--mint)', fontSize: 'var(--fs-xs)' }}>Map fundamentals</span>
          </div>
          <div className="owl-guide-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <GuideBlock icon="swords" title="T-side default plan">{detail.guide.tPlan}</GuideBlock>
              <GuideBlock icon="shield" title="CT-side setups & crossfires">{detail.guide.ctSetup}</GuideBlock>
              <GuideBlock icon="bomb" title="Utility homework">{detail.guide.utility}</GuideBlock>
            </div>
            <div className="owl-guide-actions">
              <span className="owl-label" style={{ color: 'var(--text-3)', marginBottom: 12, display: 'block' }}>Action items · this map</span>
              <ActionChecklist items={detail.guide.actions} mapName={map} />
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState icon={<Icon name="book-open" size={22} />} title="No fundamentals written for this map yet"
          message={`Ask the coach to generate a ${map} game plan, or play a few matches to seed it.`}
          action={<Button variant="secondary" size="sm" onClick={onAsk}>Generate plan</Button>} />
      )}

      {/* DEMO-DERIVED PANELS */}
      <div>
        <SectionLabel>From your demos</SectionLabel>
        {detail.hasDemos ? (
          <div className="owl-demo-grid">
            <DemoPanel title="Kill / death heatmap" full>
              <RadarPanel map={map} hasHeat />
              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontFamily: 'var(--font-body)', fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--orange)' }} /> Where you die</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--mint)' }} /> Where you get kills</span>
              </div>
            </DemoPanel>
            <DemoPanel title="Aim & crosshair">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <MiniMetric label="Crosshair placement error" value="4.2°" sub="below head height" tone="var(--orange)" />
                <MiniMetric label="First-bullet accuracy" value="38%" sub="top-tier" tone="var(--mint)" />
                <MiniMetric label="Time-to-damage" value="612ms" sub="avg on entries" />
              </div>
            </DemoPanel>
            <DemoPanel title="Economy & clutches">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <MiniMetric label="Full-buy win rate" value="58%" tone="var(--mint)" />
                <MiniMetric label="Force-buy win rate" value="22%" tone="var(--orange)" />
                <MiniMetric label="Clutch record (1vX)" value="6 / 11" sub="55%" tone="var(--mint)" />
              </div>
            </DemoPanel>
          </div>
        ) : (
          <div className="owl-demo-grid">
            <DemoPanel title="Kill / death heatmap" full>
              <RadarPanel map={map} hasHeat={false} />
              <div style={{ position: 'absolute' }} />
            </DemoPanel>
            <DemoPanel title="Aim & crosshair">
              <EmptyState compact icon={<Icon name="crosshair" size={20} />} title="Not enough demos" message={`Only a couple of ${map} demos parsed. Aim breakdown needs ~5.`} />
            </DemoPanel>
            <DemoPanel title="Economy & clutches">
              <EmptyState compact icon={<Icon name="coins" size={20} />} title="Not enough demos" message="Economy patterns appear once more rounds are parsed." />
            </DemoPanel>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, sub, tone }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', color: 'var(--text-2)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="owl-num" style={{ fontSize: 'var(--fs-md)', color: tone || 'var(--text-1)', fontWeight: 600 }}>{value}</span>
        {sub && <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-2xs)', color: 'var(--text-4)' }}>{sub}</span>}
      </span>
    </div>
  );
}

Object.assign(window, { MapPage });

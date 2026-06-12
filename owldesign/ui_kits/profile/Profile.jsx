/* ============================================================================
   OWL.COACH — Player profile / historical stats screen (mirrors the reference
   layout: profile sidebar + season hero + recent performance + ELO history)
============================================================================ */
const P = window.OWL_DATA.player;

function ProfileSidebar() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
      <Card pad="var(--s-5)" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s-4)' }}>
        <div style={{ position: 'relative' }}>
          <Avatar src="../_shared/owl-mark.svg" size={132} round />
          <span style={{ position: 'absolute', bottom: 4, right: 4 }}><SkillHex level={P.level} size={38} /></span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <h2 style={{ font: 'var(--h2)' }}>{P.handle}</h2>
            {P.verified && <Icon name="check" size={18} style={{ color: 'var(--brand)' }} />}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
            <SourceChip source="faceit" /><SourceChip source="steam" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <Button variant="ghost" size="sm" icon="pencil" style={{ flex: 1 }}>Edit</Button>
          <Button variant="ghost" size="sm" icon="share" style={{ flex: 1 }}>Share</Button>
        </div>
      </Card>

      <Card pad="var(--s-5)" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-2)', font: 'var(--ui-sm)' }}>
          <Icon name="calendar" size={15} style={{ color: 'var(--fg-3)' }} />Member since {P.memberSince}
        </div>
        <p style={{ font: 'var(--body-sm)', color: 'var(--fg-3)', fontStyle: 'italic', lineHeight: 1.55 }}>
          "Ideologies are substitutes for true knowledge. Hold your angles."
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4, borderTop: '1px solid var(--line-1)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--fg-2)', font: 'var(--ui-sm)' }}>
            <span style={{ width: 18, height: 13, background: 'linear-gradient(180deg,#3c3b6e 33%,#fff 33% 66%,#b22234 66%)', borderRadius: 2, border: '1px solid var(--line-2)' }}></span>
            United States
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <RailIcon icon="steam" title="Steam" /><RailIcon icon="external" title="FACEIT" /><RailIcon icon="play" title="Twitch" />
        </div>
      </Card>
    </div>
  );
}

function SeasonHero() {
  return (
    <Card pad="0" style={{ overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 140% at 78% 30%, rgba(255,106,44,0.14), transparent 55%)' }} />
      <div style={{ position: 'relative', padding: 'var(--s-5) var(--s-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Season 8</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div>
              <div style={{ font: '700 14px/1 var(--font-display)', color: 'var(--fg-3)', marginBottom: 6 }}>{P.matches} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>matches</span></div>
              <div style={{ font: '700 14px/1 var(--font-display)', color: 'var(--fg-3)' }}><span style={{ color: 'var(--fg-1)' }}>{P.winRate.toFixed(1)}%</span> wins</div>
            </div>
          </div>
        </div>
        <EloRing elo={P.elo} level={P.level} size={148} label="Current ELO" />
        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <div className="eyebrow" style={{ marginBottom: 10, justifyContent: 'flex-end' }}>Region</div>
          <div style={{ font: '700 28px/1 var(--font-display)', color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>#15,242</div>
          <div style={{ font: 'var(--ui-sm)', color: 'var(--fg-3)', marginTop: 4 }}>Global #23,622</div>
        </div>
      </div>
    </Card>
  );
}

function RecentPerformance() {
  return (
    <Card pad="var(--s-5)">
      <Eyebrow icon="activity" right={<a style={{ font: 'var(--label)', letterSpacing: '0.1em', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>See more stats <Icon name="chevronRight" size={13} /></a>}>Recent performance</Eyebrow>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Pill tone="info" size="sm" icon="info">Partial stats</Pill>
        <span style={{ font: 'var(--ui-sm)', color: 'var(--fg-3)' }}>Last 30 matches · avg match skill {P.avgMatchSkill}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(176px,1fr))', gap: 'var(--s-3)' }}>
        <StatTile label="K / D" value={P.kd.toFixed(2)} spark={P.kdSpark} sparkColor="auto" icon="crosshair" />
        <StatTile label="Avg swing" value={P.avgSwing} tone="loss" spark={P.swingSpark} sparkColor="var(--loss)" icon="activity" />
        <StatTile label="Consistency" value={P.consistency + '%'} tone="win" icon="gauge"
          ring={<svg width="40" height="40" style={{ transform: 'rotate(-90deg)' }}><circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" /><circle cx="20" cy="20" r="15" fill="none" stroke="var(--win)" strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15 * (1 - P.consistency / 100)} /></svg>} />
      </div>
    </Card>
  );
}

function EloHistoryCard() {
  const yTicks = [{ v: 1750 }, { v: 1530 }, { v: 1200 }, { v: 900 }];
  return (
    <Card pad="var(--s-5)">
      <Eyebrow icon="track" right={<TabBar tabs={[{ id: 'elo', label: 'ELO' }, { id: 'kd', label: 'K/D' }, { id: 'adr', label: 'ADR' }]} active="elo" onChange={() => {}} />}>ELO history</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 200px', gap: 'var(--s-5)', alignItems: 'stretch' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: -2, top: 0, bottom: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', font: 'var(--mono-sm)', color: 'var(--fg-4)' }}>
            {yTicks.map(t => <span key={t.v}>{t.v}</span>)}
          </div>
          <div style={{ paddingLeft: 38 }}>
            <AreaChart data={P.eloHistory} h={190} markers={[{ i: 12 }, { i: 22 }]} yTicks={yTicks} />
            <div style={{ display: 'flex', justifyContent: 'space-between', font: 'var(--mono-sm)', color: 'var(--fg-4)', marginTop: 8 }}>
              <span>S8 start</span><span>Soft reset</span><span>Now</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', background: 'var(--bg-2)', borderRadius: 'var(--r-md)', padding: 'var(--s-4)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Pill tone="win">W {P.seasonW}</Pill><Pill tone="loss">L {P.seasonL}</Pill>
            <div style={{ flex: 1 }} /><Icon name="chevronRight" size={16} style={{ color: 'var(--fg-3)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
            <div><div className="eyebrow" style={{ marginBottom: 4 }}>Start</div><div className="num" style={{ fontSize: 18, color: 'var(--fg-2)' }}>1,201</div></div>
            <div style={{ textAlign: 'center' }}><div className="eyebrow" style={{ marginBottom: 4 }}>Now</div><div className="num" style={{ fontSize: 22, color: 'var(--heat-bright)' }}>1,319</div></div>
            <div style={{ textAlign: 'right' }}><div className="eyebrow" style={{ marginBottom: 4 }}>Peak</div><div className="num" style={{ fontSize: 18, color: 'var(--fg-2)' }}>1,350</div></div>
          </div>
          <div style={{ borderTop: '1px solid var(--line-1)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="eyebrow">ELO change</span><Delta value={P.eloDelta} size={18} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function ProfileTabs() {
  const [tab, setTab] = useState('summary');
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s-5)', borderBottom: '1px solid var(--line-1)', paddingBottom: 14 }}>
      <div>
        <div style={{ display: 'flex', gap: 26, marginBottom: 14 }}>
          {['Games', 'Friends', 'Videos', 'Clubs', 'Teams'].map((t, i) => (
            <span key={t} className="label" style={{ color: i === 0 ? 'var(--fg-1)' : 'var(--fg-3)', cursor: 'pointer', position: 'relative', paddingBottom: 4 }}>
              {t}{i === 0 && <span style={{ position: 'absolute', left: 0, right: 0, bottom: -14, height: 2, background: 'var(--brand)' }} />}
            </span>
          ))}
        </div>
        <TabBar tabs={[{ id: 'summary', label: 'Summary' }, { id: 'history', label: 'Match history' }, { id: 'stats', label: 'Stats' }, { id: 'leagues', label: 'Leagues' }]} active={tab} onChange={setTab} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="solid" size="sm" icon="crosshair">CS2</Button>
        <RailIcon icon="more" title="More" />
      </div>
    </div>
  );
}

function Profile() {
  const [nav, setNav] = useState('profile');
  return (
    <AppShell active={nav} onNav={setNav} avatar="../_shared/owl-mark.svg" maxWidth={1240}>
      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 'var(--s-6)', alignItems: 'start' }}>
        <ProfileSidebar />
        <div>
          <ProfileTabs />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
            <SeasonHero />
            <RecentPerformance />
            <EloHistoryCard />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

Object.assign(window, { Profile });

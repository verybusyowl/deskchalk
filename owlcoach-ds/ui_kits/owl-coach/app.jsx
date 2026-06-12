/* APP — view switcher + shell + ask-coach slide-over. */
const _APPNS = window.OWLCOACHDesignSystem_013434;

function ReplayView() {
  useIcons();
  const { Card, Button, Badge } = _APPNS;
  return (
    <div className="owl-page">
      <div className="owl-page-head">
        <div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', color: 'var(--text-1)' }}>Replay</h1>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-3)', fontSize: 'var(--fs-sm)', marginTop: 2 }}>2D round playback from your parsed demos.</p>
        </div>
        <Badge tone="neutral" variant="outline">Existing tool · unchanged</Badge>
      </div>
      <Card padding="var(--space-5)">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span className="owl-label" style={{ color: 'var(--text-3)' }}>Mirage · Round 14 · CT</span>
          <span className="owl-num" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)' }}>1:12 / 1:55</span>
        </div>
        <div className="owl-radar" style={{ aspectRatio: '1 / 1', maxHeight: 420, margin: '0 auto' }}>
          <div className="owl-radar-grid" />
          <span className="owl-heat" style={{ left: '40%', top: '46%', background: 'var(--mint)', width: 14, height: 14 }} />
          <span className="owl-heat" style={{ left: '56%', top: '38%', background: 'var(--orange)', width: 14, height: 14 }} />
          <div className="owl-radar-tag">Round playback canvas</div>
        </div>
        <div className="owl-replay-bar">
          <button className="owl-icon-btn"><Icon name="skip-back" size={18} /></button>
          <button className="owl-play"><Icon name="play" size={18} /></button>
          <button className="owl-icon-btn"><Icon name="skip-forward" size={18} /></button>
          <div className="owl-scrub"><div className="owl-scrub-fill" style={{ width: '62%' }} /></div>
        </div>
      </Card>
    </div>
  );
}

function App() {
  const [view, setView] = React.useState(() => localStorage.getItem('owl_view') || 'overview');
  const [ask, setAsk] = React.useState(false);
  React.useEffect(() => { try { localStorage.setItem('owl_view', view); } catch (e) {} }, [view]);
  useIcons();

  return (
    <div className="owl-app">
      <NavRail view={view} onView={setView} onAsk={() => setAsk(true)} />
      <TopBar onAsk={() => setAsk(true)} />
      <main className="owl-main">
        {view === 'overview' && <Overview onView={setView} onAsk={() => setAsk(true)} />}
        {view === 'maps' && <MapPage onAsk={() => setAsk(true)} />}
        {view === 'replay' && <ReplayView />}
      </main>
      <BottomNav view={view} onView={setView} onAsk={() => setAsk(true)} />
      <AskCoach open={ask} onClose={() => setAsk(false)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

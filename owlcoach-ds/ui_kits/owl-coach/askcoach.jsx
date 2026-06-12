/* ASK THE COACH — reachable from anywhere via a right-hand slide-over
   (full-screen sheet on mobile). Free-form Q&A with suggested prompts. */
const _ANS = window.OWLCOACHDesignSystem_013434;

const SUGGESTIONS = [
  'Why do I keep losing on Nuke?',
  'What should I practice in aim trainer today?',
  'Explain my untraded-death problem',
  'Best CT setup for me on Mirage?',
];

const SEED = [
  { who: 'coach', text: "Ask me anything about your play — a map, a match, a habit. I'll answer from your last 20 demos." },
];

function AskCoach({ open, onClose }) {
  useIcons();
  const { Button, Avatar } = _ANS;
  const [msgs, setMsgs] = React.useState(SEED);
  const [val, setVal] = React.useState('');
  const bodyRef = React.useRef(null);

  React.useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, open]);

  const send = (text) => {
    const q = (text || val).trim();
    if (!q) return;
    setVal('');
    setMsgs((m) => [...m, { who: 'me', text: q }]);
    setTimeout(() => {
      setMsgs((m) => [...m, { who: 'coach', text: coachReply(q) }]);
    }, 380);
  };

  return (
    <React.Fragment>
      <div className={'owl-scrim' + (open ? ' is-open' : '')} onClick={onClose} />
      <aside className={'owl-slideover' + (open ? ' is-open' : '')} aria-hidden={!open}>
        <header className="owl-so-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="../../assets/owl-mark.svg" width="26" height="26" alt="" />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--text-1)' }}>Ask the coach</div>
              <div className="owl-label" style={{ color: 'var(--mint)' }}>● Reads your last 20 demos</div>
            </div>
          </div>
          <button className="owl-icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={20} /></button>
        </header>

        <div className="owl-so-body" ref={bodyRef}>
          {msgs.map((m, i) => (
            <div key={i} className={'owl-msg owl-msg--' + m.who}>
              {m.who === 'coach' && <img src="../../assets/owl-mark.svg" width="24" height="24" alt="" style={{ flexShrink: 0, marginTop: 2 }} />}
              <div className="owl-bubble">{m.text}</div>
            </div>
          ))}
        </div>

        <div className="owl-so-suggest">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} className="owl-chip" onClick={() => send(s)}>{s}</button>
          ))}
        </div>

        <footer className="owl-so-foot">
          <input
            className="owl-input"
            placeholder="Ask about a map, match, or habit…"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          />
          <button className="owl-send" onClick={() => send()} aria-label="Send"><Icon name="arrow-up" size={18} /></button>
        </footer>
      </aside>
    </React.Fragment>
  );
}

function coachReply(q) {
  const s = q.toLowerCase();
  if (s.includes('nuke')) return "Your Nuke win rate is 39% — your weakest map. The pattern: you over-rotate to lower on first contact and get caught out of position. Stick to your default CT and only drop on confirmed info. Want a Nuke fundamentals plan?";
  if (s.includes('untraded')) return "82% of your deaths last month had no trade — now 71% and dropping. It means you're peeking alone before a teammate can refrag. Closing distance to a teammate before contact is the whole fix. That's your active focus.";
  if (s.includes('aim') || s.includes('practice')) return "Given your 4.2° low crosshair placement, run 10 min of Aim Botz at head height only — no flicking. Then the trade-positioning VOD review you're assigned. Skip spray routines; your first-bullet accuracy is already top-tier.";
  if (s.includes('mirage')) return "On Mirage, play a passive connector + stairs crossfire on CT. You over-aggress jungle and die untraded. Let your awp anchor mid and hold the trade angle.";
  return "Good question. From your demos the short answer is: tighten up your trade spacing and pre-aim at head height. Want me to break that down for a specific map?";
}

Object.assign(window, { AskCoach });

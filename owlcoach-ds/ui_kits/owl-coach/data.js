/* Fake but realistic OWL.COACH data for the UI kit. Mirrors the metrics the
   real backend parses from demos + the FACEIT API. window.OWL_DATA. */
window.OWL_DATA = {
  player: {
    name: 'soloq_owl',
    level: 6,
    elo: 1350,
    eloProgress: 0.52,       // through the lvl-6 band
    eloTrend: [1290, 1305, 1298, 1322, 1311, 1340, 1333, 1350],
    region: 'EU',
  },

  // Today's committed focus — the hero
  focus: {
    verdict: "You're dying untraded far too often.",
    metricValue: '71', metricUnit: '%', targetLabel: 'vs 55% target',
    costLine: "A death with no trade hands the enemy a free man-advantage for the rest of the round. At your rate it's costing ~3 rounds a half.",
    baseline: 82, current: 71, target: 55, goodDirection: 'down',
    drillName: 'Trade-positioning VOD review', drillDuration: '15 min',
    status: 'improving', assignedAgo: '4 days ago',
    supporting: [
      { label: 'Trade participation', value: '48%' },
      { label: 'Avg time alone', value: '2.1s' },
      { label: 'Deaths in the open', value: '34%' },
    ],
  },

  overallStats: [
    { label: 'K / D', value: '1.18', delta: +0.09, goodDirection: 'up', spark: [1.02,1.05,0.98,1.10,1.06,1.12,1.15,1.18] },
    { label: 'ADR', value: '78.4', delta: +4.2, goodDirection: 'up', spark: [70,72,69,74,73,76,77,78] },
    { label: 'Win %', value: '52', unit:'%', delta: -3, goodDirection: 'up', spark: [58,56,55,54,53,53,52,52] },
    { label: 'HS %', value: '47', unit:'%', delta: +2, goodDirection: 'up', spark: [43,44,42,45,46,45,46,47] },
  ],

  insights: [
    { rank: 1, kind: 'fix', title: 'Over-peeking on retakes', detail: 'You take the first duel on 3 of 4 retakes. Let utility land and trade off a teammate instead.', metric: '64%', delta: -5, goodDirection: 'up' },
    { rank: 2, kind: 'fix', title: 'Unused utility at death', detail: 'Dying with a full kit on 41% of rounds — that grenade was a free 30 damage.', metric: '41%', delta: +3, goodDirection: 'down' },
    { rank: 3, kind: 'fix', title: 'Crosshair placement drifts low', detail: 'Avg 4.2° below head height on entries. Pre-aim common angles at head level.', metric: '4.2°', delta: +0.4, goodDirection: 'down' },
    { kind: 'strength', title: 'Clutch composure', detail: '1vX win rate is well above your level — keep trusting your reads.', metric: '58%', delta: +9, goodDirection: 'up' },
    { kind: 'strength', title: 'First-bullet accuracy', detail: 'Top-tier first-shot accuracy. Your tapping fundamentals are solid.', metric: '38%', delta: +2, goodDirection: 'up' },
  ],

  recentForm: [
    { result: 'W', map: 'Mirage', elo: +24, kd: '1.4', date: 'Today' },
    { result: 'L', map: 'Nuke', elo: -19, kd: '0.8', date: 'Today' },
    { result: 'W', map: 'Dust2', elo: +21, kd: '1.6', date: 'Yest' },
    { result: 'W', map: 'Mirage', elo: +18, kd: '1.1', date: 'Yest' },
    { result: 'L', map: 'Vertigo', elo: -22, kd: '0.7', date: 'Yest' },
    { result: 'W', map: 'Ancient', elo: +20, kd: '1.3', date: '2d' },
    { result: 'L', map: 'Inferno', elo: -17, kd: '0.9', date: '2d' },
    { result: 'W', map: 'Dust2', elo: +23, kd: '1.5', date: '3d' },
  ],

  maps: ['Mirage','Inferno','Nuke','Ancient','Anubis','Dust2','Vertigo','Train'],
  mapWinRates: { Mirage:61, Inferno:48, Nuke:39, Ancient:55, Anubis:50, Dust2:57, Vertigo:44, Train:52 },

  // Per-map detail. Some maps intentionally lack demo data (empty states).
  mapDetail: {
    Mirage: {
      hasDemos: true,
      stats: { winRate: 61, kd: '1.31', adr: 84, openWin: 58, ctWin: 64, tWin: 57 },
      guide: {
        tPlan: "Default to A-control through palace + ramp. Don't over-commit ramp early — your untraded deaths spike here. Take map control mid, then hit B late off the bench info.",
        ctSetup: "Play a passive connector + stairs crossfire. You over-aggress jungle — hold the trade angle from CT instead and let your awp anchor mid.",
        utility: "Learn the one-way smoke for mid window and the ramp molly from T-spawn. You're throwing 0 util on 30% of rounds.",
        actions: [
          'Stop taking the first ramp duel — wait for a trade body.',
          'Pre-aim head-height when you swing palace.',
          'Throw your mid window smoke EVERY T round.',
        ],
      },
      heat: true,
    },
    Vertigo: { hasDemos: false, stats: { winRate: 44, kd: '0.92', adr: 68, openWin: 41, ctWin: 47, tWin: 40 },
      guide: {
        tPlan: "Stick to A-ramp executes with your team. Avoid lone B-pushes — the rotations punish you.",
        ctSetup: "Anchor B with the awp; the close angles favour your first-bullet accuracy.",
        utility: "Learn the A-ramp smoke + molly combo. That's the whole map at your level.",
        actions: ['Default to A. Don\'t solo B.', 'Hold close angles on CT.', 'One util lineup: A-ramp smoke.'],
      },
    },
  },
};

/* ============================================================================
   OWL.COACH — Sample data (shared across kits). Fictional but internally
   consistent. Player handle mirrors the reference: VeryBusyOwl.
============================================================================ */
window.OWL_DATA = {
  player: {
    handle: 'VeryBusyOwl', verified: true, country: 'US', memberSince: 'Aug 2018',
    elo: 1319, level: 6, eloDelta: -297, matches: 488, winRate: 51.0, kd: 1.07,
    avgSwing: -0.85, consistency: 80, avgMatchSkill: 1329,
    eloHistory: [1201,1240,1268,1255,1290,1320,1342,1318,1305,1280,1262,1248,1232,1255,1278,1262,1240,1228,1250,1272,1295,1310,1288,1270,1252,1238,1260,1285,1308,1319],
    kdSpark: [1.12,0.98,1.21,1.05,0.92,1.18,1.30,1.07,0.88,1.14,1.02,1.07],
    swingSpark: [-0.2,0.4,-0.9,0.3,-1.4,0.6,-0.5,-1.1,0.2,-0.85],
    form: ['W','L','W','W','L','L','W','L','L','W'], // recent 10, latest right
    seasonW: 15, seasonL: 15,
  },
  /* Ranked, blunt coaching priorities — the heart of the product */
  fixes: [
    { id: 1, severity: 'high', impact: '+0.18 K/D', map: 'Mirage', side: 'T',
      cue: 'Stop dry-peeking mid. Hold the angle.',
      why: 'You die first in mid 6 of the last 10 rounds you contest it. No util, no trade — just a coinflip you keep losing.',
      stat: { label: 'Mid first-deaths', value: '6 / 10', spark: [2,3,4,3,5,6,6] }, drill: 'aim_botz' },
    { id: 2, severity: 'high', impact: '+4% RWR', map: 'All maps', side: 'CT',
      cue: 'Trade your teammate. Stop watching them die.',
      why: 'When your entry dies, you secure the trade only 31% of the time. Re-aim to their crosshair before they swing.',
      stat: { label: 'Trade rate', value: '31%', spark: [40,38,35,33,31,30,31] }, drill: 'prefire' },
    { id: 3, severity: 'med', impact: '−2.1 deaths/half', map: 'Inferno', side: 'T',
      cue: 'Quit over-peeking with no info.',
      why: '11 of your deaths this week were re-peeks of an angle you already lost. One peek, then reset.',
      stat: { label: 'Info-less deaths', value: '11', spark: [6,7,9,8,10,11,11] }, drill: 'review' },
  ],
  wins: [
    { cue: 'Clean B executes.', why: 'You traded every entry on B-site this week. Keep running it.', stat: '+12% B win' },
    { cue: 'Pistol rounds are sharp.', why: 'Won 7 of last 10 pistols. Your eco discipline is paying off.', stat: '7 / 10' },
  ],
  matches: [
    { id: 'm1', map: 'Mirage', result: 'W', score: '13–9', kills: 24, deaths: 17, assists: 5, kd: 1.41, adr: 92.4, hs: 58, elo: +25, when: '2h ago', mode: 'Matchmaking' },
    { id: 'm2', map: 'Inferno', result: 'L', score: '7–13', kills: 14, deaths: 20, assists: 3, kd: 0.70, adr: 61.2, hs: 41, elo: -27, when: '5h ago', mode: 'Matchmaking' },
    { id: 'm3', map: 'Ancient', result: 'L', score: '11–13', kills: 19, deaths: 21, assists: 7, kd: 0.90, adr: 78.1, hs: 47, elo: -24, when: 'Yesterday', mode: 'Premier' },
    { id: 'm4', map: 'Nuke', result: 'W', score: '13–6', kills: 27, deaths: 13, assists: 4, kd: 2.08, adr: 110.3, hs: 63, elo: +22, when: 'Yesterday', mode: 'Matchmaking' },
    { id: 'm5', map: 'Dust2', result: 'W', score: '13–11', kills: 22, deaths: 19, assists: 6, kd: 1.16, adr: 84.0, hs: 52, elo: +21, when: '2d ago', mode: 'Premier' },
    { id: 'm6', map: 'Anubis', result: 'L', score: '9–13', kills: 16, deaths: 20, assists: 8, kd: 0.80, adr: 70.5, hs: 44, elo: -26, when: '2d ago', mode: 'Matchmaking' },
  ],
  /* single-match scoreboard for the breakdown screen */
  scoreboard: {
    map: 'Mirage', score: 'WON 13 – 9', duration: '38:12', when: 'Today, 14:22', mode: 'Matchmaking',
    team: [
      { name: 'VeryBusyOwl', me: true, level: 6, k: 24, d: 17, a: 5, kd: 1.41, adr: 92.4, hs: 58, kast: 78 },
      { name: 'glaceon', level: 7, k: 21, d: 16, a: 9, kd: 1.31, adr: 88.0, hs: 49, kast: 81 },
      { name: 'm0nke', level: 5, k: 18, d: 18, a: 6, kd: 1.00, adr: 74.2, hs: 38, kast: 70 },
      { name: 'Tarkov_Andy', level: 6, k: 16, d: 19, a: 4, kd: 0.84, adr: 66.1, hs: 55, kast: 65 },
      { name: 'sixthsense', level: 8, k: 14, d: 17, a: 11, kd: 0.82, adr: 59.8, hs: 41, kast: 74 },
    ],
    enemy: [
      { name: 'b1aze', level: 9, k: 23, d: 19, a: 3, kd: 1.21, adr: 90.1, hs: 61, kast: 72 },
      { name: 'noodleArm', level: 6, k: 20, d: 20, a: 7, kd: 1.00, adr: 79.4, hs: 44, kast: 68 },
      { name: 'cl4ws', level: 7, k: 18, d: 21, a: 5, kd: 0.86, adr: 71.0, hs: 52, kast: 64 },
      { name: 'qwerty', level: 5, k: 13, d: 22, a: 8, kd: 0.59, adr: 55.3, hs: 33, kast: 60 },
      { name: 'GGwfelp', level: 4, k: 9, d: 22, a: 6, kd: 0.41, adr: 48.7, hs: 29, kast: 55 },
    ],
    rounds: [ // 1 = won by my team, 0 = lost. side flips at 12
      1,1,0,1,1,0,0,1,1,0,1,1, // first half (CT) 8-4
      1,0,1,1,0,1,0,1,1,1      // second half -> 13-9
    ],
  },
};

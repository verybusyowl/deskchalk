# UI Kit — Player Profile / Historical Stats

The deep historical view, modelled on the reference layout. Open `index.html`.

## What it shows
- **Profile sidebar** — owl avatar + skill-level hex, FACEIT/Steam source chips,
  edit/share, member-since, bio, country, social links.
- **Profile tabs** — Games/Friends/… top row + Summary/Match history/Stats/Leagues.
- **Season hero** — large ELO ring (orange arc) with matches / win-rate / region rank,
  on a faint heat radial glow.
- **Recent performance** — K/D, Avg swing, Consistency stat tiles + "partial stats" note.
- **ELO history** — area chart with season/soft-reset markers and a W/L summary panel.

## Files
- `Profile.jsx` — `Profile`, `ProfileSidebar`, `SeasonHero`, `RecentPerformance`,
  `EloHistoryCard`, `ProfileTabs`.
- Shared: `../_shared/{icons.js, data.js, primitives.jsx, charts.jsx, shell.jsx}`.

## Notes
Built for ≥1240px. The avatar uses the owl mark as a stand-in; drop in a real player
image when available.

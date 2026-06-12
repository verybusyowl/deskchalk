# UI Kit — Match History & Breakdown

A click-through: match list → single-match breakdown. Open `index.html` and click any row.

## What it shows
- **Match list** — per-row map tile (W/L edge), result + score, mode/time, K-D-A,
  K/D, ADR, HS%, ELO delta. Filter segmented control. Rows are clickable.
- **Match breakdown** — result hero (map, WON 13–9, duration) with `Watch demo` /
  `Coach this match`; a **round timeline** (per-round W/L, half split); and two
  **scoreboards** (your team / enemy) with K/D/A, ADR, HS%, KAST and your row in mint.

## Files
- `Match.jsx` — `Match`, `MatchList`, `MatchRow`, `MatchBreakdown`, `RoundTimeline`,
  `ScoreboardTable`, `MapTile`.
- Shared: `../_shared/{icons.js, data.js, primitives.jsx, charts.jsx, shell.jsx}`.

## Notes
Cosmetic recreation. Map tiles are labeled placeholders (no fake renders). Built for ≥1100px.

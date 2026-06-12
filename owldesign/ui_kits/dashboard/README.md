# UI Kit — Coaching Dashboard

The product's hero surface. Turns recent matches into a short, ranked list of
**blunt, actionable fixes**. Open `index.html`.

## What it shows
- **Header** — blunt headline, ELO ring, recent W/L form strip, season delta.
- **Layout switcher** (`Briefing` / `Triage board` / `HUD`) — the 2–3 dashboard
  variations the design explores. Click to compare.
- **Coaching cards** — ranked 1-2-3 by ELO impact. Each: severity pill, impact
  estimate, map/side context, a one-line cue, a rationale line, a supporting
  micro-stat + sparkline, and `Drill` / `Demo` actions.
- **What's working** — mint positive-reinforcement cards.

## Files
- `Dashboard.jsx` — `Dashboard`, `CoachCard`, `WinCard`, `FormStrip`, `MetricStrip`,
  `DashHeader`, and the three `Layout*` variants.
- Shared: `../_shared/{icons.js, data.js, primitives.jsx, charts.jsx, shell.jsx}`.

## Notes
Cosmetic recreation — buttons toggle local state only. Layout variants are real and
swappable. Built for ≥1180px; rails are fixed, the center column scrolls.

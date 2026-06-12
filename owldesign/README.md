# Owl's CS2 Coach — Design System

**Owl's CS2 Coach** (working wordmark: **OWL.COACH**) is a personal Counter-Strike 2
improvement tool. It does two jobs:

1. **Coach** — turns a player's recent matches into a short list of *blunt, actionable*
   things to fix. Not a wall of stats — three to five concrete drills and habit fixes,
   ranked by impact. ("Stop peeking mid every round. Hold your angle.")
2. **Track** — a deep historical view of Counter-Strike performance, pulling **FACEIT**
   (ELO, level, matches) and **Steam / CS2 official** stats into one timeline.

The audience is one competitive player (Kyle, handle *VeryBusyOwl*) who wants to climb —
so the product talks to *you* directly, like a demanding coach, not a dashboard.

---

## Sources & provenance

This system was built **from concept + a single visual reference**; there is no codebase
or Figma yet. Decisions below are original design, not extracted from production code.

- **Reference screenshot:** `uploads/faceitstats.png` — a FACEIT-style player profile.
  Used only for *vibe* (dark esports UI, condensed uppercase labels, ELO ring, skill-level
  hexagon, area-chart history). **OWL.COACH is its own brand** — electric **mint** primary
  instead of FACEIT orange, owl-crosshair logomark, blunt first-person coaching voice.
- No other repos, decks, or Figma files were provided.

> ⚠️ If a real codebase exists ("almost everything is already built"), **attach it via the
> Import menu** and I'll re-derive the tokens and rebuild the UI kits against the source —
> that will be far more accurate than this screenshot-informed reconstruction.

---

## Brand in one breath

Dark, tactical, fast. A HUD you'd trust mid-match. Near-black cool surfaces, **electric
mint** for signal and "do this," **orange heat** for ELO / streaks / danger, angular
cut-corner accents borrowed from tactical kit. Numbers are the heroes — big, condensed,
tabular. Nothing decorative survives that doesn't help you win.

---

## CONTENT FUNDAMENTALS

**Voice: a blunt coach who has watched your demos and is mildly disappointed.**
Direct, imperative, second person. Short sentences. No hedging, no corporate softening,
no motivational fluff. Specific over vague.

- **Person:** Talk to *you*. The coach is implicit ("Hold the angle," not "Players should
  hold angles"). Never "we."
- **Mood:** Imperative for advice ("Stop dry-peeking." "Trade your teammate."). Present
  tense for facts ("You're winning 38% of your duels on T-side.").
- **Length:** A coaching cue is one line. A rationale is one more line, max. If it needs a
  paragraph, it's the wrong format.
- **Specificity:** Always name the map, the side, the spot, the number.
  - ✅ "You die first on Mirage A-site 6 of last 10 rounds you attack it."
  - ❌ "Improve your entry fragging."
- **Casing:**
  - **UPPERCASE + letter-spaced** for labels, nav, eyebrows, stat captions, table headers
    (`SUMMARY`, `RECENT PERFORMANCE`, `AVG SWING`).
  - **Sentence case** for coaching cues, body copy, descriptions.
  - **Numbers are sacred** — never spell out; show the figure (`1,319`, `1.07 K/D`, `−297`).
- **Deltas** read like a scoreboard: signed and colored. `+128` mint, `−297` red. Use the
  real minus glyph `−`, not a hyphen.
- **No emoji in product chrome.** The reference uses emoji only inside an optional feedback
  reaction widget; treat that as the single exception, never in coaching content or data.
- **Tone examples:**
  - Win card: "Clean half. You traded every entry on B. Keep doing exactly that."
  - Fix card: "You're over-peeking. 11 of your deaths this week were re-peeks with no info."
  - Empty state: "No matches yet. Play one and I'll tear it apart."
  - Loading: "Reading your demos…"

---

## VISUAL FOUNDATIONS

### Color
- **Surfaces** are a cool near-black ramp (`--bg-0` `#090c0f` → `--bg-5` `#2e3946`), never
  pure black, never warm. Depth is built by *stepping the ramp*, not by drop shadows.
- **Brand = electric mint `#19e59b`.** Used sparingly: primary buttons, active nav, "do
  this" coaching accents, positive deltas, focus rings. If everything is mint, nothing is.
- **Heat = orange `#ff6a2c`.** The FACEIT-energy accent — reserved for ELO line/ring,
  win-streaks, "on fire" stats, and high-attention warnings.
- **Semantics:** win/positive = mint, loss/negative = red `#ff3b54`, caution = amber
  `#ffc24b`, info/"partial stats" = blue `#4d9eff`.
- **FACEIT skill levels 1–10** have their own canonical ramp (grey → green → yellow →
  orange → red); see `--lvl-*`. Don't recolor them.
- **Imagery vibe:** map renders and avatars run cool and slightly desaturated, dropped onto
  dark with a subtle inner vignette so the UI chrome stays louder than the art.

### Type
- **Chakra Petch** (display): all headings, uppercase labels/nav, and **every big number**.
  Its cut-corner letterforms are the typographic echo of the tactical clip-corner motif.
- **Barlow** (body): coaching cues, descriptions, UI text. Athletic, slightly condensed.
- **JetBrains Mono**: raw values in dense tables, timestamps, share codes — anything that
  benefits from fixed columns. Always `font-variant-numeric: tabular-nums`.
- Stat numerals are large and tight (`--stat-xl` 44px / 1.0). Labels above them are tiny,
  uppercase, letter-spaced, and muted (`--fg-3`).

### Spacing & layout
- 4px base grid (`--s-*`). Dense but never cramped — this is a power-user tool.
- App shell = fixed left **icon+label rail**, optional fixed right **utility rail** (like
  the reference), fluid center column with a max content width. Rails don't scroll; the
  center does.
- Cards group by *topic* (one stat cluster per card), separated by `--s-4`/`--s-6` gutters.

### Shape, borders, elevation
- **Radii are restrained:** cards `--r-md` (8px), pills fully round, inputs `--r-sm`.
- **Cut corners** (`.cut-corner`, `--cut` 9px) are the signature flourish — used on hero
  stat tiles, the primary CTA, and level badges. Don't put them on everything; 1–2 per view.
- **Borders do the work shadows usually do.** Default card = `--bg-3` fill + `1px --line-2`
  border. Hover lifts the border to `--line-3`, not a shadow.
- **Shadows** are deep and soft, only on popovers/menus (`--shadow-pop`). **Glows**
  (`--glow-brand`, `--glow-heat`) mark the single most important live element on a screen
  (e.g. the current ELO ring) — used at most once per view.

### Backgrounds & texture
- Mostly flat dark surfaces. The one allowed gradient is a **stat-area fill** under line
  charts (heat orange → transparent) and a faint radial "hero glow" behind the ELO ring.
- A barely-there diagonal grid / scanline texture (≤4% opacity) may sit behind hero panels
  for tactical-HUD feel. Never on content cards.
- No bluish-purple gradients, no glassmorphism washes, no rounded-card-with-left-border.

### Motion
- **Fast and mechanical.** `--dur-1`/`--dur-2` with `--ease-out`. Things snap, they don't
  float. No bounce on UI.
- Numbers **count up** to their value on first paint (≤320ms). The ELO ring sweeps to its
  arc. Charts wipe in left-to-right.
- Respect `prefers-reduced-motion`: skip counts/sweeps, show end state.

### States
- **Hover:** surface steps up one (`--bg-3`→`--bg-4`) and/or border brightens to `--line-3`.
  Interactive icons go `--fg-3`→`--fg-1`. Mint elements brighten to `--brand-bright`.
- **Press:** quick `scale(0.98)` + surface steps to `--bg-5`. No color invert.
- **Focus:** 2px mint ring (`box-shadow: 0 0 0 2px var(--bg-1), 0 0 0 4px var(--brand)`).
- **Selected/active nav:** mint left-edge bar + `--brand-soft` wash + `--fg-1` label.
- **Disabled:** `--fg-4` text, no border brighten, `cursor: not-allowed`.

### Transparency & blur
- Sparingly. Sticky headers and the right utility rail use `backdrop-filter: blur(12px)`
  over a `--bg-1`/85% fill. Tooltips/menus are solid `--bg-4`, no blur. Data is never
  shown through translucency.

---

## ICONOGRAPHY

- **System icons:** [**Lucide**](https://lucide.dev) (CDN), stroke `2`, line-cap round —
  a clean match for the thin line icons in the reference (search, play, rank, track, feed).
  This is a **substitution** for the reference's bespoke icon set; flagged so you can swap
  in the real icons if a codebase appears. Sizes 16 / 18 / 20; color inherits text (`--fg-3`
  idle → `--fg-1` active).
- **Brand badges / data-viz marks** are first-party SVG, not Lucide, because they encode
  meaning: the **skill-level hexagon** (number on a `--lvl-*` fill), the **ELO ring**
  (orange arc + level chip), **W/L pills**, **source chips** (FACEIT / Steam). Treat these
  as components, not decoration.
- **Logo:** `assets/owl-mark.svg` — two owl eyes drawn as crosshair reticles. Mint on dark;
  may invert to `--bg-0` on a mint fill. Pairs with the **OWL.COACH** wordmark (Chakra
  Petch 700, mint period).
- **Emoji:** not used in product chrome or data. The only sanctioned use is the optional
  reaction widget mirrored from the reference; keep it isolated.
- **No hand-drawn illustration.** Maps/agents/weapons come from real game art when present;
  otherwise use a labeled placeholder, never an invented SVG scene.

---

## Index — what's in this system

| Path | What it is |
|---|---|
| `colors_and_type.css` | All design tokens: color ramps, semantic + skill-level colors, type scale, spacing, radii, shadows/glows, motion. Import this first. |
| `assets/owl-mark.svg` | Primary logomark (owl-crosshair). |
| `assets/` | Logo, brand SVGs, any imagery. |
| `preview/` | Small specimen cards that populate the **Design System** tab (type, color, spacing, components). |
| `ui_kits/dashboard/` | **Coaching dashboard** — actionable improvement cards (2–3 layout variations). |
| `ui_kits/profile/` | **Player profile / historical stats** — ELO ring, recent performance, history chart. |
| `ui_kits/match/` | **Match history + single-match breakdown** — scoreboard, round timeline. |
| `SKILL.md` | Agent-Skills manifest so this folder works as a downloadable Claude skill. |

> **Fonts** load from Google Fonts in `colors_and_type.css`. To vendor locally, drop the
> `.woff2` files in `/fonts` and swap the `@import` for `@font-face`.

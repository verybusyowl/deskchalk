# OWL.COACH — Design System

A personal CS2 coaching web app for a single user (FACEIT level 6, ~1350 ELO,
solo-queue). Runs on a home server. The backend is working; this design system
exists to drive a **frontend redesign**.

> **The one job of this UI:** when you open the site, you should know **THE ONE
> THING to fix** in your play within 10 seconds — then be able to drill into
> "why" if you want. It is a **coach, not a stats explorer**. Verdicts first,
> numbers as proof. Ruthlessly cut anything that doesn't change a decision.

## Sources
This system was authored from a written product brief (no prior codebase or
Figma). Nothing external needs to be fetched. Brand inputs that were fixed and
carried through:
- Name **OWL.COACH**, owl-mark logo (authored here — see `assets/`).
- Dark cool surface ramp `#0e1217 → #232c36`.
- Electric mint `#19e59b` (brand / wins / improvement), orange `#ff6a2c`
  (heat / ELO / warnings / regressions).
- Type: **Chakra Petch** (display/numerals/labels), **Barlow** (body),
  **JetBrains Mono** (tables/stats).
- Vibe: esports-broadcast meets training app. Confident, blunt, zero fluff.

## My IA recommendation (what I changed and why)
I challenged the structure as asked. Three changes I'd stand behind:
1. **Identity is demoted to a slim context bar.** Avatar + level + ELO ring +
   trend still appear, but as a thin strip — not a hero. It's context, not a
   decision. The **FocusCard is the sole hero** of Overview.
2. **Overall stats become proof, not a dashboard.** K/D, ADR, Win%, HS% sit in
   a compact 4-up strip *directly under the verdict*, and the **trend delta is
   the headline of each tile**, not the absolute number. The delta is what tells
   you if you're getting better.
3. **"Coaching insights" is reframed as the bench.** Today's Focus is the ONE
   committed thing (with drill + baseline progress). The ranked insights are
   explicitly the queue *behind* it — subordinate, clearly secondary, so the
   page never has two competing "do this" messages.

Everything else in your IA I kept: Maps with a persistent picker and a
"Fundamentals" guide as the page hero; Replay left alone; Ask-the-coach pulled
out of its own page into a **slide-over reachable from anywhere**.

---

## CONTENT FUNDAMENTALS — how OWL.COACH writes

The voice is a **blunt, expert coach talking to one player**. Think a pro's
in-game leader doing a calm post-match review — direct, never hype, never
corporate.

- **Person:** second person ("**you're** dying untraded", "**let** utility land
  first"). The coach addresses the player directly. First person only for the
  coach's own voice in chat ("I'll answer from your last 20 demos").
- **Verdicts, not observations.** Lead with the judgement: *"You're dying
  untraded far too often."* Then the number as proof. Never *"Here are your
  untraded-death stats."*
- **Always tie a fix to rounds won/lost.** Every weakness explains its cost:
  *"A death with no trade hands the enemy a free man-advantage… costing ~3
  rounds a half."* Numbers exist to justify a decision.
- **Imperative drills.** Action items are commands: *"Stop taking the first ramp
  duel — wait for a trade body."* *"Throw your mid window smoke EVERY T round."*
- **Casing:** Sentence case for prose and headings. **TRACKED UPPERCASE** (Chakra
  Petch, `.14em`) only for labels, eyebrows, stat names, badges, nav. Big numbers
  are bare (no thousands-commas inside the ring).
- **Numbers:** always paired with a target or a trend. "71% vs 55% target."
  "▲ 0.09 vs prev 10." A naked stat with no comparison doesn't ship.
- **Tone words:** confident, specific, terse. *Strong / Weak / Even* for maps.
  *Improving / Regressing* for trends. *The bench. The drill. The plan.*
- **No emoji.** No exclamation hype. No "Great job!" praise — strengths are
  stated as facts ("1vX win rate is well above your level"). The reward is a
  better verdict next session, not a sticker.
- **Brevity is the rule.** A verdict is one line. A cost is one sentence. An
  insight detail is one line. If it needs a paragraph, it belongs in the guide
  or the chat, not on a card.

---

## VISUAL FOUNDATIONS

**Overall feel.** Esports-broadcast HUD restraint on a near-black cool canvas.
Calm by default ("easy on the eyes"), with the broadcast energy held in reserve:
tracked caps, mono numerals, one corner-accent rule per card. The screen should
feel like a focused training tool, not a Vegas scoreboard.

**Color.**
- A single **cool, near-black surface ramp** carries everything: `--bg-0`
  `#0b0e12` (canvas) → `--surface-3` `#232c36` (hover/active). Depth comes from
  *borders + faint top-light*, not heavy shadows.
- **Two accents do all the talking.** Mint `#19e59b` = good / win / improvement /
  on-target. Orange `#ff6a2c` = heat / ELO / warning / regression. See COLOR
  USAGE RULES below.
- Text is cool off-white → muted slate: `--text-1` `#eef4f8` → `--text-4`
  `#43505c`. Never pure white, never pure grey.

**Type.** Chakra Petch for anything that should feel like broadcast chrome
(labels, big numbers, nav, buttons — uppercase + tracked for labels). Barlow for
all prose. JetBrains Mono with `tabular-nums` for any number in a table, a delta,
or a tight column so digits never jitter. Headline numbers (K/D, the one verdict
number, ELO) use Chakra Petch; dense-table numbers use mono.

**Spacing & layout.** 4px grid. Card padding 16 (mobile) / 20 (desktop). Section
gaps 24. Content maxes at 1180px and centers. Desktop = slim 76px left icon-rail;
mobile = sticky top bar + bottom tab nav, single breakpoint at 640px.

**Backgrounds.** Flat near-black with two **very faint** radial brand glows in
the app canvas (top-right orange, top-left mint, ~4–5% alpha) — barely
perceptible, just enough to keep the void from feeling dead. No photographic
backgrounds, no gradients on cards, no repeating texture except an optional
whisper-thin grid on radar/replay surfaces and a subtle scanline veil available
as a token for HUD moments (used sparingly).

**Cards.** Flat `--surface-1` fill, 1px hairline border (`--line`), 10px radius,
a faint inset top-light. **No drop shadows on resting cards** — elevation is for
dialogs/slide-overs only. The one flourish: an optional **2px top-edge accent**
(mint or orange) on a card that must signal good/bad at a glance (the FocusCard,
a regressing metric). Never more than one accent card per cluster.

**Corners.** Crisp, esports-sharp: 4px chips, 6px buttons/inputs, 10px cards,
14px the hero focus card, pills only for map-picker toggles and avatars-as-circle.
A `--cut-sm/md` corner-notch token exists for the rare true-HUD accent.

**Borders & dividers.** Three hairline weights: `--line-faint` (whisper grid),
`--line` (default divider), `--line-strong` (emphasis/focus). Borders, not
shadows, are the primary separation tool on dark.

**Shadows & glow.** Shadows are quiet and reserved for floating surfaces
(`--shadow-pop` on the slide-over/dialogs). **Glow is accent-only**: the ELO ring
gets an orange drop-glow; focus rings use a mint halo. Never glow neutral
elements.

**Transparency & blur.** Used only for chrome that floats over content: the
mobile top bar / bottom nav (`rgba` + `backdrop-filter: blur`) and the
slide-over scrim. Content cards are fully opaque.

**Motion (minimal, by request).** Short fades, number **count-ups** (ELO ring,
hero stats), one ELO-ring sweep on load. Standard ease-out
`cubic-bezier(.22,1,.36,1)`, 120–220ms. No bounce, no parallax, no infinite
loops. Everything respects `prefers-reduced-motion`.

**Interaction states.** Hover = subtle surface lift to `--surface-2` / border
brightens to `--line-strong` (cards lift 2px). Press = 1px translate-down on
buttons. Active nav = mint text on a mint-ghost fill. Focus-visible = mint halo
ring. No color inversions, no big scale jumps.

### COLOR USAGE RULES (the discipline that keeps it readable)
- **Neutral is the default.** Most of every screen is the surface ramp + text.
- **One accent per panel, max.** A card is mint *or* orange *or* neutral.
- **Mint = good/improvement/on-target.** Wins, positive deltas (regardless of
  arrow direction), targets, the "improving" focus state, primary action button.
- **Orange = heat/ELO/regression/warning.** The ELO ring, negative deltas,
  the "regressing" focus state, losses, "weak map".
- **Trend color = meaning, not arrow.** Some metrics improve by going *down*
  (untraded %, time-to-damage, crosshair error). `TrendIndicator` and
  `BaselineProgress` take a `goodDirection` so a falling untraded % shows mint.
- **Mint and orange never sit adjacent** unless you're explicitly comparing
  good vs bad (a W/L strip, a baseline-vs-regression split).
- Amber `--warn` and blue `--info` exist for the rare neutral-data or
  caution-that-isn't-a-regression case (FACEIT chips, neutral chart lines). Use
  rarely.

---

## ICONOGRAPHY

- **System:** [Lucide](https://lucide.dev) (`0.460.0`), loaded from CDN. Chosen
  for its clean ~2px stroke, geometric-but-friendly shapes that sit well next to
  Chakra Petch and read clearly at small sizes on dark. **This is a substitution**
  — the brief specified no icon set, so Lucide is my pick. If you prefer a
  different family (e.g. Phosphor, Tabler), say so and I'll swap it system-wide.
- **Usage:** `<i data-lucide="name">` swapped to SVG via `lucide.createIcons()`;
  in the kit a small `<Icon>` wrapper sizes them with `font-size` + a global
  `svg { width:1em; height:1em }` rule. Stroke stays at 2; color inherits
  `currentColor` so icons pick up text/accent colors.
- **Icons in play:** `layout-dashboard` (Overview), `map` (Maps), `play`
  (Replay), `message-square-text` (Ask the coach), `flame` (ELO/heat), `target`
  / `crosshair` (aim), `swords` / `shield` / `bomb` (T/CT/utility guide),
  `book-open` (fundamentals), `coins` (economy), `check` (action items).
- **Logo:** `assets/owl-mark.svg` (the eyes-as-scope owl) and
  `assets/owl-wordmark.svg`. The owl doubles as a sighting scope/crosshair — the
  "watch your play" idea. Mint eyes, orange beak, on dark.
- **No emoji** anywhere in product UI. Unicode arrows (▲ ▼ →) are used *only*
  inside dense mono deltas where a Lucide icon would be too heavy.
- **No hand-drawn illustration.** Radar/heatmap surfaces use a schematic grid
  placeholder; real radar images are the developer's to drop in.

---

## INDEX — what's in this system

**Foundations (root)**
- `styles.css` — the single entry point consumers link. `@import` manifest only.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`,
  `effects.css`, `base.css`. All CSS custom properties + the base reset.
  Fonts load from the Google Fonts CDN by default; `tokens/fonts-local.css` +
  `assets/fonts/README.md` are a drop-in **self-host kit** (add 11 `.woff2`
  files, flip one line in `fonts.css`).
- `assets/` — `owl-mark.svg`, `owl-wordmark.svg`.

**Components** (`components/<group>/` — React primitives, bundled to
`window.OWLCOACHDesignSystem_<id>`):
- `core/` — **Button**, **Badge**, **Card**
- `data/` — **StatCard**, **TrendIndicator**, **Sparkline**, **BaselineProgress**
- `identity/` — **Avatar**, **LevelBadge**, **EloRing**
- `coach/` — **FocusCard**, **InsightCard**, **EmptyState**
- `navigation/` — **MapPills**
- Each has `<Name>.d.ts` (props) + `<Name>.prompt.md` (usage) + one `*.card.html`
  specimen.

**UI kit** (`ui_kits/owl-coach/`): full interactive click-through —
`index.html` (Overview · Maps · Replay · Ask-the-coach slide-over). Screens in
`overview.jsx`, `mappage.jsx`, `askcoach.jsx`, shell in `shell.jsx`, charts in
`charts.jsx`, fake data in `data.js`, layout in `kit.css`.

**Concept frames** (`concepts/`): the two alternate Overview hero directions
(Scoreboard, Drill-ticket) shown next to the recommended Briefing direction.

**Specimen cards** populate the **Design System tab** (Type, Colors, Spacing,
Brand, Components, OWL.COACH App, Concepts groups).

**`SKILL.md`** — makes this folder usable as a downloadable Claude Agent Skill.

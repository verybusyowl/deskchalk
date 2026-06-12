# OWL.COACH — Frontend Handoff

**To:** the developer (or coding agent) implementing the OWL.COACH frontend.
**From:** design. This repo is the **reference design system** for a full
frontend redesign. The backend (demo parser + FACEIT API) already works — you
are building the new UI against it.

---

## The one rule
OWL.COACH is a **coach, not a stats explorer**. When the page opens, the user
must know **the one thing to fix** within 10 seconds, then be able to drill into
"why." Lead with a **verdict**; numbers are supporting proof, never the headline.
If a panel doesn't change a decision, it doesn't get prime placement. Voice is
blunt, second-person, zero fluff, no emoji. Full voice + visual rules in
`readme.md`.

## Tech constraints (hard)
- **Vanilla HTML / CSS / JS single-page app. No React/Vue/build step.**
- Implement as semantic HTML + the single `styles.css` (links the token system)
  + light JS. Mobile-responsive, single breakpoint at ~640px (desktop = slim
  left rail, mobile = bottom tab nav).
- All charts are hand-drawn SVG/canvas — no chart libraries. Prefer sparklines,
  bars, and big numbers.
- Dark theme only.

## How to use what's in this repo
1. **`styles.css`** — link this one file. It pulls in every design token
   (`tokens/`): the cool surface ramp, mint `#19e59b` (good/win/improvement),
   orange `#ff6a2c` (heat/ELO/regression), the type scale, spacing, radii,
   effects. **Build everything from these CSS variables** — don't hardcode
   colors or sizes.
2. **`components/`** — the React source for each primitive (FocusCard,
   StatCard, TrendIndicator, BaselineProgress, MapPills, EmptyState, EloRing,
   etc.). These are the **visual + behavioral reference**. Port them to semantic
   HTML/CSS/JS — match the markup structure and the CSS-variable usage, don't
   ship the React. Each has a `.prompt.md` explaining intent and props.
3. **`ui_kits/owl-coach/`** — the interactive reference app (Overview, Maps,
   Replay, Ask-the-coach slide-over). This is the **target look and behavior**.
   `kit.css` is the layout/shell CSS you can lift almost directly.
4. **`readme.md`** — the spec: information architecture, content voice, color
   usage rules, iconography, component intent.

## ⚠️ Two install notes
1. **Fonts.** They currently load from the Google Fonts CDN. To self-host on the
   server (offline + faster), add the **11 `.woff2` files** to `assets/fonts/`
   using the exact filenames in `assets/fonts/README.md`, then flip to **Mode B**
   in `tokens/fonts.css` (comment the CDN `@import`, uncomment the
   `./fonts-local.css` line). All three families (Chakra Petch, Barlow,
   JetBrains Mono) are SIL Open Font License — free to host and ship.
2. **The compiled bundle is a preview aid, not the product.** `ui_kits/` renders
   via `_ds_bundle.js` (the React components, prebuilt). The shipped app must be
   **vanilla** — port the JSX to semantic HTML against the same CSS variables.
   `_ds_bundle.js`, `_ds_manifest.json`, and `_adherence.oxlintrc.json` are
   tooling artifacts; you don't deploy them.

## Build order (suggested)
1. Wire `styles.css` + fonts (self-host per note 1).
2. Port the **shell** (rail / top bar / bottom nav) from `kit.css` + `shell.jsx`.
3. Build **Overview**: FocusCard hero → identity strip → overall-stats proof →
   coaching-insight "bench" → form/ELO-trend/map-strength. (`overview.jsx`)
4. Build **Maps**: persistent map picker → Map Fundamentals guide (hero) →
   FACEIT stats → demo panels with graceful empty states. (`mappage.jsx`)
5. Leave **Replay** as-is; just match the chrome.
6. Wire **Ask-the-coach** as a slide-over reachable from every screen.

Questions on intent or hierarchy → `readme.md` first, then ask design.

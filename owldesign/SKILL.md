---
name: owl-coach-design
description: Use this skill to generate well-branded interfaces and assets for Owl's CS2 Coach (OWL.COACH), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping a dark tactical esports coaching product.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out
and create static HTML files for the user to view. If working on production code, you can
copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build
or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_
production code, depending on the need.

## Fast start
- **Tokens:** `colors_and_type.css` — import it, then scope your markup with `class="owl"`.
- **Voice:** blunt coach, second person, imperative. "Stop dry-peeking mid. Hold the angle."
  Always name the map, side, spot, number. No emoji in product chrome.
- **Color:** near-black cool surfaces; **mint `#19e59b`** = signal / "do this" / wins;
  **orange `#ff6a2c`** = ELO / streaks / alerts. Red loss, amber caution, blue info.
- **Type:** Chakra Petch (display + numbers), Barlow (body), JetBrains Mono (data).
- **Shape:** restrained radii, 1–2 `.cut-corner` accents per view, borders over shadows,
  glow on the single most important live element only. Fast mechanical motion.
- **Icons:** Lucide-style set in `ui_kits/_shared/icons.js`; brand badges (skill hex, ELO
  ring, source chips) are first-party components in `ui_kits/_shared/primitives.jsx`.
- **Components:** reuse the shared kit — `primitives.jsx`, `charts.jsx`, `shell.jsx` — and
  the three screens under `ui_kits/`. They export to `window`; load order matters
  (icons → data → primitives → charts → shell → screen).

## Build checklist
1. `<link>` the tokens CSS; React 18 + Babel standalone (pinned, see any kit `index.html`).
2. Load the shared scripts in order, then your screen component.
3. Wrap the app in `<AppShell>` for full product chrome, or compose primitives directly.
4. Keep copy blunt and specific; keep the palette disciplined (mint is a signal, not a fill).

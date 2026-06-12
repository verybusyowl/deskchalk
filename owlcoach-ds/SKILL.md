---
name: owl-coach-design
description: Use this skill to generate well-branded interfaces and assets for OWL.COACH (a personal CS2 coaching web app — dark, esports-broadcast-meets-training-app), either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, owl-mark assets, and UI kit components for prototyping verdict-first coaching UIs.
user-invocable: true
---

# OWL.COACH design skill

Read `readme.md` in this skill first — it is the full design guide (product
philosophy, IA, content voice, visual foundations, color usage rules,
iconography). Then explore the other files as needed.

## The one rule that matters
OWL.COACH is a **coach, not a stats explorer**. Lead with a **verdict**; show
numbers only as proof. If a panel doesn't change a decision, it doesn't deserve
prime placement. Voice is blunt, second-person, zero fluff, no emoji.

## What's here
- `styles.css` — link this one file; it `@import`s every token + font.
- `tokens/` — colors (mint `#19e59b` = good, orange `#ff6a2c` = heat/ELO),
  type (Chakra Petch / Barlow / JetBrains Mono), spacing, effects.
- `components/` — React primitives (FocusCard, StatCard, TrendIndicator,
  BaselineProgress, MapPills, EmptyState, EloRing, Badge, Button, Card, …),
  each with a `.d.ts`, a `.prompt.md`, and a specimen `.card.html`.
- `ui_kits/owl-coach/` — full interactive Overview + Maps + Replay +
  Ask-the-coach app you can copy and adapt.
- `assets/` — `owl-mark.svg`, `owl-wordmark.svg`.

## How to use it
- **Visual artifacts** (slides, mocks, throwaway prototypes): copy assets out
  and produce static HTML the user can open. Pull the token CSS in via
  `styles.css`, reuse the component patterns, keep the verdict-first hierarchy.
- **Production code:** the product is **vanilla HTML/CSS/JS, no framework/build
  step** (single-page app, single CSS file, light JS, mobile breakpoint ~640px,
  hand-drawn SVG/canvas charts only). The React components here are the visual
  reference — port them to semantic HTML + the CSS variables, don't ship React.

If invoked with no other guidance, ask what the user wants to build, ask a few
sharp questions, then act as an expert designer who outputs HTML artifacts *or*
vanilla production code as the need dictates — always verdict-first, dark, blunt.

## Trademark / scope note
Recreate **OWL.COACH's own** brand only. Don't reproduce FACEIT, Valve, or other
companies' proprietary marks or UI — reference their data, not their chrome.

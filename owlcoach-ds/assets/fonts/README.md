# OWL.COACH — self-hosted fonts

Drop **11 `.woff2` files** in this folder, then activate **MODE B** in
`tokens/fonts.css` (comment the CDN `@import`, uncomment the `fonts-local.css`
one). Tell me when they're in and I'll flip the switch + verify.

All three families are **SIL Open Font License** — free to download, self-host,
and ship. Use the exact filenames below so `fonts-local.css` resolves them.

## Where to get them
- **Google Fonts** (download → unzip → you get `.ttf`): https://fonts.google.com
  - https://fonts.google.com/specimen/Chakra+Petch
  - https://fonts.google.com/specimen/Barlow
  - https://fonts.google.com/specimen/JetBrains+Mono
- Convert the `.ttf` you need to `.woff2` (smaller, faster) at any
  ttf→woff2 converter, **or** grab `.woff2` directly from
  https://gwfh.mranftl.com (google-webfonts-helper) — pick the family, the
  weights below, and "Modern Browsers (woff2)".

> Prefer `.woff2` (≈40% smaller). If you only have `.ttf`, you can still use
> them — just change `format('woff2')` → `format('truetype')` and the
> `.woff2` extensions → `.ttf` in `tokens/fonts-local.css` (I can do this).

## Exact files needed (weight → filename)

**Chakra Petch** — display, numerals, labels
| Weight | Filename |
|---|---|
| 400 Regular  | `ChakraPetch-Regular.woff2` |
| 500 Medium   | `ChakraPetch-Medium.woff2` |
| 600 SemiBold | `ChakraPetch-SemiBold.woff2` |
| 700 Bold     | `ChakraPetch-Bold.woff2` |

**Barlow** — body & coaching prose
| Weight | Filename |
|---|---|
| 400 Regular  | `Barlow-Regular.woff2` |
| 500 Medium   | `Barlow-Medium.woff2` |
| 600 SemiBold | `Barlow-SemiBold.woff2` |
| 700 Bold     | `Barlow-Bold.woff2` |

**JetBrains Mono** — stats, tables, numbers
| Weight | Filename |
|---|---|
| 400 Regular | `JetBrainsMono-Regular.woff2` |
| 500 Medium  | `JetBrainsMono-Medium.woff2` |
| 700 Bold    | `JetBrainsMono-Bold.woff2` |

That's the complete set the design system uses — no italics, no other weights.
Anything extra you add won't hurt, but these 11 are all that's referenced.

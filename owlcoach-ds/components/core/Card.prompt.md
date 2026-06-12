The base surface container every panel sits in — 1px hairline, 10px radius, faint top-light. Neutral by default; use `accent` only when the card itself must signal good/bad.

```jsx
<Card>…panel…</Card>
<Card accent="orange">…a regressing metric…</Card>
<Card as="section" interactive>…clickable…</Card>
```

Don't nest accent cards. `interactive` adds a subtle hover lift for clickable cards.

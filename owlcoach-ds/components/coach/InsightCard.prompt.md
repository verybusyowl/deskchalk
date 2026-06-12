Ranked coaching insight — the bench behind Today's Focus. `kind="fix"` (orange) or `kind="strength"` (mint). Stack 2–3 fixes then 1–2 strengths in priority order.

```jsx
<InsightCard rank={1} kind="fix" title="Over-peeking on retakes"
  detail="You take the first duel on 3 of 4 retakes. Let utility land first."
  metric="64%" delta={-5} goodDirection="up" />
<InsightCard kind="strength" title="Clutch composure"
  detail="1v1 win rate is well above your level." metric="58%" delta={+9} />
```

Keep `detail` to one line of plain second-person coaching.

Minimal SVG trend line for stat cards and tables. Auto-scales to its data. Keep it small (≤120px wide) — it's supporting evidence, never the headline.

```jsx
<Sparkline data={[1.0,0.9,1.1,1.2,1.15,1.3]} tone="good" />
```

`tone` tints it; `fill` adds a faint gradient area; `dot` marks the latest point.

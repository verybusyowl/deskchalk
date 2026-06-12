Compact metric tile for the overall-stats strip (K/D, ADR, Win%, HS%). The delta + sparkline carry the signal; the absolute number is reference. These are proof, not headlines — keep them in a row below the focus.

```jsx
<StatCard label="K / D" value="1.18" delta={+0.09} goodDirection="up" spark={[1.0,1.05,0.98,1.1,1.18]} />
<StatCard label="Untraded death %" value="71%" delta={-6} unit="%" goodDirection="down" />
```

Pass already-formatted `value`. `emphasis="hero"` bumps the number size.

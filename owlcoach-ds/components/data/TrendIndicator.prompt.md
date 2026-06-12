Signed trend delta where **colour means good/bad, not up/down**. Critical for CS metrics that improve by decreasing.

```jsx
<TrendIndicator delta={+0.12} goodDirection="up" />        {/* K/D up → mint */}
<TrendIndicator delta={-7} unit="%" goodDirection="down" /> {/* untraded% down → mint */}
```

Always set `goodDirection`. Mint = improving, orange = regressing, grey = flat.

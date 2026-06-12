Action button — uppercase Chakra Petch label, used for commits ("Start drill"), navigation, and destructive actions. Mint primary is the only high-emphasis action on a screen; everything else is secondary/ghost.

```jsx
<Button variant="primary" iconLeft={<i data-lucide="target" />}>Start 15-min drill</Button>
<Button variant="secondary" size="sm">View demos</Button>
<Button variant="ghost">Dismiss</Button>
```

Variants: `primary` (mint, one per screen), `secondary` (neutral surface), `ghost` (text-only), `danger` (orange tint — regressions/destructive). Sizes `sm | md | lg`. Pass `iconLeft`/`iconRight` Lucide nodes; `fullWidth` for mobile CTAs.

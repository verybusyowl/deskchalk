For demo-derived map panels that are empty on rarely-played maps. Dashed well + muted glyph + plain reason — never looks like an error.

```jsx
<EmptyState icon={<i data-lucide="crosshair" />}
  title="No heatmap yet"
  message="Only 2 demos parsed on Vertigo. Play a few more and kill/death zones will appear." />
```

Keep the message specific (cite the real reason) so it reads as pending, not failed.

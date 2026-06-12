The signature "are you actually fixing it" element. Plots baseline (when the focus was set), current, and target on one axis; fill turns mint when closing the gap, orange when widening it. Lives inside the FocusCard.

```jsx
<BaselineProgress baseline={82} current={71} target={55} unit="%" goodDirection="down" />
```

Set `goodDirection="down"` for metrics that improve by decreasing.

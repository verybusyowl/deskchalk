The single most important component — the Overview hero. One verdict, one number, one drill, and baseline→target progress. Nothing else on the page outranks it.

```jsx
<FocusCard
  verdict="You're dying untraded far too often."
  metricValue="71" metricUnit="%" targetLabel="vs 55% target"
  costLine="When you die without a trade, your team plays the round a man down. This is costing you ~3 rounds a half."
  baseline={82} current={71} target={55} goodDirection="down"
  drillName="Trade-positioning VOD review" drillDuration="15 min"
  status="improving" assignedAgo="4 days ago"
  supporting={[{label:'Trade participation', value:'48%'},{label:'Avg time alone', value:'2.1s'}]}
/>
```

`status` flips the accent + badge (improving = mint, regressing = orange). Keep `verdict` blunt and second-person. `costLine` is the "why it matters" — always tie it to rounds.

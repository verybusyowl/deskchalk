import React from 'react';
import { Card } from '../core/Card.jsx';
import { Badge } from '../core/Badge.jsx';
import { Button } from '../core/Button.jsx';
import { BaselineProgress } from '../data/BaselineProgress.jsx';

/**
 * THE hero. Answers "what do I fix next match" in one glance: a blunt
 * verdict headline, the one number as proof, why it costs rounds, the
 * assigned drill, and baseline→current→target progress. Everything else
 * on Overview is subordinate to this. Status badge flips mint/orange on
 * whether the focus is improving since assigned.
 */
export function FocusCard({
  verdict,
  metricValue,
  metricUnit = '',
  targetLabel,
  costLine,
  baseline,
  current,
  target,
  goodDirection = 'down',
  drillName,
  drillDuration = '15 min',
  status = 'improving',
  assignedAgo = '4 days ago',
  onStartDrill,
  supporting = [],
  style = {},
  ...rest
}) {
  const improving = status === 'improving';
  return (
    <Card
      padding="0"
      style={{ overflow: 'hidden', borderColor: 'var(--line-strong)', ...style }}
      {...rest}
    >
      {/* top accent rule */}
      <div style={{ height: 3, background: improving ? 'var(--mint)' : 'var(--orange)' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)', gap: 0 }} className="owl-focus-grid">
        {/* LEFT — verdict + proof */}
        <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="owl-label" style={{ color: improving ? 'var(--mint)' : 'var(--orange)' }}>● Today's Focus</span>
            <Badge tone={improving ? 'good' : 'bad'} variant="soft">
              {improving ? 'Improving' : 'Regressing'}
            </Badge>
            <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-4)', fontFamily: 'var(--font-body)' }}>assigned {assignedAgo}</span>
          </div>

          <h2 style={{ fontSize: 'var(--fs-2xl)', color: 'var(--text-1)', lineHeight: 1.15, textWrap: 'balance' }}>
            {verdict}
          </h2>

          {/* the one number */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
            <span className="owl-stat" style={{ fontSize: 'var(--fs-4xl)', color: improving ? 'var(--mint)' : 'var(--orange)', lineHeight: 0.9 }}>
              {metricValue}<span style={{ fontSize: '0.4em', color: 'var(--text-3)', fontWeight: 600 }}>{metricUnit}</span>
            </span>
            {targetLabel && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'var(--text-3)', paddingBottom: 8 }}>{targetLabel}</span>}
          </div>

          {costLine && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', color: 'var(--text-2)', lineHeight: 'var(--lh-normal)', maxWidth: 420 }}>
              {costLine}
            </p>
          )}

          {supporting.length > 0 && (
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', paddingTop: 2 }}>
              {supporting.map((s, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="owl-label" style={{ color: 'var(--text-4)' }}>{s.label}</span>
                  <span className="owl-num" style={{ fontSize: 'var(--fs-md)', color: 'var(--text-1)', fontWeight: 600 }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — drill + baseline */}
        <div style={{ padding: 'var(--space-6)', background: 'var(--surface-2)', borderLeft: 'var(--border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', justifyContent: 'space-between' }} className="owl-focus-side">
          <BaselineProgress baseline={baseline} current={current} target={target} unit={metricUnit} goodDirection={goodDirection} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="owl-label" style={{ color: 'var(--text-3)' }}>The drill</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-1)', fontSize: 'var(--fs-md)' }}>{drillName}</span>
              <Badge tone="neutral" size="sm">{drillDuration}</Badge>
            </div>
            <Button variant="primary" fullWidth onClick={onStartDrill}>Start drill</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

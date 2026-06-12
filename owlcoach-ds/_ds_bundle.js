/* @ds-bundle: {"format":3,"namespace":"OWLCOACHDesignSystem_013434","components":[{"name":"EmptyState","sourcePath":"components/coach/EmptyState.jsx"},{"name":"FocusCard","sourcePath":"components/coach/FocusCard.jsx"},{"name":"InsightCard","sourcePath":"components/coach/InsightCard.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"BaselineProgress","sourcePath":"components/data/BaselineProgress.jsx"},{"name":"Sparkline","sourcePath":"components/data/Sparkline.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"TrendIndicator","sourcePath":"components/data/TrendIndicator.jsx"},{"name":"Avatar","sourcePath":"components/identity/Avatar.jsx"},{"name":"EloRing","sourcePath":"components/identity/EloRing.jsx"},{"name":"LevelBadge","sourcePath":"components/identity/LevelBadge.jsx"},{"name":"MapPills","sourcePath":"components/navigation/MapPills.jsx"}],"sourceHashes":{"components/coach/EmptyState.jsx":"87119b83e901","components/coach/FocusCard.jsx":"9bfaaf595299","components/coach/InsightCard.jsx":"0b2225e2a3a2","components/core/Badge.jsx":"1fa73a9d21b2","components/core/Button.jsx":"e0a558c0acb6","components/core/Card.jsx":"47cb3c373e6b","components/data/BaselineProgress.jsx":"cd979b598b25","components/data/Sparkline.jsx":"27b6ea5b5634","components/data/StatCard.jsx":"c68703659115","components/data/TrendIndicator.jsx":"d0524098c51a","components/identity/Avatar.jsx":"7f6d26784d59","components/identity/EloRing.jsx":"0c08fab3cc44","components/identity/LevelBadge.jsx":"a28538ac8469","components/navigation/MapPills.jsx":"99ffefaad2bf","ui_kits/owl-coach/app.jsx":"a8b31614568f","ui_kits/owl-coach/askcoach.jsx":"a2b8770fee70","ui_kits/owl-coach/charts.jsx":"b4f2e0a8b7fd","ui_kits/owl-coach/data.js":"7c2a940975fa","ui_kits/owl-coach/icon.jsx":"a4dbdca2f8ef","ui_kits/owl-coach/mappage.jsx":"20fa61229a9b","ui_kits/owl-coach/overview.jsx":"3aa4c220cf44","ui_kits/owl-coach/shell.jsx":"00a3fed199b5"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.OWLCOACHDesignSystem_013434 = window.OWLCOACHDesignSystem_013434 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/coach/EmptyState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Graceful empty state for demo-derived panels with no data yet (common
 * on rarely-played maps). Reads as "nothing to show YET", never as broken:
 * dashed well, muted glyph, plain reason, optional nudge action.
 */
function EmptyState({
  icon = null,
  title = 'No demo data yet',
  message = 'Play a few matches on this map and the breakdown will appear here.',
  action = null,
  compact = false,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: 'var(--space-3)',
      padding: compact ? 'var(--space-5)' : 'var(--space-8) var(--space-6)',
      background: 'transparent',
      border: '1px dashed var(--line-strong)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--text-3)',
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-4)',
      display: 'flex'
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--fs-md)',
      color: 'var(--text-2)'
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--fs-sm)',
      color: 'var(--text-3)',
      maxWidth: 300,
      lineHeight: 'var(--lh-normal)'
    }
  }, message), action);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/coach/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Small status / category token. Soft tint by default. Tone maps to the
 * semantic palette: good=mint, bad=orange, warn=amber, info=blue, neutral=slate.
 */
function Badge({
  children,
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  icon = null,
  style = {},
  ...rest
}) {
  const tones = {
    neutral: {
      c: 'var(--text-2)',
      ghost: 'var(--surface-3)',
      line: 'var(--line-strong)',
      solidBg: 'var(--surface-3)',
      solidFg: 'var(--text-1)'
    },
    good: {
      c: 'var(--mint)',
      ghost: 'var(--mint-ghost)',
      line: 'var(--mint-line)',
      solidBg: 'var(--mint)',
      solidFg: 'var(--text-on-accent)'
    },
    bad: {
      c: 'var(--orange-bright)',
      ghost: 'var(--orange-ghost)',
      line: 'var(--orange-line)',
      solidBg: 'var(--orange)',
      solidFg: '#1a0c05'
    },
    warn: {
      c: 'var(--warn)',
      ghost: 'var(--warn-ghost)',
      line: 'rgba(255,194,75,0.34)',
      solidBg: 'var(--warn)',
      solidFg: '#1d1503'
    },
    info: {
      c: 'var(--info)',
      ghost: 'var(--info-ghost)',
      line: 'rgba(74,168,255,0.34)',
      solidBg: 'var(--info)',
      solidFg: '#04121f'
    }
  };
  const t = tones[tone] || tones.neutral;
  const pad = size === 'sm' ? '2px 7px' : '3px 9px';
  const fs = size === 'sm' ? '10px' : 'var(--fs-2xs)';
  const skin = variant === 'solid' ? {
    background: t.solidBg,
    color: t.solidFg,
    border: '1px solid transparent'
  } : variant === 'outline' ? {
    background: 'transparent',
    color: t.c,
    border: `1px solid ${t.line}`
  } : {
    background: t.ghost,
    color: t.c,
    border: `1px solid ${t.line}`
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: pad,
      borderRadius: 'var(--radius-xs)',
      fontFamily: 'var(--font-display)',
      fontSize: fs,
      fontWeight: 'var(--fw-semibold)',
      letterSpacing: 'var(--ls-wide)',
      textTransform: 'uppercase',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      ...skin,
      ...style
    }
  }, rest), icon, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * OWL.COACH primary action / control. Mint = commit/go, surface = neutral,
 * ghost = low-emphasis, danger = orange (regression/destructive).
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft = null,
  iconRight = null,
  fullWidth = false,
  disabled = false,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: {
      padding: '0 12px',
      height: 32,
      fontSize: 'var(--fs-xs)'
    },
    md: {
      padding: '0 16px',
      height: 40,
      fontSize: 'var(--fs-sm)'
    },
    lg: {
      padding: '0 22px',
      height: 48,
      fontSize: 'var(--fs-md)'
    }
  };
  const variants = {
    primary: {
      background: 'var(--mint)',
      color: 'var(--text-on-accent)',
      border: '1px solid transparent'
    },
    secondary: {
      background: 'var(--surface-2)',
      color: 'var(--text-1)',
      border: '1px solid var(--line-strong)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-2)',
      border: '1px solid transparent'
    },
    danger: {
      background: 'var(--orange-ghost)',
      color: 'var(--orange-bright)',
      border: '1px solid var(--orange-line)'
    }
  };
  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.primary;
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: fullWidth ? '100%' : 'auto',
      height: s.height,
      padding: s.padding,
      fontFamily: 'var(--font-display)',
      fontSize: s.fontSize,
      fontWeight: 'var(--fw-semibold)',
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
      borderRadius: 'var(--radius-sm)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      whiteSpace: 'nowrap',
      transition: 'filter var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
      ...v,
      ...style
    },
    onMouseDown: e => {
      if (!disabled) e.currentTarget.style.transform = 'translateY(1px)';
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = 'translateY(0)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.filter = 'none';
    },
    onMouseEnter: e => {
      if (!disabled) e.currentTarget.style.filter = 'brightness(1.12)';
    }
  }, rest), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Base surface container. The house card: 1px hairline, md radius, quiet
 * inset top-light. `accent` paints a 2px top edge (mint/orange) for the
 * rare card that needs to signal good/bad at a glance. `as` lets it be a
 * <section> etc. `interactive` adds hover lift.
 */
function Card({
  children,
  accent = 'none',
  padding = 'var(--space-5)',
  interactive = false,
  as: Tag = 'div',
  style = {},
  ...rest
}) {
  const accents = {
    none: 'transparent',
    mint: 'var(--mint)',
    orange: 'var(--orange)',
    neutral: 'var(--line-strong)'
  };
  const edge = accents[accent] || 'transparent';
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      position: 'relative',
      background: 'var(--surface-card)',
      border: 'var(--border)',
      borderRadius: 'var(--radius-md)',
      padding,
      boxShadow: 'var(--inset-top)',
      transition: 'border-color var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
      ...(accent !== 'none' ? {
        borderTop: `2px solid ${edge}`
      } : {}),
      ...style
    }
  }, interactive ? {
    onMouseEnter: e => {
      e.currentTarget.style.borderColor = 'var(--line-strong)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = '';
      e.currentTarget.style.transform = 'translateY(0)';
    }
  } : {}, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/data/BaselineProgress.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Progress-vs-baseline track. Plots three points on one axis — BASELINE
 * (value when the focus was assigned), CURRENT, and TARGET — so you can
 * see whether you're closing the gap. The fill runs baseline→current and
 * is mint when moving toward target, orange when moving away. Handles
 * metrics where lower is better (goodDirection="down").
 */
function BaselineProgress({
  baseline,
  current,
  target,
  unit = '',
  goodDirection = 'down',
  label = 'vs baseline',
  height = 8,
  style = {},
  ...rest
}) {
  const vals = [baseline, current, target];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo || 1) * 0.18;
  const dMin = lo - pad;
  const dMax = hi + pad;
  const pos = v => (v - dMin) / (dMax - dMin) * 100;
  const improvedAmt = goodDirection === 'down' ? baseline - current : current - baseline;
  const improving = improvedAmt > 0;
  const accent = improving ? 'var(--mint)' : 'var(--orange)';
  const bPos = pos(baseline);
  const cPos = pos(current);
  const tPos = pos(target);
  const fillLeft = Math.min(bPos, cPos);
  const fillW = Math.abs(cPos - bPos);
  const fmt = v => (Number.isInteger(v) ? v : v.toFixed(v < 1 ? 2 : 1)) + unit;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-label"
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-xs)',
      color: accent,
      fontWeight: 600
    }
  }, improving ? '−' : '+', fmt(Math.abs(improvedAmt)).replace(unit, ''), unit, " ", improving ? 'closer' : 'further')), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: height + 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 9,
      left: 0,
      right: 0,
      height,
      background: 'var(--surface-3)',
      borderRadius: 99
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 9,
      left: `${fillLeft}%`,
      width: `${fillW}%`,
      height,
      background: accent,
      borderRadius: 99,
      transition: 'all var(--dur-slow) var(--ease-out)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 5,
      left: `${bPos}%`,
      transform: 'translateX(-50%)',
      width: 2,
      height: height + 8,
      background: 'var(--text-4)',
      borderRadius: 2
    },
    title: `Baseline ${fmt(baseline)}`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 3,
      left: `${tPos}%`,
      transform: 'translateX(-50%)',
      width: 2,
      height: height + 12,
      background: 'var(--mint)',
      borderRadius: 2
    },
    title: `Target ${fmt(target)}`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 9 + height / 2,
      left: `${cPos}%`,
      transform: 'translate(-50%,-50%)',
      width: height + 6,
      height: height + 6,
      borderRadius: 99,
      background: accent,
      boxShadow: '0 0 0 3px var(--surface-card)'
    },
    title: `Current ${fmt(current)}`
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      color: 'var(--text-4)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "base ", fmt(baseline)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--mint)'
    }
  }, "target ", fmt(target))));
}
Object.assign(__ds_scope, { BaselineProgress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/BaselineProgress.jsx", error: String((e && e.message) || e) }); }

// components/coach/FocusCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * THE hero. Answers "what do I fix next match" in one glance: a blunt
 * verdict headline, the one number as proof, why it costs rounds, the
 * assigned drill, and baseline→current→target progress. Everything else
 * on Overview is subordinate to this. Status badge flips mint/orange on
 * whether the focus is improving since assigned.
 */
function FocusCard({
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
  return /*#__PURE__*/React.createElement(__ds_scope.Card, _extends({
    padding: "0",
    style: {
      overflow: 'hidden',
      borderColor: 'var(--line-strong)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 3,
      background: improving ? 'var(--mint)' : 'var(--orange)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)',
      gap: 0
    },
    className: "owl-focus-grid"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      color: improving ? 'var(--mint)' : 'var(--orange)'
    }
  }, "\u25CF Today's Focus"), /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: improving ? 'good' : 'bad',
    variant: "soft"
  }, improving ? 'Improving' : 'Regressing'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--text-4)',
      fontFamily: 'var(--font-body)'
    }
  }, "assigned ", assignedAgo)), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'var(--fs-2xl)',
      color: 'var(--text-1)',
      lineHeight: 1.15,
      textWrap: 'balance'
    }
  }, verdict), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-stat",
    style: {
      fontSize: 'var(--fs-4xl)',
      color: improving ? 'var(--mint)' : 'var(--orange)',
      lineHeight: 0.9
    }
  }, metricValue, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.4em',
      color: 'var(--text-3)',
      fontWeight: 600
    }
  }, metricUnit)), targetLabel && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-xs)',
      color: 'var(--text-3)',
      paddingBottom: 8
    }
  }, targetLabel)), costLine && /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--fs-sm)',
      color: 'var(--text-2)',
      lineHeight: 'var(--lh-normal)',
      maxWidth: 420
    }
  }, costLine), supporting.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18,
      flexWrap: 'wrap',
      paddingTop: 2
    }
  }, supporting.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      color: 'var(--text-4)'
    }
  }, s.label), /*#__PURE__*/React.createElement("span", {
    className: "owl-num",
    style: {
      fontSize: 'var(--fs-md)',
      color: 'var(--text-1)',
      fontWeight: 600
    }
  }, s.value))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-6)',
      background: 'var(--surface-2)',
      borderLeft: 'var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)',
      justifyContent: 'space-between'
    },
    className: "owl-focus-side"
  }, /*#__PURE__*/React.createElement(__ds_scope.BaselineProgress, {
    baseline: baseline,
    current: current,
    target: target,
    unit: metricUnit,
    goodDirection: goodDirection
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      color: 'var(--text-3)'
    }
  }, "The drill"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      color: 'var(--text-1)',
      fontSize: 'var(--fs-md)'
    }
  }, drillName), /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "neutral",
    size: "sm"
  }, drillDuration)), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    fullWidth: true,
    onClick: onStartDrill
  }, "Start drill")))));
}
Object.assign(__ds_scope, { FocusCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/coach/FocusCard.jsx", error: String((e && e.message) || e) }); }

// components/data/Sparkline.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Hand-drawn SVG sparkline. No chart libs. Renders a polyline (optional
 * area fill + last-point dot) from an array of numbers, auto-scaled.
 * Colour defaults to neutral; pass tone to tint mint/orange.
 */
function Sparkline({
  data = [],
  width = 96,
  height = 28,
  tone = 'neutral',
  fill = true,
  dot = true,
  strokeWidth = 1.75,
  style = {},
  ...rest
}) {
  const colors = {
    neutral: 'var(--text-3)',
    good: 'var(--mint)',
    bad: 'var(--orange)',
    info: 'var(--info)'
  };
  const stroke = colors[tone] || colors.neutral;
  const uid = React.useMemo(() => 'spk' + Math.random().toString(36).slice(2, 8), []);
  if (!data.length) return /*#__PURE__*/React.createElement("svg", _extends({
    width: width,
    height: height,
    style: style
  }, rest));
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = strokeWidth + 1;
  const stepX = (width - pad * 2) / (data.length - 1 || 1);
  const pts = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return [x, y];
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`;
  const last = pts[pts.length - 1];
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: width,
    height: height,
    style: {
      display: 'block',
      overflow: 'visible',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: uid,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: stroke,
    stopOpacity: "0.22"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: stroke,
    stopOpacity: "0"
  }))), fill && /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: `url(#${uid})`
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: stroke,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), dot && /*#__PURE__*/React.createElement("circle", {
    cx: last[0],
    cy: last[1],
    r: strokeWidth + 0.5,
    fill: stroke
  }));
}
Object.assign(__ds_scope, { Sparkline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Sparkline.jsx", error: String((e && e.message) || e) }); }

// components/data/TrendIndicator.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Trend delta indicator. Colour is keyed to MEANING, not arrow direction:
 * mint = improvement, orange = regression. Because some metrics improve by
 * going DOWN (untraded-death %, time-to-damage), pass `goodDirection`.
 * `delta` is the signed change (recent-10 vs previous-10).
 */
function TrendIndicator({
  delta,
  goodDirection = 'up',
  unit = '',
  size = 'md',
  showArrow = true,
  style = {},
  ...rest
}) {
  const isUp = delta > 0;
  const isFlat = delta === 0;
  const improved = isFlat ? null : goodDirection === 'up' ? isUp : !isUp;
  const color = improved === null ? 'var(--text-3)' : improved ? 'var(--mint)' : 'var(--orange-bright)';
  const arrow = isFlat ? '→' : isUp ? '▲' : '▼';
  const fs = size === 'sm' ? 'var(--fs-2xs)' : size === 'lg' ? 'var(--fs-md)' : 'var(--fs-xs)';
  const mag = Math.abs(delta);
  const num = Number.isInteger(mag) ? mag : mag.toFixed(mag < 1 ? 2 : 1);
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      color,
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: fs,
      fontWeight: 'var(--fw-medium)',
      ...style
    },
    title: improved === null ? 'No change' : improved ? 'Improving' : 'Regressing'
  }, rest), showArrow && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.85em'
    }
  }, arrow), num, unit);
}
Object.assign(__ds_scope, { TrendIndicator });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/TrendIndicator.jsx", error: String((e && e.message) || e) }); }

// components/coach/InsightCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A ranked coaching insight — either a FIX (orange tick) or a STRENGTH
 * (mint tick). Compact row: rank, title, one-line rationale, supporting
 * metric + trend. These are the bench behind Today's Focus, listed in
 * priority order. AI-generated copy goes in `detail`.
 */
function InsightCard({
  rank = null,
  kind = 'fix',
  title,
  detail,
  metric = null,
  delta = null,
  goodDirection = 'up',
  style = {},
  ...rest
}) {
  const isStrength = kind === 'strength';
  const accent = isStrength ? 'var(--mint)' : 'var(--orange)';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'flex-start',
      padding: 'var(--space-4)',
      background: 'var(--surface-card)',
      border: 'var(--border)',
      borderRadius: 'var(--radius-md)',
      borderLeft: `2px solid ${accent}`,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
      minWidth: 22,
      paddingTop: 1
    }
  }, rank != null ? /*#__PURE__*/React.createElement("span", {
    className: "owl-stat",
    style: {
      fontSize: 'var(--fs-lg)',
      color: accent
    }
  }, rank) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: accent
    }
  }, isStrength ? '✓' : '!')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      color: accent
    }
  }, isStrength ? 'Strength' : 'Fix'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--fs-md)',
      color: 'var(--text-1)'
    }
  }, title)), detail && /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--fs-sm)',
      color: 'var(--text-2)',
      lineHeight: 'var(--lh-normal)'
    }
  }, detail)), metric != null && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 3,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-num",
    style: {
      fontSize: 'var(--fs-md)',
      color: 'var(--text-1)',
      fontWeight: 600
    }
  }, metric), delta != null && /*#__PURE__*/React.createElement(__ds_scope.TrendIndicator, {
    delta: delta,
    goodDirection: goodDirection,
    size: "sm"
  })));
}
Object.assign(__ds_scope, { InsightCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/coach/InsightCard.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Compact metric tile: tracked label, big Chakra-Petch value, signed trend,
 * optional sparkline. Supporting evidence — never the page headline. Value
 * is shown verbatim (already formatted), so pass "1.18" / "72%" / "84ms".
 */
function StatCard({
  label,
  value,
  unit = '',
  delta = null,
  goodDirection = 'up',
  spark = null,
  emphasis = 'normal',
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, _extends({
    padding: "var(--space-4)",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 0,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "owl-label",
    style: {
      color: 'var(--text-3)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-stat",
    style: {
      fontSize: emphasis === 'hero' ? 'var(--fs-3xl)' : 'var(--fs-2xl)',
      color: 'var(--text-1)'
    }
  }, value), unit && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--fs-md)',
      color: 'var(--text-3)',
      fontWeight: 600
    }
  }, unit)), spark && /*#__PURE__*/React.createElement(__ds_scope.Sparkline, {
    data: spark,
    tone: delta == null ? 'neutral' : goodDirection === 'up' ? delta >= 0 ? 'good' : 'bad' : delta <= 0 ? 'good' : 'bad',
    width: 72,
    height: 24
  })), delta != null && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.TrendIndicator, {
    delta: delta,
    goodDirection: goodDirection,
    unit: unit,
    size: "sm"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--text-4)',
      fontFamily: 'var(--font-body)'
    }
  }, "vs prev 10")));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/identity/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Player avatar. Square-rounded by default (esports feel); circle optional.
 * Falls back to initials on a cool surface when no src. Optional accent ring.
 */
function Avatar({
  src = null,
  name = 'Player',
  size = 44,
  shape = 'rounded',
  ring = 'none',
  style = {},
  ...rest
}) {
  const ringColor = {
    none: 'transparent',
    mint: 'var(--mint)',
    orange: 'var(--orange)',
    neutral: 'var(--line-strong)'
  }[ring] || 'transparent';
  const radius = shape === 'circle' ? '50%' : 'var(--radius-sm)';
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: radius,
      overflow: 'hidden',
      background: 'var(--surface-3)',
      flexShrink: 0,
      border: ring === 'none' ? 'var(--border)' : `2px solid ${ringColor}`,
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: size * 0.38,
      color: 'var(--text-2)',
      ...style
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/identity/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/identity/EloRing.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Animated ELO ring. SVG arc that sweeps to `progress` (0–1 through the
 * current level band) on mount, with the ELO number counting up in the
 * centre. Ring tone is orange (ELO = heat). Honours reduced-motion.
 */
function EloRing({
  elo = 1350,
  progress = 0.5,
  size = 132,
  level = 6,
  animate = true,
  style = {},
  ...rest
}) {
  const stroke = 8;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = React.useState(animate ? 0 : progress);
  const [num, setNum] = React.useState(animate ? 0 : elo);
  React.useEffect(() => {
    if (!animate) {
      setShown(progress);
      setNum(elo);
      return;
    }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(progress);
      setNum(elo);
      return;
    }
    let raf;
    const t0 = performance.now();
    const dur = 900;
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(progress * e);
      setNum(Math.round(elo * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [elo, progress, animate]);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'relative',
      width: size,
      height: size,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    style: {
      transform: 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "var(--surface-3)",
    strokeWidth: stroke
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "var(--orange)",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: c * (1 - shown),
    style: {
      filter: 'drop-shadow(0 0 6px var(--orange-glow))'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      color: 'var(--text-3)',
      fontSize: '9px'
    }
  }, "ELO"), /*#__PURE__*/React.createElement("span", {
    className: "owl-stat",
    style: {
      fontSize: size * 0.27,
      color: 'var(--text-1)'
    }
  }, num), /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      color: 'var(--orange)',
      fontSize: '9px'
    }
  }, "LVL ", level)));
}
Object.assign(__ds_scope, { EloRing });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/identity/EloRing.jsx", error: String((e && e.message) || e) }); }

// components/identity/LevelBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * FACEIT level badge (1–10). Colour ramp keyed to skill tier — info only,
 * never decorative. Chevron glyph echoes the FACEIT mark without copying it.
 */
function LevelBadge({
  level = 1,
  size = 'md',
  showLabel = false,
  style = {},
  ...rest
}) {
  const color = level >= 10 ? 'var(--lvl-max)' : level >= 8 ? 'var(--lvl-high)' : level >= 4 ? 'var(--lvl-mid)' : 'var(--lvl-low)';
  const dim = size === 'sm' ? 22 : size === 'lg' ? 34 : 28;
  const fs = size === 'sm' ? 11 : size === 'lg' ? 16 : 13;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: dim,
      height: dim,
      position: 'relative',
      background: 'var(--surface-2)',
      border: `1.5px solid ${color}`,
      borderRadius: 'var(--radius-xs)',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: fs,
      color,
      lineHeight: 1
    }
  }, level), showLabel && /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      color: 'var(--text-3)'
    }
  }, "LVL ", level));
}
Object.assign(__ds_scope, { LevelBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/identity/LevelBadge.jsx", error: String((e && e.message) || e) }); }

// components/navigation/MapPills.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const MAP_ABBR = {
  'Mirage': 'MRG',
  'Inferno': 'INF',
  'Nuke': 'NUK',
  'Ancient': 'ANC',
  'Anubis': 'ANB',
  'Dust2': 'DU2',
  'Vertigo': 'VTG',
  'Train': 'TRN',
  'Overpass': 'OVP'
};

/**
 * Always-visible map picker. Horizontal scroll row of pills; the selected
 * map gets a mint fill. Each pill can carry a tiny win% so the picker
 * doubles as a strength glance. Controlled via `value` + `onChange`.
 * Persist the last selection in localStorage at the call site.
 */
function MapPills({
  maps = ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Dust2', 'Vertigo', 'Train'],
  value,
  winRates = {},
  onChange,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      display: 'flex',
      gap: 'var(--space-2)',
      overflowX: 'auto',
      paddingBottom: 4,
      ...style
    }
  }, rest), maps.map(m => {
    const active = m === value;
    const wr = winRates[m];
    const wrTone = wr == null ? 'var(--text-4)' : wr >= 55 ? 'var(--mint)' : wr < 45 ? 'var(--orange)' : 'var(--text-3)';
    return /*#__PURE__*/React.createElement("button", {
      key: m,
      role: "tab",
      "aria-selected": active,
      onClick: () => onChange && onChange(m),
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        padding: '8px 14px',
        flexShrink: 0,
        background: active ? 'var(--mint)' : 'var(--surface-2)',
        border: active ? '1px solid var(--mint)' : '1px solid var(--line)',
        borderRadius: 'var(--radius-pill)',
        transition: 'all var(--dur-fast) var(--ease-out)'
      },
      onMouseEnter: e => {
        if (!active) e.currentTarget.style.borderColor = 'var(--line-strong)';
      },
      onMouseLeave: e => {
        if (!active) e.currentTarget.style.borderColor = 'var(--line)';
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: 'var(--fs-sm)',
        letterSpacing: '0.02em',
        lineHeight: 1,
        color: active ? 'var(--text-on-accent)' : 'var(--text-1)'
      }
    }, m), wr != null && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        lineHeight: 1,
        color: active ? 'rgba(7,18,12,0.7)' : wrTone
      }
    }, wr, "% WR"));
  }));
}
Object.assign(__ds_scope, { MapPills });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/MapPills.jsx", error: String((e && e.message) || e) }); }

// ui_kits/owl-coach/app.jsx
try { (() => {
/* APP — view switcher + shell + ask-coach slide-over. */
const _APPNS = window.OWLCOACHDesignSystem_013434;
function ReplayView() {
  useIcons();
  const {
    Card,
    Button,
    Badge
  } = _APPNS;
  return /*#__PURE__*/React.createElement("div", {
    className: "owl-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "owl-page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--fs-2xl)',
      color: 'var(--text-1)'
    }
  }, "Replay"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      color: 'var(--text-3)',
      fontSize: 'var(--fs-sm)',
      marginTop: 2
    }
  }, "2D round playback from your parsed demos.")), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral",
    variant: "outline"
  }, "Existing tool \xB7 unchanged")), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      color: 'var(--text-3)'
    }
  }, "Mirage \xB7 Round 14 \xB7 CT"), /*#__PURE__*/React.createElement("span", {
    className: "owl-num",
    style: {
      fontSize: 'var(--fs-sm)',
      color: 'var(--text-2)'
    }
  }, "1:12 / 1:55")), /*#__PURE__*/React.createElement("div", {
    className: "owl-radar",
    style: {
      aspectRatio: '1 / 1',
      maxHeight: 420,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "owl-radar-grid"
  }), /*#__PURE__*/React.createElement("span", {
    className: "owl-heat",
    style: {
      left: '40%',
      top: '46%',
      background: 'var(--mint)',
      width: 14,
      height: 14
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "owl-heat",
    style: {
      left: '56%',
      top: '38%',
      background: 'var(--orange)',
      width: 14,
      height: 14
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "owl-radar-tag"
  }, "Round playback canvas")), /*#__PURE__*/React.createElement("div", {
    className: "owl-replay-bar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "owl-icon-btn"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "skip-back",
    size: 18
  })), /*#__PURE__*/React.createElement("button", {
    className: "owl-play"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play",
    size: 18
  })), /*#__PURE__*/React.createElement("button", {
    className: "owl-icon-btn"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "skip-forward",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "owl-scrub"
  }, /*#__PURE__*/React.createElement("div", {
    className: "owl-scrub-fill",
    style: {
      width: '62%'
    }
  })))));
}
function App() {
  const [view, setView] = React.useState(() => localStorage.getItem('owl_view') || 'overview');
  const [ask, setAsk] = React.useState(false);
  React.useEffect(() => {
    try {
      localStorage.setItem('owl_view', view);
    } catch (e) {}
  }, [view]);
  useIcons();
  return /*#__PURE__*/React.createElement("div", {
    className: "owl-app"
  }, /*#__PURE__*/React.createElement(NavRail, {
    view: view,
    onView: setView,
    onAsk: () => setAsk(true)
  }), /*#__PURE__*/React.createElement(TopBar, {
    onAsk: () => setAsk(true)
  }), /*#__PURE__*/React.createElement("main", {
    className: "owl-main"
  }, view === 'overview' && /*#__PURE__*/React.createElement(Overview, {
    onView: setView,
    onAsk: () => setAsk(true)
  }), view === 'maps' && /*#__PURE__*/React.createElement(MapPage, {
    onAsk: () => setAsk(true)
  }), view === 'replay' && /*#__PURE__*/React.createElement(ReplayView, null)), /*#__PURE__*/React.createElement(BottomNav, {
    view: view,
    onView: setView,
    onAsk: () => setAsk(true)
  }), /*#__PURE__*/React.createElement(AskCoach, {
    open: ask,
    onClose: () => setAsk(false)
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/owl-coach/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/owl-coach/askcoach.jsx
try { (() => {
/* ASK THE COACH — reachable from anywhere via a right-hand slide-over
   (full-screen sheet on mobile). Free-form Q&A with suggested prompts. */
const _ANS = window.OWLCOACHDesignSystem_013434;
const SUGGESTIONS = ['Why do I keep losing on Nuke?', 'What should I practice in aim trainer today?', 'Explain my untraded-death problem', 'Best CT setup for me on Mirage?'];
const SEED = [{
  who: 'coach',
  text: "Ask me anything about your play — a map, a match, a habit. I'll answer from your last 20 demos."
}];
function AskCoach({
  open,
  onClose
}) {
  useIcons();
  const {
    Button,
    Avatar
  } = _ANS;
  const [msgs, setMsgs] = React.useState(SEED);
  const [val, setVal] = React.useState('');
  const bodyRef = React.useRef(null);
  React.useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, open]);
  const send = text => {
    const q = (text || val).trim();
    if (!q) return;
    setVal('');
    setMsgs(m => [...m, {
      who: 'me',
      text: q
    }]);
    setTimeout(() => {
      setMsgs(m => [...m, {
        who: 'coach',
        text: coachReply(q)
      }]);
    }, 380);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: 'owl-scrim' + (open ? ' is-open' : ''),
    onClick: onClose
  }), /*#__PURE__*/React.createElement("aside", {
    className: 'owl-slideover' + (open ? ' is-open' : ''),
    "aria-hidden": !open
  }, /*#__PURE__*/React.createElement("header", {
    className: "owl-so-head"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/owl-mark.svg",
    width: "26",
    height: "26",
    alt: ""
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-md)',
      color: 'var(--text-1)'
    }
  }, "Ask the coach"), /*#__PURE__*/React.createElement("div", {
    className: "owl-label",
    style: {
      color: 'var(--mint)'
    }
  }, "\u25CF Reads your last 20 demos"))), /*#__PURE__*/React.createElement("button", {
    className: "owl-icon-btn",
    onClick: onClose,
    "aria-label": "Close"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 20
  }))), /*#__PURE__*/React.createElement("div", {
    className: "owl-so-body",
    ref: bodyRef
  }, msgs.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: 'owl-msg owl-msg--' + m.who
  }, m.who === 'coach' && /*#__PURE__*/React.createElement("img", {
    src: "../../assets/owl-mark.svg",
    width: "24",
    height: "24",
    alt: "",
    style: {
      flexShrink: 0,
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "owl-bubble"
  }, m.text)))), /*#__PURE__*/React.createElement("div", {
    className: "owl-so-suggest"
  }, SUGGESTIONS.map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "owl-chip",
    onClick: () => send(s)
  }, s))), /*#__PURE__*/React.createElement("footer", {
    className: "owl-so-foot"
  }, /*#__PURE__*/React.createElement("input", {
    className: "owl-input",
    placeholder: "Ask about a map, match, or habit\u2026",
    value: val,
    onChange: e => setVal(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') send();
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "owl-send",
    onClick: () => send(),
    "aria-label": "Send"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-up",
    size: 18
  })))));
}
function coachReply(q) {
  const s = q.toLowerCase();
  if (s.includes('nuke')) return "Your Nuke win rate is 39% — your weakest map. The pattern: you over-rotate to lower on first contact and get caught out of position. Stick to your default CT and only drop on confirmed info. Want a Nuke fundamentals plan?";
  if (s.includes('untraded')) return "82% of your deaths last month had no trade — now 71% and dropping. It means you're peeking alone before a teammate can refrag. Closing distance to a teammate before contact is the whole fix. That's your active focus.";
  if (s.includes('aim') || s.includes('practice')) return "Given your 4.2° low crosshair placement, run 10 min of Aim Botz at head height only — no flicking. Then the trade-positioning VOD review you're assigned. Skip spray routines; your first-bullet accuracy is already top-tier.";
  if (s.includes('mirage')) return "On Mirage, play a passive connector + stairs crossfire on CT. You over-aggress jungle and die untraded. Let your awp anchor mid and hold the trade angle.";
  return "Good question. From your demos the short answer is: tighten up your trade spacing and pre-aim at head height. Want me to break that down for a specific map?";
}
Object.assign(window, {
  AskCoach
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/owl-coach/askcoach.jsx", error: String((e && e.message) || e) }); }

// ui_kits/owl-coach/charts.jsx
try { (() => {
/* Hand-drawn SVG charts + small data displays for the kit. No chart libs. */
const {
  Badge: _CBadge
} = window.OWLCOACHDesignSystem_013434;

/* ELO / rating trend line ---------------------------------------- */
function EloTrendChart({
  data,
  height = 120
}) {
  const w = 100,
    pad = 6;
  const min = Math.min(...data),
    max = Math.max(...data);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [pad + i * stepX, pad + (height - pad * 2) * (1 - (v - min) / span)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`;
  const up = data[data.length - 1] >= data[0];
  const col = up ? 'var(--mint)' : 'var(--orange)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${w} ${height}`,
    preserveAspectRatio: "none",
    style: {
      width: '100%',
      height,
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "eloFill",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: col,
    stopOpacity: "0.20"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: col,
    stopOpacity: "0"
  }))), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: "url(#eloFill)"
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: col,
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: pts[pts.length - 1][0],
    cy: pts[pts.length - 1][1],
    r: "2.4",
    fill: col
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      right: 0,
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: col
    }
  }, max), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-4)'
    }
  }, min));
}

/* Recent form W/L strip ------------------------------------------ */
function FormStrip({
  form
}) {
  const wins = form.filter(f => f.result === 'W').length;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-label"
  }, "Recent form"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      color: 'var(--text-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--mint)'
    }
  }, wins, "W"), " \xB7 ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--orange)'
    }
  }, form.length - wins, "L"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, form.map((f, i) => {
    const win = f.result === 'W';
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      title: `${f.map} · ${f.elo > 0 ? '+' : ''}${f.elo} ELO · ${f.kd} K/D`,
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: 38,
        height: 44,
        borderRadius: 'var(--radius-sm)',
        background: win ? 'var(--mint-ghost)' : 'var(--orange-ghost)',
        border: `1px solid ${win ? 'var(--mint-line)' : 'var(--orange-line)'}`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 15,
        color: win ? 'var(--mint)' : 'var(--orange-bright)'
      }
    }, f.result), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--text-4)'
      }
    }, f.elo > 0 ? '+' : '', f.elo));
  })));
}

/* Map strength table best -> worst ------------------------------- */
function MapStrengthTable({
  winRates,
  onPick
}) {
  const rows = Object.entries(winRates).sort((a, b) => b[1] - a[1]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, rows.map(([map, wr]) => {
    const tone = wr >= 55 ? 'var(--mint)' : wr < 45 ? 'var(--orange)' : 'var(--text-2)';
    return /*#__PURE__*/React.createElement("button", {
      key: map,
      className: "owl-maprow",
      onClick: () => onPick && onPick(map)
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: 14,
        color: 'var(--text-1)',
        width: 78,
        textAlign: 'left'
      }
    }, map), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        height: 6,
        background: 'var(--surface-3)',
        borderRadius: 99,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        height: '100%',
        width: `${wr}%`,
        background: tone,
        borderRadius: 99
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        color: tone,
        width: 38,
        textAlign: 'right'
      }
    }, wr, "%"));
  }));
}
Object.assign(window, {
  EloTrendChart,
  FormStrip,
  MapStrengthTable
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/owl-coach/charts.jsx", error: String((e && e.message) || e) }); }

// ui_kits/owl-coach/data.js
try { (() => {
/* Fake but realistic OWL.COACH data for the UI kit. Mirrors the metrics the
   real backend parses from demos + the FACEIT API. window.OWL_DATA. */
window.OWL_DATA = {
  player: {
    name: 'soloq_owl',
    level: 6,
    elo: 1350,
    eloProgress: 0.52,
    // through the lvl-6 band
    eloTrend: [1290, 1305, 1298, 1322, 1311, 1340, 1333, 1350],
    region: 'EU'
  },
  // Today's committed focus — the hero
  focus: {
    verdict: "You're dying untraded far too often.",
    metricValue: '71',
    metricUnit: '%',
    targetLabel: 'vs 55% target',
    costLine: "A death with no trade hands the enemy a free man-advantage for the rest of the round. At your rate it's costing ~3 rounds a half.",
    baseline: 82,
    current: 71,
    target: 55,
    goodDirection: 'down',
    drillName: 'Trade-positioning VOD review',
    drillDuration: '15 min',
    status: 'improving',
    assignedAgo: '4 days ago',
    supporting: [{
      label: 'Trade participation',
      value: '48%'
    }, {
      label: 'Avg time alone',
      value: '2.1s'
    }, {
      label: 'Deaths in the open',
      value: '34%'
    }]
  },
  overallStats: [{
    label: 'K / D',
    value: '1.18',
    delta: +0.09,
    goodDirection: 'up',
    spark: [1.02, 1.05, 0.98, 1.10, 1.06, 1.12, 1.15, 1.18]
  }, {
    label: 'ADR',
    value: '78.4',
    delta: +4.2,
    goodDirection: 'up',
    spark: [70, 72, 69, 74, 73, 76, 77, 78]
  }, {
    label: 'Win %',
    value: '52',
    unit: '%',
    delta: -3,
    goodDirection: 'up',
    spark: [58, 56, 55, 54, 53, 53, 52, 52]
  }, {
    label: 'HS %',
    value: '47',
    unit: '%',
    delta: +2,
    goodDirection: 'up',
    spark: [43, 44, 42, 45, 46, 45, 46, 47]
  }],
  insights: [{
    rank: 1,
    kind: 'fix',
    title: 'Over-peeking on retakes',
    detail: 'You take the first duel on 3 of 4 retakes. Let utility land and trade off a teammate instead.',
    metric: '64%',
    delta: -5,
    goodDirection: 'up'
  }, {
    rank: 2,
    kind: 'fix',
    title: 'Unused utility at death',
    detail: 'Dying with a full kit on 41% of rounds — that grenade was a free 30 damage.',
    metric: '41%',
    delta: +3,
    goodDirection: 'down'
  }, {
    rank: 3,
    kind: 'fix',
    title: 'Crosshair placement drifts low',
    detail: 'Avg 4.2° below head height on entries. Pre-aim common angles at head level.',
    metric: '4.2°',
    delta: +0.4,
    goodDirection: 'down'
  }, {
    kind: 'strength',
    title: 'Clutch composure',
    detail: '1vX win rate is well above your level — keep trusting your reads.',
    metric: '58%',
    delta: +9,
    goodDirection: 'up'
  }, {
    kind: 'strength',
    title: 'First-bullet accuracy',
    detail: 'Top-tier first-shot accuracy. Your tapping fundamentals are solid.',
    metric: '38%',
    delta: +2,
    goodDirection: 'up'
  }],
  recentForm: [{
    result: 'W',
    map: 'Mirage',
    elo: +24,
    kd: '1.4',
    date: 'Today'
  }, {
    result: 'L',
    map: 'Nuke',
    elo: -19,
    kd: '0.8',
    date: 'Today'
  }, {
    result: 'W',
    map: 'Dust2',
    elo: +21,
    kd: '1.6',
    date: 'Yest'
  }, {
    result: 'W',
    map: 'Mirage',
    elo: +18,
    kd: '1.1',
    date: 'Yest'
  }, {
    result: 'L',
    map: 'Vertigo',
    elo: -22,
    kd: '0.7',
    date: 'Yest'
  }, {
    result: 'W',
    map: 'Ancient',
    elo: +20,
    kd: '1.3',
    date: '2d'
  }, {
    result: 'L',
    map: 'Inferno',
    elo: -17,
    kd: '0.9',
    date: '2d'
  }, {
    result: 'W',
    map: 'Dust2',
    elo: +23,
    kd: '1.5',
    date: '3d'
  }],
  maps: ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Dust2', 'Vertigo', 'Train'],
  mapWinRates: {
    Mirage: 61,
    Inferno: 48,
    Nuke: 39,
    Ancient: 55,
    Anubis: 50,
    Dust2: 57,
    Vertigo: 44,
    Train: 52
  },
  // Per-map detail. Some maps intentionally lack demo data (empty states).
  mapDetail: {
    Mirage: {
      hasDemos: true,
      stats: {
        winRate: 61,
        kd: '1.31',
        adr: 84,
        openWin: 58,
        ctWin: 64,
        tWin: 57
      },
      guide: {
        tPlan: "Default to A-control through palace + ramp. Don't over-commit ramp early — your untraded deaths spike here. Take map control mid, then hit B late off the bench info.",
        ctSetup: "Play a passive connector + stairs crossfire. You over-aggress jungle — hold the trade angle from CT instead and let your awp anchor mid.",
        utility: "Learn the one-way smoke for mid window and the ramp molly from T-spawn. You're throwing 0 util on 30% of rounds.",
        actions: ['Stop taking the first ramp duel — wait for a trade body.', 'Pre-aim head-height when you swing palace.', 'Throw your mid window smoke EVERY T round.']
      },
      heat: true
    },
    Vertigo: {
      hasDemos: false,
      stats: {
        winRate: 44,
        kd: '0.92',
        adr: 68,
        openWin: 41,
        ctWin: 47,
        tWin: 40
      },
      guide: {
        tPlan: "Stick to A-ramp executes with your team. Avoid lone B-pushes — the rotations punish you.",
        ctSetup: "Anchor B with the awp; the close angles favour your first-bullet accuracy.",
        utility: "Learn the A-ramp smoke + molly combo. That's the whole map at your level.",
        actions: ['Default to A. Don\'t solo B.', 'Hold close angles on CT.', 'One util lineup: A-ramp smoke.']
      }
    }
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/owl-coach/data.js", error: String((e && e.message) || e) }); }

// ui_kits/owl-coach/icon.jsx
try { (() => {
/* Lucide icon wrapper. Renders <i data-lucide="name">; a screen-level
   effect calls lucide.createIcons() to swap in SVGs. Size via font-size +
   a global rule (svg { width:1em; height:1em }). */
function Icon({
  name,
  size = 18,
  color = 'currentColor',
  strokeWidth = 2,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "owl-ico",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size,
      width: size,
      height: size,
      color,
      ...style
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": name,
    style: {
      ['--sw']: strokeWidth
    }
  }));
}

/* Hook: refresh lucide SVGs after render. */
function useIcons(deps) {
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });
}
Object.assign(window, {
  Icon,
  useIcons
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/owl-coach/icon.jsx", error: String((e && e.message) || e) }); }

// ui_kits/owl-coach/mappage.jsx
try { (() => {
/* MAPS — "how do I play this map better".
   Map picker persists last selection. The Map Fundamentals guide is the
   HERO; FACEIT stats are proof; demo-derived panels sit below and degrade
   to empty states on maps with thin demo data. */
const _MNS = window.OWLCOACHDesignSystem_013434;
function MapStat({
  label,
  value,
  tone
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      color: 'var(--text-4)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "owl-stat",
    style: {
      fontSize: 'var(--fs-xl)',
      color: tone || 'var(--text-1)'
    }
  }, value));
}
function GuideBlock({
  icon,
  title,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0,
      width: 30,
      height: 30,
      borderRadius: 'var(--radius-sm)',
      background: 'var(--surface-3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--mint)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--fs-md)',
      color: 'var(--text-1)',
      marginBottom: 4
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--fs-sm)',
      color: 'var(--text-2)',
      lineHeight: 'var(--lh-relaxed)'
    }
  }, children)));
}
function ActionChecklist({
  items,
  mapName
}) {
  const key = 'owl_actions_' + mapName;
  const [done, setDone] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch (e) {
      return {};
    }
  });
  const toggle = i => {
    const next = {
      ...done,
      [i]: !done[i]
    };
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch (e) {}
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => toggle(i),
    className: "owl-action",
    "data-done": !!done[i]
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-action-box"
  }, done[i] && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      textDecoration: done[i] ? 'line-through' : 'none',
      opacity: done[i] ? 0.5 : 1
    }
  }, it))));
}
function RadarPanel({
  map,
  hasHeat
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "owl-radar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "owl-radar-grid"
  }), hasHeat ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "owl-heat",
    style: {
      left: '34%',
      top: '40%',
      background: 'var(--orange)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "owl-heat",
    style: {
      left: '58%',
      top: '30%',
      background: 'var(--orange)',
      width: 30,
      height: 30
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "owl-heat",
    style: {
      left: '46%',
      top: '62%',
      background: 'var(--mint)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "owl-heat",
    style: {
      left: '24%',
      top: '55%',
      background: 'var(--mint)',
      width: 22,
      height: 22
    }
  })) : null, /*#__PURE__*/React.createElement("div", {
    className: "owl-radar-tag"
  }, map, " \xB7 radar"));
}
function DemoPanel({
  title,
  children,
  full
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "owl-demo-panel",
    style: full ? {
      gridColumn: '1 / -1'
    } : {}
  }, /*#__PURE__*/React.createElement(SectionLabel, null, title), children);
}
function MapPage({
  onAsk
}) {
  useIcons();
  const d = window.OWL_DATA;
  const {
    MapPills,
    Card,
    EmptyState,
    Badge,
    Button
  } = _MNS;
  const [map, setMap] = React.useState(() => localStorage.getItem('owl_last_map') || 'Mirage');
  React.useEffect(() => {
    try {
      localStorage.setItem('owl_last_map', map);
    } catch (e) {}
  }, [map]);
  const detail = d.mapDetail[map] || {
    hasDemos: false,
    stats: {
      winRate: d.mapWinRates[map] || 50,
      kd: '—',
      adr: '—',
      openWin: '—',
      ctWin: '—',
      tWin: '—'
    },
    guide: null
  };
  const wr = detail.stats.winRate;
  const wrTone = wr >= 55 ? 'var(--mint)' : wr < 45 ? 'var(--orange)' : 'var(--text-1)';
  return /*#__PURE__*/React.createElement("div", {
    className: "owl-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "owl-page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--fs-2xl)',
      color: 'var(--text-1)'
    }
  }, "Maps"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      color: 'var(--text-3)',
      fontSize: 'var(--fs-sm)',
      marginTop: 2
    }
  }, "Your plan for the map, then the proof from your demos.")), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "message-square-text",
      size: 15
    }),
    onClick: onAsk
  }, "Ask the coach")), /*#__PURE__*/React.createElement(MapPills, {
    value: map,
    onChange: setMap,
    winRates: d.mapWinRates
  }), /*#__PURE__*/React.createElement("div", {
    className: "owl-map-head"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'var(--fs-3xl)',
      color: 'var(--text-1)',
      letterSpacing: '-0.01em'
    }
  }, map), /*#__PURE__*/React.createElement(Badge, {
    tone: wr >= 55 ? 'good' : wr < 45 ? 'bad' : 'neutral',
    variant: "soft"
  }, wr >= 55 ? 'Strong' : wr < 45 ? 'Weak' : 'Even')), /*#__PURE__*/React.createElement("div", {
    className: "owl-map-stats"
  }, /*#__PURE__*/React.createElement(MapStat, {
    label: "FACEIT Win %",
    value: wr + '%',
    tone: wrTone
  }), /*#__PURE__*/React.createElement(MapStat, {
    label: "K / D",
    value: detail.stats.kd
  }), /*#__PURE__*/React.createElement(MapStat, {
    label: "ADR",
    value: detail.stats.adr
  }), /*#__PURE__*/React.createElement(MapStat, {
    label: "Opening duels",
    value: detail.stats.openWin === '—' ? '—' : detail.stats.openWin + '%',
    tone: detail.stats.openWin !== '—' && detail.stats.openWin < 50 ? 'var(--orange)' : null
  }))), detail.guide ? /*#__PURE__*/React.createElement(Card, {
    accent: "mint",
    padding: "var(--space-6)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "book-open",
    size: 18,
    style: {
      color: 'var(--mint)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      color: 'var(--mint)',
      fontSize: 'var(--fs-xs)'
    }
  }, "Map fundamentals")), /*#__PURE__*/React.createElement("div", {
    className: "owl-guide-grid"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(GuideBlock, {
    icon: "swords",
    title: "T-side default plan"
  }, detail.guide.tPlan), /*#__PURE__*/React.createElement(GuideBlock, {
    icon: "shield",
    title: "CT-side setups & crossfires"
  }, detail.guide.ctSetup), /*#__PURE__*/React.createElement(GuideBlock, {
    icon: "bomb",
    title: "Utility homework"
  }, detail.guide.utility)), /*#__PURE__*/React.createElement("div", {
    className: "owl-guide-actions"
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      color: 'var(--text-3)',
      marginBottom: 12,
      display: 'block'
    }
  }, "Action items \xB7 this map"), /*#__PURE__*/React.createElement(ActionChecklist, {
    items: detail.guide.actions,
    mapName: map
  })))) : /*#__PURE__*/React.createElement(EmptyState, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "book-open",
      size: 22
    }),
    title: "No fundamentals written for this map yet",
    message: `Ask the coach to generate a ${map} game plan, or play a few matches to seed it.`,
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      onClick: onAsk
    }, "Generate plan")
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionLabel, null, "From your demos"), detail.hasDemos ? /*#__PURE__*/React.createElement("div", {
    className: "owl-demo-grid"
  }, /*#__PURE__*/React.createElement(DemoPanel, {
    title: "Kill / death heatmap",
    full: true
  }, /*#__PURE__*/React.createElement(RadarPanel, {
    map: map,
    hasHeat: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      marginTop: 12,
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--fs-xs)',
      color: 'var(--text-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 99,
      background: 'var(--orange)'
    }
  }), " Where you die"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 99,
      background: 'var(--mint)'
    }
  }), " Where you get kills"))), /*#__PURE__*/React.createElement(DemoPanel, {
    title: "Aim & crosshair"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(MiniMetric, {
    label: "Crosshair placement error",
    value: "4.2\xB0",
    sub: "below head height",
    tone: "var(--orange)"
  }), /*#__PURE__*/React.createElement(MiniMetric, {
    label: "First-bullet accuracy",
    value: "38%",
    sub: "top-tier",
    tone: "var(--mint)"
  }), /*#__PURE__*/React.createElement(MiniMetric, {
    label: "Time-to-damage",
    value: "612ms",
    sub: "avg on entries"
  }))), /*#__PURE__*/React.createElement(DemoPanel, {
    title: "Economy & clutches"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(MiniMetric, {
    label: "Full-buy win rate",
    value: "58%",
    tone: "var(--mint)"
  }), /*#__PURE__*/React.createElement(MiniMetric, {
    label: "Force-buy win rate",
    value: "22%",
    tone: "var(--orange)"
  }), /*#__PURE__*/React.createElement(MiniMetric, {
    label: "Clutch record (1vX)",
    value: "6 / 11",
    sub: "55%",
    tone: "var(--mint)"
  })))) : /*#__PURE__*/React.createElement("div", {
    className: "owl-demo-grid"
  }, /*#__PURE__*/React.createElement(DemoPanel, {
    title: "Kill / death heatmap",
    full: true
  }, /*#__PURE__*/React.createElement(RadarPanel, {
    map: map,
    hasHeat: false
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute'
    }
  })), /*#__PURE__*/React.createElement(DemoPanel, {
    title: "Aim & crosshair"
  }, /*#__PURE__*/React.createElement(EmptyState, {
    compact: true,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "crosshair",
      size: 20
    }),
    title: "Not enough demos",
    message: `Only a couple of ${map} demos parsed. Aim breakdown needs ~5.`
  })), /*#__PURE__*/React.createElement(DemoPanel, {
    title: "Economy & clutches"
  }, /*#__PURE__*/React.createElement(EmptyState, {
    compact: true,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 20
    }),
    title: "Not enough demos",
    message: "Economy patterns appear once more rounds are parsed."
  })))));
}
function MiniMetric({
  label,
  value,
  sub,
  tone
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 10,
      paddingBottom: 10,
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--fs-sm)',
      color: 'var(--text-2)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-num",
    style: {
      fontSize: 'var(--fs-md)',
      color: tone || 'var(--text-1)',
      fontWeight: 600
    }
  }, value), sub && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--text-4)'
    }
  }, sub)));
}
Object.assign(window, {
  MapPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/owl-coach/mappage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/owl-coach/overview.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* OVERVIEW — the recommended "Briefing" direction.
   Hierarchy (my IA challenge): identity is DEMOTED to a slim context bar;
   the FocusCard is the sole hero; overall stats are proof directly under
   it; coaching insights are the subordinate "bench"; form/trend/maps are
   context at the bottom. */
const _NS = window.OWLCOACHDesignSystem_013434;
function SectionLabel({
  children,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--text-3)'
    }
  }, children), action);
}
function IdentityBar() {
  const d = window.OWL_DATA.player;
  const {
    Avatar,
    LevelBadge,
    EloRing
  } = _NS;
  const delta = d.eloTrend[d.eloTrend.length - 1] - d.eloTrend[0];
  return /*#__PURE__*/React.createElement("div", {
    className: "owl-identity"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "OW",
    size: 50,
    ring: "mint"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-lg)',
      color: 'var(--text-1)'
    }
  }, d.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(LevelBadge, {
    level: d.level,
    size: "sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      color: 'var(--text-3)'
    }
  }, d.region, " \xB7 Solo queue")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-label",
    style: {
      color: 'var(--text-4)'
    }
  }, "ELO \xB7 last 8"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "owl-num",
    style: {
      fontSize: 'var(--fs-md)',
      color: 'var(--text-2)'
    }
  }, d.elo), /*#__PURE__*/React.createElement("span", {
    className: "owl-num",
    style: {
      fontSize: 'var(--fs-sm)',
      color: delta >= 0 ? 'var(--mint)' : 'var(--orange)'
    }
  }, delta >= 0 ? '▲' : '▼', " ", Math.abs(delta)))), /*#__PURE__*/React.createElement(EloRing, {
    elo: d.elo,
    level: d.level,
    progress: d.eloProgress,
    size: 76
  })));
}
function Overview({
  onView,
  onAsk
}) {
  useIcons();
  const d = window.OWL_DATA;
  const {
    FocusCard,
    StatCard,
    InsightCard,
    Card,
    Button
  } = _NS;
  return /*#__PURE__*/React.createElement("div", {
    className: "owl-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "owl-page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--fs-2xl)',
      color: 'var(--text-1)'
    }
  }, "Overview"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      color: 'var(--text-3)',
      fontSize: 'var(--fs-sm)',
      marginTop: 2
    }
  }, "One thing to fix, with the proof. Updated after every match.")), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "message-square-text",
      size: 15
    }),
    onClick: onAsk
  }, "Ask the coach")), /*#__PURE__*/React.createElement(IdentityBar, null), /*#__PURE__*/React.createElement(FocusCard, _extends({}, d.focus, {
    onStartDrill: () => {}
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionLabel, null, "Overall \xB7 recent 10 matches"), /*#__PURE__*/React.createElement("div", {
    className: "owl-stats-grid"
  }, d.overallStats.map((s, i) => /*#__PURE__*/React.createElement(StatCard, {
    key: i,
    label: s.label,
    value: s.value,
    unit: s.unit || '',
    delta: s.delta,
    goodDirection: s.goodDirection,
    spark: s.spark
  })))), /*#__PURE__*/React.createElement("div", {
    className: "owl-two-col"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionLabel, null, "Coaching insights \xB7 the bench"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, d.insights.map((it, i) => /*#__PURE__*/React.createElement(InsightCard, _extends({
    key: i
  }, it))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SectionLabel, null, "ELO trend"), /*#__PURE__*/React.createElement(EloTrendChart, {
    data: d.player.eloTrend,
    height: 96
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(FormStrip, {
    form: d.recentForm
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SectionLabel, {
    action: /*#__PURE__*/React.createElement("button", {
      className: "owl-link",
      onClick: () => onView('maps')
    }, "All maps ", /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      size: 13
    }))
  }, "Map strength"), /*#__PURE__*/React.createElement(MapStrengthTable, {
    winRates: d.mapWinRates,
    onPick: () => onView('maps')
  })))));
}
Object.assign(window, {
  Overview,
  SectionLabel,
  IdentityBar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/owl-coach/overview.jsx", error: String((e && e.message) || e) }); }

// ui_kits/owl-coach/shell.jsx
try { (() => {
/* App shell: slim left rail on desktop, top bar + bottom tab nav on mobile.
   Uses the design-system bundle for Avatar/LevelBadge/Button. */
const {
  Avatar: _Avatar,
  LevelBadge: _LevelBadge,
  Button: _SBtn
} = window.OWLCOACHDesignSystem_013434;
const NAV = [{
  id: 'overview',
  label: 'Overview',
  icon: 'layout-dashboard'
}, {
  id: 'maps',
  label: 'Maps',
  icon: 'map'
}, {
  id: 'replay',
  label: 'Replay',
  icon: 'play'
}];
function NavRail({
  view,
  onView,
  onAsk
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "owl-rail"
  }, /*#__PURE__*/React.createElement("a", {
    className: "owl-rail-logo",
    href: "#",
    onClick: e => {
      e.preventDefault();
      onView('overview');
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/owl-mark.svg",
    alt: "OWL.COACH",
    width: "34",
    height: "34"
  })), /*#__PURE__*/React.createElement("div", {
    className: "owl-rail-items"
  }, NAV.map(n => /*#__PURE__*/React.createElement("button", {
    key: n.id,
    className: 'owl-rail-btn' + (view === n.id ? ' is-active' : ''),
    onClick: () => onView(n.id)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: n.icon,
    size: 20
  }), /*#__PURE__*/React.createElement("span", null, n.label)))), /*#__PURE__*/React.createElement("button", {
    className: "owl-rail-ask",
    onClick: onAsk,
    title: "Ask the coach"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "message-square-text",
    size: 20
  }), /*#__PURE__*/React.createElement("span", null, "Ask")));
}
function TopBar({
  onAsk
}) {
  const d = window.OWL_DATA;
  return /*#__PURE__*/React.createElement("header", {
    className: "owl-topbar"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/owl-mark.svg",
    alt: "",
    width: "28",
    height: "28"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 16,
      color: 'var(--text-1)',
      letterSpacing: '.03em'
    }
  }, "OWL", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--mint)'
    }
  }, "."), "COACH")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      color: 'var(--orange)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "flame",
    size: 14
  }), d.player.elo), /*#__PURE__*/React.createElement("button", {
    className: "owl-icon-btn",
    onClick: onAsk,
    "aria-label": "Ask the coach"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "message-square-text",
    size: 20
  }))));
}
function BottomNav({
  view,
  onView,
  onAsk
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "owl-bottomnav"
  }, NAV.map(n => /*#__PURE__*/React.createElement("button", {
    key: n.id,
    className: 'owl-bn-btn' + (view === n.id ? ' is-active' : ''),
    onClick: () => onView(n.id)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: n.icon,
    size: 22
  }), /*#__PURE__*/React.createElement("span", null, n.label))), /*#__PURE__*/React.createElement("button", {
    className: "owl-bn-btn owl-bn-ask",
    onClick: onAsk
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "message-square-text",
    size: 22
  }), /*#__PURE__*/React.createElement("span", null, "Ask")));
}
Object.assign(window, {
  NavRail,
  TopBar,
  BottomNav
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/owl-coach/shell.jsx", error: String((e && e.message) || e) }); }

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.FocusCard = __ds_scope.FocusCard;

__ds_ns.InsightCard = __ds_scope.InsightCard;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.BaselineProgress = __ds_scope.BaselineProgress;

__ds_ns.Sparkline = __ds_scope.Sparkline;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.TrendIndicator = __ds_scope.TrendIndicator;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.EloRing = __ds_scope.EloRing;

__ds_ns.LevelBadge = __ds_scope.LevelBadge;

__ds_ns.MapPills = __ds_scope.MapPills;

})();

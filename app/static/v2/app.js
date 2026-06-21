/* DESKCHALK v2 — vanilla SPA
   No build step. Single-page, two views (Overview / Maps), Ask slide-over.
   Replay navigates to the legacy /app route. */

// ── CONSTANTS ──────────────────────────────────────────────────────

const MAP_NAMES = {
  de_dust2:'Dust2', de_inferno:'Inferno', de_nuke:'Nuke', de_ancient:'Ancient',
  de_anubis:'Anubis', de_mirage:'Mirage', de_vertigo:'Vertigo',
  de_overpass:'Overpass', de_train:'Train', de_cache:'Cache',
};

const ELO_BANDS = {
  1:[100,500], 2:[501,750], 3:[751,900], 4:[901,1050], 5:[1051,1200],
  6:[1201,1350], 7:[1351,1530], 8:[1531,1750], 9:[1751,2000], 10:[2001,2300],
};

const METRIC_UNIT = { pct: '%', ms: 'ms', deg: '°' };

// ── STATE ──────────────────────────────────────────────────────────

const S = {
  view: 'overview',
  map: localStorage.getItem('dc_last_map') || null,
  cache: {},
};

// ── UTILITY ────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function mapName(key) { return MAP_NAMES[key] || key.replace('de_',''); }

function metricUnit(metric) {
  if (!metric) return '';
  for (const [k, v] of Object.entries(METRIC_UNIT)) {
    if (metric.endsWith('_' + k)) return v;
  }
  return '';
}

function fmtNum(n, dec = 1) {
  if (n == null) return '—';
  const v = parseFloat(n);
  if (isNaN(v)) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(dec);
}

function avg(arr, key) {
  const vals = arr.map(r => parseFloat(r[key])).filter(v => !isNaN(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function eloProgress(elo, level) {
  const band = ELO_BANDS[Math.max(1, Math.min(10, level))] || ELO_BANDS[1];
  return Math.max(0, Math.min(1, (elo - band[0]) / (band[1] - band[0])));
}

function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return '1 day ago';
  return d + ' days ago';
}

function mdBold(s) {
  return (s || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// ── HTML COMPONENTS ────────────────────────────────────────────────

function badge(text, tone = 'neutral', size = '') {
  return `<span class="o-badge o-badge--${tone}${size ? ' o-badge--' + size : ''}">${esc(text)}</span>`;
}

function btn(text, variant = 'primary', size = '', extra = '') {
  return `<button class="o-btn o-btn--${variant}${size ? ' o-btn--' + size : ''}" ${extra}>${text}</button>`;
}

function card(content, opts = {}) {
  const { accent = '', style = '', cls = '' } = opts;
  return `<div class="o-card${accent ? ' o-card--' + accent : ''}${cls ? ' ' + cls : ''}" style="${style}">${content}</div>`;
}

function sectionLabel(text, action = '') {
  return `<div class="o-section-label">${esc(text)}${action ? `<span>${action}</span>` : ''}</div>`;
}

function trendBadge(delta, goodDir = 'up', unit = '', size = 'sm') {
  if (delta == null) return '';
  const improved = goodDir === 'up' ? delta > 0 : delta < 0;
  const flat = delta === 0;
  const color = flat ? 'var(--text-3)' : improved ? 'var(--mint)' : 'var(--orange-bright)';
  const arrow = flat ? '→' : delta > 0 ? '▲' : '▼';
  const fs = size === 'sm' ? 'var(--fs-2xs)' : 'var(--fs-xs)';
  const mag = Math.abs(delta);
  const num = Number.isInteger(mag) ? mag : mag.toFixed(mag < 1 ? 2 : 1);
  return `<span class="o-trend" style="color:${color};font-size:${fs}">${arrow} ${num}${esc(unit)}</span>`;
}

function sparklineSVG(data, tone = 'neutral') {
  if (!data || data.length < 2) return '';
  const W = 72, H = 24, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const stepX = (W - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [pad + i * stepX, pad + (H - pad * 2) * (1 - (v - min) / span)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length-1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`;
  const col = tone === 'good' ? 'var(--mint)' : tone === 'bad' ? 'var(--orange)' : 'var(--text-4)';
  const gid = 'sg' + Math.random().toString(36).slice(2, 7);
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="flex-shrink:0;overflow:visible">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${col}" stop-opacity="0.3"/>
      <stop offset="1" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${pts[pts.length-1][0].toFixed(1)}" cy="${pts[pts.length-1][1].toFixed(1)}" r="2.2" fill="${col}"/>
  </svg>`;
}

function statCard(label, value, unit, delta, goodDir, spark) {
  const sparkTone = delta == null ? 'neutral' : (goodDir === 'up' ? (delta >= 0 ? 'good' : 'bad') : (delta <= 0 ? 'good' : 'bad'));
  return card(`
    <div class="o-statcard">
      <div class="dc-label" style="color:var(--text-3)">${esc(label)}</div>
      <div class="o-statcard-row">
        <div style="display:flex;align-items:baseline;gap:2px">
          <span class="dc-stat" style="font-size:var(--fs-2xl);color:var(--text-1)">${esc(value)}</span>
          ${unit ? `<span style="font-family:var(--font-display);font-size:var(--fs-md);color:var(--text-3);font-weight:600">${esc(unit)}</span>` : ''}
        </div>
        ${sparklineSVG(spark, sparkTone)}
      </div>
      ${delta != null ? `<div style="display:flex;align-items:center;gap:6px">
        ${trendBadge(delta, goodDir, unit)}
        <span style="font-size:var(--fs-2xs);color:var(--text-4);font-family:var(--font-body)">vs prev 10</span>
      </div>` : ''}
    </div>
  `);
}

function levelBadge(level, size = '') {
  return `<span class="o-lvl${size ? ' o-lvl--' + size : ''}" data-level="${level}">${level}</span>`;
}

function eloRingHTML(id, elo, level, progress, size = 76) {
  const stroke = 8, r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  return `<div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0"
    id="${id}" data-elo="${elo}" data-progress="${progress}" data-c="${c}" data-level="${level}">
    <svg width="${size}" height="${size}" style="transform:rotate(-90deg);display:block">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/>
      <circle class="elo-arc" cx="${size/2}" cy="${size/2}" r="${r}" fill="none"
        stroke="var(--orange)" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${c.toFixed(2)}"
        style="filter:drop-shadow(0 0 6px var(--orange-glow))"/>
    </svg>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">
      <span class="dc-label" style="color:var(--text-3);font-size:9px">ELO</span>
      <span class="dc-stat elo-num" style="font-size:${Math.round(size * 0.27)}px;color:var(--text-1)">0</span>
      <span class="dc-label" style="color:var(--orange);font-size:9px">LVL ${level}</span>
    </div>
  </div>`;
}

function initEloRing(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const elo = parseInt(el.dataset.elo);
  const progress = parseFloat(el.dataset.progress);
  const c = parseFloat(el.dataset.c);
  const arc = el.querySelector('.elo-arc');
  const numEl = el.querySelector('.elo-num');
  if (!arc || !numEl) return;

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (reduce) { arc.style.strokeDashoffset = c * (1 - progress); numEl.textContent = elo; return; }

  const dur = 900, t0 = performance.now();
  function tick(now) {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    arc.style.strokeDashoffset = c * (1 - progress * e);
    numEl.textContent = Math.round(elo * e);
    if (k < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function baselineProgressHTML(baseline, current, target, unit, goodDir) {
  const lo = Math.min(baseline, current, target);
  const hi = Math.max(baseline, current, target);
  const pad = (hi - lo || 1) * 0.18;
  const dMin = lo - pad, dMax = hi + pad;
  const pos = v => ((v - dMin) / (dMax - dMin) * 100).toFixed(1);

  const improvedAmt = goodDir === 'down' ? baseline - current : current - baseline;
  const improving = improvedAmt > 0;
  const accent = improving ? 'var(--mint)' : 'var(--orange)';

  const bPos = pos(baseline), cPos = pos(current), tPos = pos(target);
  const fillLeft = Math.min(parseFloat(bPos), parseFloat(cPos)).toFixed(1);
  const fillW = Math.abs(parseFloat(cPos) - parseFloat(bPos)).toFixed(1);

  const fmt = v => (Number.isInteger(v) ? v : v.toFixed(v < 1 ? 2 : 1)) + unit;

  return `<div class="o-bp">
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <span class="dc-label">vs baseline</span>
      <span style="font-family:var(--font-mono);font-size:var(--fs-xs);color:${accent};font-weight:600">
        ${improving ? '−' : '+'} ${fmt(Math.abs(improvedAmt)).replace(unit,'')}${unit} ${improving ? 'closer' : 'further'}
      </span>
    </div>
    <div class="o-bp-track-wrap">
      <div class="o-bp-track"></div>
      <div class="o-bp-fill" style="left:${fillLeft}%;width:${fillW}%;background:${accent};top:9px;height:8px"></div>
      <div class="o-bp-baseline" style="left:${bPos}%;top:5px"></div>
      <div class="o-bp-target" style="left:${tPos}%;top:3px"></div>
      <div class="o-bp-knob" style="left:${cPos}%;top:13px;background:${accent}"></div>
    </div>
    <div class="o-bp-labels">
      <span>base ${fmt(baseline)}</span>
      <span style="color:var(--mint)">target ${fmt(target)}</span>
    </div>
  </div>`;
}

function emptyStateHTML(icon, title, msg, action = '', compact = false) {
  return `<div class="o-empty${compact ? ' o-empty--compact' : ''}">
    <div class="o-empty-icon"><i data-lucide="${icon}"></i></div>
    <div class="o-empty-title">${esc(title)}</div>
    <p class="o-empty-msg">${esc(msg)}</p>
    ${action}
  </div>`;
}

// ── OVERVIEW ───────────────────────────────────────────────────────

async function loadOverview() {
  const el = document.getElementById('view-overview');
  el.innerHTML = `<div class="dc-page"><div class="o-loading">Loading…</div></div>`;

  try {
    const [overview, focusData, brief, profile] = await Promise.all([
      fetchJSON('/api/faceit_overview'),
      fetchJSON('/api/todays_focus'),
      fetchJSON('/api/coach_brief'),
      fetchJSON('/api/player_profile'),
    ]);

    S.cache.overview = overview;
    S.cache.profile = profile;

    const kpis = overview.kpis || {};
    const form = overview.recent_form || [];
    const byMap = overview.by_map || [];
    const eloTrend = overview.elo_trend || [];

    // Default map to first in by_map
    if (!S.map && byMap.length) S.map = byMap[0].map;

    // ELO ring
    const elo = kpis.latest_elo || 0;
    const level = kpis.faceit_level || 1;
    const progress = eloProgress(elo, level);

    // Trend delta from elo_trend
    const trendPts = eloTrend.filter(t => t.faceit_elo != null).map(t => t.faceit_elo);
    const eloDelta = trendPts.length >= 2 ? trendPts[trendPts.length - 1] - trendPts[0] : null;

    // Stat card deltas from recent_form[10]
    const last5 = form.slice(0, 5), prev5 = form.slice(5, 10);
    const kdDelta   = prev5.length ? +(avg(last5,'kd') - avg(prev5,'kd')).toFixed(2) : null;
    const adrDelta  = prev5.length ? +(avg(last5,'adr') - avg(prev5,'adr')).toFixed(1) : null;
    const wrDelta   = prev5.length ? Math.round((last5.filter(f=>f.won).length - prev5.filter(f=>f.won).length) * 20) : null;
    const hsDelta   = prev5.length ? +(avg(last5,'hs_pct') - avg(prev5,'hs_pct')).toFixed(1) : null;

    // Sparklines (oldest → newest)
    const kdSpark  = form.map(f => parseFloat(f.kd)).filter(v=>!isNaN(v)).reverse();
    const adrSpark = form.map(f => parseFloat(f.adr)).filter(v=>!isNaN(v)).reverse();
    const wrSpark  = form.map(f => f.won ? 100 : 0).reverse();
    const hsSpark  = form.map(f => parseFloat(f.hs_pct)).filter(v=>!isNaN(v)).reverse();

    // Focus card
    const focus = focusData.focus || {};
    const fp = focusData.progress;
    const threshold = focusData.threshold;
    const unit = metricUnit(focus.metric);
    const goodDir = focus.better === 'lower' ? 'down' : 'up';
    const current = fp ? fp.current : focus.baseline;
    const status = fp ? (fp.delta > 0 ? 'improving' : 'regressing') : 'awaiting';
    const improving = status === 'improving';
    const statusBadge = improving ? badge('Improving','good','sm') : status === 'regressing' ? badge('Regressing','bad','sm') : badge('Awaiting data','neutral','sm');
    const accentColor = improving ? 'var(--mint)' : status === 'regressing' ? 'var(--orange)' : 'var(--text-3)';

    // Focus drill text with markdown bold
    const drillHtml = focus.drill ? mdBold(esc(focus.drill)) : '';

    // ELO trend SVG chart
    const eloChartHtml = eloTrendChart(trendPts);

    // Form strip
    const formHtml = renderFormStrip(form);

    // Map strength table
    const mapTableHtml = renderMapStrengthTable(byMap);

    // Map by_map for pills
    const mapWinRates = {};
    byMap.forEach(m => { mapWinRates[m.map] = m.win_pct; });

    // Avatar
    const avatarSize = 50;
    const avatarHtml = `<div class="o-avatar" style="width:${avatarSize}px;height:${avatarSize}px;border-radius:var(--radius-sm);border:2px solid var(--mint-line)">
      <img src="${esc(profile.avatar_url || '')}" alt="" onerror="this.parentElement.innerHTML='<span style=font-size:16px>${esc((profile.name||'?')[0])}</span>'">
    </div>`;

    el.innerHTML = `<div class="dc-page">

      <!-- Page header -->
      <div class="dc-page-head">
        <div>
          <h1 style="font-size:var(--fs-2xl)">Overview</h1>
          <p style="color:var(--text-3);font-size:var(--fs-sm);margin-top:2px">One thing to fix, with the proof. Updated after every match.</p>
        </div>
        <button class="o-btn o-btn--secondary o-btn--sm ask-open" style="display:flex;align-items:center;gap:6px">
          <i data-lucide="message-square-text" style="width:15px;height:15px"></i> Ask the coach
        </button>
      </div>

      <!-- Identity bar -->
      <div class="dc-identity">
        <div style="display:flex;align-items:center;gap:14px;min-width:0">
          ${avatarHtml}
          <div style="display:flex;flex-direction:column;gap:5px;min-width:0">
            <span style="font-family:var(--font-display);font-weight:700;font-size:var(--fs-lg);color:var(--text-1)">${esc(profile.name || 'Player')}</span>
            <div style="display:flex;align-items:center;gap:8px">
              ${levelBadge(level, 'sm')}
              <span class="dc-label" style="color:var(--text-3)">${esc(profile.role || 'Solo queue')}</span>
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:22px">
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span class="dc-label" style="color:var(--text-4)">ELO · trend</span>
            <span style="display:flex;align-items:center;gap:7px">
              <span class="dc-num" style="font-size:var(--fs-md);color:var(--text-2)">${elo}</span>
              ${eloDelta != null ? trendBadge(eloDelta, 'up') : ''}
            </span>
          </div>
          ${eloRingHTML('elo-ring', elo, level, progress, 76)}
        </div>
      </div>

      <!-- Focus card — THE HERO -->
      <div class="o-card o-card--strong" style="overflow:hidden;padding:0">
        <div style="height:3px;background:${accentColor}"></div>
        <div style="display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr)" class="dc-focus-grid">

          <!-- Left: verdict + proof -->
          <div style="padding:var(--space-6);display:flex;flex-direction:column;gap:var(--space-4)">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span class="dc-label" style="color:${accentColor}">● Today's Focus</span>
              ${statusBadge}
              <span style="font-size:var(--fs-2xs);color:var(--text-4);font-family:var(--font-body)">assigned ${relTime(focus.assigned_at)}</span>
            </div>
            <h2 style="font-size:var(--fs-2xl);line-height:1.15;text-wrap:balance">${esc(focus.label || 'No focus assigned')}</h2>
            <div style="display:flex;align-items:flex-end;gap:14px">
              <span class="dc-stat" style="font-size:var(--fs-4xl);color:${accentColor};line-height:0.9">
                ${fmtNum(current, 1)}<span style="font-size:0.4em;color:var(--text-3);font-weight:600">${esc(unit)}</span>
              </span>
              ${threshold != null ? `<span style="font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--text-3);padding-bottom:8px">vs ${threshold}${unit} target</span>` : ''}
            </div>
            ${focus.advice_html ? `<div class="o-prose" style="max-width:420px">${focus.advice_html}</div>` : ''}
          </div>

          <!-- Right: progress + drill -->
          <div style="padding:var(--space-6);background:var(--surface-2);border-left:1px solid var(--line);display:flex;flex-direction:column;gap:var(--space-5);justify-content:space-between" class="dc-focus-side">
            ${focus.baseline != null && current != null && threshold != null
              ? baselineProgressHTML(focus.baseline, current, threshold, unit, goodDir)
              : ''}
            <div style="display:flex;flex-direction:column;gap:10px">
              <span class="dc-label" style="color:var(--text-3)">The drill</span>
              ${drillHtml ? `<p class="o-drill-text">${drillHtml}</p>` : ''}
              ${btn('<i data-lucide="arrow-right" style="width:14px;height:14px"></i> New focus', 'ghost', 'sm', 'id="focus-refresh"')}
            </div>
          </div>

        </div>
      </div>

      <!-- Stats proof -->
      <div>
        ${sectionLabel('Overall · recent 10 matches')}
        <div class="dc-stats-grid">
          ${statCard('K / D', fmtNum(kpis.kd,2), '', kdDelta, 'up', kdSpark)}
          ${statCard('ADR', fmtNum(kpis.adr,1), '', adrDelta, 'up', adrSpark)}
          ${statCard('Win %', fmtNum(kpis.win_pct,0), '%', wrDelta, 'up', wrSpark)}
          ${statCard('HS %', fmtNum(kpis.hs_pct,0), '%', hsDelta, 'up', hsSpark)}
        </div>
      </div>

      <!-- Tilt detector — live session alert (filled async by loadTilt) -->
      <div id="tilt-alert"></div>

      <!-- Reverse-Elo honesty score (filled async by loadHonesty) -->
      <div id="honesty-score"></div>

      <!-- Team & enemy context (filled async by loadTeamContext) -->
      <div id="team-context"></div>

      <!-- What-if simulator (filled async by loadWhatif) -->
      <div id="whatif"></div>

      <!-- Bench + context -->
      <div class="dc-two-col">

        <!-- Left: coach brief -->
        <div>
          ${sectionLabel('Coaching insights · the bench',
            btn('<i data-lucide="refresh-cw" style="width:12px;height:12px"></i>', 'ghost', 'sm', 'id="brief-refresh" title="Refresh"')
          )}
          ${card(`<div class="o-prose">${brief.answer_html || '<p>No brief available yet.</p>'}</div>`)}
        </div>

        <!-- Right: ELO trend + form + map strength -->
        <div style="display:flex;flex-direction:column;gap:var(--space-5)">
          ${card(`${sectionLabel('ELO trend')}${eloChartHtml}`)}
          ${card(formHtml)}
          ${card(`${sectionLabel('Map strength', `<button class="dc-link" id="maps-link">All maps <i data-lucide="arrow-right" style="width:13px;height:13px"></i></button>`)}${mapTableHtml}`)}
        </div>

      </div>
    </div>`;

    lucide.createIcons();
    initEloRing('elo-ring');

    // Show ELO in mobile topbar
    const topElo = document.getElementById('topbar-elo');
    const topEloVal = document.getElementById('topbar-elo-val');
    if (topElo && topEloVal) { topEloVal.textContent = elo; topElo.style.display = 'flex'; }

    // Bind overview-specific events
    document.getElementById('focus-refresh')?.addEventListener('click', refreshFocus);
    document.getElementById('brief-refresh')?.addEventListener('click', refreshBrief);
    document.getElementById('maps-link')?.addEventListener('click', () => setView('maps'));
    loadTilt();         // live-session tilt alert, failure-isolated
    loadHonesty();      // reverse-Elo honesty score, failure-isolated
    loadTeamContext();  // team + enemy panel, failure-isolated
    loadWhatif();       // what-if fix projections, failure-isolated
    el.querySelectorAll('.ask-open').forEach(b => b.addEventListener('click', openAsk));
    el.querySelectorAll('[data-map-goto]').forEach(b => {
      b.addEventListener('click', () => { S.map = b.dataset.mapGoto; setView('maps'); });
    });

  } catch (err) {
    el.innerHTML = `<div class="dc-page"><div class="o-card" style="color:var(--orange)">Failed to load overview: ${esc(err.message)}</div></div>`;
    console.error(err);
  }
}

function eloTrendChart(eloPoints) {
  if (!eloPoints || eloPoints.length < 2) return '<div style="color:var(--text-4);font-size:var(--fs-sm);padding:20px 0;text-align:center">Not enough data</div>';
  const W = 100, H = 96, pad = 6;
  const min = Math.min(...eloPoints), max = Math.max(...eloPoints), span = max - min || 1;
  const stepX = (W - pad * 2) / (eloPoints.length - 1);
  const pts = eloPoints.map((v, i) => [pad + i * stepX, pad + (H - pad * 2) * (1 - (v - min) / span)]);
  const line = pts.map((p, i) => `${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length-1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`;
  const up = eloPoints[eloPoints.length-1] >= eloPoints[0];
  const col = up ? 'var(--mint)' : 'var(--orange)';
  const gid = 'eg' + Math.random().toString(36).slice(2,7);
  return `<div style="position:relative">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:${H}px;display:block">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${col}" stop-opacity="0.2"/>
        <stop offset="1" stop-color="${col}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${line}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${pts[pts.length-1][0].toFixed(1)}" cy="${pts[pts.length-1][1].toFixed(1)}" r="2.4" fill="${col}"/>
    </svg>
    <div style="position:absolute;top:0;right:0;font-family:var(--font-mono);font-size:11px;color:${col}">${max}</div>
    <div style="position:absolute;bottom:0;right:0;font-family:var(--font-mono);font-size:11px;color:var(--text-4)">${min}</div>
  </div>`;
}

function renderFormStrip(form) {
  if (!form.length) return '<div style="color:var(--text-4);font-size:var(--fs-sm)">No recent matches</div>';
  const wins = form.filter(f => f.won).length;
  return `<div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px">
      <span class="dc-label">Recent form</span>
      <span style="font-family:var(--font-mono);font-size:13px;color:var(--text-2)">
        <span style="color:var(--mint)">${wins}W</span> · <span style="color:var(--orange)">${form.length-wins}L</span>
      </span>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${form.map(f => {
        const win = f.won;
        const eloStr = f.elo_change != null ? (f.elo_change > 0 ? '+' : '') + Math.round(f.elo_change) : '—';
        return `<div title="${mapName(f.map)} · ${eloStr} ELO · ${f.kd} K/D"
          style="display:flex;flex-direction:column;align-items:center;justify-content:center;
            width:38px;height:44px;border-radius:var(--radius-sm);
            background:${win?'var(--mint-ghost)':'var(--orange-ghost)'};
            border:1px solid ${win?'var(--mint-line)':'var(--orange-line)'}">
          <span style="font-family:var(--font-display);font-weight:700;font-size:15px;color:${win?'var(--mint)':'var(--orange-bright)'}">
            ${win ? 'W' : 'L'}
          </span>
          <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-4)">${eloStr}</span>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function renderMapStrengthTable(byMap) {
  if (!byMap.length) return '<div style="color:var(--text-4);font-size:var(--fs-sm)">No map data</div>';
  const sorted = [...byMap].sort((a, b) => b.win_pct - a.win_pct);
  return sorted.map(m => {
    const wr = Math.round(m.win_pct);
    const tone = wr >= 55 ? 'var(--mint)' : wr < 45 ? 'var(--orange)' : 'var(--text-2)';
    return `<button class="dc-maprow" data-map-goto="${m.map}">
      <span style="font-family:var(--font-display);font-weight:600;font-size:14px;color:var(--text-1);width:78px;text-align:left">${mapName(m.map)}</span>
      <span style="flex:1;height:6px;background:var(--surface-3);border-radius:99px;overflow:hidden">
        <span style="display:block;height:100%;width:${wr}%;background:${tone};border-radius:99px"></span>
      </span>
      <span style="font-family:var(--font-mono);font-size:13px;color:${tone};width:38px;text-align:right">${wr}%</span>
    </button>`;
  }).join('');
}

async function refreshFocus() {
  const btn = document.getElementById('focus-refresh');
  if (btn) { btn.disabled = true; btn.textContent = 'Refreshing…'; }
  try {
    await fetch('/api/refresh_focus', { method: 'POST' });
    await loadOverview();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'New focus'; }
  }
}

async function refreshBrief() {
  const btn = document.getElementById('brief-refresh');
  if (btn) { btn.disabled = true; }
  try {
    await fetch('/api/refresh_coach', { method: 'POST' });
    await loadOverview();
  } catch (e) {
    if (btn) { btn.disabled = false; }
  }
}

// ── MAPS ───────────────────────────────────────────────────────────

async function loadMaps(mapKey) {
  const el = document.getElementById('view-maps');

  // Resolve map list from cache or re-fetch
  let byMap = S.cache.overview?.by_map || [];
  if (!byMap.length) {
    try {
      const ov = await fetchJSON('/api/faceit_overview');
      S.cache.overview = ov;
      byMap = ov.by_map || [];
    } catch (_) {}
  }

  if (!mapKey) {
    mapKey = S.map || (byMap[0]?.map) || 'de_dust2';
  }
  S.map = mapKey;
  localStorage.setItem('dc_last_map', mapKey);

  el.innerHTML = `<div class="dc-page"><div class="o-loading">Loading…</div></div>`;

  try {
    const [detail, fundsData] = await Promise.all([
      fetchJSON(`/api/map_detail?map=${mapKey}`),
      fetchJSON(`/api/map_fundamentals?map=${mapKey}`),
    ]);

    const fkpis = detail.faceit_kpis || {};
    const dkpis = detail.kpis || {};
    const hasFaceit = (fkpis.matches || 0) > 0;
    const hasDemos = (dkpis.matches || 0) > 0;
    const wr = Math.round(fkpis.win_pct || 0);
    const wrTone = wr >= 55 ? 'var(--mint)' : wr < 45 ? 'var(--orange)' : 'var(--text-1)';
    const wrBadge = hasFaceit ? (wr >= 55 ? badge('Strong','good') : wr < 45 ? badge('Weak','bad') : badge('Even','neutral')) : '';

    // Map pills
    const mapWinRates = {};
    byMap.forEach(m => { mapWinRates[m.map] = Math.round(m.win_pct); });
    const pillsHtml = byMap.map(m => {
      const mwr = mapWinRates[m.map];
      const wrToneP = mwr >= 55 ? 'var(--mint)' : mwr < 45 ? 'var(--orange)' : 'var(--text-3)';
      const active = m.map === mapKey;
      return `<button class="o-pill${active?' is-active':''}" data-map="${m.map}">
        <span class="o-pill-name">${mapName(m.map)}</span>
        <span class="o-pill-wr" style="color:${active?'rgba(7,18,12,0.7)':wrToneP}">${mwr}% WR</span>
      </button>`;
    }).join('');

    // Sides
    const ct = (detail.sides || []).find(s => s.side === 'CT') || {};
    const t  = (detail.sides || []).find(s => s.side === 'T')  || {};

    // Economy
    const eco = detail.economy || {};

    // Clutch
    const clutch = detail.clutch || {};
    const v1rate = clutch.v1_total > 0 ? Math.round(clutch.v1_won / clutch.v1_total * 100) : null;

    // Fundamentals
    const fundsHtml = fundsData.html
      ? `<div class="o-prose" style="max-width:none">${fundsData.html}</div>`
      : emptyStateHTML('book-open', 'No fundamentals yet', `Ask the coach to generate a ${mapName(mapKey)} game plan, or play more matches.`, `<button class="o-btn o-btn--secondary o-btn--sm ask-open">Generate plan</button>`);

    // Heatmap: server-rendered density map (/heatmap), wired after DOM insertion
    const heatmapHtml = hasDemos
      ? `<div class="dc-heat-ctrls">
           <div class="dc-seg" id="heat-lens">
             <button class="dc-seg-btn is-active" data-lens="deaths">Death zones</button>
             <button class="dc-seg-btn" data-lens="duel">Duel map</button>
             <button class="dc-seg-btn" data-lens="winloss">Win vs loss</button>
           </div>
           <div class="dc-seg" id="heat-side">
             <button class="dc-seg-btn is-active" data-side="all">All</button>
             <button class="dc-seg-btn" data-side="CT">CT</button>
             <button class="dc-seg-btn" data-side="T">T</button>
           </div>
         </div>
         <div class="dc-radar" id="radar-panel">
           <img id="radar-img" alt="Kill &amp; death heatmap" decoding="async">
           <div class="dc-radar-tag" id="radar-tag">${mapName(mapKey)}</div>
         </div>
         <div class="dc-heat-legend">
           <span>Less</span>
           <span class="dc-heat-bar" id="heat-bar"></span>
           <span>More</span>
           <span id="heat-legend-label" style="margin-left:4px"></span>
         </div>
         <div class="dc-heat-insight" id="heat-insight">
           <i data-lucide="crosshair" class="dc-heat-ico"></i>
           <div>
             <div class="dc-heat-headline" id="heat-headline">Reading your demos…</div>
             <div class="dc-heat-detail" id="heat-detail"></div>
           </div>
         </div>`
      : emptyStateHTML('map', 'No demo data for this map', `Play ${hasFaceit ? 'more' : 'some'} matches on ${mapName(mapKey)} and the heatmap will appear here.`);

    // Demo-derived panels
    const demoPanels = hasDemos
      ? `<div class="dc-demo-panel dc-demo-panel--full">${sectionLabel('Kill & death map')}${heatmapHtml}</div>
         <div class="dc-demo-panel">
           ${sectionLabel('Sides')}
           <div style="display:flex;flex-direction:column;gap:0">
             ${renderMiniRow('CT win %', ct.round_win_pct != null ? fmtNum(ct.round_win_pct,0)+'%' : '—', ct.round_win_pct != null ? (ct.round_win_pct >= 55 ? 'var(--mint)' : ct.round_win_pct < 45 ? 'var(--orange)' : null) : null)}
             ${renderMiniRow('T win %', t.round_win_pct != null ? fmtNum(t.round_win_pct,0)+'%' : '—', t.round_win_pct != null ? (t.round_win_pct >= 50 ? 'var(--mint)' : 'var(--orange)') : null)}
             ${renderMiniRow('CT ADR', fmtNum(ct.adr,0))}
             ${renderMiniRow('T ADR', fmtNum(t.adr,0))}
             ${renderMiniRow('CT util/round', fmtNum(ct.util_per_round,1))}
             ${renderMiniRow('T util/round', fmtNum(t.util_per_round,1))}
           </div>
         </div>
         <div class="dc-demo-panel">
           ${sectionLabel('Economy & clutch')}
           <div style="display:flex;flex-direction:column;gap:0">
             ${renderMiniRow('Full-buy ADR', fmtNum(eco.full_buy_adr,0))}
             ${renderMiniRow('Eco win %', eco.eco_win_pct != null ? fmtNum(eco.eco_win_pct,0)+'%' : '—', eco.eco_win_pct != null && eco.eco_win_pct > 30 ? 'var(--mint)' : 'var(--orange)')}
             ${renderMiniRow('Failed save %', eco.failed_save_pct != null ? fmtNum(eco.failed_save_pct,0)+'%' : '—', eco.failed_save_pct != null && eco.failed_save_pct < 40 ? 'var(--mint)' : 'var(--orange)')}
             ${renderMiniRow('1v1 clutch', v1rate != null ? v1rate+'%' : `${clutch.v1_won||0}/${clutch.v1_total||0}`, v1rate != null ? (v1rate >= 50 ? 'var(--mint)' : 'var(--orange)') : null)}
             ${renderMiniRow('1v2 clutch', clutch.v2_total ? `${clutch.v2_won}/${clutch.v2_total}` : '—')}
             ${renderMiniRow('1v3+ clutch', clutch.v3p_total ? `${clutch.v3p_won}/${clutch.v3p_total}` : '—')}
           </div>
         </div>`
      : `<div class="dc-demo-panel dc-demo-panel--full">
           ${emptyStateHTML('map', 'No demo data for this map', `Play matches on ${mapName(mapKey)} and per-round analysis will appear here.`)}
         </div>`;

    el.innerHTML = `<div class="dc-page">

      <!-- Page header -->
      <div class="dc-page-head">
        <div>
          <h1 style="font-size:var(--fs-2xl)">Maps</h1>
          <p style="color:var(--text-3);font-size:var(--fs-sm);margin-top:2px">Your plan for the map, then the proof from your demos.</p>
        </div>
        <button class="o-btn o-btn--secondary o-btn--sm ask-open" style="display:flex;align-items:center;gap:6px">
          <i data-lucide="message-square-text" style="width:15px;height:15px"></i> Ask the coach
        </button>
      </div>

      <!-- Map pills -->
      <div class="o-pills" id="map-pills">${pillsHtml}</div>

      <!-- Map header -->
      <div class="dc-map-head">
        <div style="display:flex;align-items:center;gap:14px">
          <h2 style="font-size:var(--fs-3xl)">${mapName(mapKey)}</h2>
          ${wrBadge}
          ${!hasFaceit ? badge('No FACEIT data','neutral','sm') : ''}
        </div>
        <div class="dc-map-stats">
          ${renderMapStat('FACEIT Win %', hasFaceit ? wr+'%' : '—', wrTone)}
          ${renderMapStat('K / D', hasFaceit ? fmtNum(fkpis.kd,2) : '—')}
          ${renderMapStat('ADR', hasFaceit ? fmtNum(fkpis.adr,1) : '—')}
          ${renderMapStat('Opening duels', hasFaceit ? fmtNum(fkpis.opening_win_pct,0)+'%' : '—',
            hasFaceit && fkpis.opening_win_pct < 50 ? 'var(--orange)' : null)}
        </div>
      </div>

      <!-- Map fundamentals hero -->
      <div class="o-card o-card--mint">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
          <i data-lucide="book-open" style="color:var(--mint);width:18px;height:18px"></i>
          <span class="dc-label" style="color:var(--mint)">Map fundamentals</span>
          <button class="o-btn o-btn--ghost o-btn--sm" id="funds-refresh" style="margin-left:auto" title="Regenerate">
            <i data-lucide="refresh-cw" style="width:13px;height:13px"></i>
          </button>
        </div>
        ${fundsHtml}
      </div>

      <!-- Demo-derived panels -->
      <div>
        ${sectionLabel('From your demos')}
        <div class="dc-demo-grid">${demoPanels}</div>
      </div>

    </div>`;

    lucide.createIcons();

    // Wire map pill clicks
    document.getElementById('map-pills')?.querySelectorAll('.o-pill').forEach(p => {
      p.addEventListener('click', () => loadMaps(p.dataset.map));
    });
    document.getElementById('funds-refresh')?.addEventListener('click', () => refreshFundamentals(mapKey));
    el.querySelectorAll('.ask-open').forEach(b => b.addEventListener('click', openAsk));

    // Wire the server-rendered heatmap (kind + side toggles) if demo data exists
    if (hasDemos) initHeatmap(mapKey);

  } catch (err) {
    el.innerHTML = `<div class="dc-page"><div class="o-card" style="color:var(--orange)">Failed to load map data: ${esc(err.message)}</div></div>`;
    console.error(err);
  }
}

function renderMapStat(label, value, tone) {
  return `<div class="o-mapstat">
    <span class="dc-label" style="color:var(--text-4)">${esc(label)}</span>
    <span class="dc-stat" style="font-size:var(--fs-xl);color:${tone||'var(--text-1)'}">${esc(value)}</span>
  </div>`;
}

function renderMiniRow(label, value, tone) {
  return `<div class="o-minirow">
    <span style="font-family:var(--font-body);font-size:var(--fs-sm);color:var(--text-2)">${esc(label)}</span>
    <span class="dc-num" style="font-size:var(--fs-md);color:${tone||'var(--text-1)'};font-weight:600">${esc(String(value))}</span>
  </div>`;
}

async function refreshFundamentals(mapKey) {
  const btn = document.getElementById('funds-refresh');
  if (btn) { btn.disabled = true; }
  try {
    await fetchJSON(`/api/map_fundamentals?map=${mapKey}&refresh=1`);
    await loadMaps(mapKey);
  } catch (e) {
    if (btn) { btn.disabled = false; }
  }
}

function initHeatmap(mapKey) {
  const img = document.getElementById('radar-img');
  const tag = document.getElementById('radar-tag');
  const bar = document.getElementById('heat-bar');
  const label = document.getElementById('heat-legend-label');
  const headline = document.getElementById('heat-headline');
  const detail = document.getElementById('heat-detail');
  if (!img) return;

  let lens = 'deaths', side = 'all';
  // each lens = a coaching view: what to render + how to read the density bar
  const LENS = {
    deaths:  { name: 'Death zones', q: 'lens=deaths',  bar: 'linear-gradient(90deg, rgba(232,229,216,0.06), #D4520A)', leg: '— where you die most' },
    duel:    { name: 'Duel map',    q: 'lens=duel',    bar: 'linear-gradient(90deg, #D4520A, #34B45A)',                leg: '— orange = you lose, green = you win' },
    winloss: { name: 'Win vs loss', q: 'lens=winloss', bar: 'linear-gradient(90deg, rgba(232,229,216,0.06), #D4520A)', leg: '— deaths in rounds you lost' },
  };

  let reqId = 0;
  async function update() {
    const cfg = LENS[lens];
    // days=120 → density blobs for older data + recent dots; caption off for a clean view
    img.src = `/heatmap?map=${encodeURIComponent(mapKey)}&${cfg.q}&side=${side}&days=120&caption=0&_=${Date.now()}`;
    if (tag) tag.textContent = `${mapName(mapKey)} · ${cfg.name} · ${side === 'all' ? 'all sides' : side}`;
    if (bar) bar.style.background = cfg.bar;
    if (label) label.textContent = cfg.leg;

    // coaching verdict — the text that turns the picture into advice
    const my = ++reqId;
    if (headline) headline.textContent = 'Reading your demos…';
    if (detail) detail.textContent = '';
    try {
      const j = await fetchJSON(`/api/heat_insight?map=${encodeURIComponent(mapKey)}&side=${side}&lens=${lens}&days=120`);
      if (my !== reqId) return; // a newer toggle won
      if (headline) headline.textContent = j.headline || '';
      if (detail) {
        detail.textContent = j.detail || '';
        detail.style.color = j.tone === 'warn' ? 'var(--orange)' : j.tone === 'good' ? 'var(--mint)' : 'var(--text-2)';
      }
    } catch (e) {
      if (my !== reqId) return;
      if (headline) headline.textContent = '';
      if (detail) detail.textContent = '';
    }
  }

  function wire(groupId, attr, set) {
    document.querySelectorAll(`#${groupId} .dc-seg-btn`).forEach(b => {
      b.addEventListener('click', () => {
        set(b.dataset[attr]);
        document.querySelectorAll(`#${groupId} .dc-seg-btn`).forEach(x => x.classList.toggle('is-active', x === b));
        update();
      });
    });
  }
  wire('heat-lens', 'lens', v => lens = v);
  wire('heat-side', 'side', v => side = v);

  img.addEventListener('error', () => { if (tag) tag.textContent = 'No heatmap for this map yet'; });
  update();
}

// ── ASK SLIDE-OVER ─────────────────────────────────────────────────

const ASK_SEED = [{who:'coach', text:"Ask me anything about your play — a map, a match, a habit. I'll answer from your last 20 demos."}];
let askMsgs = [...ASK_SEED];

function openAsk() {
  document.getElementById('ask-scrim').classList.add('is-open');
  document.getElementById('ask-panel').classList.add('is-open');
  renderAskBody();
  document.getElementById('ask-input')?.focus();
}

function closeAsk() {
  document.getElementById('ask-scrim').classList.remove('is-open');
  document.getElementById('ask-panel').classList.remove('is-open');
}

function renderAskBody() {
  const body = document.getElementById('ask-body');
  if (!body) return;
  body.innerHTML = askMsgs.map(m => `
    <div class="dc-msg dc-msg--${m.who}">
      ${m.who === 'coach' ? '<img src="/static/v2/dc-mark.svg" width="24" height="24" alt="" style="flex-shrink:0;margin-top:2px">' : ''}
      <div class="dc-bubble${m.loading ? ' o-loading' : ''}">${m.loading ? '…' : (m.html ? m.html : esc(m.text))}</div>
    </div>
  `).join('');
  body.scrollTop = body.scrollHeight;
}

async function sendAsk(question) {
  question = (question || '').trim();
  if (!question) return;
  const input = document.getElementById('ask-input');
  if (input) input.value = '';
  askMsgs.push({who:'me', text: question});
  askMsgs.push({who:'coach', text: '', loading: true});
  renderAskBody();

  try {
    const body = {question};
    if (S.view === 'maps' && S.map) body.map = S.map;
    const res = await fetch('/ask', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body),
    });
    const data = await res.json();
    askMsgs.pop();
    askMsgs.push({who:'coach', html: data.answer_html || esc(data.answer || 'No answer received.')});
  } catch (e) {
    askMsgs.pop();
    askMsgs.push({who:'coach', text: 'Sorry, something went wrong. Please try again.'});
  }
  renderAskBody();
}

// ── TEAM & ENEMY CONTEXT ───────────────────────────────────────────
// Your output vs your own team, opponent strength, and trade involvement.
// Backed by round_player_stats (all 10 players), populated on demos parsed
// after the 2026-06-19 multi-player update.

async function loadWhatif() {
  const host = document.getElementById('whatif');
  if (!host) return;
  let d;
  try { d = await fetchJSON('/api/whatif'); } catch (e) { host.innerHTML = ''; return; }
  if (!d || !d.enough) { host.innerHTML = ''; return; }
  const fixes = d.fixes || [];
  const rows = fixes.map((f, i) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);padding:9px 0;${i ? 'border-top:1px solid var(--line)' : ''}">
      <div style="min-width:0">
        <div style="font-size:var(--fs-sm);color:var(--text-2);text-transform:capitalize">${esc(f.fix)}</div>
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-4)">win ${fmtNum(f.win_in_clean,0)}% without vs ${fmtNum(f.win_in_bad,0)}% with · ${fmtNum(f.bad_per_match,1)}/match</div>
      </div>
      <div style="font-family:var(--font-mono);font-size:var(--fs-md);color:var(--mint);white-space:nowrap">+${fmtNum(f.rounds_per_match,1)}<span style="font-size:0.8em;color:var(--text-4)"> rds/match</span></div>
    </div>`).join('');
  const body = fixes.length
    ? `<div style="font-size:var(--fs-sm);color:var(--text-3);margin-bottom:6px">Projected rounds/match if you halve each habit — from your own demos.</div>${rows}`
    : `<div style="font-size:var(--fs-sm);color:var(--text-3)">${esc(d.detail)}</div>`;
  host.innerHTML = `<div style="margin-top:var(--space-6)">
    ${sectionLabel('What-if simulator', `<span style="color:var(--text-4);font-size:11px;font-family:var(--font-mono)">${d.rounds} rounds</span>`)}
    ${card(body)}
  </div>`;
  lucide.createIcons();
}

async function loadTilt() {
  const host = document.getElementById('tilt-alert');
  if (!host) return;
  let d;
  try { d = await fetchJSON('/api/tilt'); } catch (e) { host.innerHTML = ''; return; }
  if (!d || !d.enough) { host.innerHTML = ''; return; }  // quiet unless there's a real session to read
  const border = d.tone === 'good' ? 'var(--mint)' : d.tone === 'warn' ? 'var(--orange)' : 'var(--text-4)';
  const icon   = d.tone === 'warn' ? 'triangle-alert' : 'activity';
  host.innerHTML = `<div style="margin-top:var(--space-5)">
    <div class="dc-heat-insight" style="border-left-color:${border}">
      <i data-lucide="${icon}" class="dc-heat-ico" style="color:${border}"></i>
      <div><div class="dc-heat-headline">${esc(d.headline)}</div>
        <div class="dc-heat-detail">${esc(d.detail)}</div></div>
    </div>
  </div>`;
  lucide.createIcons();
}

async function loadHonesty() {
  const host = document.getElementById('honesty-score');
  if (!host) return;
  let d;
  try { d = await fetchJSON('/api/honesty'); } catch (e) { host.innerHTML = ''; return; }
  if (!d || !d.enough) { host.innerHTML = ''; return; }  // stay quiet until the read is honest

  const border = d.tone === 'good' ? 'var(--mint)' : d.tone === 'warn' ? 'var(--orange)' : 'var(--text-4)';
  const estColor = d.tone === 'good' ? 'var(--mint)' : d.tone === 'warn' ? 'var(--orange)' : 'var(--text-2)';
  const lvl = v => v == null ? '—' : 'LVL ' + v;
  const ordSuffix = x => { x = Math.round(x); return (x % 100 >= 10 && x % 100 <= 20) ? 'th' : ({1:'st',2:'nd',3:'rd'}[x % 10] || 'th'); };
  const badgeTone = d.tone === 'good' ? 'good' : d.tone === 'warn' ? 'bad' : 'neutral';

  host.innerHTML = `<div style="margin-top:var(--space-6)">
    ${sectionLabel('Reverse-Elo honesty score',
      `<span style="color:var(--text-4);font-size:11px;font-family:var(--font-mono)">${d.n} games</span>`)}
    ${card(`
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-5);justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:var(--space-5)">
          <div><div class="dc-label" style="color:var(--text-3)">Plays like</div>
            <div style="font-family:var(--font-mono);font-size:28px;line-height:1.1;color:${estColor}">${lvl(d.estimated_level)}</div></div>
          <i data-lucide="move-right" style="color:var(--text-4)"></i>
          <div><div class="dc-label" style="color:var(--text-3)">Current badge</div>
            <div style="font-family:var(--font-mono);font-size:28px;line-height:1.1;color:var(--text-2)">${lvl(d.current_level)}</div></div>
        </div>
        <div style="text-align:right">
          <div class="dc-stat" style="font-size:var(--fs-2xl);line-height:1">${fmtNum(d.avg_percentile,0)}<span style="font-size:0.4em;color:var(--text-3);font-weight:600">${ordSuffix(d.avg_percentile)} pctl</span></div>
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-4);margin:4px 0 6px">#${fmtNum(d.avg_lobby_rank,1)} of ${fmtNum(d.avg_lobby_size,0)} in lobby · fair = 50th</div>
          ${badge(d.verdict, badgeTone, 'sm')}
        </div>
      </div>
      <div class="dc-heat-insight" style="border-left-color:${border};margin-top:var(--space-4)">
        <i data-lucide="gauge" class="dc-heat-ico" style="color:${border}"></i>
        <div><div class="dc-heat-headline">${esc(d.headline)}</div>
          <div class="dc-heat-detail">${esc(d.detail)}</div></div>
      </div>
    `)}
  </div>`;
  lucide.createIcons();
}

const TEAM_SRC_META = { faceit: 'FACEIT', mm: 'Matchmaking' };

async function loadTeamContext() {
  const host = document.getElementById('team-context');
  if (!host) return;
  // Pull both sources; FACEIT is usually the real volume, MM comes from parsed demos.
  const sources = {};
  await Promise.all([
    fetchJSON('/api/faceit_team').then(d => { if (d?.summary?.matches) sources.faceit = d; }).catch(() => {}),
    fetchJSON('/api/team_relative').then(d => { if (d?.summary?.matches) sources.mm = d; }).catch(() => {}),
  ]);
  const keys = Object.keys(sources);
  if (!keys.length) {
    host.innerHTML = `<div style="margin-top:var(--space-6)">
      ${sectionLabel('Team & enemy context')}
      ${card(`<div style="color:var(--text-3);font-size:var(--fs-sm)">
        No multi-player data yet — this fills in from FACEIT matches the poller ingests, or
        demos parsed after the team-data update: your output vs teammates, opponent strength,
        and how often you trade.
        <span style="color:var(--text-4)">Older parsed matches need a re-parse to appear here.</span>
      </div>`)}
    </div>`;
    return;
  }
  // default to the source with the most matches
  const def = keys.reduce((a, b) => (sources[b].summary.matches > sources[a].summary.matches ? b : a));
  renderTeamPanel(host, sources, def);
  // delegated source toggle (host element persists across innerHTML swaps)
  if (!host.dataset.srcBound) {
    host.dataset.srcBound = '1';
    host.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-team-src]');
      if (btn && sources[btn.dataset.teamSrc]) renderTeamPanel(host, sources, btn.dataset.teamSrc);
    });
  }
}

function renderTeamPanel(host, sources, cur) {
  const data = sources[cur];
  const s = data.summary || {};
  const matches = data.matches || [];
  const order = ['faceit', 'mm'].filter(k => sources[k]);

  // mine-vs-team compare card
  const cmp = (label, mine, team, unit, higherBetter) => {
    const m = mine == null ? null : +mine, t = team == null ? null : +team;
    let tone = 'neutral', txt = 'no team data';
    if (m != null && t != null) {
      const better = higherBetter ? m >= t : m <= t;
      tone = better ? 'good' : 'bad';
      txt = `${better ? '▲' : '▼'} ${Math.abs(m - t).toFixed(1)} vs team`;
    }
    return `<div class="o-card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:6px">
      <span class="dc-label" style="color:var(--text-3)">${esc(label)}</span>
      <span class="dc-stat" style="font-size:var(--fs-2xl);line-height:1">${m==null?'—':fmtNum(m,1)}<span style="font-size:0.4em;color:var(--text-3);font-weight:600">${esc(unit)}</span></span>
      <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-4)">team avg ${t==null?'—':fmtNum(t,1)}${esc(unit)}</span>
      ${badge(txt, tone, 'sm')}
    </div>`;
  };

  const teamSize = matches[0]?.team_size || 5;
  const rankCard = `<div class="o-card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:6px">
    <span class="dc-label" style="color:var(--text-3)">Avg team rank (by kills)</span>
    <span class="dc-stat" style="font-size:var(--fs-2xl);line-height:1">${s.avg_team_rank==null?'—':'#'+fmtNum(s.avg_team_rank,1)}<span style="font-size:0.4em;color:var(--text-3);font-weight:600"> / ${teamSize}</span></span>
    <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-4)">${s.pct_at_or_above_team==null?'—':fmtNum(s.pct_at_or_above_team,0)+'% of games at/above team ADR'}</span>
    ${badge(s.avg_team_rank!=null && s.avg_team_rank<=2 ? 'carrying' : s.avg_team_rank!=null && s.avg_team_rank>=4 ? 'carried' : 'mid', s.avg_team_rank!=null && s.avg_team_rank<=2 ? 'good' : s.avg_team_rank!=null && s.avg_team_rank>=4 ? 'bad' : 'neutral', 'sm')}
  </div>`;

  const enemyCard = `<div class="o-card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:6px">
    <span class="dc-label" style="color:var(--text-3)">Opponent strength</span>
    <span class="dc-stat" style="font-size:var(--fs-2xl);line-height:1">${matches[0]?.enemy_avg_kd==null?'—':fmtNum(matches[0].enemy_avg_kd,2)}<span style="font-size:0.4em;color:var(--text-3);font-weight:600"> K/D</span></span>
    <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-4)">last game · top enemy ${matches[0]?.enemy_top_kd==null?'—':fmtNum(matches[0].enemy_top_kd,2)} K/D</span>
    <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-4)">context for your stats</span>
  </div>`;

  // entries (opening duels) — win% is the headline, role context below
  const ewp = s.entry_win_pct == null ? null : +s.entry_win_pct;
  const entryTone = ewp == null ? 'neutral' : ewp >= 55 ? 'good' : ewp < 45 ? 'bad' : 'neutral';
  const entryTxt  = ewp == null ? 'no data' : ewp >= 55 ? 'winning entries' : ewp < 45 ? 'losing entries' : 'even';
  const entryCard = `<div class="o-card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:6px">
    <span class="dc-label" style="color:var(--text-3)">Opening duels</span>
    <span class="dc-stat" style="font-size:var(--fs-2xl);line-height:1">${ewp==null?'—':fmtNum(ewp,0)}<span style="font-size:0.4em;color:var(--text-3);font-weight:600">% won</span></span>
    <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-4)">${s.avg_my_entries==null?'—':fmtNum(s.avg_my_entries,1)}/game · team ${s.avg_team_entries==null?'—':fmtNum(s.avg_team_entries,1)}</span>
    ${badge(entryTxt, entryTone, 'sm')}
  </div>`;

  const cardList = [cmp('Your ADR', s.avg_my_adr, s.avg_team_adr, '', true)];
  if (s.avg_my_kast != null)   cardList.push(cmp('Your KAST', s.avg_my_kast, s.avg_team_kast, '%', true));
  if (s.avg_my_trades != null) cardList.push(cmp('Trades you make', s.avg_my_trades, s.avg_team_trades, '', true));
  cardList.push(entryCard, rankCard, enemyCard);
  const cards = cardList.join('');

  // synthesized coaching verdict — role + the one weakness worth fixing
  const dg = data.diagnosis || {};
  const dgBorder = dg.tone === 'good' ? 'var(--mint)' : dg.tone === 'warn' ? 'var(--orange)' : 'var(--text-4)';
  const dgIcon   = dg.tone === 'good' ? 'shield-check' : dg.tone === 'warn' ? 'target' : 'compass';
  const verdict = dg.headline ? `<div class="dc-heat-insight" style="border-left-color:${dgBorder};margin-top:var(--space-4)">
      <i data-lucide="${dgIcon}" class="dc-heat-ico" style="color:${dgBorder}"></i>
      <div><div class="dc-heat-headline">${esc(dg.headline)}</div>
        <div class="dc-heat-detail">${esc(dg.detail || '')}</div></div>
    </div>` : '';

  const tradedFor = s.avg_my_traded_for;
  const tradedNote = tradedFor == null ? '' :
    `<div style="margin-top:10px;font-size:var(--fs-sm);color:var(--text-3)">
       Your deaths get traded <b style="color:var(--text-2)">${fmtNum(tradedFor,0)}%</b> of the time —
       ${tradedFor >= 55 ? 'good trade positioning, you play near teammates.'
                         : 'you often die out of trade range; play closer to support.'}
     </div>`;

  // recent matches mini-table
  const rows = matches.slice(0, 8).map(mt => `<tr>
      <td style="padding:5px 8px">${esc(mt.map || '')}</td>
      <td style="padding:5px 8px;text-align:center">${mt.my_team_rank==null?'—':'#'+mt.my_team_rank}</td>
      <td style="padding:5px 8px;text-align:right;color:${(mt.my_adr!=null&&mt.team_avg_adr!=null&&+mt.my_adr>=+mt.team_avg_adr)?'var(--mint)':'var(--orange)'}">${mt.my_adr==null?'—':fmtNum(mt.my_adr,0)}</td>
      <td style="padding:5px 8px;text-align:right;color:var(--text-3)">${mt.team_avg_adr==null?'—':fmtNum(mt.team_avg_adr,0)}</td>
      <td style="padding:5px 8px;text-align:right">${mt.enemy_avg_kd==null?'—':fmtNum(mt.enemy_avg_kd,2)}</td>
    </tr>`).join('');
  const table = `<table style="width:100%;border-collapse:collapse;font-size:var(--fs-sm)">
      <thead><tr style="color:var(--text-4);font-family:var(--font-mono);font-size:11px;text-align:left">
        <th style="padding:5px 8px;font-weight:500">Map</th>
        <th style="padding:5px 8px;font-weight:500;text-align:center">Rank</th>
        <th style="padding:5px 8px;font-weight:500;text-align:right">You ADR</th>
        <th style="padding:5px 8px;font-weight:500;text-align:right">Team ADR</th>
        <th style="padding:5px 8px;font-weight:500;text-align:right">Enemy K/D</th>
      </tr></thead><tbody>${rows}</tbody></table>`;

  const srcToggle = order.length > 1
    ? `<span style="display:inline-flex;gap:2px;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--radius-sm);padding:2px;vertical-align:middle">
        ${order.map(k => `<button data-team-src="${k}" style="border:0;cursor:pointer;font-family:var(--font-mono);font-size:11px;padding:3px 9px;border-radius:4px;background:${k===cur?'var(--orange)':'transparent'};color:${k===cur?'#fff':'var(--text-3)'}">${TEAM_SRC_META[k]} ${sources[k].summary.matches}</button>`).join('')}
      </span>`
    : `<span style="color:var(--text-4);font-size:11px;font-family:var(--font-mono)">${TEAM_SRC_META[cur]} · ${s.matches} matches</span>`;
  host.innerHTML = `<div style="margin-top:var(--space-6)">
    ${sectionLabel('Team & enemy context', srcToggle)}
    ${verdict}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--space-3);margin-top:var(--space-3)">${cards}</div>
    ${tradedNote}
    <div style="margin-top:var(--space-4)">${card(table)}</div>
  </div>`;
  lucide.createIcons();
}

// ── NAV ────────────────────────────────────────────────────────────

function setView(view) {
  S.view = view;
  document.querySelectorAll('[data-view]').forEach(el => {
    el.classList.toggle('is-active', el.dataset.view === view);
  });

  const ov = document.getElementById('view-overview');
  const mp = document.getElementById('view-maps');
  ov.style.display = view === 'overview' ? '' : 'none';
  mp.style.display = view === 'maps' ? '' : 'none';

  if (view === 'overview' && !ov.firstChild) loadOverview();
  if (view === 'maps') loadMaps(S.map);
}

// ── API ────────────────────────────────────────────────────────────

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// ── INIT ───────────────────────────────────────────────────────────

function init() {
  // Nav buttons
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', () => setView(el.dataset.view));
  });
  document.getElementById('logo-link')?.addEventListener('click', e => { e.preventDefault(); setView('overview'); });

  // Ask slide-over
  ['ask-open-rail','ask-open-top','ask-open-bot'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', openAsk);
  });
  document.getElementById('ask-close')?.addEventListener('click', closeAsk);
  document.getElementById('ask-scrim')?.addEventListener('click', closeAsk);
  document.getElementById('ask-send')?.addEventListener('click', () => sendAsk(document.getElementById('ask-input')?.value));
  document.getElementById('ask-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendAsk(e.target.value); });
  document.getElementById('ask-suggest')?.querySelectorAll('.dc-chip').forEach(c => {
    c.addEventListener('click', () => sendAsk(c.dataset.q));
  });

  // Init Lucide icons already in the static shell
  lucide.createIcons();

  // First-run gate: if the install isn't configured yet, guide the user instead
  // of loading empty dashboards. Falls through to the normal overview once ready.
  checkSetup();
}

async function checkSetup() {
  try {
    const s = await fetchJSON('/api/setup_state');
    if (s.ready) { loadOverview(); return; }
    renderSetupScreen(s);
  } catch (e) {
    loadOverview(); // never let the setup check itself block the app
  }
}

function setupRow(ok, title, body) {
  return `<div class="dc-setup-row">
    <i data-lucide="${ok ? 'check-circle-2' : 'circle'}" class="dc-setup-ic${ok ? ' is-ok' : ''}"></i>
    <div><div class="dc-setup-title">${title}</div><div class="dc-setup-body">${body}</div></div>
  </div>`;
}

function renderSetupScreen(s) {
  const el = document.getElementById('view-overview');
  const ai = s.ai.configured;
  const src = s.faceit.configured || s.steam.configured || s.has_data;
  el.innerHTML = `<div class="dc-page" style="max-width:760px">
    <div class="dc-page-head"><div>
      <h1 style="font-size:var(--fs-2xl)">Welcome to DeskChalk</h1>
      <p style="color:var(--text-3);font-size:var(--fs-sm);margin-top:2px">Set these in your <code>.env</code>, then <code>docker compose up -d</code>. This screen clears once you're connected.</p>
    </div></div>
    <div class="o-card">
      ${setupRow(ai, '1 · Connect an AI coach', ai
        ? `Using <b>${esc(s.ai.provider)}</b>.`
        : `Set <code>LLM_PROVIDER=anthropic</code> + <code>ANTHROPIC_API_KEY</code> (key at console.anthropic.com), or <code>LLM_PROVIDER=ollama</code> for a free local model.`)}
      ${setupRow(src, '2 · Connect a data source', src
        ? 'Connected.'
        : `Easiest: <code>FACEIT_API_KEY</code> + <code>FACEIT_NICKNAME</code> (developers.faceit.com). For full demo analysis, start with <code>--profile demos</code> and add your Steam keys.`)}
    </div>
    <div style="display:flex;gap:12px;align-items:center;margin-top:16px">
      <button class="o-btn o-btn--primary" id="setup-recheck">Re-check</button>
      <span style="color:var(--text-3);font-size:var(--fs-sm)">Env changes need a container restart to take effect.</span>
    </div>
  </div>`;
  lucide.createIcons();
  document.getElementById('setup-recheck')?.addEventListener('click', checkSetup);
}

document.addEventListener('DOMContentLoaded', init);

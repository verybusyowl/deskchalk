const $ = id => document.getElementById(id);
const sel = id => $(id).value;

/* ════════════════════════════════════
   THEME SYSTEM
   ════════════════════════════════════ */
const THEMES = [
  { id: 'dark',    label: 'Dark',    desc: 'Default dark',       swatch: '#e07828' },
  { id: 'light',   label: 'Light',   desc: 'Clean light',        swatch: '#b85814' },
  { id: 'faceit',  label: 'FACEIT',  desc: 'FACEIT-inspired',    swatch: '#ff5500' },
  { id: 'leetify', label: 'Leetify', desc: 'Navy + cyan',        swatch: '#00b4e0' },
  { id: 'hltv',    label: 'HLTV',    desc: 'Charcoal + gold',    swatch: '#cc9810' },
];

const _THEME_PICKER_IDS = ['themePicker', 'settingsThemePicker'];
const _THEME_WRAP_IDS   = ['themePickerWrap', 'settingsThemePickerWrap'];
const _THEME_DOT_IDS    = ['themeBtnDot', 'settingsThemeBtnDot'];

function applyTheme(id) {
  const theme = THEMES.find(t => t.id === id) || THEMES[0];
  document.documentElement.dataset.theme = theme.id === 'dark' ? '' : theme.id;
  localStorage.setItem('cs2owl-theme', theme.id);
  _THEME_DOT_IDS.forEach(did => { const d = document.getElementById(did); if (d) d.style.background = theme.swatch; });
  _renderThemePicker();
}

function toggleThemePicker() {
  const p = document.getElementById('themePicker');
  if (!p) return;
  p.classList.toggle('open');
  if (p.classList.contains('open')) _renderThemePicker();
}

function toggleSettingsThemePicker() {
  const p = document.getElementById('settingsThemePicker');
  if (!p) return;
  p.classList.toggle('open');
  if (p.classList.contains('open')) _renderThemePicker();
}

function _renderThemePicker() {
  const cur = localStorage.getItem('cs2owl-theme') || 'dark';
  const html = THEMES.map(t => `
    <div class="theme-swatch${t.id === cur ? ' active' : ''}" onclick="_pickTheme('${t.id}')">
      <span class="theme-swatch-dot" style="background:${t.swatch}"></span>
      <span class="theme-swatch-info">
        <span class="theme-swatch-name">${t.label}</span>
        <span class="theme-swatch-desc">${t.desc}</span>
      </span>
    </div>`).join('');
  _THEME_PICKER_IDS.forEach(pid => { const p = document.getElementById(pid); if (p) p.innerHTML = html; });
}

function _pickTheme(id) {
  applyTheme(id);
  _THEME_PICKER_IDS.forEach(pid => { const p = document.getElementById(pid); if (p) p.classList.remove('open'); });
}

document.addEventListener('click', e => {
  _THEME_WRAP_IDS.forEach(wid => {
    const wrap = document.getElementById(wid);
    if (wrap && !wrap.contains(e.target)) {
      const pid = wid.replace('Wrap', '');
      const p = document.getElementById(pid);
      if (p) p.classList.remove('open');
    }
  });
});

// Init theme on load
(function() {
  const saved = localStorage.getItem('cs2owl-theme') || 'dark';
  applyTheme(saved);
})();

let currentTab   = 'overview';
let showPro      = false;
let showAim      = false;
let grenadeType  = '';
let lineupData   = [];
let lineupFilter = '';
let tabsPopulated= false;
let coachLoaded  = {overview: false};

/* ── navigation ── */
function switchTab(tab) {
  // Sidebar "Maps" sends the literal 'map' — resolve it to a real map
  // (last viewed, else first in the list) instead of querying map=map.
  if (tab === 'map' || tab === 'maps') {
    tab = (window._lastMap && (window._mapsList||[]).includes(window._lastMap))
      ? window._lastMap : ((window._mapsList||[])[0] || 'overview');
  }
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('v-overview').classList.toggle('active', tab === 'overview');
  $('v-map').classList.toggle('active',      tab !== 'overview' && tab !== 'replay');
  $('v-replay').classList.toggle('active',   tab === 'replay');
  if (tab !== 'overview' && tab !== 'replay') {
    window._lastMap = tab;
    document.querySelectorAll('.map-pick-pill').forEach(p =>
      p.classList.toggle('active', p.dataset.map === tab));
    $('map-title').textContent = tab.replace('de_','').toUpperCase();
    $('map-coach-link').href = `/coach?map=${tab}`;
    switchMapSubTab('overview');
  }
  if (tab === 'replay') {
    rpTabOpen();
    return;
  }
  load();
}

/* ── pro overlay ── */
function togglePro() {
  showPro = !showPro;
  $('pro-btn').textContent = showPro ? 'Pro: On' : 'Pro: Off';
  $('pro-btn').classList.toggle('on', showPro);
  $('pro-legend').style.display   = showPro ? '' : 'none';
  $('pro-legend-d').style.display = showPro ? '' : 'none';
  if (currentTab !== 'overview') refreshMapImages();
}

/* ── aim toggle ── */
function toggleAim() {
  showAim = !showAim;
  $('aim-btn').textContent = showAim ? 'Aim' : 'Kills';
  $('aim-btn').classList.toggle('on', showAim);
  const lbl = $('t-kills');
  lbl.textContent = showAim ? 'Crosshair Placement (green=HS, orange=body)' : `Kill Locations — ${currentTab.replace('de_','').toUpperCase()}`;
  $('kill-legend-label').textContent = showAim ? 'Headshot kill' : 'Your kills';
  $('hs-legend').style.display = showAim ? '' : 'none';
  $('aim-weapon-wrap').classList.toggle('visible', showAim);
  if (!showAim) $('aim-weapon-sel').value = '';
  if (currentTab !== 'overview') refreshMapImages();
}

/* ── grenade filter ── */
function setGrenadeFilter(btn, gt) {
  grenadeType = gt;
  document.querySelectorAll('#g-heatmap-panel .g-pill').forEach(p => {
    p.className = 'g-pill';
    if (p.dataset.gt === gt) p.classList.add(gt ? `on-${gt}` : 'on-all');
  });
  if (currentTab !== 'overview') refreshMapImages();
}

/* ── lineup filter ── */
function filterLineups(gt) {
  lineupFilter = gt;
  document.querySelectorAll('#ref-pills .g-pill').forEach(p => {
    p.className = 'g-pill';
    if (p.dataset.gt === gt) p.classList.add(gt ? `on-${gt}` : 'on-all');
  });
  renderLineups(lineupData, lineupFilter);
}

/* ── coach ── */
function toggleCoach(which) {
  const panel = which === 'overview' ? $('coach-overview') : $('coach-map');
  panel.classList.toggle('collapsed');
}

async function loadCoachBrief(scope, bodyId, tsId, qId) {
  const el = $(bodyId);
  try {
    const d = await fetch(`/api/coach_brief?scope=${scope}`).then(r=>r.json());
    if (!d.cached || !d.answer_html) {
      el.innerHTML = '<div class="spin">No brief yet — click ↻ Refresh to generate one.</div>';
      $(tsId).textContent = '';
    } else {
      el.innerHTML = d.answer_html;
      const ts = d.generated_at ? new Date(d.generated_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
      $(tsId).textContent = ts ? `Generated ${ts}` : '';
      if (qId && d.question) $(qId).textContent = d.question;
      if (scope === 'overview') { _overviewCoachAnswer = d.answer_html; renderCoachSlide(); renderOvCoachingInsights(); }
    }
  } catch(e) {
    el.innerHTML = '<div class="spin">Failed to load coach brief.</div>';
  }
}

async function refreshCoach(which) {
  const scope = which === 'overview' ? 'overview' : currentTab;
  const bodyId = which === 'overview' ? 'coach-body-overview' : 'coach-body-map';
  const tsId   = which === 'overview' ? 'coach-ts-overview'   : 'coach-ts-map';
  const qId    = which === 'overview' ? 'coach-q-overview'    : 'coach-q-map';
  $(bodyId).innerHTML = '<div class="spin">Generating… (may take ~30s)</div>';
  if (which === 'overview') { const ob = $('ov-coaching-body'); if (ob) ob.innerHTML = '<div class="spin" style="padding:12px;text-align:center">Generating brief…</div>'; }
  await fetch(`/api/refresh_coach?scope=${scope}`, {method:'POST'});
  // Poll for result
  let tries = 0;
  const poll = setInterval(async () => {
    tries++;
    const d = await fetch(`/api/coach_brief?scope=${scope}`).then(r=>r.json());
    if (d.cached && d.answer_html) {
      clearInterval(poll);
      const panel = which === 'overview' ? $('coach-overview') : $('coach-map');
      panel.classList.remove('collapsed');
      loadCoachBrief(scope, bodyId, tsId, qId);
    }
    if (tries > 40) clearInterval(poll); // stop after 120s
  }, 3000);
}

/* ── scoring helpers ── */
function sc(v, g, y) { return v == null ? '' : v >= g ? 'g' : v >= y ? 'y' : 'r'; }
function trendArrow(cur, prev, higherIsBetter=true) {
  if (cur == null || prev == null) return '';
  const delta = parseFloat(cur) - parseFloat(prev);
  if (Math.abs(delta) < 0.5) return '';
  const up = delta > 0;
  const good = higherIsBetter ? up : !up;
  const cls = good ? 'up' : 'dn';
  const sym = up ? '↑' : '↓';
  return `<span class="trend ${cls}">${sym}${Math.abs(delta).toFixed(1)}</span>`;
}

/* ── overview KPIs ── */
const KPI_CFG = [
  {key:'score',           label:'Match Score',  unit:'',  g:75,  y:60,  h:true},
  {key:'win_pct',         label:'Win %',        unit:'%', g:55,  y:45,  h:true},
  {key:'kd',              label:'K / D',        unit:'',  g:1.1, y:0.9, h:true},
  {key:'adr',             label:'ADR',          unit:'',  g:85,  y:70,  h:true},
  {key:'hs_pct',          label:'HS %',         unit:'%', g:50,  y:30,  h:true},
  {key:'accuracy_pct',    label:'Accuracy',     unit:'%', g:28,  y:18,  h:true},
  {key:'opening_win_pct', label:'Opening Duel', unit:'%', g:55,  y:45,  h:true},
  {key:'round_win_pct',   label:'Round Win',    unit:'%', g:55,  y:45,  h:true},
  {key:'clutch_pct',      label:'Clutch',       unit:'%', g:50,  y:33,  h:true},
];
function renderKPIs(kpis, curr, prev) {
  $('kpis').innerHTML = KPI_CFG.map(c => {
    const v = kpis[c.key];
    const arrow = trendArrow(curr?.[c.key], prev?.[c.key], c.h);
    return `<div class="kpi ${sc(v,c.g,c.y)}">
      <div class="val">${v!=null?v+c.unit:'—'}</div>
      ${arrow}
      <div class="lbl">${c.label}</div>
    </div>`;
  }).join('');
}

/* ── map KPIs ── */
function renderMapKPIs(kpis, curr, prev) {
  const cfgs = [
    {key:'matches',         label:'Matches',       unit:'', g:null,  h:true},
    {key:'win_pct',         label:'Win %',         unit:'%',g:55,y:45,h:true},
    {key:'kd',              label:'K / D',         unit:'', g:1.1,y:0.9,h:true},
    {key:'adr',             label:'ADR',           unit:'', g:85,y:70,h:true},
    {key:'opening_win_pct', label:'Opening Win %', unit:'%',g:55,y:45,h:true},
  ];
  $('m-kpis').innerHTML = cfgs.map(c => {
    const v = kpis[c.key];
    const arrow = c.g != null ? trendArrow(curr?.[c.key]??kpis[c.key], prev?.[c.key], c.h) : '';
    return `<div class="kpi ${c.g!=null?sc(v,c.g,c.y):''}">
      <div class="val">${v!=null?v+c.unit:'—'}</div>
      ${arrow}
      <div class="lbl">${c.label}</div>
    </div>`;
  }).join('');
}

/* ── verdict callout ── */
function renderVerdict(kpis, sides, trend) {
  const el = $('m-verdict');
  const byS = {};
  (sides||[]).forEach(s => byS[s.side] = s);
  const issues = [], positives = [];

  const ctWin = parseFloat(byS.CT?.round_win_pct), tWin = parseFloat(byS.T?.round_win_pct);
  if (!isNaN(ctWin) && !isNaN(tWin)) {
    const gap = Math.abs(ctWin - tWin);
    if (gap >= 15) {
      const weak = ctWin < tWin ? 'CT' : 'T', strong = ctWin >= tWin ? 'CT' : 'T';
      issues.push(`<b>${weak} side is ${gap.toFixed(0)}pp weaker</b> than ${strong} (CT ${ctWin}% vs T ${tWin}% round win)`);
    }
  }

  const owp = parseFloat(kpis?.opening_win_pct);
  if (!isNaN(owp)) {
    if (owp < 42) issues.push(`<b>First blood problem:</b> winning only ${owp}% of opening duels`);
    else if (owp > 58) positives.push(`<b>Strong opener:</b> winning ${owp}% of first duels`);
  }

  if (trend?.length >= 6) {
    const last = trend.slice(-5).map(d=>+d.score);
    const prev = trend.slice(-10,-5).map(d=>+d.score);
    if (prev.length >= 3) {
      const la = last.reduce((a,b)=>a+b,0)/last.length;
      const pa = prev.reduce((a,b)=>a+b,0)/prev.length;
      const d  = la - pa;
      if (d >= 4) positives.push(`<b>Trending up</b> +${d.toFixed(0)} rating pts over last 5 matches`);
      else if (d <= -4) issues.push(`<b>Trending down</b> ${d.toFixed(0)} pts over last 5 matches`);
    }
  }

  const wp = parseFloat(kpis?.win_pct);
  if (!isNaN(wp)) {
    if (wp >= 56) positives.push(`<b>Positive win rate</b> on this map (${wp}%)`);
    else if (wp < 44) issues.push(`<b>Below 50% win rate</b> (${wp}%) — structural weakness`);
  }

  if (!issues.length && !positives.length) { el.innerHTML=''; return; }
  const cls = issues.length > positives.length ? 'issues' : positives.length > issues.length ? 'good' : 'mixed';
  const all = [...positives.map(x=>`<div class="verdict-row g">✓ ${x}</div>`),
               ...issues.map(x=>`<div class="verdict-row r">⚠ ${x}</div>`)];
  el.innerHTML = `<div class="verdict ${cls}">${all.join('')}</div>`;
}

/* ── sample size warning ── */
function showWarning(matches) {
  const w = $('m-warn');
  if (matches != null && matches < 5) {
    w.textContent = `⚠ Only ${matches} match${matches===1?'':'es'} on this map — stats may not be reliable yet.`;
    w.style.display = '';
  } else {
    w.style.display = 'none';
  }
}

/* ── side cards ── */
function renderSides(sides) {
  const byS = {};
  (sides||[]).forEach(s => byS[s.side] = s);
  const rows = [
    ['round_win_pct','Round Win %','%'],
    ['adr','ADR',''],
    ['opening_kill_pct','Opening Kill %','%'],
    ['opening_death_pct','Opening Death %','%'],
    ['early_death_pct','Early Deaths %','%'],
    ['util_per_round','Util / Round',''],
  ];
  ['CT','T'].forEach(side => {
    const d = byS[side] || {};
    const card = $('m-sides').querySelector(`.side-card.${side.toLowerCase()}`);
    card.innerHTML = `<h3>${side} SIDE</h3>` + rows.map(([k,l,u]) => {
      const v = d[k];
      return `<div class="srow"><span class="sk">${l}</span><span class="sv">${v!=null?v+u:'—'}</span></div>`;
    }).join('');
  });
}

/* ── economy panel ── */
function renderEconomy(eco) {
  const el = $('m-economy');
  if (!eco || Object.keys(eco).filter(k=>eco[k]!=null).length===0) {
    el.innerHTML='<h4>Economy</h4><div class="spin" style="padding:4px;font-size:11px">No economy data yet</div>';
    return;
  }
  el.innerHTML = `<h4>Economy</h4>` + [
    ['Force buy waste',     eco.force_waste_pct, '%', v=>v>30?'r':v>15?'y':'g'],
    ['Failed save %',       eco.failed_save_pct, '%', v=>v>40?'r':v>20?'y':'g'],
    ['Eco round wins',      eco.eco_win_pct,     '%', v=>v>25?'g':v>10?'y':'r'],
    ['Full buy ADR',        eco.full_buy_adr,    '',  v=>v>85?'g':v>70?'y':'r'],
  ].map(([l,v,u,cls])=>`<div class="stat-row"><span class="sk">${l}</span>
    <span class="sv ${v!=null?cls(parseFloat(v)):''}">${v!=null?v+u:'—'}</span></div>`).join('');
}

/* ── clutch panel ── */
function renderClutch(c) {
  const el = $('m-clutch');
  if (!c || (c.v1_total==null && c.v2_total==null)) {
    el.innerHTML='<h4>Clutch Situations</h4><div class="spin" style="padding:4px;font-size:11px">No clutch data yet</div>';
    return;
  }
  const pct = (w,t) => t>0 ? Math.round(100*w/t)+'%' : '—';
  const cls = (w,t) => t>0 ? (100*w/t>55?'g':100*w/t>35?'y':'r') : '';
  el.innerHTML = `<h4>Clutch Situations</h4>` + [
    ['1v1', c.v1_won, c.v1_total],
    ['1v2', c.v2_won, c.v2_total],
    ['1v3+',c.v3p_won,c.v3p_total],
  ].filter(([,w,t])=>t>0).map(([l,w,t])=>`<div class="stat-row">
    <span class="sk">${l} (${t} tries)</span>
    <span class="sv ${cls(w,t)}">${pct(w,t)}</span>
  </div>`).join('') || '<div class="stat-row"><span class="sk">No clutch data</span></div>';
}

/* ── session panel ── */
function renderSession(session, kpis) {
  const el = $('session-row');
  const adrDelta = session?.adr_today != null && kpis?.adr != null
    ? trendArrow(session.adr_today, kpis.adr) : '';
  const kdDelta  = session?.kd_today  != null && kpis?.kd  != null
    ? trendArrow(session.kd_today,  kpis.kd)  : '';
  el.innerHTML = `
    <div class="stat-mini"><h4>Matches Today</h4>
      <div style="font-size:24px;font-weight:700;text-align:center;padding:4px 0">
        ${session?.matches_today??'—'}
      </div>
    </div>
    <div class="stat-mini"><h4>Today ADR</h4>
      <div style="font-size:22px;font-weight:700;text-align:center;padding:4px 0">
        ${session?.adr_today??'—'} ${adrDelta}
      </div>
    </div>
    <div class="stat-mini"><h4>Today K/D</h4>
      <div style="font-size:22px;font-weight:700;text-align:center;padding:4px 0">
        ${session?.kd_today??'—'} ${kdDelta}
      </div>
    </div>`;
}

/* ── form table ── */
function renderForm(rows, id, clickable=false) {
  const el = $(id);
  if (!rows?.length) { el.innerHTML='<div class="spin">No matches yet</div>'; return; }
  el.innerHTML = `<table><thead><tr><th>When</th><th>Map</th><th>R</th><th>Score</th><th>Rating</th>${clickable?'<th></th>':''}</tr></thead><tbody>
    ${rows.map(r => {
      const rc = r.rating>=75?'g':r.rating>=60?'y':'r';
      const link = clickable && r.match_id
        ? `<td><a class="match-link" onclick="openMatchDetail(${r.match_id})" title="Analyse this match">↗</a></td>` : '';
      return `<tr>
        <td>${r.when}</td>
        <td>${(r.map||'').replace('de_','').toUpperCase()}</td>
        <td class="${r.won?'w':'l'}">${r.won?'W':'L'}</td>
        <td>${r.team_score}:${r.opp_score}</td>
        <td class="${rc}">${r.rating}</td>
        ${link}
      </tr>`;
    }).join('')}</tbody></table>`;
}

/* ── performance rating trend ── */
function renderRatingTrend(data, id) {
  const el = $(id);
  if (!el) return;
  if (!data?.length) { el.innerHTML = '<div class="spin">No data</div>'; return; }
  const cur   = data[data.length - 1];
  const first = data[0];
  const totalDelta  = cur.rating - first.rating;
  const recentDelta = data.length >= 3 ? cur.rating - data[data.length - 3].rating : totalDelta;

  const W=400, H=100, pl=46, pr=12, pt=10, pb=22, iW=W-pl-pr, iH=H-pt-pb;
  const ratings = data.map(d => d.rating);
  const minR = Math.min(...ratings), maxR = Math.max(...ratings);
  const range = (maxR - minR) || 200;
  const padded = range * 0.18;
  const lo = minR - padded, hi = maxR + padded;
  const yScale = iH / (hi - lo);

  function rx(i) { return pl + (i / Math.max(data.length - 1, 1)) * iW; }
  function ry(r) { return pt + iH - (r - lo) * yScale; }

  // Grid + y-axis labels
  const ticks = [lo + (hi-lo)*0.15, lo + (hi-lo)*0.5, lo + (hi-lo)*0.85];
  const yLabels = ticks.map(t => {
    const y = ry(t).toFixed(1);
    return `<line x1="${pl}" y1="${y}" x2="${W-pr}" y2="${y}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
            <text x="${pl-4}" y="${(+y+3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--mu)" font-family="'JetBrains Mono',monospace">${Math.round(t)}</text>`;
  }).join('');

  // Area gradient fill
  const pts = data.map((d,i) => `${rx(i).toFixed(1)},${ry(d.rating).toFixed(1)}`).join(' ');
  const bottomY = (pt + iH).toFixed(1);
  const areaPath = `${rx(0).toFixed(1)},${bottomY} ${pts} ${rx(data.length-1).toFixed(1)},${bottomY}`;
  const gId = `rg-${id}`;

  // Start baseline
  const startY = ry(first.rating).toFixed(1);
  const refLine = `<line x1="${pl}" y1="${startY}" x2="${W-pr}" y2="${startY}"
    stroke="var(--orange)" stroke-width="1" stroke-dasharray="3,3" opacity="0.4"/>`;

  // W/L dots
  const dots = data.map((d, i) => {
    const col = d.won ? 'var(--green)' : 'var(--red)';
    const mapName = (d.map||'').replace('de_','').toUpperCase();
    return `<circle cx="${rx(i).toFixed(1)}" cy="${ry(d.rating).toFixed(1)}" r="3.5"
      fill="${col}" stroke="var(--bg)" stroke-width="1.5">
      <title>${mapName}: ${d.rating} (${d.delta >= 0 ? '+' : ''}${d.delta})</title></circle>`;
  }).join('');

  const dStr  = totalDelta  >= 0 ? `+${totalDelta}`  : `−${Math.abs(totalDelta)}`;
  const rdStr = recentDelta >= 0 ? `+${recentDelta}` : `−${Math.abs(recentDelta)}`;
  const dCls  = totalDelta  >= 0 ? 'up' : 'dn';
  const rdCls = recentDelta >= 0 ? 'up' : 'dn';

  el.innerHTML = `
    <div class="rating-hero">
      <span class="rating-val">${cur.rating.toLocaleString()}</span>
      <span class="rating-delta ${dCls}">${dStr} all-time</span>
      <span class="rating-delta ${rdCls}" style="margin-left:8px">${rdStr} recent</span>
    </div>
    <svg class="trend-svg" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="${gId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff6a2c" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#ff6a2c" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${yLabels}${refLine}
      <polygon points="${areaPath}" fill="url(#${gId})"/>
      <polyline points="${pts}" fill="none" stroke="var(--orange)" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round"
        style="filter:drop-shadow(0 0 3px rgba(255,106,44,0.45))"/>
      ${dots}
    </svg>
    <div style="display:flex;gap:12px;font-size:9px;color:var(--mu);margin-top:4px;font-family:var(--font-mono)">
      <span><span style="color:var(--green)">●</span> Win</span>
      <span><span style="color:var(--red)">●</span> Loss</span>
      <span style="margin-left:auto">Start: ${first.rating.toLocaleString()}</span>
    </div>`;
}

/* ── maps table ── */
function renderMaps(mmRows, fcRows, trendData) {
  // Support old signature renderMaps(rows, trendData)
  if (!Array.isArray(fcRows)) { trendData = fcRows; fcRows = []; }
  const el=$('d-maps');
  const mm = mmRows || [], fc = fcRows || [];
  if (!mm.length && !fc.length) { el.innerHTML='<div class="spin">No data</div>'; return; }

  function mmSpark(mapName) {
    if (!trendData?.length) return '—';
    const recent = trendData.filter(t => t.map === mapName).slice(-5);
    if (!recent.length) return '—';
    return `<div class="map-spark">${recent.map(t =>
      `<span class="map-spark-dot ${t.won ? 'w' : 'l'}" title="${t.won?'Win':'Loss'}"></span>`
    ).join('')}</div>`;
  }

  // Build rows: MM first, then FACEIT-only maps
  const mmMapNames = new Set(mm.map(r=>r.map));
  const fcOnly = fc.filter(r => !mmMapNames.has(r.map));

  const mmHtml = mm.map(r => {
    const fcRow = fc.find(f=>f.map===r.map);
    const fcBadge = fcRow ? `<span class="plat-badge fc" title="FACEIT: ${fcRow.matches}M ${fcRow.win_pct}%W">FC</span>` : '';
    return `<tr>
      <td><a class="map-link" href="#" onclick="switchTab('${r.map}');return false;">${(r.map||'').replace('de_','').toUpperCase()}</a>
        ${fcBadge}</td>
      <td>${r.matches}</td>
      <td class="${sc(r.win_pct,55,45)}">${r.win_pct??'—'}%</td>
      <td class="${sc(r.kd,1.1,0.9)}">${r.kd??'—'}</td>
      <td>${r.adr??'—'}</td>
      <td>${mmSpark(r.map)}</td>
    </tr>`;
  }).join('');

  const fcHtml = fcOnly.map(r => `<tr>
    <td><a class="map-link" href="#" onclick="switchTab('${r.map}');return false;">${(r.map||'').replace('de_','').toUpperCase()}</a>
      <span class="plat-badge fc">FC</span></td>
    <td>${r.matches}</td>
    <td class="${sc(r.win_pct,55,45)}">${r.win_pct??'—'}%</td>
    <td class="${sc(r.kd,1.1,0.9)}">${r.kd??'—'}</td>
    <td>${r.adr??'—'}</td>
    <td>—</td>
  </tr>`).join('');

  el.innerHTML=`<table><thead><tr><th>Map</th><th>M</th><th>W%</th><th>K/D</th><th>ADR</th><th>Form</th></tr></thead><tbody>
    ${mmHtml}${fcHtml}</tbody></table>`;
}

/* ── weapons ── */
function renderWeapons(rows, id) {
  const el=$(id);
  if (!rows?.length) { el.innerHTML='<div class="spin">No data</div>'; return; }
  el.innerHTML=`<table><thead><tr><th>Weapon</th><th>Kills</th><th>HS</th><th>HS%</th></tr></thead><tbody>
    ${rows.map(r=>`<tr>
      <td><div class="wpn-cell"><img class="wicon" src="${wIconSrc(r.weapon)}" alt="${r.weapon}" title="${r.weapon}"><span>${r.weapon}</span></div></td>
      <td>${r.kills}</td><td>${r.hs}</td>
      <td class="${sc(r.hs_pct,50,30)}">${r.hs_pct??'—'}%</td>
    </tr>`).join('')}</tbody></table>`;
}

/* ── pitfall cards ── */
function renderPitfalls(rows, wrapperId) {
  const el = $(wrapperId);
  if (!el) return;
  if (!rows?.length) { el.innerHTML = '<div class="spin">No data</div>'; return; }
  const valid = rows.filter(r => r.rate_pct != null && r.rate_pct !== '');
  if (!valid.length) { el.innerHTML = '<div class="spin">No data</div>'; return; }
  const sorted = [...valid].sort((a,b) => b.rate_pct - a.rate_pct);

  // Separate "focus area" (worst) from the rest
  const [worst, ...rest] = sorted;
  const allCards = [worst, ...rest];

  function sevClass(pct) {
    return pct >= 35 ? 'sev-crit' : pct >= 20 ? 'sev-warn' : 'sev-ok';
  }
  function sevLabel(pct) {
    return pct >= 35 ? '⚠ Critical' : pct >= 20 ? '▲ Watch' : '✓ Minor';
  }
  function pitFix(p) {
    const fixes = {
      'T-side opening deaths':
        'Hold angles instead of pushing early. Let CTs overextend. Info > aggression in first 15s.',
      'Failed weapon saves on lost rounds':
        'At 15s remaining, if you can\'t trade, drop the gun. A saved rifle is worth 3 eco rounds.',
      'Bad force-buys (lost, under 50 dmg)':
        'Only force when you have 2+ nades to add pressure. Pistol eco with $1400 saved beats a naked force.',
      'Rounds with zero utility thrown':
        'One smoke or flash per round changes sight lines. Bind a nade key and throw something — anything.',
      'Fight conversion failures (80+ dmg, 0 kills)':
        'When you win the damage trade, push or call for trade backup. Peeking again at full health negates your damage.',
      'Early round deaths (first third of round)':
        'Play the first 30s passively — gather info, don\'t die. Your value is highest when alive with info.',
      'Avg team flashes per round':
        'One pop-flash per round before a peek costs nothing and wins duels. Add it to every entry.',
    };
    for (const key of Object.keys(fixes)) {
      if (p.includes(key.slice(0, 20))) return fixes[key];
    }
    return '';
  }

  const cards = allCards.map((r, i) => {
    const pct = +r.rate_pct;
    const sev = sevClass(pct);
    const label = sevLabel(pct);
    const fix = pitFix(r.pitfall);
    const barW = Math.min(100, pct * 1.5);
    const barCol = pct >= 35 ? 'var(--red)' : pct >= 20 ? 'var(--yellow)' : 'var(--green)';
    return `<div class="pit-card ${sev}">
      <div class="pit-top">
        <div style="flex:1">
          <div class="pit-label">${label}</div>
          <div class="pit-name">${r.pitfall}</div>
        </div>
        <div class="pit-pct ${sev}">${pct}%</div>
      </div>
      <div class="pit-bar-bg"><div class="pit-bar-fill" style="width:${barW}%;background:${barCol}"></div></div>
      ${fix ? `<div class="pit-tip"><b>Fix:</b> ${fix}</div>` : ''}
    </div>`;
  });

  // Focus area callout for the worst issue
  const focusLabel = worst.rate_pct >= 35
    ? `<div style="font-size:10px;color:var(--red);font-weight:700;margin-bottom:8px">
        ⚠ Focus Area: <b>${worst.pitfall}</b> is happening ${worst.rate_pct}% of the time — address this first.
       </div>`
    : '';

  el.innerHTML = `${focusLabel}<div class="pit-cards">${cards.join('')}</div>`;
}

/* ── platform comparison (MM vs FACEIT) ── */
const PLAT_KPI_CFG = [
  {key:'win_pct', label:'Win %',  unit:'%', g:55,  y:45},
  {key:'kd',      label:'K / D',  unit:'',  g:1.1, y:0.9},
  {key:'adr',     label:'ADR',    unit:'',  g:85,  y:70},
  {key:'hs_pct',  label:'HS %',   unit:'%', g:50,  y:30},
];

function _platKpi(label, val, unit, g, y) {
  const cls = (g == null || val == null) ? '' : sc(val, g, y);
  return `<div class="plat-kpi ${cls}">
    <div class="plat-val">${val != null ? val + unit : '—'}</div>
    <div class="plat-lbl">${label}</div>
  </div>`;
}

function _platMapsTable(rows) {
  if (!rows?.length) return '';
  return `<table class="plat-map-table"><thead><tr>
    <th>Map</th><th>M</th><th>W%</th><th>K/D</th><th>ADR</th>
  </tr></thead><tbody>
    ${rows.map(r=>`<tr>
      <td>${(r.map||'').replace('de_','')}</td>
      <td>${r.matches}</td>
      <td class="${sc(r.win_pct,55,45)}">${r.win_pct??'—'}%</td>
      <td class="${sc(r.kd,1.1,0.9)}">${r.kd??'—'}</td>
      <td class="${sc(r.adr,85,70)}">${r.adr??'—'}</td>
    </tr>`).join('')}
  </tbody></table>`;
}

function _eloSparkline(trend) {
  if (!trend?.length) return '';
  const elos = trend.map(t=>t.faceit_elo).filter(e=>e!=null);
  if (elos.length < 2) return '';
  const mn = Math.min(...elos), mx = Math.max(...elos), rng = mx - mn || 1;
  const W=220, H=44;
  const pts = elos.map((e,i)=>`${(i/(elos.length-1))*W},${H-((e-mn)/rng)*H}`).join(' ');
  const latest = elos[elos.length-1], first = elos[0], diff = latest - first;
  const col = diff >= 0 ? 'var(--green)' : 'var(--red)';
  return `<div class="elo-spark-wrap">
    <div class="elo-spark-vals">
      <span class="elo-val">${latest}</span>
      <span class="elo-diff" style="color:${col}">${diff>=0?'+':''}${diff}</span>
      <span class="elo-lbl">ELO (${elos.length} matches)</span>
    </div>
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible">
      <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5" opacity=".85"/>
      <circle cx="${(elos.length-1)/(elos.length-1)*W}" cy="${H-((latest-mn)/rng)*H}" r="3" fill="${col}"/>
    </svg>
  </div>`;
}

/* ══════════════════════════════════════════════
   OVERVIEW — FACEIT-style stat cards + coaching
   ══════════════════════════════════════════════ */

function _ovMiniSparkline(svgId, values) {
  const el = $(svgId);
  if (!el || !values?.length) return;
  const mn = Math.min(...values), mx = Math.max(...values);
  const rng = mx - mn || 1;
  const W = 120, H = 36;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * W;
    const y = H - ((v - mn) / rng) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = values[values.length - 1], first = values[0];
  const col = last >= first ? 'var(--green)' : 'var(--red)';
  el.innerHTML = `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5" opacity=".55" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function _ovTrend(curr, prev, higherBetter = true) {
  if (curr == null || prev == null) return '';
  const diff = parseFloat(curr) - parseFloat(prev);
  if (Math.abs(diff) < 0.01) return '';
  const up = higherBetter ? diff > 0 : diff < 0;
  // Use real minus glyph per design system
  const sign = diff > 0 ? '+' : '−';
  const abs = Math.abs(diff);
  const valStr = abs < 1 ? abs.toFixed(2) : abs < 10 ? abs.toFixed(1) : Math.round(abs);
  return `<span class="ov-sc-trend ${up ? 'up' : 'dn'}">${up ? '▲' : '▼'} ${sign}${valStr}</span>`;
}

function renderOvStatCards(kpis, curr, prev, ratingTrend) {
  const ratings = (ratingTrend || []).map(d => d.rating).filter(v => v != null);

  // K/D
  const kdEl = $('ov-kd-val'); if (kdEl) kdEl.textContent = kpis.kd ?? '—';
  const kdT = $('ov-kd-trend'); if (kdT) kdT.innerHTML = _ovTrend(curr?.kd, prev?.kd);
  _ovMiniSparkline('ov-kd-spark', ratings);

  // ADR
  const adrEl = $('ov-adr-val'); if (adrEl) adrEl.textContent = kpis.adr != null ? Math.round(kpis.adr) : '—';
  const adrT = $('ov-adr-trend'); if (adrT) adrT.innerHTML = _ovTrend(curr?.adr, prev?.adr);
  _ovMiniSparkline('ov-adr-spark', ratings);

  // Win % — ring gauge
  const wp = parseFloat(kpis.win_pct);
  const wvEl = $('ov-wins-val'); if (wvEl) wvEl.textContent = kpis.win_pct != null ? kpis.win_pct + '%' : '—';
  const wt = $('ov-wins-trend'); if (wt) wt.innerHTML = _ovTrend(curr?.win_pct, prev?.win_pct);
  const arc = $('ov-wins-arc');
  if (arc && !isNaN(wp)) {
    const circ = 2 * Math.PI * 28; // r=28
    const dash = (wp / 100) * circ;
    arc.setAttribute('stroke-dasharray', `${dash.toFixed(1)} ${(circ - dash).toFixed(1)}`);
    arc.setAttribute('stroke', wp >= 55 ? 'var(--green)' : wp >= 45 ? '#c49020' : 'var(--red)');
  }

  // HS %
  const hsEl = $('ov-hs-val'); if (hsEl) hsEl.textContent = kpis.hs_pct != null ? kpis.hs_pct + '%' : '—';
  const hsT = $('ov-hs-trend'); if (hsT) hsT.innerHTML = _ovTrend(curr?.hs_pct, prev?.hs_pct);
  _ovMiniSparkline('ov-hs-spark', ratings);
}

function renderOvIdentity(kpis) {
  const meta = $('ov-id-meta');
  if (meta && kpis.matches) {
    meta.textContent = `${kpis.matches} match${kpis.matches !== 1 ? 'es' : ''} · ${kpis.win_pct ?? '—'}% wins`;
  }
  const mmRating = $('ov-mm-rating');
  if (mmRating) mmRating.textContent = kpis.score != null ? kpis.score : '—';
}

function renderOvIdentityFaceit(faceitKpis) {
  if (!faceitKpis?.latest_elo) return;
  const sep = $('ov-fc-sep'); if (sep) sep.style.display = '';
  const pill = $('ov-fc-pill'); if (pill) pill.style.display = '';
  const disp = $('ov-fc-display');
  if (disp) {
    disp.style.display = '';
    disp.textContent = faceitKpis.faceit_level
      ? `L${faceitKpis.faceit_level} · ${faceitKpis.latest_elo.toLocaleString()} ELO`
      : faceitKpis.latest_elo.toLocaleString();
  }

  // Render EloRing widget
  const ringWrap = $('ov-elo-ring');
  if (ringWrap && faceitKpis.latest_elo) {
    const elo = faceitKpis.latest_elo;
    const lvl = faceitKpis.faceit_level || 1;
    const lvlCols = ['#eee','#1ce400','#1ce400','#ffc800','#ffc800','#ffc800','#ffc800','#ff6a2c','#ff6a2c','#ff1f3d'];
    const col = lvlCols[Math.min(lvl - 1, 9)];
    const size = 80, r = 32, c = 2 * Math.PI * r;
    const pct = Math.min(1, ((elo % 250) || 250) / 250);
    const arc = pct * c;
    ringWrap.innerHTML = `
      <div class="owl-elo-ring" style="width:${size}px;height:${size}px">
        <div class="owl-elo-glow"></div>
        <svg width="${size}" height="${size}" style="transform:rotate(-90deg);position:absolute">
          <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="5"/>
          <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--orange)" stroke-width="5"
            stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}"
            class="owl-elo-arc" data-target="${c - arc}"/>
        </svg>
        <div class="owl-elo-inner">
          <div class="owl-skill-hex" style="border-color:${col};color:${col}">${lvl}</div>
          <div class="owl-elo-num">${elo.toLocaleString()}</div>
        </div>
      </div>`;
    // Animate arc after paint
    requestAnimationFrame(() => {
      const arc_el = ringWrap.querySelector('.owl-elo-arc');
      if (arc_el) setTimeout(() => arc_el.style.strokeDashoffset = arc_el.dataset.target, 60);
    });
  }

  // Mirror avatar/name to identity strip
  const ovAvatar = $('ov-avatar');
  const pcAvatar = $('pc-avatar');
  if (ovAvatar && pcAvatar) ovAvatar.textContent = pcAvatar.textContent;
  const ovName = $('ov-name');
  const pcName = $('pc-name');
  if (ovName && pcName && pcName.textContent) ovName.textContent = pcName.textContent;
}

function renderOvCoachingInsights() {
  const el = $('ov-coaching-body');
  if (!el) return;
  if (!_overviewCoachAnswer) {
    el.innerHTML = `<div class="ov-coach-empty">
      <span style="color:var(--mu);font-size:11px">No brief yet.</span>
      <button onclick="refreshCoach('overview')" class="icon-btn" style="font-size:11px;margin-left:10px">↻ Generate</button>
    </div>`;
    return;
  }

  const tmp = document.createElement('div');
  tmp.innerHTML = _overviewCoachAnswer;

  // Extract strengths and weaknesses from AI HTML
  let strengths = [], weaknesses = [];
  const headings = [...tmp.querySelectorAll('h1,h2,h3,h4')];
  headings.forEach(h => {
    const txt = h.textContent.toLowerCase();
    const isSt = /strength|strong|doing well|positive|great/i.test(txt);
    const isWk = /improve|fix|weak|focus|area|work on|impactful/i.test(txt);
    if (!isSt && !isWk) return;
    const items = [];
    let next = h.nextElementSibling;
    while (next && !/^H[1-4]$/.test(next.tagName)) {
      [...next.querySelectorAll('li')].forEach(li => items.push(li.textContent.trim()));
      if (next.tagName === 'P') items.push(next.textContent.trim());
      next = next.nextElementSibling;
    }
    if (isSt) strengths = [...strengths, ...items];
    else weaknesses = [...weaknesses, ...items];
  });

  // Fallback: all li items
  if (!strengths.length && !weaknesses.length) {
    const all = [...tmp.querySelectorAll('li')].map(li => li.textContent.trim()).filter(t => t.length > 10);
    const mid = Math.ceil(all.length / 2);
    strengths = all.slice(0, mid);
    weaknesses = all.slice(mid);
  }

  // Split each text into cue (first sentence) + why (rest)
  const splitCueWhy = text => {
    const dot = text.search(/[.!–—]/);
    if (dot > 10 && dot < text.length - 2) {
      return { cue: text.slice(0, dot + 1).trim(), why: text.slice(dot + 1).trim() };
    }
    return { cue: text, why: '' };
  };

  const sevCfg = [
    { col: 'var(--orange)', bg: 'var(--orange-g)', label: 'HIGH IMPACT' },
    { col: 'var(--orange)', bg: 'var(--orange-g)', label: 'HIGH IMPACT' },
    { col: 'var(--yellow)', bg: 'var(--yellow-soft)', label: 'MEDIUM' },
    { col: 'var(--ct)',     bg: 'rgba(77,158,255,.10)', label: 'LOW' },
  ];

  const mkFixCard = (text, n) => {
    const { cue, why } = splitCueWhy(text);
    const sev = sevCfg[Math.min(n, sevCfg.length - 1)];
    return `<div class="owl-cc">
      <div class="owl-cc-hdr">
        <div class="owl-cc-rank cut-corner" style="border-color:${sev.col};color:${sev.col}">${n + 1}</div>
        <div class="owl-cc-meta">
          <span class="owl-pill" style="background:${sev.bg};color:${sev.col};border-color:${sev.col}40">${sev.label}</span>
          <div class="owl-cc-cue">${_escHtml(cue)}</div>
        </div>
      </div>
      ${why ? `<p class="owl-cc-why">${_escHtml(why)}</p>` : ''}
    </div>`;
  };

  const mkWinCard = text => {
    const { cue, why } = splitCueWhy(text);
    return `<div class="owl-win-card">
      <svg class="owl-win-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      <div>
        <div class="owl-win-cue">${_escHtml(cue)}</div>
        ${why ? `<div class="owl-win-why">${_escHtml(why)}</div>` : ''}
      </div>
    </div>`;
  };

  const fixCards = weaknesses.slice(0, 3).map((t, i) => mkFixCard(t, i)).join('');
  const strCards = strengths.slice(0, 2).map(t => mkWinCard(t)).join('');
  const hasData = fixCards || strCards;

  el.innerHTML = hasData
    ? `<div class="owl-coach-grid">${fixCards}</div>${strCards ? `<div class="owl-win-list">${strCards}</div>` : ''}`
    : `<div class="ov-coach-empty" style="color:var(--mu);font-size:11px;padding:8px">Brief generated — no structured tips found. Try refreshing.</div>`;
}

/* ── Slide 1: single-pane stat comparison grid ── */
let _cs1MmKpis = null, _cs1FcKpis = null;

function _cs1BuildGrid() {
  const el = $('cs1-stat-grid');
  if (!el) return;
  const mm = _cs1MmKpis || {};
  const fc = _cs1FcKpis;
  const stats = [
    {label:'K / D', key:'kd',     unit:'',  g:1.1, y:0.9},
    {label:'ADR',   key:'adr',   unit:'',  g:85,  y:70},
    {label:'Win %', key:'win_pct',unit:'%', g:55,  y:45},
    {label:'HS %',  key:'hs_pct', unit:'%', g:50,  y:30},
  ];
  el.innerHTML = stats.map(s => {
    const mv = mm[s.key], fv = fc ? fc[s.key] : null;
    const mc = mv != null ? sc(mv,s.g,s.y) : '';
    const fc_ = fv != null ? sc(fv,s.g,s.y) : '';
    const fStr = fv != null ? fv + s.unit : (fc ? '—' : '…');
    return `<div class="cs1-stat">
      <div class="cs1-stat-lbl">${s.label}</div>
      <div class="cs1-cmp">
        <div class="cs1-cmp-col">
          <span class="cs1-cmp-val ${mc}">${mv != null ? mv + s.unit : '—'}</span>
          <div class="cs1-cmp-plat cs1-mm-col">MM</div>
        </div>
        <span class="cs1-cmp-sep">|</span>
        <div class="cs1-cmp-col">
          <span class="cs1-cmp-val ${fc_}">${fStr}</span>
          <div class="cs1-cmp-plat cs1-fc-col">FC</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function renderPlatformComparison(mmData, days) {
  // MM side — data already loaded
  const mk = mmData.kpis || {};
  const mmSub = mk.matches ? `${mk.matches} matches` : '';
  const el_mmSub = $('mm-plat-sub'); if(el_mmSub) el_mmSub.textContent = mmSub;
  const mmKpis = PLAT_KPI_CFG.map(c=>_platKpi(c.label, mk[c.key], c.unit, c.g, c.y)).join('')
    + _platKpi('Accuracy', mk.accuracy_pct, '%', 28, 18);
  const el_mmKpis = $('plat-kpis-mm'); if(el_mmKpis) el_mmKpis.innerHTML = mmKpis;

  // Slide 1 — MM side
  _cs1MmKpis = mk;
  const el_mmR = $('cs1-mm-rating'); if(el_mmR) el_mmR.textContent = mmData.kpis?.score ?? '—';
  const el_mmM = $('cs1-mm-meta'); if(el_mmM) el_mmM.textContent = mmSub;
  _cs1BuildGrid();

  // FACEIT side — separate fetch
  try {
    const fd = await fetch(`/api/faceit_overview?days=${days}`).then(r=>r.json());
    if (!fd.has_data) {
      const noData = `<div class="plat-no-data" style="font-size:10px;color:var(--mu);padding:4px">No FACEIT data</div>`;
      const el_fp = $('faceit-panel-content'); if(el_fp) el_fp.innerHTML = noData;
      _cs1FcKpis = null;
      _cs1BuildGrid();
      return;
    }
    const fk = fd.kpis || {};
    const fSub = fk.matches ? `${fk.matches} matches` : '';
    const el_fSub = $('faceit-plat-sub'); if(el_fSub) el_fSub.textContent = fSub;
    const eloKpi = fk.latest_elo
      ? `<div class="plat-kpi"><div class="plat-val" style="color:#ff7733">${fk.latest_elo}</div><div class="plat-lbl">ELO${fk.faceit_level?' · Lvl '+fk.faceit_level:''}</div></div>`
      : '';
    const faceitKpis = PLAT_KPI_CFG.map(c=>_platKpi(c.label, fk[c.key], c.unit, c.g, c.y)).join('') + eloKpi;
    const el_fp = $('faceit-panel-content'); if(el_fp) el_fp.innerHTML = `<div class="plat-kpis">${faceitKpis}</div>`;

    // Slide 1 — FACEIT side
    _cs1FcKpis = fk;
    const el_fcR = $('cs1-fc-rating');
    if(el_fcR) el_fcR.textContent = fk.latest_elo
      ? `${fk.latest_elo}${fk.faceit_level ? ' · L'+fk.faceit_level : ''}` : '—';
    const el_fcM = $('cs1-fc-meta'); if(el_fcM) el_fcM.textContent = fSub;
    _cs1BuildGrid();

    if (fd.elo_trend?.length) {
      _rankEloData = fd.elo_trend;
      _applyRankToggle();
    }
    _updatePlayerCard(null, fk);
    renderOvIdentityFaceit(fk);
  } catch(e) {
    const el_fp = $('faceit-panel-content');
    if(el_fp) el_fp.innerHTML = `<div class="spin" style="color:var(--mu);font-size:10px">Unavailable</div>`;
    _cs1FcKpis = null;
    _cs1BuildGrid();
  }
}

/* ── Slide 2: today's performance (MM + FACEIT, last 24 h) ── */
async function renderTodayPerf(session) {
  const el = $('d-today-perf');
  if (!el) return;
  const mmMatches = session?.matches_today || 0;

  let fcToday = null;
  try {
    const fd = await fetch('/api/faceit_overview?days=1').then(r=>r.json());
    if (fd.has_data) fcToday = fd.kpis;
  } catch(e) {}

  const fcMatches = fcToday?.matches || 0;

  if (!mmMatches && !fcMatches) {
    el.innerHTML = `<div class="today-empty">No matches yet today — queue up!</div>`;
    return;
  }

  const mmBlock = mmMatches
    ? `<div class="today-stat-row"><span class="today-stat-lbl">Matches</span><span class="today-stat-val">${mmMatches}</span></div>
       <div class="today-stat-row"><span class="today-stat-lbl">K / D</span><span class="today-stat-val">${session.kd_today ?? '—'}</span></div>
       <div class="today-stat-row"><span class="today-stat-lbl">ADR</span><span class="today-stat-val">${session.adr_today ?? '—'}</span></div>`
    : `<div class="today-none">No MM today</div>`;

  const fcBlock = fcMatches
    ? `<div class="today-stat-row"><span class="today-stat-lbl">Matches</span><span class="today-stat-val">${fcMatches}</span></div>
       <div class="today-stat-row"><span class="today-stat-lbl">K / D</span><span class="today-stat-val">${fcToday.kd ?? '—'}</span></div>
       <div class="today-stat-row"><span class="today-stat-lbl">ADR</span><span class="today-stat-val">${fcToday.adr ?? '—'}</span></div>`
    : `<div class="today-none">No FACEIT today</div>`;

  el.innerHTML = `
    <div class="today-perf-hdr">Today's Performance</div>
    <div class="today-perf-grid">
      <div class="today-plat-col">
        <div class="today-plat-name mm">Matchmaking</div>
        ${mmBlock}
      </div>
      <div class="today-plat-col">
        <div class="today-plat-name fc">FACEIT</div>
        ${fcBlock}
      </div>
    </div>`;
}

/* ── lineups ── */
function renderLineups(rows, filter) {
  const el=$('m-lineups');
  const filtered = filter ? rows.filter(r=>r.grenade_type===filter) : rows;
  if (!filtered.length) {
    el.innerHTML = rows.length
      ? `<div class="spin">No ${filter} lineups seeded for this map.</div>`
      : `<div class="spin">No lineups — run seed_lineups.sql</div>`;
    return;
  }
  const sL = s => s==='CT'?`<span class=side-ct>CT</span>`:s==='T'?`<span class=side-t>T</span>`:`<span class=side-b>Both</span>`;
  el.innerHTML=`<table><thead><tr><th>Type</th><th>Name</th><th>Side</th><th>Diff</th><th></th></tr></thead><tbody>
    ${filtered.map(r=>`<tr>
      <td><span class="lineup-type lt-${r.grenade_type}">${r.grenade_type}</span></td>
      <td title="${r.notes||''}">${r.name}</td>
      <td>${sL(r.side)}</td>
      <td class="diff-${r.difficulty||'easy'}">${r.difficulty||'—'}</td>
      <td>${r.ref_url?`<a class=map-link href="${r.ref_url}" target="_blank">csnades ↗</a>`:''}</td>
    </tr>`).join('')}</tbody></table>`;
}

/* ── images ── */
function refreshMapImages() {
  const map=currentTab, side='all', days=sel('s-days'), ts=Date.now();
  const pro  = showPro  ? '&pro=true' : '';
  const gt   = grenadeType ? `&grenade_type=${grenadeType}` : '';
  const base = `map=${map}&side=${side}&days=${days}&_=${ts}`;
  const killType = showAim ? 'aim' : 'kills';
  const aimWeapon = showAim ? ($('aim-weapon-sel').value || '') : '';
  const wf = aimWeapon ? `&weapon=${encodeURIComponent(aimWeapon)}` : '';
  $('i-kills').src   = `/heatmap?type=${killType}&${base}${pro}${wf}`;
  $('i-deaths').src  = `/heatmap?type=deaths&${base}${showPro?'&pro=true':''}`;
  $('i-hbin').src    = `/hitbox?perspective=incoming&${base}`;
  $('i-hbout').src   = `/hitbox?perspective=outgoing&${base}`;
  $('i-gren').src    = `/heatmap?type=grenades&${base}${gt}`;
  $('i-smokes').src  = `/heatmap?type=smokes&${base}`;
  $('i-flashes').src = `/heatmap?type=flashes&${base}`;
  if (!showAim)
    $('t-kills').textContent = `Kill Locations — ${map.replace('de_','').toUpperCase()}`;
}

/* ── map section nav ── */
const _MAP_SECTIONS = ['msp-overview','msp-positions','msp-analysis','msp-history'];

function scrollToSection(id) {
  const el = $(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  _setPillActive(id);
}

function switchMapSubTab(name) {
  scrollToSection('msp-' + name);
}

function _setPillActive(id) {
  document.querySelectorAll('.map-pill').forEach(b =>
    b.classList.toggle('active', b.dataset.sec === id));
}

// Arrow-key navigation between sections (← →)
document.addEventListener('keydown', e => {
  if ($('v-map') && !$('v-map').classList.contains('active')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const active = document.querySelector('.map-pill.active');
  const idx = active ? _MAP_SECTIONS.indexOf(active.dataset.sec) : 0;
  const next = e.key === 'ArrowRight'
    ? Math.min(idx + 1, _MAP_SECTIONS.length - 1)
    : Math.max(idx - 1, 0);
  if (next !== idx) scrollToSection(_MAP_SECTIONS[next]);
});

// Highlight pill as user scrolls through sections
(function _initSectionObserver() {
  if (typeof IntersectionObserver === 'undefined') return;
  const io = new IntersectionObserver(entries => {
    const visible = entries.filter(e => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible.length) _setPillActive(visible[0].target.id);
  }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.map-section').forEach(el => io.observe(el));
  });
}());

/* ── positions sub-tab ── */
function switchPosTab(name) {
  document.querySelectorAll('.pos-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.ptab === name));
  document.querySelectorAll('.pos-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'pp-' + name));
}

/* ── coaching callout bar ── */
let _coachBarPriority = 0;
function _updateCoachBar(text, priority) {
  if (priority <= _coachBarPriority) return;
  _coachBarPriority = priority;
  const bar = $('m-coaching-bar');
  const txt = $('cbText');
  if (!bar || !txt) return;
  txt.textContent = text;
  bar.style.display = 'flex';
}

/* ── tabs ── */
function populateTabs(maps) {
  window._mapsList = maps || window._mapsList || [];
  if (tabsPopulated) return;
  const bar=$('tabs-bar');
  (maps||[]).forEach(m=>{
    const b=document.createElement('button');
    b.className='tab'; b.dataset.tab=m;
    b.textContent=m.replace('de_','').toUpperCase();
    b.onclick=()=>switchTab(m);
    bar.appendChild(b);
  });
  // Map picker inside the Maps view
  const picker=$('map-picker');
  if (picker) {
    picker.innerHTML='';
    (maps||[]).forEach(m=>{
      const b=document.createElement('button');
      b.className='map-pick-pill'; b.dataset.map=m;
      b.textContent=m.replace('de_','').toUpperCase();
      b.onclick=()=>switchTab(m);
      picker.appendChild(b);
    });
  }
  tabsPopulated=true;
}

/* ── match detail modal ── */
async function openMatchDetail(matchId) {
  $('match-modal').classList.remove('hidden');
  switchModalTab('stats');
  $('md-title').textContent = 'Loading…';
  $('md-sub').textContent = '';
  $('md-vs').innerHTML = '<div class="spin">Loading…</div>';
  $('md-sides').innerHTML = '';
  $('md-rounds').innerHTML = '';
  $('md-econ').innerHTML = '';
  $('md-kills').innerHTML = '';
  try {
    const d = await fetch(`/api/match_detail?match_id=${matchId}`).then(r=>r.json());
    const h = d.header || {};
    const wl = h.won ? 'w' : 'l';
    const res = h.won ? '<span class="w">WIN</span>' : '<span class="l">LOSS</span>';
    $('md-title').innerHTML = `${(h.map||'').replace('de_','').toUpperCase()} · ${h.team_score}:${h.opp_score} ${res}`;
    $('md-sub').innerHTML = `<span style="color:var(--mu)">${h.played_at || ''}</span>
      <button onclick="closeModal();switchTab('replay');rpSelectMatch('${matchId}')"
        style="margin-left:12px;font:600 10px/1 var(--font-display);text-transform:uppercase;letter-spacing:.08em;
               background:var(--green-soft);border:1px solid var(--green-line);color:var(--green);
               border-radius:4px;padding:3px 10px;cursor:pointer">
        Watch Replay →
      </button>`;

    // vs average — design-system stat cards
    const agg = d.agg || {}, va = d.vs_avg || {};
    const kpiDefs = [
      {l:'K/D',    you:agg.kd,       avg:va.avg_kd,      g:1.1, y:0.9, hi:true},
      {l:'ADR',    you:agg.adr,      avg:va.avg_adr,     g:85,  y:70,  hi:true},
      {l:'HS %',   you:agg.hs_pct,   avg:va.avg_hs_pct,  g:50,  y:30,  hi:true, unit:'%'},
      {l:'Kills',  you:agg.kills,    avg:null},
      {l:'Deaths', you:agg.deaths,   avg:null},
    ];
    $('md-vs').innerHTML = `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px">
      ${kpiDefs.map(k=>{
        const val = k.you != null ? k.you + (k.unit||'') : '—';
        const delta = k.you!=null && k.avg!=null ? parseFloat(k.you)-parseFloat(k.avg) : null;
        const good = delta!=null ? (k.hi ? delta>=0 : delta<=0) : null;
        const dHtml = delta!=null
          ? `<div style="font:600 9px/1 var(--font-display);color:${good?'var(--green)':'var(--red)'}">
              ${delta>=0?'+':'−'}${Math.abs(delta).toFixed(1)} vs avg</div>`
          : k.avg!=null ? `<div style="font:600 9px/1 var(--font-display);color:var(--mu)">avg ${k.avg}</div>` : '';
        const colCls = k.g!=null && k.you!=null ? (k.you>=k.g?'g':k.you>=k.y?'y':'r') : '';
        return `<div style="background:var(--sf2);border:1px solid var(--bd);border-radius:6px;padding:10px 10px 8px;text-align:center">
          <div style="font:700 20px/1 var(--font-display);font-variant-numeric:tabular-nums;color:var(--tx)" class="${colCls}">${val}</div>
          <div style="font:600 9px/1 var(--font-display);text-transform:uppercase;letter-spacing:.1em;color:var(--mu);margin-top:4px">${k.l}</div>
          <div style="margin-top:4px">${dHtml}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="font-size:11px;color:var(--mu)">
      ${agg.kills??0}K / ${agg.deaths??0}D · ${agg.assists??0}A · HS ${agg.hs_pct??'—'}% · ${agg.survived_rounds??0} rounds survived
    </div>`;

    // CT/T split
    const byS = {};
    (d.side_split||[]).forEach(s=>byS[s.side]=s);
    $('md-sides').innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
      ${['CT','T'].map(s=>{
        const sd = byS[s]||{};
        const col = s==='CT' ? 'var(--ct)' : 'var(--t)';
        return `<div style="background:var(--sf2);border:1px solid var(--bd);border-left:2px solid ${col};border-radius:5px;padding:10px 12px">
          <div style="font:700 11px/1 var(--font-display);color:${col};text-transform:uppercase;margin-bottom:6px">${s} Side</div>
          <div style="font:700 18px/1 var(--font-display);font-variant-numeric:tabular-nums;color:var(--tx)">${sd.rounds_won??0}<span style="font-size:12px;color:var(--mu)">/${sd.rounds_played??0}</span></div>
          <div style="font-size:10px;color:var(--mu);margin-top:4px">ADR <b style="color:var(--mu2)">${sd.adr??'—'}</b> · <b style="color:var(--mu2)">${sd.kills??0}</b>K</div>
        </div>`;
      }).join('')}
    </div>`;

    // Round timeline
    const econClr = {full:'var(--green)', force:'var(--yellow)', eco:'var(--red)', save:'var(--mu)'};
    $('md-rounds').innerHTML = (d.rounds||[]).map((r,i)=>{
      const ec = r.buy_type || 'full';
      const bc = econClr[ec] || 'var(--mu)';
      const wl = r.round_won ? 'w' : 'l';
      return `<div class="rnd ${wl}" style="border-color:${bc};font-family:var(--font-display)"
        title="R${r.round_num} ${r.side} · ${ec} · ${r.kills}K ${r.deaths}D ${r.damage}dmg">${r.round_num}</div>`;
    }).join('');

    // Economy breakdown — per-round chart + summary table
    const rounds = d.rounds || [];
    const econCount = {full:0, force:0, eco:0, save:0};
    const econWin   = {full:0, force:0, eco:0, save:0};
    rounds.forEach(r=>{
      const t = r.buy_type||'full';
      if (econCount[t]!==undefined) {
        econCount[t]++;
        if (r.round_won) econWin[t]++;
      }
    });
    // Build per-round SVG bar chart
    const bW=14, bGap=3, svgH=60, lblH=14, totalH=svgH+lblH;
    const econCol={full:'#4aaa6a',force:'#c49020',eco:'#c44040',save:'#6a6a7a'};
    const svgW = rounds.length*(bW+bGap)+bGap;
    let bars='',wlDots='',rlbls='';
    rounds.forEach((r,i)=>{
      const x=bGap+i*(bW+bGap);
      const col=econCol[r.buy_type||'full']||'#6a6a7a';
      const isCT=r.side==='CT';
      const opacity=isCT?0.9:0.6;
      bars+=`<rect x="${x}" y="${svgH-36}" width="${bW}" height="36" fill="${col}" opacity="${opacity}" rx="2"><title>R${r.round_num} ${r.side} · ${r.buy_type||'full'} · ${r.round_won?'W':'L'}</title></rect>`;
      if (isCT) bars+=`<rect x="${x}" y="${svgH-38}" width="${bW}" height="2" fill="#4e9ed4" opacity=".7"/>`;
      else       bars+=`<rect x="${x}" y="${svgH-38}" width="${bW}" height="2" fill="#d4804a" opacity=".7"/>`;
      const dotY=r.round_won?4:12;
      wlDots+=`<circle cx="${x+bW/2}" cy="${dotY}" r="3" fill="${r.round_won?'#4aaa6a':'#c44040'}"/>`;
      rlbls+=`<text x="${x+bW/2}" y="${svgH+lblH-2}" text-anchor="middle" font-size="7" fill="#888">${r.round_num}</text>`;
    });
    const ctHalftime=Math.min(12,rounds.length);
    const halfX=bGap+ctHalftime*(bW+bGap)-bGap/2;
    const halfLine=`<line x1="${halfX}" y1="0" x2="${halfX}" y2="${svgH}" stroke="#555" stroke-width="1" stroke-dasharray="3,2"/>`;
    $('md-econ').innerHTML = `
      <div class="econ-chart-wrap">
        <svg width="${svgW}" height="${totalH}" style="display:block">
          ${halfLine}${bars}${wlDots}${rlbls}
        </svg>
      </div>
      <div style="font-size:10px;color:var(--mu);margin-bottom:8px;display:flex;gap:10px">
        <span><span style="display:inline-block;width:8px;height:8px;background:#4e9ed4;border-radius:1px"></span> CT side</span>
        <span><span style="display:inline-block;width:8px;height:8px;background:#d4804a;border-radius:1px"></span> T side</span>
        <span>&#11044; Win / <span style="color:#c44040">&#11044;</span> Loss</span>
      </div>
      <table><thead><tr><th>Type</th><th>Rounds</th><th>Win%</th></tr></thead><tbody>
      ${Object.entries(econCount).filter(([,n])=>n>0).map(([t,n])=>{
        const wp = n>0 ? Math.round(100*econWin[t]/n) : 0;
        return `<tr><td><span class="econ-badge eb-${t}">${t}</span></td><td>${n}</td><td class="${wp>=50?'g':wp>=35?'y':'r'}">${wp}%</td></tr>`;
      }).join('')}</tbody></table>`;

    // Kill breakdown
    const myKills = (d.kills||[]).filter(k=>!k.is_victim);
    const hs = myKills.filter(k=>k.headshot).length;
    const wepMap = {};
    myKills.forEach(k=>{ wepMap[k.weapon]=(wepMap[k.weapon]||0)+1; });
    const sorted = Object.entries(wepMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    $('md-kills').innerHTML = `<div style="font-size:12px;margin-bottom:6px">${myKills.length} kills · <span class="${hs/Math.max(myKills.length,1)>=0.5?'g':'y'}">${hs} headshots (${myKills.length?Math.round(100*hs/myKills.length):0}%)</span></div>
      <table><thead><tr><th>Weapon</th><th>Kills</th></tr></thead><tbody>
      ${sorted.map(([w,n])=>`<tr><td>${w}</td><td>${n}</td></tr>`).join('')}</tbody></table>`;

  } catch(e) {
    $('md-vs').innerHTML = `<div class="spin">Error: ${e.message}</div>`;
  }
}

function closeModal() {
  $('match-modal').classList.add('hidden');
}

document.addEventListener('keydown', e => { if (e.key==='Escape') closeModal(); });

/* ── dual-platform trend chart (MM orange + FACEIT green) ── */
function renderDualTrend(mmTrend, eloTrend, id) {
  const el = $(id);
  if (!el) return;
  const W = 460, H = 120, pl = 10, pr = 10, pt = 12, pb = 22;
  const cW = W - pl - pr, cH = H - pt - pb;

  function mkSeries(data, yKey, col, label) {
    if (!data?.length) return null;
    const vals = data.map(d => d[yKey]).filter(v => v != null);
    if (!vals.length) return null;
    const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
    const n = data.length;
    const xp = i => pl + (n <= 1 ? cW / 2 : i * cW / (n - 1));
    const yp = v => pt + cH * (1 - (v - mn) / rng);
    const pts = data.map((d, i) => d[yKey] != null ? `${xp(i).toFixed(1)},${yp(d[yKey]).toFixed(1)}` : null).filter(Boolean);
    const path = pts.length > 1
      ? `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>`
      : '';
    const dots = data.map((d, i) => d[yKey] != null
      ? `<circle cx="${xp(i).toFixed(1)}" cy="${yp(d[yKey]).toFixed(1)}" r="2.5" fill="${col}" stroke="var(--sf)" stroke-width="1.5"><title>${label}: ${d[yKey]}</title></circle>`
      : '').join('');
    const endVal = vals[vals.length - 1];
    const startVal = vals[0];
    const diff = endVal - startVal;
    return { path, dots, col, label, endVal, diff };
  }

  const mm = mkSeries(mmTrend, 'rating', 'var(--orange)', 'MM Rating');
  const fc = mkSeries(eloTrend, 'faceit_elo', 'var(--green)', 'FACEIT ELO');
  if (!mm && !fc) { el.innerHTML = '<div class="spin">No data yet</div>'; return; }

  const allDates = [...(mmTrend||[]).map(d=>d.played_at), ...(eloTrend||[]).map(d=>d.played_at)].filter(Boolean).sort();
  const fmt = d => (d||'').slice(5,10).replace('-','/');
  const xLabels = allDates.length >= 2
    ? `<text x="${pl}" y="${H-3}" text-anchor="start" font-size="8" fill="var(--mu)">${fmt(allDates[0])}</text>
       <text x="${W-pr}" y="${H-3}" text-anchor="end" font-size="8" fill="var(--mu)">${fmt(allDates[allDates.length-1])}</text>`
    : '';

  const legends = [mm, fc].filter(Boolean).map(s => {
    const sign = s.diff >= 0 ? '+' : '';
    const dcol = s.diff >= 0 ? 'var(--green)' : 'var(--red)';
    return `<span><i style="background:${s.col}"></i>${s.label}
      <b style="color:var(--tx)">${s.endVal}</b>
      <span style="color:${dcol};font-size:9px">${sign}${Math.round(s.diff)}</span></span>`;
  }).join('');

  el.innerHTML = `<div class="trend-legend">${legends}</div>
    <svg viewBox="0 0 ${W} ${H}" class="trend-svg">
      ${[0,.33,.67,1].map(f=>`<line x1="${pl}" y1="${(pt+cH*(1-f)).toFixed(1)}" x2="${W-pr}" y2="${(pt+cH*(1-f)).toFixed(1)}" stroke="var(--bd)" stroke-width="1"/>`).join('')}
      ${(mm?.path||'')}${(fc?.path||'')}${(mm?.dots||'')}${(fc?.dots||'')}${xLabels}
    </svg>`;
}

/* ── weekly matches slide ── */
function renderWeeklySlide(trendData) {
  const el = $('d-weekly');
  if (!el) return;
  const cutoff = new Date(Date.now() - 7 * 86400000);
  const week = (trendData || []).filter(d => new Date(d.played_at) >= cutoff).reverse();
  if (!week.length) {
    el.innerHTML = '<div class="weekly-empty">No matches in the last 7 days</div>';
    return;
  }
  const byDay = {};
  week.forEach(d => {
    const day = (d.played_at || '').slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(d);
  });
  el.innerHTML = Object.keys(byDay).sort().reverse().map(day => {
    const dt = new Date(day + 'T12:00:00');
    const lbl = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const rows = byDay[day].map(m => {
      const map = (m.map || '').replace('de_', '').toUpperCase();
      const rc = m.rating >= 75 ? 'g' : m.rating >= 60 ? 'y' : 'r';
      const sign = m.delta >= 0 ? '+' : '';
      const dc = m.delta >= 0 ? 'g' : 'r';
      return `<div class="weekly-match-row">
        <span class="weekly-map">${map}</span>
        <span class="weekly-result ${m.won ? 'w' : 'l'}">${m.won ? 'W' : 'L'}</span>
        <span class="weekly-rating ${rc}">${m.rating ?? '—'}</span>
        <span class="weekly-delta ${dc}">${sign}${Math.round(m.delta ?? 0)}</span>
      </div>`;
    }).join('');
    return `<div class="weekly-day-hdr">${lbl}</div>${rows}`;
  }).join('');
}

/* ── coach brief slide — 3 strengths / 3 weaknesses ── */
let _overviewCoachAnswer = null;
function renderCoachSlide() {
  const el = $('d-coach-slide');
  if (!el) return;
  if (!_overviewCoachAnswer) {
    el.innerHTML = `<div class="coach-tips-empty">
      <div style="margin-bottom:8px;color:var(--mu);font-size:11px">No brief yet</div>
      <button onclick="refreshCoach('overview')" class="icon-btn" style="font-size:11px">↻ Generate brief</button>
      <a href="/companion" class="coach-tips-link">Full coaching →</a>
    </div>`;
    return;
  }

  const tmp = document.createElement('div');
  tmp.innerHTML = _overviewCoachAnswer;

  // Walk headings to find strength / weakness sections
  let strengths = [], weaknesses = [];
  const headings = [...tmp.querySelectorAll('h1,h2,h3,h4')];
  headings.forEach(h => {
    const txt = h.textContent.toLowerCase();
    const isSt = /strength|strong|doing well|positive|great/i.test(txt);
    const isWk = /improve|fix|weak|focus|area|work on|impactful/i.test(txt);
    if (!isSt && !isWk) return;
    const items = [];
    let next = h.nextElementSibling;
    while (next && !/^H[1-4]$/.test(next.tagName)) {
      [...next.querySelectorAll('li')].forEach(li => items.push(li.textContent.trim()));
      next = next.nextElementSibling;
    }
    if (isSt) strengths = [...strengths, ...items];
    else weaknesses = [...weaknesses, ...items];
  });

  // Fallback: split all li items 50/50
  if (!strengths.length && !weaknesses.length) {
    const all = [...tmp.querySelectorAll('li')].map(li => li.textContent.trim());
    const mid = Math.ceil(all.length / 2);
    strengths = all.slice(0, mid);
    weaknesses = all.slice(mid);
  }

  const mkRows = (arr, icon, cls) => arr.slice(0,3).map(t =>
    `<div class="cs3-sw-item"><span class="cs3-sw-icon ${cls}">${icon}</span><span>${t}</span></div>`
  ).join('') || `<div class="cs3-sw-item" style="color:var(--mu);font-size:10px">No data yet</div>`;

  el.innerHTML = `
    <div class="cs3-sw-grid">
      <div class="cs3-sw-col">
        <div class="cs3-sw-hdr strengths">Strengths</div>
        ${mkRows(strengths, '✓', 's')}
      </div>
      <div class="cs3-sw-col">
        <div class="cs3-sw-hdr weaknesses">Fix These</div>
        ${mkRows(weaknesses, '✗', 'w')}
      </div>
    </div>
    <a href="/companion" class="coach-tips-link">Full analysis →</a>`;
}

/* kept for backwards-compat calls (map trend etc.) */
function renderMultiTrend(trend, id) { renderDualTrend(trend, null, id); }

/* ── round phase breakdown chart ── */
function renderPhaseChart(phase) {
  const el = $('m-phase');
  if (!el) return;
  if (!phase || !Object.keys(phase).length) {
    el.innerHTML = '<div style="color:var(--mu);font-size:11px;padding:4px">No phase data</div>';
    return;
  }
  const phaseCol = {early:'#e04444', mid:'#c49020', late:'#4aaa6a'};
  const phaseLabel = {early:'Early', mid:'Mid', late:'Late'};

  const sides = Object.keys(phase).sort();
  const inner = sides.map(side => {
    const d = phase[side];
    const total = (d.early||0) + (d.mid||0) + (d.late||0);
    const rows = ['early','mid','late'].map(ph => {
      const n = d[ph] || 0;
      const pct = total > 0 ? Math.round(100*n/total) : 0;
      return `<div class="phase-bar-row">
        <span class="lbl">${phaseLabel[ph]}</span>
        <div class="phase-bar-wrap"><div class="phase-bar" style="width:${pct}%;background:${phaseCol[ph]}"></div></div>
        <span class="pct">${pct}%</span>
      </div>`;
    }).join('');
    const sideLabel = side === 'CT'
      ? '<span style="color:var(--ct);font-weight:700">CT</span>'
      : '<span style="color:var(--t);font-weight:700">T</span>';
    return `<div class="phase-side"><h4>${sideLabel} — When Do You Die?</h4>${rows}<div style="font-size:10px;color:var(--mu);margin-top:4px">${total} death rounds</div></div>`;
  }).join('');

  el.innerHTML = `<h3 style="margin-bottom:8px">Round Phase Deaths</h3><div class="phase-chart">${inner}</div>`;
}

/* ── flash / utility efficiency ── */
function renderFlashStats(fs) {
  const el = $('m-flash');
  if (!el) return;
  if (!fs || !fs.flashes) {
    el.innerHTML = '<div style="color:var(--mu);font-size:11px;padding:4px">No grenade data</div>';
    return;
  }
  const avgEf = parseFloat(fs.avg_ef) || 0;
  const efCls = avgEf >= 1.5 ? 'g' : avgEf >= 0.8 ? 'y' : 'r';
  const stats = [
    {v: fs.flashes||0,    l: 'Flashes Thrown'},
    {v: `${avgEf.toFixed(2)}<span style="font-size:11px;color:var(--mu)">/throw</span>`, l: 'Enemies Flashed', cls: efCls},
    {v: fs.tf||0,         l: 'Team Flashed',   cls: (fs.tf||0) === 0 ? 'g' : (fs.tf||0) <= 2 ? 'y' : 'r'},
    {v: fs.smokes||0,     l: 'Smokes'},
    {v: fs.mols||0,       l: 'Molotovs'},
    {v: fs.hes||0,        l: 'HE Grenades'},
  ];
  el.innerHTML = `<h3 style="margin-bottom:8px">Utility Efficiency</h3>
    <div class="flash-grid">
      ${stats.map(s=>`<div class="flash-stat">
        <div class="val ${s.cls||''}">${s.v}</div>
        <div class="lbl">${s.l}</div>
      </div>`).join('')}
    </div>`;
}

/* ── predictability score ── */
function computePredictability(deaths, calib) {
  if (!deaths?.length || !calib || deaths.length < 3) return null;
  const G = 24;
  const grid = new Float32Array(G * G);
  for (const d of deaths) {
    const gx = Math.floor((d.x - calib.origin_x) / calib.scale / 1024 * G);
    const gy = Math.floor((calib.origin_y - d.y) / calib.scale / 1024 * G);
    if (gx >= 0 && gx < G && gy >= 0 && gy < G) grid[gy * G + gx]++;
  }
  const total = deaths.length;
  let entropy = 0;
  for (let i = 0; i < G * G; i++) {
    if (grid[i] > 0) { const p = grid[i] / total; entropy -= p * Math.log2(p); }
  }
  const maxEntropy = Math.log2(Math.min(total, G * G));
  return maxEntropy > 0 ? Math.round(entropy / maxEntropy * 100) : 50;
}

/* ── play style card ── */
function renderPlayStyle(sides, weapons) {
  const el = $('m-playstyle');
  if (!el) return;
  if (!sides?.length) { el.innerHTML='<div style="color:var(--mu);font-size:11px;padding:4px">No side data yet</div>'; return; }
  const tS = sides.find(s=>s.side==='T') || {};
  const cS = sides.find(s=>s.side==='CT') || {};
  const awpK = (weapons||[]).find(w=>w.weapon==='awp')?.kills || 0;
  const totalK = (weapons||[]).reduce((s,w)=>s+(w.kills||0),0);
  const awpPct = totalK > 0 ? awpK/totalK*100 : 0;
  const tUtil = parseFloat(tS.util_per_round)||0;
  const cUtil = parseFloat(cS.util_per_round)||0;
  const avgUtil = (tUtil+cUtil)/2;
  const tEntry = parseFloat(tS.opening_kill_pct)||0;
  const tDeath = parseFloat(tS.opening_death_pct)||0;

  let role, roleDesc, roleCol;
  if (awpPct > 22) {
    role='AWPer'; roleDesc=`${awpPct.toFixed(0)}% of kills with AWP`; roleCol='#4e9ed4';
  } else if (tEntry > 42) {
    role='Entry Fragger'; roleDesc=`Opens ${tEntry}% of T-side rounds`; roleCol='#e07828';
  } else if (avgUtil > 1.8) {
    role='Support'; roleDesc=`${avgUtil.toFixed(1)} nades/round avg`; roleCol='#c49020';
  } else if (tDeath > 40) {
    role='Baiter'; roleDesc=`High opening death rate (${tDeath}%) — letting teammates go first`; roleCol='#e04444';
  } else {
    role='Rifler'; roleDesc='Balanced, rifle-focused play style'; roleCol='#4aaa6a';
  }

  const metrics = [
    {l:'T Entry Rate', v:tEntry, u:'%', good:v=>v>40, warn:v=>v>25},
    {l:'CT Win Rate',  v:parseFloat(cS.round_win_pct)||null, u:'%', good:v=>v>55, warn:v=>v>45},
    {l:'Util/Round',  v:avgUtil>0?avgUtil.toFixed(1):null, u:'', good:v=>v>2, warn:v=>v>1},
    {l:'Early Deaths',v:Math.round(((parseFloat(tS.early_death_pct)||0)+(parseFloat(cS.early_death_pct)||0))/2)||null, u:'%', good:v=>v<20, warn:v=>v<35},
  ];

  el.innerHTML = `<div class="ps-card">
    <div class="ps-role">
      <div class="ps-role-name" style="color:${roleCol}">${role}</div>
      <div class="ps-role-desc">${roleDesc}</div>
    </div>
    <div class="ps-metrics">
      ${metrics.map(m=>{
        const v = m.v!=null ? parseFloat(m.v) : null;
        const cls = v!=null ? (m.good(v)?'g':m.warn(v)?'y':'r') : '';
        return `<div class="ps-metric">
          <div class="val ${cls}">${v!=null?v+m.u:'—'}</div>
          <div class="lbl">${m.l}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

/* ── death pattern dot overlay ── */
let _dpData = null, _dpCalib = null, _dpMap = null;

async function loadDeathPatterns(map, days) {
  _dpMap = map;
  try {
    const [dp, cal] = await Promise.all([
      fetch(`/api/death_patterns?map=${encodeURIComponent(map)}&days=${days}`).then(r=>r.json()),
      fetch(`/api/radar_calibration?map=${encodeURIComponent(map)}`).then(r=>r.json()),
    ]);
    _dpData = dp;
    _dpCalib = cal;
    renderDeathDots();
  } catch(e) { console.error('death patterns:', e); }
}

function renderDeathDots() {
  const img = $('i-deaths');
  const canvas = $('dp-canvas');
  if (!img || !canvas || !_dpData || !_dpCalib) return;
  const W = img.offsetWidth || img.clientWidth;
  const H = img.offsetHeight || img.clientHeight;
  if (!W || !H) return;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  const c = _dpCalib;
  for (const d of _dpData) {
    const px = (d.x - c.origin_x) / c.scale / 1024 * W;
    const py = (c.origin_y - d.y) / c.scale / 1024 * H;
    if (px<0||px>W||py<0||py>H) continue;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI*2);
    ctx.fillStyle = d.side==='CT' ? '#4e9ed4' : '#d4804a';
    ctx.fill();
    if (d.headshot) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#f0c060';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Predictability badge
  const score = computePredictability(_dpData, _dpCalib);
  const badgeEl = $('predict-badge');
  if (badgeEl && score != null) {
    const cls = score < 35 ? 'r' : score < 60 ? 'y' : 'g';
    const label = score < 35 ? 'Predictable' : score < 60 ? 'Moderate' : 'Varied';
    badgeEl.className = `predict-badge ${cls}`;
    badgeEl.textContent = `${score}% — ${label}`;
    badgeEl.title = 'How varied your death locations are. Low = you die in the same spots.';
  }
}

/* ── main load ── */
// ── Today's Focus card ───────────────────────────────────────────────────────
async function loadFocus() {
  try {
    const d = await fetch('/api/todays_focus').then(r=>r.json());
    const card = $('focus-card');
    if (!d.focus) { card.style.display='none'; return; }
    card.style.display='';
    $('focus-label').textContent = d.focus.label;
    const f = d.focus, p = d.progress;
    let nums = `<span class="focus-num"><b>${f.baseline ?? '—'}</b> when assigned</span>` +
               `<span class="focus-num">target <b>${d.threshold ?? '—'}</b></span>`;
    if (p && p.current != null) {
      const cls = p.delta == null ? '' : (p.delta > 0 ? 'focus-up' : 'focus-down');
      const arrow = p.delta == null ? '' : (p.delta > 0 ? '▲' : '▼');
      nums += `<span class="focus-num ${cls}">now <b>${p.current}</b> ${arrow}` +
              (p.delta != null ? ` ${Math.abs(p.delta)}` : '') +
              ` <i>(${p.sample} samples since)</i></span>`;
    }
    $('focus-numbers').innerHTML = nums;
    $('focus-advice').innerHTML = f.advice_html || '';
    $('focus-drill').innerHTML = f.drill
      ? `<span class="focus-drill-chip">DRILL</span> ${_escHtml(f.drill)}` : '';
  } catch(e) { console.error('focus', e); }
}

async function refreshFocus() {
  const card = $('focus-card');
  card.style.opacity = .5;
  try { await fetch('/api/refresh_focus', {method:'POST'}); await loadFocus(); }
  finally { card.style.opacity = 1; }
}

async function load() {
  const side='all', days=sel('s-days');

  if (currentTab==='overview') {
    if (!coachLoaded['overview']) {
      coachLoaded['overview'] = true;
      loadCoachBrief('overview','coach-body-overview','coach-ts-overview','coach-q-overview');
      loadFocus();
    }
    try {
      const d = await fetch(`/api/stats?side=${side}&days=${days}`).then(r=>r.json());
      populateTabs(d.maps);  // d.maps is already combined MM+FACEIT from backend
      renderKPIs(d.kpis||{}, d.curr_kpis, d.prev_kpis);
      renderSession(d.session, d.kpis);
      renderForm(d.recent_form,'d-form',false);
      renderMaps(d.maps_stats, d.faceit_maps_stats||[], d.rating_trend);
      _updateMapTiles([...(d.maps_stats||[]), ...(d.faceit_maps_stats||[]).filter(f=>
        !(d.maps_stats||[]).find(m=>m.map===f.map))]);
      _rankTrendData = d.rating_trend;
      _applyRankToggle();
      renderWeapons(d.weapons,'d-wpn');
      renderPitfalls(d.pitfalls,'d-pit-wrap');
      _updatePlayerCard(d.kpis || {});
      renderWeeklySlide(d.rating_trend);
      renderTodayPerf(d.session);
      renderPlatformComparison(d, days);
      // New FACEIT-style overview
      renderOvIdentity(d.kpis || {});
      renderOvStatCards(d.kpis || {}, d.curr_kpis, d.prev_kpis, d.rating_trend);
      // Mirror loadPlayerProfile avatar/name to new identity strip after a tick
      setTimeout(() => {
        const ovAvatar = $('ov-avatar'), pcAvatar = $('pc-avatar');
        if (ovAvatar && pcAvatar && pcAvatar.textContent) ovAvatar.textContent = pcAvatar.textContent;
        const ovName = $('ov-name'), pcName = $('pc-name');
        if (ovName && pcName && pcName.textContent) ovName.textContent = pcName.textContent;
      }, 200);
    } catch(e) { console.error(e); }

  } else {
    const map=currentTab;
    if (!map.startsWith('de_')) {
      const mt = $('map-title'); if (mt) mt.textContent = '← Select a map from Overview';
      const mw = $('m-warn'); if (mw) mw.style.display = 'none';
      const mv = $('m-verdict'); if (mv) mv.innerHTML = '';
      return;
    }
    refreshMapImages();

    if (!coachLoaded[map]) {
      coachLoaded[map] = true;
      loadCoachBrief(map,'coach-body-map','coach-ts-map','coach-q-map');
    }
    loadFundamentals(map);

    try {
      const [md, lu, al] = await Promise.all([
        fetch(`/api/map_detail?map=${map}&side=${side}&days=${days}`).then(r=>r.json()),
        fetch(`/api/lineups?map=${map}`).then(r=>r.json()),
        fetch(`/api/auto_lineups?map=${map}&min_count=2`).then(r=>r.json()).catch(()=>[]),
      ]);
      // Reset coaching bar for new map
      _coachBarPriority = 0;
      const _cb = $('m-coaching-bar'); if (_cb) _cb.style.display = 'none';
      showWarning(md.kpis?.matches);
      renderPlayStyle(md.sides||[], md.weapons||[]);
      renderMapKPIs(md.kpis||{}, md.curr_kpis, md.prev_kpis);
      renderVerdict(md.kpis||{}, md.sides||[], md.score_trend||[]);
      renderSides(md.sides||[]);
      renderWeapons(md.weapons,'m-wpn');
      renderPhaseChart(md.phase_breakdown||{});
      renderFlashStats(md.flash_stats||{});
      renderPitfalls(md.pitfalls,'m-pit',3);
      renderEconomy(md.economy||{});
      renderClutch(md.clutch||{});
      renderForm(md.recent_form,'m-form',true);
      renderMultiTrend(md.score_trend,'m-trend');
      renderFaceitMapPanel(md.faceit_kpis||{}, md.faceit_form||[]);
      lineupData = lu||[];
      renderLineups(lineupData, lineupFilter);
      renderAutoLineups(al||[]);
      loadDeathPatterns(map, days);
      renderDuelBreakdown(map, days);
      renderCombatProfile(map, days);
      renderConsistency(map, days);
      renderEconAdvisor(map, days);
      renderAimProfile(map, days);
    } catch(e) { console.error(e); }
  }
}

['s-days'].forEach(id=>$(id).addEventListener('change', load));
load();
loadPlayerProfile();

/* ── Map fundamentals guide ── */
let _fundLoadedFor = null;
async function loadFundamentals(map, refresh = 0) {
  if (!map || (!refresh && _fundLoadedFor === map)) return;
  const body = $('fund-body'), nameEl = $('fund-map-name');
  if (!body) return;
  if (nameEl) nameEl.textContent = (map||'').replace('de_','').toUpperCase();
  body.innerHTML = '<div class="spin">' +
    (refresh ? 'Regenerating map guide…' : 'Loading map guide…') + '</div>';
  try {
    const d = await fetch(`/api/map_fundamentals?map=${map}&refresh=${refresh}`).then(r=>r.json());
    body.innerHTML = d.html || '<p>No guide available.</p>';
    _fundLoadedFor = map;
  } catch(e) {
    body.innerHTML = '<p style="color:var(--mu)">Map guide unavailable.</p>';
  }
}

/* ── FACEIT map panel ── */
function renderFaceitMapPanel(kpis, form) {
  const wrap = $('m-faceit-wrap');
  if (!wrap) return;
  if (!kpis.matches) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';

  const eloStr = kpis.latest_elo ? `ELO ${kpis.latest_elo} · ` : '';
  const multis = [
    kpis.triple_kills ? `${kpis.triple_kills} 3K` : null,
    kpis.quadro_kills ? `${kpis.quadro_kills} 4K` : null,
    kpis.penta_kills  ? `${kpis.penta_kills} ACE` : null,
  ].filter(Boolean).join(' · ');

  const kpiHtml = `
    <div class="fc-map-kpis">
      <div class="fc-map-kpi"><div class="val">${kpis.matches}</div><div class="lbl">Matches</div></div>
      <div class="fc-map-kpi"><div class="val ${sc(kpis.win_pct,55,45)}">${kpis.win_pct??'—'}%</div><div class="lbl">Win %</div></div>
      <div class="fc-map-kpi"><div class="val ${sc(kpis.kd,1.1,0.9)}">${kpis.kd??'—'}</div><div class="lbl">K / D</div></div>
      <div class="fc-map-kpi"><div class="val ${sc(kpis.adr,85,70)}">${kpis.adr??'—'}</div><div class="lbl">ADR</div></div>
      <div class="fc-map-kpi"><div class="val">${kpis.hs_pct??'—'}%</div><div class="lbl">HS %</div></div>
      ${kpis.opening_win_pct!=null?`<div class="fc-map-kpi"><div class="val ${sc(kpis.opening_win_pct,55,45)}">${kpis.opening_win_pct}%</div><div class="lbl">Entry Win %</div></div>`:''}
    </div>
    ${multis ? `<div class="fc-multis">${multis}</div>` : ''}`;

  const formHtml = form.length ? `
    <table class="fc-form-table">
      <thead><tr><th>When</th><th>R</th><th>Score</th><th>K/D</th><th>ADR</th><th>ELO</th></tr></thead>
      <tbody>${form.map(r => {
        const eloChg = r.elo_change != null
          ? `<span style="color:${r.elo_change>=0?'var(--green)':'var(--red)'}"> ${r.elo_change>=0?'+':''}${r.elo_change}</span>` : '';
        return `<tr>
          <td style="color:var(--mu);font-size:10px">${r.when}</td>
          <td class="${r.won?'w':'l'}">${r.won?'W':'L'}</td>
          <td>${r.team_score}:${r.opp_score}</td>
          <td class="${sc(r.kd,1.1,0.9)}">${r.kd??'—'}</td>
          <td class="${sc(r.adr,85,70)}">${r.adr??'—'}</td>
          <td style="font-size:10px">${r.faceit_elo??'—'}${eloChg}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>` : '<div class="spin" style="font-size:11px">No FACEIT matches on this map</div>';

  $('m-faceit-kpis').innerHTML = kpiHtml;
  $('m-faceit-form').innerHTML = formHtml;
}

/* ── duel breakdown ── */
async function renderDuelBreakdown(map, days) {
  const el = $('m-duel');
  if (!el) return;
  el.innerHTML = '<div class="spin">Loading…</div>';
  try {
    const d = await fetch(`/api/duel_breakdown?map=${map}&days=${days}`).then(r=>r.json());
    if (!d || !d.deaths_by_weapon?.length) {
      el.innerHTML = '<div class="spin">No data yet</div>';
      return;
    }
    const topDeaths = d.deaths_by_weapon.slice(0,6);
    const topKills  = d.kills_by_weapon.slice(0,6);
    const hsColor = (hs, tot) => {
      const p = tot>0 ? hs/tot : 0;
      return p>=0.5 ? 'var(--green)' : p>=0.3 ? '#c49020' : 'var(--mu)';
    };
    const deathRows = topDeaths.map(w=>
      `<tr><td>${w.weapon}</td><td class="r">${w.n}</td><td style="color:${hsColor(w.hs,w.n)}">${w.n>0?Math.round(100*w.hs/w.n):0}%</td></tr>`
    ).join('');
    const killRows  = topKills.map(w=>
      `<tr><td>${w.weapon}</td><td class="g">${w.n}</td><td style="color:${hsColor(w.hs,w.n)}">${w.n>0?Math.round(100*w.hs/w.n):0}%</td></tr>`
    ).join('');
    el.innerHTML = `
      <div class="grid col2" style="gap:12px">
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--red);margin-bottom:4px">Killed By</div>
          <table><thead><tr><th>Weapon</th><th>Deaths</th><th>HS%</th></tr></thead><tbody>${deathRows}</tbody></table>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--green);margin-bottom:4px">Kills With</div>
          <table><thead><tr><th>Weapon</th><th>Kills</th><th>HS%</th></tr></thead><tbody>${killRows}</tbody></table>
        </div>
      </div>`;
  } catch(e) { el.innerHTML = `<div class="spin">Error: ${e.message}</div>`; }
}

/* ── combat profile: opening duels, trade discipline, clutch ── */
async function renderCombatProfile(map, days) {
  ['m-opening-duel','m-trade-disc','m-clutch-profile'].forEach(id => {
    const el = $(id);
    if (el) el.innerHTML = '<div class="spin">Loading…</div>';
  });
  try {
    const d = await fetch(`/api/combat_profile?map=${encodeURIComponent(map)}&days=${days}`).then(r=>r.json());
    _renderOpeningDuel(d.opening || {});
    _renderTradeDisc(d.trade || {});
    _renderClutchProfile(d.clutch || {});
    // Surface worst signal in the coaching callout bar
    const ow = parseFloat((d.opening || {}).open_wr);
    const sp = parseFloat((d.trade || {}).spray_waste_rate);
    const inv = parseInt((d.opening || {}).involved_rounds) || 0;
    if (!isNaN(ow) && inv >= 5) {
      if (ow < 40) _updateCoachBar(`Opening win rate ${ow.toFixed(0)}% — only take duels from spots where you hold the angle`, 3);
      else if (ow < 52) _updateCoachBar(`Opening win rate ${ow.toFixed(0)}% — pre-aim common positions before peeking`, 2);
    }
    if (!isNaN(sp) && sp > 25) _updateCoachBar(`Spray waste ${sp.toFixed(0)}% — burst fire to convert high-damage rounds into kills`, 1);
  } catch(e) {
    ['m-opening-duel','m-trade-disc','m-clutch-profile'].forEach(id => {
      const el = $(id);
      if (el) el.innerHTML = `<div class="spin">Error: ${e.message}</div>`;
    });
  }
}

function _renderOpeningDuel(o) {
  const el = $('m-opening-duel');
  if (!el) return;
  const inv = parseInt(o.involved_rounds) || 0;
  if (!inv) {
    el.innerHTML = '<div class="spin" style="font-size:11px">No opening duel data yet for this map/period</div>';
    return;
  }
  const fmt = v => v != null ? v + '%' : '—';
  const cls = v => {
    const n = parseFloat(v);
    return isNaN(n) ? '' : n >= 55 ? 'g' : n >= 40 ? 'y' : 'r';
  };
  const openWR       = o.open_wr;
  const openedOnWR   = o.opened_on_wr;
  const openRate     = o.open_rate;
  const openerRounds = parseInt(o.opener_rounds) || 0;
  const openedRounds = parseInt(o.opened_on_rounds) || 0;

  // Coaching tip driven by the numbers
  let tip = '';
  const owr = parseFloat(openWR);
  const eowr = parseFloat(openedOnWR);
  if (!isNaN(owr) && openerRounds >= 5) {
    if (owr >= 60)      tip = `Strong opener — ${fmt(openWR)} win rate when you pull the trigger first.`;
    else if (owr >= 45) tip = `Inconsistent opener — ${fmt(openWR)} is below the 60% target. Prioritise better angle selection before peeking.`;
    else                tip = `Avoid opening duels on this map until fundamentals improve — ${fmt(openWR)} is below average.`;
  }

  el.innerHTML = `
    <div class="grid col2" style="gap:16px">
      <div>
        <div class="combat-section-lbl" style="color:var(--green)">When You Open</div>
        <div class="stat-row"><span class="sk">Rounds as opener</span><span class="sv">${openerRounds}</span></div>
        <div class="stat-row"><span class="sk">Open rate (of duels)</span><span class="sv">${fmt(openRate)}</span></div>
        <div class="stat-row"><span class="sk">Win rate when you open</span><span class="sv ${cls(openWR)}">${fmt(openWR)}</span></div>
      </div>
      <div>
        <div class="combat-section-lbl" style="color:var(--red)">When Opened On</div>
        <div class="stat-row"><span class="sk">Times opened on</span><span class="sv">${openedRounds}</span></div>
        <div class="stat-row"><span class="sk">Win rate after being opened</span><span class="sv ${cls(openedOnWR)}">${fmt(openedOnWR)}</span></div>
        <div class="stat-row" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--bd)">
          <span style="font-size:10px;color:var(--mu2)">Involved in ${inv} opening duels total</span>
        </div>
      </div>
    </div>
    ${tip ? `<div class="combat-tip">${tip}</div>` : ''}`;
}

function _renderTradeDisc(t) {
  const el = $('m-trade-disc');
  if (!el) return;
  const total = parseInt(t.total_rounds) || 0;
  if (!total) {
    el.innerHTML = '<div class="spin" style="font-size:11px">No trade data yet</div>';
    return;
  }
  const tradeRate     = parseFloat(t.trade_rate)      || 0;
  const sprayRate     = parseFloat(t.spray_waste_rate) || 0;
  const tradeGood     = tradeRate >= 55;
  const tradeOk       = tradeRate >= 40;
  const sprayGood     = sprayRate <= 15;
  const sprayOk       = sprayRate <= 25;
  const tradeCls      = tradeGood ? 'g' : tradeOk ? 'y' : 'r';
  const sprayCls      = sprayGood ? 'g' : sprayOk  ? 'y' : 'r';

  const gauge = (pct, cls, max=100) => {
    const w = Math.min(100, Math.round(pct / max * 100));
    const colors = {g:'var(--green)', y:'#c49020', r:'var(--red)'};
    return `<div class="td-gauge-wrap">
      <div class="td-gauge-bar" style="width:${w}%;background:${colors[cls]||'var(--mu)'}"></div>
    </div>`;
  };

  const tradeTip = tradeGood
    ? `Trade rate ${t.trade_rate}% — you're closing out fights you start.`
    : tradeOk
    ? `Trade rate ${t.trade_rate}% is borderline. Aim for 55%+ by cleaning up damaged targets before moving on.`
    : `Low trade rate (${t.trade_rate}%) — you leave wounded enemies alive too often. Stop when you damage someone; finish the fight.`;

  const sprayTip = sprayGood
    ? `Fight conversion ${t.spray_waste_rate}% — minimal wasted damage.`
    : sprayOk
    ? `Fight conversion ${t.spray_waste_rate}% is above average. Work on burst control to turn damage into kills.`
    : `High conversion waste (${t.spray_waste_rate}%) — heavy damage with no kill in too many rounds. Burst fire and pre-aim before committing.`;

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
          <span style="font-size:11px;font-weight:600">Trade Rate</span>
          <span class="sv ${tradeCls}" style="font-size:16px;font-weight:700">${t.trade_rate ?? '—'}%</span>
        </div>
        ${gauge(tradeRate, tradeCls)}
        <div style="font-size:10px;color:var(--mu);margin-top:3px">Target: ≥55% &nbsp;·&nbsp; ${t.traded ?? 0} trades in ${total} rounds</div>
        <div class="combat-tip" style="margin-top:6px">${tradeTip}</div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
          <span style="font-size:11px;font-weight:600">Spray Waste Rate</span>
          <span class="sv ${sprayCls}" style="font-size:16px;font-weight:700">${t.spray_waste_rate ?? '—'}%</span>
        </div>
        ${gauge(sprayRate, sprayCls)}
        <div style="font-size:10px;color:var(--mu);margin-top:3px">Target: ≤15% &nbsp;·&nbsp; ${t.spray_wasted ?? 0} wasted rounds in ${total}</div>
        <div class="combat-tip" style="margin-top:6px">${sprayTip}</div>
      </div>
    </div>`;
}

function _renderClutchProfile(c) {
  const el = $('m-clutch-profile');
  if (!el) return;
  const tiers = [
    ['1v1', parseInt(c.v1_won)||0,  parseInt(c.v1_total)||0],
    ['1v2', parseInt(c.v2_won)||0,  parseInt(c.v2_total)||0],
    ['1v3+',parseInt(c.v3p_won)||0, parseInt(c.v3p_total)||0],
  ].filter(([,, t]) => t > 0);

  if (!tiers.length) {
    el.innerHTML = '<div class="spin" style="font-size:11px">No clutch data yet for this map/period</div>';
    return;
  }

  const pct = (w, t) => t > 0 ? Math.round(100 * w / t) : 0;
  const cls = (w, t) => {
    const p = pct(w, t);
    return p >= 55 ? 'g' : p >= 35 ? 'y' : 'r';
  };

  const totalAttempts = tiers.reduce((s,[,,t]) => s + t, 0);
  const totalWon      = tiers.reduce((s,[,w]) => s + w, 0);
  const overallPct    = totalAttempts > 0 ? Math.round(100 * totalWon / totalAttempts) : 0;

  const rows = tiers.map(([label, won, total]) => {
    const p = pct(won, total);
    const c2 = cls(won, total);
    const colors = {g:'var(--green)', y:'#c49020', r:'var(--red)'};
    return `<div class="clutch-row">
      <span class="clutch-label">${label}</span>
      <div class="clutch-bar-wrap">
        <div class="clutch-bar" style="width:${p}%;background:${colors[c2]||'var(--mu)'}"></div>
      </div>
      <span class="sv ${c2}" style="min-width:36px;text-align:right">${p}%</span>
      <span style="font-size:10px;color:var(--mu);min-width:54px;text-align:right">${won}/${total}</span>
    </div>`;
  }).join('');

  let tip = '';
  if (totalAttempts >= 5) {
    if (overallPct >= 50)     tip = `Solid clutch player — ${overallPct}% overall across ${totalAttempts} situations.`;
    else if (overallPct >= 35) tip = `Average clutch rate (${overallPct}%). In 1vX situations: delay, gather info, reset utility before peeking.`;
    else                       tip = `Low clutch rate (${overallPct}%) — avoid panic peeking in 1vX. Play time, wait for the bomb tick, and isolate duels one at a time.`;
  }

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
      <span style="font-size:11px;font-weight:600">${totalAttempts} clutch situation${totalAttempts!==1?'s':''}</span>
      <span class="sv ${cls(totalWon, totalAttempts)}" style="font-size:16px;font-weight:700">${overallPct}% overall</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">${rows}</div>
    ${tip ? `<div class="combat-tip" style="margin-top:10px">${tip}</div>` : ''}`;
}

/* ── consistency sparkline ── */
async function renderConsistency(map, days) {
  const el = $('m-consistency');
  if (!el) return;
  el.innerHTML = '<div class="spin">Loading…</div>';
  try {
    const data = await fetch(`/api/consistency?map=${encodeURIComponent(map)}&days=${days * 2}`).then(r=>r.json());
    if (!data?.length) {
      el.innerHTML = '<h3 style="margin-bottom:8px">Consistency</h3><div class="spin" style="font-size:11px">Not enough matches yet</div>';
      return;
    }

    const latest = data[data.length - 1];
    const cv     = latest.cv != null ? parseFloat(latest.cv) : null;
    // Consistency score: 1 - cv, clamped 0-1, shown as 0-100
    const score  = cv != null ? Math.max(0, Math.min(100, Math.round((1 - cv) * 100))) : null;
    const cls    = score == null ? '' : score >= 70 ? 'g' : score >= 50 ? 'y' : 'r';

    let tip = '';
    if (cv != null && latest.window_n >= 5) {
      if (cv < 0.25)      tip = `Very consistent — kills vary ${Math.round(cv*100)}% around your average. You show up every game.`;
      else if (cv < 0.45) tip = `Moderate variance (${Math.round(cv*100)}%). Some games are outliers. Focus on floor, not ceiling.`;
      else                tip = `High variance (${Math.round(cv*100)}%) — you're spiking high and crashing low. 12 stable rounds beats two 20-bomb halves.`;
    }

    // SVG sparkline of kills per match
    const W=380, H=72, pl=6, pr=6, pt=8, pb=4;
    const iW = W-pl-pr, iH = H-pt-pb;
    const kills = data.map(d => d.kills);
    const minK = Math.min(...kills), maxK = Math.max(...kills);
    const range = (maxK - minK) || 1;

    function xp(i) { return pl + (data.length <= 1 ? iW/2 : i * iW / (data.length - 1)); }
    function yp(v) { return pt + iH * (1 - (v - minK) / range); }

    const avgKills = kills.reduce((a,b)=>a+b,0) / kills.length;
    const avgY = yp(avgKills).toFixed(1);

    let segs = '';
    for (let i = 1; i < data.length; i++) {
      const col = data[i].kills >= avgKills ? '#4aaa6a' : '#e07828';
      segs += `<line x1="${xp(i-1).toFixed(1)}" y1="${yp(data[i-1].kills).toFixed(1)}" x2="${xp(i).toFixed(1)}" y2="${yp(data[i].kills).toFixed(1)}" stroke="${col}" stroke-width="1.8" stroke-linecap="round"/>`;
    }
    const dots = data.map((d, i) => {
      const col = d.won ? '#4aaa6a' : '#c44040';
      return `<circle cx="${xp(i).toFixed(1)}" cy="${yp(d.kills).toFixed(1)}" r="2.5" fill="${col}" stroke="#0d0e11" stroke-width="1"><title>${d.kills}K (${d.won?'W':'L'})</title></circle>`;
    }).join('');

    el.innerHTML = `
      <h3 style="margin-bottom:8px;display:flex;align-items:baseline;gap:10px">
        Consistency
        ${score != null ? `<span class="sv ${cls}" style="font-size:20px;font-weight:800">${score}</span><span style="font-size:10px;color:var(--mu)">/ 100</span>` : ''}
        <span style="font-size:10px;color:var(--mu);margin-left:auto">last ${data.length} matches on ${map.replace('de_','').toUpperCase()}</span>
      </h3>
      <svg viewBox="0 0 ${W} ${H}" class="cons-svg">
        <line x1="${pl}" y1="${avgY}" x2="${W-pr}" y2="${avgY}" stroke="#444" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
        ${segs}${dots}
      </svg>
      <div style="display:flex;gap:12px;font-size:9px;color:var(--mu);margin-top:3px">
        <span><span style="color:#4aaa6a">●</span> Win</span>
        <span><span style="color:#c44040">●</span> Loss</span>
        <span style="color:#6a6a7a">avg kills: ${avgKills.toFixed(1)}</span>
      </div>
      ${tip ? `<div class="combat-tip" style="margin-top:6px">${tip}</div>` : ''}`;
  } catch(e) {
    el.innerHTML = `<div class="spin">Error: ${e.message}</div>`;
  }
}

/* ── economy advisor ── */
async function renderEconAdvisor(map, days) {
  const el = $('m-econ-advisor');
  if (!el) return;
  el.innerHTML = '<div class="spin">Loading…</div>';
  try {
    const d = await fetch(`/api/economy_advisor?map=${encodeURIComponent(map)}&days=${days}`).then(r=>r.json());
    if (!d || !d.total_rounds) {
      el.innerHTML = '<div class="spin" style="font-size:11px">No economy data yet</div>';
      return;
    }

    const fmt = (v, suffix='%') => v != null ? v + suffix : '—';
    const gcls = (v, goodThresh, badThresh) => {
      if (v == null) return '';
      return v <= goodThresh ? 'g' : v <= badThresh ? 'y' : 'r';
    };

    const bfRate  = d.bad_force_rate;
    const fsRate  = d.failed_save_rate;
    const ewRate  = d.eco_win_rate;
    const nuRate  = d.no_util_rate;

    const bfTip = bfRate == null ? '' : bfRate <= 15
      ? `Force discipline is solid — only ${d.bad_forces} wasteful forces in ${d.force_rounds} attempts.`
      : bfRate <= 30
      ? `${bfRate}% of force buys contributed <50 damage before the round ended. Prefer saving when the gap is wide.`
      : `${d.bad_forces} out of ${d.force_rounds} forces were wasted (${bfRate}%). Force-buying into full-buys almost always loses you both the round and the money.`;

    const fsTip = fsRate == null ? '' : fsRate <= 20
      ? `Good save discipline — only ${d.failed_saves} rifles/kits lost in ${d.save_attempts} losable rounds.`
      : fsRate <= 40
      ? `${fsRate}% of your expensive guns are being lost in losing rounds. Use shift-walk near bomb and prioritize survival over taking extra fights.`
      : `High kit-loss rate (${fsRate}%) — ${d.failed_saves} of ${d.save_attempts} expensive kits were lost. This bleeds $${Math.round(d.failed_saves * 2700)} across the match.`;

    const nuTip = nuRate == null ? '' : nuRate <= 15
      ? `Good utility usage — rarely buying and not throwing.`
      : nuRate <= 30
      ? `${nuRate}% of buy rounds you threw nothing. A smoke or flash costs $300 and can win a round.`
      : `${nuRate}% of full-buy rounds you used zero utility. That's ${d.no_util_rounds} rounds of free info/coverage left on the table.`;

    const metrics = [
      { label: 'Bad Force Rate',    val: bfRate,  good: 15,  bad: 30,  count: `${d.bad_forces} / ${d.force_rounds} forces`,  tip: bfTip  },
      { label: 'Failed Save Rate',  val: fsRate,  good: 20,  bad: 40,  count: `${d.failed_saves} / ${d.save_attempts} saves`, tip: fsTip  },
      { label: 'Eco Win Rate',      val: ewRate,  good: 999, bad: 999, count: `${d.eco_wins} / ${d.eco_rounds} ecos`,        tip: null,  invert: true },
      { label: 'No-Util Buy Rate',  val: nuRate,  good: 15,  bad: 30,  count: `${d.no_util_rounds} / ${d.buy_rounds} rounds`,tip: nuTip  },
    ];

    const cards = metrics.map(m => {
      const cls = m.invert
        ? (m.val == null ? '' : m.val >= 25 ? 'g' : m.val >= 15 ? 'y' : 'r')
        : gcls(m.val, m.good, m.bad);
      return `<div class="econ-card">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="font-size:10px;font-weight:600">${m.label}</span>
          <span class="sv ${cls}" style="font-size:18px;font-weight:700">${fmt(m.val)}</span>
        </div>
        <div style="font-size:10px;color:var(--mu);margin-top:2px">${m.count}</div>
        ${m.tip ? `<div class="combat-tip" style="margin-top:5px">${m.tip}</div>` : ''}
      </div>`;
    }).join('');

    el.innerHTML = `<div class="econ-grid">${cards}</div>`;
  } catch(e) {
    el.innerHTML = `<div class="spin">Error: ${e.message}</div>`;
  }
}

/* ── aim profile (crosshair placement proxy) ── */
async function renderAimProfile(map, days) {
  const el = $('m-aim-profile');
  if (!el) return;
  el.innerHTML = '<div class="spin">Loading…</div>';
  try {
    const d = await fetch(`/api/aim_profile?map=${encodeURIComponent(map)}&days=${days}`).then(r=>r.json());
    const overall = parseFloat(d.overall_hs) || 0;
    const bands = [
      { key: 'close', label: 'Close  (<400u)',  target: 55, note: 'head-level at close range' },
      { key: 'mid',   label: 'Mid  (400-1200u)',target: 45, note: 'consistent crosshair at mid' },
      { key: 'far',   label: 'Far  (>1200u)',   target: 35, note: 'pre-aim corners at range' },
    ];

    const hasData = bands.some(b => (d[b.key]?.kills || 0) > 0);
    if (!hasData) {
      el.innerHTML = '<div class="spin" style="font-size:11px">No aim data yet for this map/period</div>';
      return;
    }

    let worstGap = null, worstBand = null;
    const rows = bands.map(b => {
      const bkt   = d[b.key] || {};
      const hs    = parseFloat(bkt.hs_pct) || 0;
      const n     = parseInt(bkt.kills) || 0;
      const cls   = n === 0 ? '' : hs >= b.target ? 'g' : hs >= b.target - 15 ? 'y' : 'r';
      const w     = n === 0 ? 0 : Math.min(100, Math.round(hs));
      const colors= {g:'var(--green)', y:'#c49020', r:'var(--red)'};
      const gap   = b.target - hs;
      if (n >= 3 && gap > 0 && (worstGap == null || gap > worstGap)) {
        worstGap = gap; worstBand = b;
      }
      return `<div class="aim-row">
        <span class="aim-label">${b.label}</span>
        <div class="aim-bar-wrap">
          <div class="aim-bar" style="width:${w}%;background:${colors[cls]||'var(--mu)'}"></div>
          <div class="aim-target-line" style="left:${b.target}%"></div>
        </div>
        <span class="sv ${cls}" style="min-width:38px;text-align:right">${n>0?hs+'%':'—'}</span>
        <span style="font-size:10px;color:var(--mu);min-width:48px;text-align:right">${n} kills</span>
      </div>`;
    }).join('');

    let tip = '';
    if (worstBand) {
      const bkt = d[worstBand.key] || {};
      const hs  = parseFloat(bkt.hs_pct) || 0;
      if (worstBand.key === 'close') {
        tip = `Close-range HS rate ${hs}% (target: ${worstBand.target}%). At close range, crosshair should be pre-aimed at head height before the peek. If it's at chest level you lose the duel before you fire.`;
      } else if (worstBand.key === 'mid') {
        tip = `Mid-range HS rate ${hs}% (target: ${worstBand.target}%). Walk-peeking with crosshair at head height should yield ~45%+ HS. Consider counter-strafing before shooting.`;
      } else {
        tip = `Long-range HS rate ${hs}% (target: ${worstBand.target}%). Pre-aim known angles at head height and use single-shot or burst to land clean shots.`;
      }
    }

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
        <span style="font-size:11px;font-weight:600">Headshot % by Engagement Distance</span>
        <span style="font-size:10px;color:var(--mu)">overall HS ${overall}%</span>
      </div>
      <div style="font-size:9px;color:var(--mu);margin-bottom:8px">Bar = your HS% · Vertical line = target</div>
      <div style="display:flex;flex-direction:column;gap:10px">${rows}</div>
      ${tip ? `<div class="combat-tip" style="margin-top:10px">${tip}</div>` : ''}`;
  } catch(e) {
    el.innerHTML = `<div class="spin">Error: ${e.message}</div>`;
  }
}

/* ── auto-detected lineups ── */
function renderAutoLineups(data) {
  const el = $('m-lineups');
  if (!el || !data.length) return;
  const savedEl = el.innerHTML || '';
  const autoHtml = `<div style="margin-top:10px;border-top:1px solid var(--bd);padding-top:8px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mu);margin-bottom:4px">Detected Repeats</div>
    ${data.map(r=>`
      <div class="auto-lu-row">
        <span class="lineup-type lt-${r.grenade_type}">${r.grenade_type}</span>
        <span style="flex:1">${r.throw_count}× across ${r.match_count} matches</span>
        <button class="auto-lu-save" onclick="saveAutoLineup(${JSON.stringify(r).replace(/"/g,'&quot;')})">Save</button>
      </div>`).join('')}
  </div>`;
  el.innerHTML = savedEl + autoHtml;
}

async function saveAutoLineup(r) {
  const name = prompt(`Name this ${r.grenade_type} lineup:`, `${r.grenade_type} lineup`);
  if (!name) return;
  try {
    const resp = await fetch('/api/save_lineup', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        map: currentTab, grenade_type: r.grenade_type, name,
        side: 'both', difficulty: 'easy', notes: `Auto-detected: ${r.count} throws`,
        throw_x: r.throw_x, throw_y: r.throw_y, land_x: r.land_x, land_y: r.land_y
      })
    });
    if (resp.ok) {
      load();
    }
  } catch(e) { alert('Save failed: '+e.message); }
}

/* ── drill recommendations ── */
let _loadedDrills = [];

async function loadDrills() {
  const map = currentTab === 'overview' ? null : currentTab;
  const days = sel('s-days');
  $('drills-status').textContent = 'Fetching…';
  $('drills-body').innerHTML = '';
  try {
    const url = `/api/drills?days=${days}${map ? `&map=${map}` : ''}`;
    const d = await fetch(url).then(r=>r.json());
    $('drills-status').textContent = '';
    if (!d.drills?.length) {
      $('drills-body').innerHTML = '<div class="spin">No recommendations</div>';
      return;
    }
    _loadedDrills = d.drills;
    $('drills-body').innerHTML = d.drills.map((dr, i) => `
      <div class="drill-card">
        <div class="drill-card-area">${_escHtml(dr.area||'')}</div>
        <div class="drill-card-drill">${_escHtml(dr.drill||'')}</div>
        <div class="drill-card-target">Target: ${_escHtml(dr.target||'')}</div>
        <div class="drill-card-actions">
          <button class="drill-btn drill-done-btn" onclick="logDrill(this,${i},'done')">✓ Done</button>
          <button class="drill-btn drill-skip-btn" onclick="logDrill(this,${i},'skipped')">— Skip</button>
        </div>
      </div>`).join('');
  } catch(e) {
    $('drills-status').textContent = '';
    $('drills-body').innerHTML = `<div class="spin">Error: ${e.message}</div>`;
  }
}

async function logDrill(btn, idx, status) {
  const dr = _loadedDrills[idx] || {};
  const card = btn.closest('.drill-card');
  try {
    await fetch('/api/drill_log', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        drill: dr.drill || '',
        area: dr.area || '',
        target: dr.target || '',
        status,
        map_context: currentTab === 'overview' ? null : currentTab
      })
    });
  } catch(e) {}
  card.classList.add(status === 'done' ? 'drill-card-done' : 'drill-card-skipped');
  card.querySelectorAll('.drill-btn').forEach(b => b.disabled = true);
}

/* ── modal inner tabs ── */
function switchModalTab(name) {
  document.querySelectorAll('.modal-tab').forEach((t,i) => {
    const names = ['stats','rounds','kills','economy'];
    t.classList.toggle('active', names[i] === name);
  });
  ['stats','rounds','kills','economy'].forEach(n => {
    const p = $('mp-'+n);
    if (p) p.classList.toggle('active', n === name);
  });
}


/* ════════════════════════════════════════════
   TOP-LEVEL REPLAY TAB
   ════════════════════════════════════════════ */
const rp = {
  matches: [],          // [{match_id, map, won, team_score, opp_score, played_at, kd, adr}]
  rounds: [],           // [{round_num, side, round_won, kills, ...}]
  selectedMatchId: null,
  selectedMatch: null,
  selectedRound: 1,
  data: null,           // current round replay JSONB
  roundMeta: null,      // current round's player_rounds row
  roundCache: {},       // key `matchId:round` → data
  calib: null,
  radarImg: null,
  radarImgLoaded: false,
  radarMap: null,
  _radarCache: null,   // offscreen canvas: radar + dark overlay baked
  _ctx: null,          // cached 2d context
  frameIdx: 0,
  speed: 1,
  playing: false,
  rafId: null,
  lastFrameTime: 0,
  canvasW: 600, canvasH: 600,
  // Feature additions
  filters: {side: null, result: null, eco: null, clutch: false, opening: false},
  patternMode: false,
  allMatchMode: false,
  _allMatchCache: {},
  _lastPanelFi: -1,  // last frameIdx for which player panels were updated
  layers: {routes: false, utility: false, nadepaths: false, contact: false, danger: false, allroutes: false},
  _dangerCache: {},   // keyed by map name
  _allroutesCache: {}, // keyed by match_id
};

/* ── helpers ── */
// rpWorldToPx was removed — coordinate transform is inlined as wx2px() inside rpRenderFrame
// so it has access to the live canvas size without a closure over rp.

function rpFmt(secs) {
  const s = Math.abs(Math.round(secs));
  return (secs < 0 ? '-' : '') + Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
}

/* ── tab entry ── */
let _rpResizeObs = null;
/* ── Map pan / zoom ── */
let _rpZoom = 1, _rpPanX = 0, _rpPanY = 0, _rpDrag = null;

function rpResetZoom() {
  _rpZoom = 1; _rpPanX = 0; _rpPanY = 0;
  rpApplyMapTransform();
}

function rpApplyMapTransform() {
  const el = $('rpMapZoom');
  if (el) el.style.transform = `translate(${_rpPanX}px,${_rpPanY}px) scale(${_rpZoom})`;
}

function rpInitMapInteraction() {
  const wrap = $('rpCanvasWrap');
  if (!wrap || wrap._rpInteractionBound) return;
  wrap._rpInteractionBound = true;

  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    _rpZoom = Math.max(0.5, Math.min(6, _rpZoom * factor));
    rpApplyMapTransform();
  }, { passive: false });

  wrap.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    _rpDrag = { x: e.clientX - _rpPanX, y: e.clientY - _rpPanY };
    wrap.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', e => {
    if (!_rpDrag) return;
    _rpPanX = e.clientX - _rpDrag.x;
    _rpPanY = e.clientY - _rpDrag.y;
    rpApplyMapTransform();
  });

  window.addEventListener('mouseup', () => {
    if (_rpDrag) { _rpDrag = null; wrap.style.cursor = 'grab'; }
  });

  // Double-click resets zoom/pan
  wrap.addEventListener('dblclick', rpResetZoom);

  wrap.style.cursor = 'grab';

  // Hide hint after first interaction
  const hint = $('rpZoomHint');
  if (hint) {
    wrap.addEventListener('wheel', () => { hint.style.opacity = '0'; }, { once: true });
    wrap.addEventListener('mousedown', () => { hint.style.opacity = '0'; }, { once: true });
  }
}

async function rpTabOpen() {
  rpResizeCanvas();
  rpInitMapInteraction();
  if (!_rpResizeObs) {
    _rpResizeObs = new ResizeObserver(() => {
      rp._radarCache = null;
      rpResizeCanvas();
      if (rp.data && !rp.playing) rpRenderFrame(rp.frameIdx, 0);
    });
    const wrap = $('rpCanvasWrap');
    if (wrap) _rpResizeObs.observe(wrap);
  }
  if (rp.matches.length === 0) await rpLoadMatches();
}

function rpResizeCanvas() {
  const wrap = $('rpCanvasWrap');
  if (!wrap) return;
  const w = wrap.clientWidth, h = wrap.clientHeight;
  const sz = Math.min(w, h, 700);
  if (sz === rp.canvasW) return;  // no change — do NOT touch canvas (would clear it)
  const canvas = $('rpCanvas');
  if (!canvas) return;
  canvas.width = sz; canvas.height = sz;
  rp.canvasW = sz; rp.canvasH = sz;
  rp._ctx = null;          // invalidate context cache
  rp._radarCache = null;   // force radar re-bake at new size
}

function rpBakeRadar() {
  if (!rp.radarImg || !rp.radarImgLoaded || !rp.canvasW) return;
  const off = document.createElement('canvas');
  off.width = rp.canvasW; off.height = rp.canvasH;
  const c = off.getContext('2d');
  c.drawImage(rp.radarImg, 0, 0, rp.canvasW, rp.canvasH);
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.fillRect(0, 0, rp.canvasW, rp.canvasH);
  rp._radarCache = off;
}

/* ── match list ── */
async function rpLoadMatches() {
  const r = await fetch('/api/matches?limit=100');
  rp.matches = await r.json();
  rpRenderMatchList();
}

function rpRenderMatchList() {
  $('rpBackBtn').style.display = 'none';
  $('rpSidebarTitle').textContent = 'Matches';
  const list = $('rpSidebarList');
  if (!rp.matches.length) { list.innerHTML = '<div class="spin">No matches yet</div>'; return; }

  // Group by date
  const byDate = {};
  for (const m of rp.matches) {
    const d = (m.played_at || '').slice(0, 10);
    (byDate[d] = byDate[d] || []).push(m);
  }

  let html = '';
  for (const [date, matches] of Object.entries(byDate)) {
    const dt = new Date(date + 'T12:00:00Z');
    const label = dt.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
    html += `<div class="rp-date-hdr">${label}</div>`;
    for (const m of matches) {
      const mapShort = (m.map || '').replace('de_','').toUpperCase();
      const cls = m.won ? 'w' : 'l';
      const wl = m.won ? 'W' : 'L';
      const active = m.match_id == rp.selectedMatchId ? ' active' : '';
      const plat = m.platform || 'mm';
      const platBadge = `<span class="rp-plat-badge ${plat}">${plat === 'faceit' ? 'FZ' : 'MM'}</span>`;
      html += `<div class="rp-match-item${active}" onclick="rpSelectMatch('${m.match_id}')">
        <span class="rp-match-map">${mapShort}</span>
        <span class="rp-match-score ${cls}">${m.team_score}-${m.opp_score} ${wl}</span>
        ${platBadge}
      </div>`;
    }
  }
  list.innerHTML = html;
}

/* ── match selection ── */
async function rpSelectMatch(matchId) {
  rp.selectedMatchId = matchId;
  rp.matchId = matchId;
  rp.selectedMatch = rp.matches.find(m => m.match_id == matchId);
  rpRenderMatchList(); // re-render to show active

  // Update info bar
  const m = rp.selectedMatch;
  if (m) {
    $('rpMapLabel').textContent = (m.map || '').replace('de_','').toUpperCase();
    const scEl = $('rpScoreLabel');
    scEl.textContent = `${m.team_score}-${m.opp_score}` + (m.won ? ' W' : ' L');
    scEl.className = 'rp-infobar-score ' + (m.won ? 'w' : 'l');
    $('rpDateLabel').textContent = (m.played_at || '').slice(0, 10);
    const plat = m.platform || 'mm';
    let platEl = $('rpPlatLabel');
    if (!platEl) {
      platEl = document.createElement('span');
      platEl.id = 'rpPlatLabel';
      const dateEl = $('rpDateLabel');
      if (dateEl && dateEl.parentNode) dateEl.parentNode.insertBefore(platEl, dateEl.nextSibling);
    }
    platEl.className = `rp-plat-badge ${plat}`;
    platEl.textContent = plat === 'faceit' ? 'FACEIT' : 'MM';
  }

  // FACEIT matches: show stats panel, no replay available
  if (m?.platform === 'faceit') {
    rpShowFaceitMatchStats(m);
    return;
  }

  // Load calibration + radar
  if (m && m.map) rp.mapName = m.map;
  if (m && m.map && m.map !== rp.radarMap) {
    rp.radarMap = m.map;
    rp.radarImgLoaded = false;
    const img = new Image();
    img.onload = () => { rp.radarImgLoaded = true; rp._radarCache = null; rpBakeRadar(); if (rp.data) rpRenderFrame(rp.frameIdx, 0); };
    img.src = `/radar/${m.map}.png`;
    rp.radarImg = img;
    try {
      const cr = await fetch(`/api/radar_calibration?map=${m.map}`);
      rp.calib = cr.ok ? await cr.json() : null;
    } catch(e) { rp.calib = null; }
  }

  // Load rounds
  const rr = await fetch(`/api/match_rounds?match_id=${matchId}`);
  rp.rounds = await rr.json();
  rpRenderRoundList();
  rpRenderRoundBar();
  rpLoadUtilTend();

  // Auto-select round 1
  await rpSelectRound(1);
}

function rpShowFaceitMatchStats(m) {
  rp.rounds = [];
  rpRenderRoundList();
  const eloChg = m.elo_change != null
    ? `<span style="color:${m.elo_change>=0?'var(--green)':'var(--red)'}"> (${m.elo_change>=0?'+':''}${m.elo_change} ELO)</span>` : '';
  const multis = [
    m.triple_kills ? `${m.triple_kills}×3K` : null,
    m.quadro_kills ? `${m.quadro_kills}×4K` : null,
    m.penta_kills  ? `${m.penta_kills}×ACE` : null,
  ].filter(Boolean).join('  ');

  const canvas = document.querySelector('.rp-canvas');
  if (canvas) {
    canvas.innerHTML = `<div class="fc-match-stats-panel">
      <div class="fc-ms-map">${(m.map||'').replace('de_','').toUpperCase()}</div>
      <div class="fc-ms-result ${m.won?'w':'l'}">${m.won?'WIN':'LOSS'} · ${m.team_score}–${m.opp_score}</div>
      <div class="fc-ms-kpis">
        <div class="fc-ms-kpi"><span class="v ${sc(m.kd,1.1,0.9)}">${m.kd??'—'}</span><span class="l">K/D</span></div>
        <div class="fc-ms-kpi"><span class="v ${sc(m.adr,85,70)}">${m.adr??'—'}</span><span class="l">ADR</span></div>
        <div class="fc-ms-kpi"><span class="v">${m.kills}</span><span class="l">Kills</span></div>
        <div class="fc-ms-kpi"><span class="v">${m.deaths}</span><span class="l">Deaths</span></div>
        <div class="fc-ms-kpi"><span class="v">${m.hs_pct??'—'}%</span><span class="l">HS %</span></div>
      </div>
      ${m.faceit_elo ? `<div class="fc-ms-elo">ELO ${m.faceit_elo}${eloChg}</div>` : ''}
      ${multis ? `<div class="fc-ms-multis">${multis}</div>` : ''}
      <div class="fc-ms-note">FACEIT demo unavailable — stats only</div>
    </div>`;
  }
}

function rpBackToMatches() {
  rpHidePlayers();
  rpRenderMatchList();
}

/* ── eco classification ── */
function rpEcoClass(equip) {
  if (equip == null) return null;
  if (equip >= 4500) return 'full';
  if (equip >= 2000) return 'force';
  return 'eco';
}

/* ── filtered rounds ── */
function rpFilteredRounds() {
  const f = rp.filters;
  return rp.rounds.filter(r => {
    if (f.side && r.side !== f.side) return false;
    if (f.result === 'won'  && !r.round_won) return false;
    if (f.result === 'lost' && r.round_won)  return false;
    const ec = rpEcoClass(r.equip_value);
    if (f.eco && ec !== f.eco) return false;
    if (f.clutch  && !r.was_clutch)   return false;
    if (f.opening && !r.opening_kill) return false;
    return true;
  });
}

/* ── filter chip handlers ── */
function rpSetFilter(which) {
  const f = rp.filters;
  if (which === 'all') {
    f.side = null; f.result = null; f.eco = null;
  } else if (which === 'CT' || which === 'T') {
    f.side = (f.side === which) ? null : which;
    f.result = null;
  } else if (which === 'won' || which === 'lost') {
    f.result = (f.result === which) ? null : which;
    f.side = null;
  } else if (which === 'eco' || which === 'force' || which === 'full') {
    f.eco = (f.eco === which) ? null : which;
  }
  rpUpdateFilterChips();
  rpRenderRoundList();
}

function rpToggleChip(which) {
  rp.filters[which] = !rp.filters[which];
  rpUpdateFilterChips();
  rpRenderRoundList();
}

function rpUpdateFilterChips() {
  const f = rp.filters;
  // All = active when no side/result/eco filter and no clutch/opening
  const allActive = !f.side && !f.result && !f.eco && !f.clutch && !f.opening;
  $('rpChipAll').className   = 'rp-chip' + (allActive ? ' active' : '');
  $('rpChipCT').className    = 'rp-chip' + (f.side === 'CT'     ? ' active-ct'   : '');
  $('rpChipT').className     = 'rp-chip' + (f.side === 'T'      ? ' active'      : '');
  $('rpChipWon').className   = 'rp-chip' + (f.result === 'won'  ? ' active-win'  : '');
  $('rpChipLost').className  = 'rp-chip' + (f.result === 'lost' ? ' active-loss' : '');
  $('rpChipEco').className   = 'rp-chip' + (f.eco === 'eco'     ? ' active'      : '');
  $('rpChipForce').className = 'rp-chip' + (f.eco === 'force'   ? ' active'      : '');
  $('rpChipFull').className  = 'rp-chip' + (f.eco === 'full'    ? ' active'      : '');
  $('rpChipClutch').className= 'rp-chip' + (f.clutch  ? ' active' : '');
  $('rpChipFK').className    = 'rp-chip' + (f.opening ? ' active' : '');
}

/* ── round list ── */
function rpRenderRoundList() {
  $('rpBackBtn').style.display = '';
  $('rpSidebarTitle').textContent = (rp.selectedMatch && rp.selectedMatch.map ? rp.selectedMatch.map : '').replace('de_','').toUpperCase();
  // Show filter bar
  $('rpFilterBar').style.display = '';
  const filtered = rpFilteredRounds();
  let html = '';
  for (const r of filtered) {
    const sideCls = r.side === 'CT' ? 'ct' : 't';
    const dotCls = r.round_won ? 'w' : 'l';
    const active = r.round_num === rp.selectedRound ? ' active' : '';
    let badges = '';
    if (r.was_clutch) badges += `<span class="rp-rb rp-rb-clutch">1v${r.clutch_vs}</span>`;
    if (r.opening_kill) badges += `<span class="rp-rb rp-rb-open">FK</span>`;
    if (r.planted_bomb) badges += `<span class="rp-rb rp-rb-bomb">&#128163;</span>`;
    if (r.round_num === 1 || r.round_num === 13) badges += `<span class="rp-rb rp-rb-pistol">P</span>`;
    else if (r.round_num > 24) badges += `<span class="rp-rb rp-rb-ot">OT</span>`;
    // Eco badge
    const ec = rpEcoClass(r.equip_value);
    const ecBadge = ec ? `<span class="rp-eco rp-eco-${ec}">${ec.toUpperCase()}</span>` : '';
    html += `<div class="rp-round-item${active}" onclick="rpSelectRound(${r.round_num})">
      <span class="rp-rnum">R${r.round_num}</span>
      <span class="rp-rside ${sideCls}">${r.side}</span>
      <span class="rp-rdot ${dotCls}"></span>
      <span class="rp-rkills">${r.kills}K</span>
      <span class="rp-rdmg">${r.damage}d</span>
      ${ecBadge || '<span></span>'}
      <span class="rp-rbadges">${badges}</span>
    </div>`;
  }
  $('rpSidebarList').innerHTML = html || '<div class="spin">No rounds match filters</div>';
}

/* ── round selection ── */
async function rpSelectRound(n) {
  rpStopPlay();
  rp.selectedRound = n;
  rp.roundIdx = n;
  rp.frameIdx = 0;
  $('rpScrubber').value = 0;
  $('rpTimeLabel').textContent = '0:00';

  // Update round label + sidebar highlight
  const total = rp.rounds.length || '?';
  $('rpRoundLabel').textContent = `Round ${n} / ${total}`;
  // Re-render round list to update active
  if (rp.selectedMatchId) {
    document.querySelectorAll('.rp-round-item').forEach(el => {
      const onclick = el.getAttribute('onclick') || '';
      const isActive = onclick.includes(`rpSelectRound(${n})`);
      el.classList.toggle('active', isActive);
    });
  }

  // Pre-fill coach question
  const rd = rp.rounds.find(r => r.round_num === n);
  rp.roundMeta = rd || null;
  if (rd) {
    const ctx2 = rpBuildCoachContext(rd);
    $('rpCoachInput').value = ctx2;
  }

  // Load replay data
  const key = `${rp.selectedMatchId}:${n}`;
  if (!rp.roundCache[key]) {
    $('rpNoData').style.display = 'flex';
    $('rpNoData').textContent = 'Loading…';
    try {
      const res = await fetch(`/api/round_replay?match_id=${rp.selectedMatchId}&round=${n}`);
      if (res.ok) {
        rp.roundCache[key] = await res.json();
      }
    } catch(e) {}
  }
  rp.data = rp.roundCache[key] || null;
  rp._lastPanelFi = -1;  // force panel refresh on new round

  if (!rp.data) {
    $('rpNoData').style.display = 'flex';
    $('rpNoData').textContent = 'No replay data for this round';
    $('rpKillFeedPanel').style.display = 'none';
    $('rpAimPanel').style.display = 'none';
    return;
  }
  $('rpNoData').style.display = 'none';
  rpPrewarmWeaponIcons();
  rpRenderFrame(0, 0);
  rpUpdateScrubber();
  rpDrawScrubMarkers();
  rpPopulateKillFeed();
  rpRenderAimPanel(rp.data.freeze_tick || 0, rp.data.sample_rate || 64);
  rpGenerateNarrative();
  rpLoadPythonCoach();
  if (rp.patternMode) rpRenderPatterns();
  // Show Leetify-style player panel in sidebar + round bar
  rpShowPlayers();
  rpRenderRoundBar();
}

function rpPrewarmWeaponIcons() {
  if (!rp.data?.frames) return;
  const seen = new Set();
  for (const [, states] of rp.data.frames) {
    for (const ps of Object.values(states || {})) {
      const w = ps[7];
      if (w && !seen.has(w)) { seen.add(w); wImg(String(w)); }
    }
  }
}

function rpPrevRound() {
  if (rp.selectedRound > 1) rpSelectRound(rp.selectedRound - 1);
}

function rpNextRound() {
  const max = rp.rounds.length || 30;
  if (rp.selectedRound < max) rpSelectRound(rp.selectedRound + 1);
}

/* ── playback ── */
function rpTogglePlay() {
  if (rp.playing) {
    rpStopPlay();
  } else {
    if (!rp.data) return;
    rp.playing = true;
    rp.lastFrameTime = performance.now();
    $('rpPlayBtn').innerHTML = '&#9646;&#9646; Pause';
    rp.rafId = requestAnimationFrame(rpAnimateLoop);
  }
}

function rpStopPlay() {
  rp.playing = false;
  if (rp.rafId) { cancelAnimationFrame(rp.rafId); rp.rafId = null; }
  $('rpPlayBtn').innerHTML = '&#9654; Play';
}

function rpSetSpeed(v) { rp.speed = parseFloat(v); }

function rpScrub(pct) {
  if (!rp.data) return;
  rpStopPlay();
  rp.frameIdx = Math.round(pct / 100 * (rp.data.frames.length - 1));
  rpRenderFrame(rp.frameIdx, 0);
  rpUpdateScrubber();
  const tick = rp.data.frames[rp.frameIdx] ? rp.data.frames[rp.frameIdx][0] : 0;
  const sr = rp.data.sample_rate || 64;
  rpRenderAimPanel(tick, sr);
  rpHighlightKillFeed(tick, sr);
}

function rpUpdateScrubber() {
  if (!rp.data) return;
  const pct = rp.data.frames.length > 1 ? rp.frameIdx / (rp.data.frames.length - 1) * 100 : 0;
  $('rpScrubber').value = pct;
  const frame = rp.data.frames[rp.frameIdx];
  if (frame) {
    const secs = (frame[0] - rp.data.freeze_tick) / 64;
    $('rpTimeLabel').textContent = rpFmt(secs);
  }
}

function rpAnimateLoop(now) {
  if (rp.patternMode) { rpRenderPatterns(); return; }
  if (!rp.playing || !rp.data) { rpStopPlay(); return; }
  const sr = rp.data.sample_rate || 64;
  const msPerFrame = (sr / 64) * 1000 / rp.speed;
  const elapsed = now - rp.lastFrameTime;

  if (elapsed >= msPerFrame) {
    rp.frameIdx++;
    rp.lastFrameTime = now - (elapsed % msPerFrame);
    if (rp.frameIdx >= rp.data.frames.length - 1) {
      rp.frameIdx = rp.data.frames.length - 1;
      rpUpdateScrubber();
      rpRenderFrame(rp.frameIdx, 1);
      rpStopPlay();
      return;
    }
    rpUpdateScrubber();
  }

  // t computed AFTER any frame advance so it's always 0→1 within the current interval
  const t = Math.min((now - rp.lastFrameTime) / msPerFrame, 1.0);
  rpRenderFrame(rp.frameIdx, t);
  rpRenderAimPanel(
    rp.data.frames[rp.frameIdx] ? rp.data.frames[rp.frameIdx][0] + ((rp.data.frames[Math.min(rp.frameIdx+1, rp.data.frames.length-1)]?.[0] ?? rp.data.frames[rp.frameIdx][0]) - rp.data.frames[rp.frameIdx][0]) * t : 0,
    sr
  );
  rpHighlightKillFeed(
    rp.data.frames[rp.frameIdx] ? rp.data.frames[rp.frameIdx][0] : 0,
    sr
  );
  rp.rafId = requestAnimationFrame(rpAnimateLoop);
}

/* ── rendering ── */
function rpRenderFrame(frameIdx, t) {
  rpResizeCanvas();  // no-op when size unchanged
  const canvas = $('rpCanvas');
  if (!canvas) return;
  // Cache the 2d context — getting it every frame forces a state sync in some browsers
  if (!rp._ctx || rp._ctx.canvas !== canvas) rp._ctx = canvas.getContext('2d');
  const ctx = rp._ctx;
  const W = rp.canvasW, H = rp.canvasH;
  if (!W || !H) return;
  const data = rp.data;
  if (!data) return;

  // 1. Background — use pre-baked offscreen canvas (radar + dark overlay)
  ctx.clearRect(0, 0, W, H);
  if (!rp._radarCache && rp.radarImgLoaded) rpBakeRadar();
  if (rp._radarCache) {
    ctx.drawImage(rp._radarCache, 0, 0);
  } else {
    ctx.fillStyle = '#0d0e11';
    ctx.fillRect(0, 0, W, H);
  }

  const calib = rp.calib;
  if (!calib) return;

  const frames = data.frames;
  if (!frames || frames.length === 0) return;
  const fi = Math.max(0, Math.min(frameIdx, frames.length - 1));
  const [curTick, curStates] = frames[fi];
  const nextFi = Math.min(fi + 1, frames.length - 1);
  const [nxtTick, nxtStates] = frames[nextFi];

  // Interpolated tick (for event timing)
  const interpTick = curTick + (nxtTick - curTick) * t;
  const sr = data.sample_rate || 64;

  function wx2px(wx, wy) {
    const px = (wx - calib.origin_x) / calib.scale * (W / 1024);
    const py = (calib.origin_y - wy) / calib.scale * (H / 1024);
    return [px, py];
  }

  // Team color for grenade trajectory (all replay nades are mine)
  const mySide = (rp.roundMeta && rp.roundMeta.side) || 'CT';
  const teamRgb = mySide === 'CT' ? [78,158,212] : [212,128,74];

  // 2. Grenade events — in-flight arc + detonation burst + landing effect
  for (const ev of (data.events || [])) {
    if (ev.t_type !== 'nade' || ev.lx == null || ev.ly == null) continue;
    const detTick = ev.tick || 0;
    const isSm = ev.gt === 'smoke';
    const isMol = ev.gt === 'molotov' || ev.gt === 'incendiary';
    const isHe = ev.gt === 'he';
    const isFlash = ev.gt === 'flash';
    const [cr2, cg, cb] = isSm ? [160,160,170] : teamRgb;
    const [lx, ly] = wx2px(ev.lx, ev.ly);

    // === a. In-flight: animated dot travelling from throw to land ===
    if (ev.tx != null && ev.ty != null) {
      const flightTicks = (isSm || isMol) ? 130 : 95;
      const throwTick = detTick - flightTicks;
      const inFlight = interpTick >= throwTick - 8 && interpTick < detTick;
      if (inFlight) {
        const fp = Math.max(0, Math.min(1, (interpTick - throwTick) / flightTicks));
        const [txp, typ] = wx2px(ev.tx, ev.ty);
        const arc = Math.sin(fp * Math.PI) * Math.min(40, Math.hypot(lx-txp, ly-typ) * 0.25);
        const nx = lx - txp, ny = ly - typ, nl = Math.hypot(nx, ny) || 1;
        const perpX = -ny / nl, perpY = nx / nl; // perpendicular for arc
        const fx = txp + (lx - txp) * fp + perpX * arc;
        const fy = typ + (ly - typ) * fp + perpY * arc;
        const fadeIn = Math.min(1, (interpTick - throwTick + 8) / 8);
        ctx.save();
        ctx.globalAlpha = fadeIn * 0.9;
        ctx.beginPath();
        ctx.arc(fx, fy, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr2},${cg},${cb},1)`;
        ctx.fill();
        // Short trail
        if (fp > 0.03) {
          const tp2 = Math.max(0, fp - 0.06);
          const tx2 = txp + (lx - txp) * tp2 + perpX * Math.sin(tp2 * Math.PI) * Math.min(40, Math.hypot(lx-txp, ly-typ) * 0.25);
          const ty2 = typ + (ly - typ) * tp2 + perpY * Math.sin(tp2 * Math.PI) * Math.min(40, Math.hypot(lx-txp, ly-typ) * 0.25);
          ctx.globalAlpha = fadeIn * 0.3;
          ctx.strokeStyle = `rgba(${cr2},${cg},${cb},1)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(tx2, ty2);
          ctx.lineTo(fx, fy);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // === b. Detonation burst ring ===
    const detDist = interpTick - detTick;
    if (detDist >= 0 && detDist < sr * 0.5) {
      const bp = detDist / (sr * 0.5);
      const burstR = 5 + bp * (isSm ? 28 : isHe ? 22 : 16);
      const typeColors = { flash:[240,230,60], molotov:[240,80,20], incendiary:[240,80,20], he:[255,80,40] };
      const tc = typeColors[ev.gt];
      ctx.save();
      ctx.globalAlpha = (1 - bp) * (isFlash ? 0.85 : 0.7);
      ctx.strokeStyle = tc ? `rgba(${tc[0]},${tc[1]},${tc[2]},1)` : `rgba(${cr2},${cg},${cb},1)`;
      ctx.lineWidth = Math.max(0.5, 2.5 - bp * 2);
      ctx.beginPath();
      ctx.arc(lx, ly, burstR, 0, Math.PI * 2);
      ctx.stroke();
      if (isHe) {
        ctx.globalAlpha = (1 - bp) * 0.25;
        ctx.fillStyle = `rgba(255,80,40,1)`;
        ctx.fill();
      }
      ctx.restore();
    }

    // === c. Persistent landing effect + countdown arc ===
    const SMOKE_DUR = 1152; // 18s × 64hz
    const MOL_DUR   = 448;  // 7s × 64hz
    const duration  = isSm ? SMOKE_DUR : isMol ? MOL_DUR : sr * 6;
    const postDist  = interpTick - detTick;
    if (postDist < -sr || postDist > duration) continue;

    // Fade-in on arrival, fade-out in final stretch
    const fadeIn  = postDist < 0 ? Math.max(0, 1 + postDist / sr) : 1;
    const fadeLen = isSm ? 192 : isMol ? 64 : sr * 2;
    const fadeStart = duration - fadeLen;
    const fadeOut = postDist >= fadeStart
      ? Math.max(0, 1 - (postDist - fadeStart) / fadeLen) : 1;
    const alpha = fadeIn * fadeOut;
    if (alpha <= 0) continue;

    const r2 = isSm ? 18 : (isHe ? 10 : 8);

    // Coverage area circle (smoke=gray fog, molotov=fire glow) in base layer
    if ((isSm || isMol) && postDist >= 0) {
      const wRadius = isSm ? 105 : 125; // world units radius
      const pxCov = wRadius / calib.scale * (W / 1024);
      ctx.save();
      if (isSm) {
        // Smoke: radial gradient gray fog
        const sg = ctx.createRadialGradient(lx, ly, 0, lx, ly, pxCov);
        sg.addColorStop(0,   `rgba(160,160,175,${alpha * 0.30})`);
        sg.addColorStop(0.6, `rgba(140,140,155,${alpha * 0.18})`);
        sg.addColorStop(1,   `rgba(120,120,140,0)`);
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(lx, ly, pxCov, 0, Math.PI * 2);
        ctx.fill();
        // Dashed boundary ring
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = `rgba(180,180,200,${alpha * 0.45})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(lx, ly, pxCov, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Molotov: orange fire glow
        const mg = ctx.createRadialGradient(lx, ly, 0, lx, ly, pxCov);
        mg.addColorStop(0,   `rgba(255,100,20,${alpha * 0.35})`);
        mg.addColorStop(0.5, `rgba(220,60,10,${alpha * 0.18})`);
        mg.addColorStop(1,   `rgba(180,40,0,0)`);
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(lx, ly, pxCov, 0, Math.PI * 2);
        ctx.fill();
        // Solid boundary ring
        ctx.strokeStyle = `rgba(255,120,30,${alpha * 0.55})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(lx, ly, pxCov, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = alpha * (isSm ? 0.55 : isMol ? 0.75 : 0.85);
    ctx.beginPath();
    ctx.arc(lx, ly, r2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${cr2},${cg},${cb},1)`;
    ctx.fill();
    ctx.restore();

    // Countdown arc for smoke and molotov — shrinks clockwise from top
    if ((isSm || isMol) && postDist >= 0) {
      const frac = Math.max(0, 1 - postDist / duration);
      if (frac > 0.01) {
        const arcR  = r2 + (isSm ? 9 : 6);
        const [arcR2g, arcG2g, arcB2g] = isMol ? [255, 110, 20] : [cr2, cg, cb];
        ctx.save();
        ctx.globalAlpha = alpha * 0.72;
        ctx.strokeStyle = `rgba(${arcR2g},${arcG2g},${arcB2g},1)`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        // Arc goes clockwise from top: starts at -π/2, sweeps frac × 2π
        ctx.arc(lx, ly, arcR, -Math.PI / 2, -Math.PI / 2 + frac * 2 * Math.PI);
        ctx.stroke();
        // Background track (dim full circle)
        ctx.globalAlpha = alpha * 0.18;
        ctx.strokeStyle = `rgba(${arcR2g},${arcG2g},${arcB2g},1)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(lx, ly, arcR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // 3. Kill events
  for (const ev of (data.events || [])) {
    if (ev.t_type !== 'kill' || ev.x == null || ev.y == null) continue;
    const evTick = ev.tick || curTick; // if no tick stored, show at current
    const dist = Math.abs(interpTick - evTick);
    if (dist > sr * 3) continue;
    const alpha = Math.max(0, 1 - dist / (sr * 3));
    const [px, py] = wx2px(ev.x, ev.y);
    const s = 7;
    const col = ev.iv ? '#ff4444' : (ev.hs ? '#ffaa00' : '#44ee88');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px-s, py-s); ctx.lineTo(px+s, py+s);
    ctx.moveTo(px+s, py-s); ctx.lineTo(px-s, py+s);
    ctx.stroke();
    // Fading ring
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, s + 4, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Movement trails (last 4 frames)
  const players = data.players || {};
  for (let tfi = Math.max(0, fi-4); tfi < fi; tfi++) {
    const [, tStates] = frames[tfi];
    const age = fi - tfi;
    const trailAlpha = (4 - age) / 4 * 0.2;
    for (const [sidStr, pinfo] of Object.entries(players)) {
      const ps = tStates && tStates[sidStr];
      if (!ps || !ps[2]) continue;
      const [tx, ty] = wx2px(ps[0], ps[1]);
      const isCT = pinfo.team === 'CT';
      ctx.save();
      ctx.globalAlpha = trailAlpha;
      ctx.beginPath();
      ctx.arc(tx, ty, 3, 0, Math.PI*2);
      ctx.fillStyle = isCT ? '#4e9ed4' : '#d4804a';
      ctx.fill();
      ctx.restore();
    }
  }

  // 5. Players
  for (const [sidStr, pinfo] of Object.entries(players)) {
    const cs = curStates && curStates[sidStr];
    const ns = nxtStates && nxtStates[sidStr];
    if (!cs) continue;
    // Linear interpolate position
    const wx = cs[0] + ((ns ? ns[0] : cs[0]) - cs[0]) * t;
    const wy = cs[1] + ((ns ? ns[1] : cs[1]) - cs[1]) * t;
    const alive = cs[2] === 1;
    const hp = cs[3] != null ? cs[3] : 0;
    const [px, py] = wx2px(wx, wy);
    if (px < -30 || px > W+30 || py < -30 || py > H+30) continue;
    const isMe = pinfo.is_me;
    const isCT = pinfo.team === 'CT';
    const teamCol = isCT ? '#4e9ed4' : '#d4804a';
    const r = isMe ? 9 : 7;
    ctx.save();
    if (!alive) {
      // Persistent death marker — team-colored X at last known position
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = teamCol;
      ctx.lineWidth = 2.5;
      const s = isMe ? 8 : 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px-s, py-s); ctx.lineTo(px+s, py+s);
      ctx.moveTo(px+s, py-s); ctx.lineTo(px-s, py+s);
      ctx.stroke();
      // Faint circle to show radius
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = teamCol;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, s+3, 0, Math.PI*2);
      ctx.stroke();
      // Name of dead player
      const dname = pinfo.name || '';
      if (dname) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = teamCol;
        ctx.font = '8px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(dname.length > 8 ? dname.slice(0,7)+'…' : dname, px, py + s + 3);
      }
    } else {
      // Flash indicator — white shrinking arc ring when this player is blinded
      // Blind events: {t_type:'blind', tick, sid, dur(seconds)}
      let flashRemaining = 0;
      for (const ev of (data.events || [])) {
        if (ev.t_type !== 'blind' || ev.sid !== sidStr || ev.tick == null) continue;
        const remain = ev.dur - (interpTick - ev.tick) / 64;
        if (remain > flashRemaining) flashRemaining = remain;
      }
      if (flashRemaining > 0) {
        const maxFlash = 3.4; // CS2 max blind duration (seconds)
        const frac = Math.min(1, flashRemaining / maxFlash);
        const flashR = r + 5 + frac * 9;
        ctx.save();
        // White fill bloom — brighter the more blinded
        ctx.globalAlpha = 0.08 + frac * 0.30;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, flashR + 2, 0, Math.PI * 2);
        ctx.fill();
        // Countdown arc (white, shrinks clockwise from top)
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(255,255,255,0.6)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(px, py, flashR, -Math.PI / 2, -Math.PI / 2 + frac * 2 * Math.PI);
        ctx.stroke();
        // Dim track
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.20;
        ctx.beginPath();
        ctx.arc(px, py, flashR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Direction cone — interpolate yaw via shortest angular path to avoid snap
      const yaw0 = cs[6] != null ? cs[6] : 0;
      const yaw1 = ns && ns[6] != null ? ns[6] : yaw0;
      const dYaw = ((yaw1 - yaw0 + 540) % 360) - 180; // shortest path delta
      const yawDeg = yaw0 + dYaw * t;
      const coneDir = -yawDeg * Math.PI / 180;
      const coneLen = r + 22, coneHalf = 32 * Math.PI / 180; // ~64° FOV
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, coneLen, coneDir - coneHalf, coneDir + coneHalf);
      ctx.closePath();
      ctx.fillStyle = isMe ? '#d0e8ff' : teamCol;
      ctx.fill();
      ctx.restore();
      // Drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI*2);
      ctx.fillStyle = teamCol;
      ctx.fill();
      ctx.shadowBlur = 0;
      if (isMe) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, r+2, 0, Math.PI*2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // HP bar (non-me)
      if (!isMe) {
        const bw = 14, bh = 2;
        ctx.fillStyle = '#1a1a22';
        ctx.fillRect(px - bw/2, py + r + 2, bw, bh);
        const hc = hp > 60 ? '#4aaa6a' : hp > 25 ? '#c49020' : '#c44040';
        ctx.fillStyle = hc;
        ctx.fillRect(px - bw/2, py + r + 2, bw * Math.max(0, hp/100), bh);
      }
      // HP text for me
      if (isMe && hp > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hp, px, py);
      }
      // Name
      const name = pinfo.name || '';
      if (name) {
        const dn = name.length > 10 ? name.slice(0,9)+'…' : name;
        ctx.fillStyle = isMe ? '#fff' : 'rgba(210,210,225,0.65)';
        ctx.font = (isMe ? 'bold ' : '') + '9px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(dn, px, py + r + (isMe ? 4 : 6));
      }
      // Weapon icon — floats right of dot, Leetify style
      const wpnName = cs[7] ? String(cs[7]) : null;
      if (wpnName) {
        const wimg = wImg(wpnName);
        if (wimg.complete && wimg.naturalWidth > 0) {
          const iconSize = isMe ? 14 : 12;
          const ix = Math.round(px + r + 4);
          const iy = Math.round(py - iconSize / 2);
          ctx.save();
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = '#0d0e11';
          ctx.fillRect(ix - 1, iy - 1, iconSize + 2, iconSize + 2);
          ctx.globalAlpha = isMe ? 0.92 : 0.72;
          ctx.drawImage(wimg, ix, iy, iconSize, iconSize);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  // 5b. Firing & hit indicators — ring pulses at my position when I shoot or take damage
  for (const [sidStr, pinfo] of Object.entries(players)) {
    if (!pinfo.is_me) continue;
    const csM = curStates && curStates[sidStr];
    const nsM = nxtStates && nxtStates[sidStr];
    if (!csM || !csM[2]) continue;
    const wxM = csM[0] + ((nsM ? nsM[0] : csM[0]) - csM[0]) * t;
    const wyM = csM[1] + ((nsM ? nsM[1] : csM[1]) - csM[1]) * t;
    const [mpx, mpy] = wx2px(wxM, wyM);
    // Find most-recent event of each type within a 0.25s window
    let lastKill = null, lastHit = null, lastHurt = null;
    for (const ev of (data.events || [])) {
      if (ev.tick == null) continue;
      const dt = interpTick - ev.tick;
      if (dt < 0 || dt > sr * 0.25) continue;
      if      (ev.t_type === 'kill' && !ev.iv)    { if (!lastKill || ev.tick > lastKill._t) lastKill = {...ev, _t: ev.tick, _dt: dt}; }
      else if (ev.t_type === 'dmg'  &&  ev.you)   { if (!lastHit  || ev.tick > lastHit._t)  lastHit  = {...ev, _t: ev.tick, _dt: dt}; }
      else if (ev.t_type === 'dmg'  && !ev.you)   { if (!lastHurt || ev.tick > lastHurt._t) lastHurt = {...ev, _t: ev.tick, _dt: dt}; }
    }
    if (lastKill) {
      const prog = lastKill._dt / (sr * 0.25), fade = 1 - prog;
      ctx.save(); ctx.globalAlpha = fade * 0.92; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mpx, mpy, 11 + prog * 18, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (lastHit) {
      const prog = lastHit._dt / (sr * 0.25), fade = 1 - prog;
      ctx.save(); ctx.globalAlpha = fade * 0.65; ctx.strokeStyle = '#80c8ff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mpx, mpy, 9 + prog * 12, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (lastHurt) {
      const prog = lastHurt._dt / (sr * 0.25), fade = 1 - prog;
      ctx.save(); ctx.globalAlpha = fade * 0.80; ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mpx, mpy, 14 + prog * 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }

  // 6. Kill feed (top-right corner, CS2-style)
  const feedEvents = (data.events || [])
    .filter(ev => ev.t_type === 'kill' && ev.tick != null)
    .filter(ev => { const d = interpTick - ev.tick; return d > -sr && d < sr * 20; })
    .sort((a, b) => a.tick - b.tick)
    .slice(-5);
  if (feedEvents.length > 0) {
    const lineH = 22, iconW = 32, iconH = 14, padX = 6, fontSize = 10;
    let feedTop = 8;
    const myName = (() => {
      for (const p of Object.values(data.players || {})) if (p.is_me) return p.name || 'You';
      return 'You';
    })();
    ctx.save();
    ctx.font = `${fontSize}px system-ui`;
    for (const ev of feedEvents) {
      const d = interpTick - ev.tick;
      const alpha = d < 0 ? Math.max(0, 1 + d/sr) : Math.max(0, 1 - d/(sr*20));
      if (alpha <= 0) continue;
      const isKill = !ev.iv;
      const killCol = '#4aaa6a', deathCol = '#e04444';
      const barCol = isKill ? killCol : deathCol;
      const attName = isKill ? myName : 'Enemy';
      const vicName = isKill ? 'Enemy' : myName;
      const attW = ctx.measureText(attName).width;
      const vicW = ctx.measureText(vicName).width;
      const hsW = ev.hs ? ctx.measureText(' ☠').width : 0;
      const totalW = attW + padX + iconW + padX + vicW + hsW + padX * 2 + 3;
      const bx = W - totalW - 6, by = feedTop;
      // Background pill
      ctx.globalAlpha = alpha * 0.82;
      ctx.fillStyle = 'rgba(6,7,12,0.88)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, totalW, lineH, 3) : ctx.rect(bx, by, totalW, lineH);
      ctx.fill();
      // Left accent bar
      ctx.globalAlpha = alpha;
      ctx.fillStyle = barCol;
      ctx.fillRect(bx, by, 3, lineH);
      // Attacker name
      const textY = by + lineH / 2;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isKill ? '#e0e8ff' : '#a0a8c0';
      ctx.fillText(attName, bx + 3 + padX, textY);
      // Weapon icon
      const imgX = bx + 3 + padX + attW + padX;
      const imgY = by + (lineH - iconH) / 2;
      const wimg = wImg(ev.w);
      if (wimg.complete && wimg.naturalWidth > 0) {
        ctx.globalAlpha = alpha * 0.9;
        ctx.drawImage(wimg, imgX, imgY, iconW, iconH);
      } else {
        ctx.fillStyle = '#607080';
        ctx.fillText((ev.w||'').slice(0,6), imgX, textY);
      }
      // Victim name
      ctx.globalAlpha = alpha;
      ctx.fillStyle = !isKill ? '#e0e8ff' : '#a0a8c0';
      ctx.fillText(vicName, imgX + iconW + padX, textY);
      // Headshot skull
      if (ev.hs) {
        ctx.fillStyle = '#f0c060';
        ctx.fillText(' ☠', imgX + iconW + padX + vicW, textY);
      }
      ctx.restore();
      ctx.save();
      ctx.font = `${fontSize}px system-ui`;
      feedTop += lineH + 3;
    }
    ctx.restore();
  }

  // 7. Round result overlay (last 1.5s of round)
  if (rp.data) {
    const endTick = rp.data.end_tick;
    const ticksLeft = endTick - interpTick;
    if (ticksLeft >= 0 && ticksLeft < 96) { // ~1.5s at 64hz
      const alpha = Math.min(1, (96 - ticksLeft) / 32);
      const rd = rp.rounds.find(r => r.round_num === rp.selectedRound);
      if (rd) {
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = rd.round_won ? 'rgba(74,170,106,0.12)' : 'rgba(196,64,64,0.12)';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 24px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = rd.round_won ? '#4aaa6a' : '#c44040';
        ctx.fillText(rd.round_won ? 'ROUND WON' : 'ROUND LOST', W/2, H/2);
        ctx.restore();
      }
    }
  }

  // 7b. Round timer — elapsed from freeze_tick, top-right corner
  {
    const fz = data.freeze_tick || 0;
    const rawSecs = (interpTick - fz) / 64;
    const secs = Math.max(0, rawSecs);
    const mm = Math.floor(secs / 60);
    const ss = Math.floor(secs % 60);
    const timerStr = `${mm}:${ss.toString().padStart(2, '0')}`;
    const pad = 6, bh = 20, bw = 44;
    const bx = W - bw - pad, by = pad;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = 'rgba(6,7,12,0.80)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 3) : ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rawSecs < 0 ? '#6080a0' : '#c8d8f0';
    ctx.fillText(timerStr, bx + bw / 2, by + bh / 2);
    ctx.restore();
  }

  // 8. Player panels — update on frame change; always update if someone is currently blinded
  const _anyBlind = (data.events || []).some(ev =>
    ev.t_type === 'blind' && ev.dur - (interpTick - ev.tick) / 64 > 0.15);
  if (fi !== rp._lastPanelFi || _anyBlind) {
    rp._lastPanelFi = fi;
    rpUpdatePlayerPanels(curStates);
  }

  // 9. Coaching layers (toggled by user)
  if (rp.layers.routes)    rpLayerRoutes(ctx, wx2px, W, H);
  if (rp.layers.utility)   rpLayerUtility(ctx, wx2px);
  if (rp.layers.nadepaths) rpLayerNadePaths(ctx, wx2px);
  if (rp.layers.contact)   rpLayerContact(ctx, wx2px);
  if (rp.layers.danger)    rpLayerDanger(ctx, wx2px, W, H);
  if (rp.layers.allroutes) rpLayerAllRoutes(ctx, wx2px);
}

/* ════════════════════════════════════════════════════════
   FEATURE: Leetify-style player scorecard panels
   ════════════════════════════════════════════════════════ */

/* Show player panel in sidebar, hide match/round list */
function rpShowPlayers() {
  const pp = $('rpPlayersPanel'), mp = $('rpMatchPanel');
  if (pp) pp.style.display = '';
  if (mp) mp.style.display = 'none';
}
function rpHidePlayers() {
  const pp = $('rpPlayersPanel'), mp = $('rpMatchPanel');
  if (pp) pp.style.display = 'none';
  if (mp) mp.style.display = '';
}

/* Round bar — Leetify-style row of clickable round buttons at bottom */
function rpRenderRoundBar() {
  const el = $('rpRoundBar');
  if (!el) return;
  if (!rp.rounds?.length) { el.style.display = 'none'; return; }
  el.style.display = '';
  const n = rp.selectedRound;
  el.innerHTML = rp.rounds.map(r => {
    const won = r.round_won === true || r.result === 'win';
    const active = r.round_num === n;
    const cls = `rp-round-btn${active ? ' active' : ''}${won ? ' won' : ' lost'}`;
    return `<button class="${cls}" onclick="rpSelectRound(${r.round_num})" title="Round ${r.round_num}: ${won?'W':'L'}">${r.round_num}</button>`;
  }).join('');
}

/* Kill tracker — count user's kills per round up to current tick */
function _rpUserKillsToTick(upToTick) {
  return (rp.data?.events || []).filter(ev => ev.t_type === 'kill' && !ev.iv && (ev.tick ?? 0) <= upToTick).length;
}
function _rpUserDeathsToTick(upToTick) {
  return (rp.data?.events || []).filter(ev => ev.t_type === 'kill' && ev.iv && (ev.tick ?? 0) <= upToTick).length;
}

function rpUpdatePlayerPanels(states) {
  if (!rp.data) return;
  const players = rp.data.players || {};

  const curTick = rp.data.frames?.[rp.frameIdx]?.[0] ?? 0;
  const freeze  = rp.data.freeze_tick ?? 0;
  const secs    = Math.max(0, 115 - Math.floor((curTick - freeze) / 64));
  const timeLbl = `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;

  // Update sidebar footer timer
  const ppTimer = $('rpPPTimer'), ppRound = $('rpPPRound');
  if (ppTimer) ppTimer.textContent = timeLbl;
  if (ppRound) ppRound.textContent = `ROUND ${rp.selectedRound ?? '—'}`;

  // Blind events
  const blindNow = {};
  for (const ev of (rp.data.events || [])) {
    if (ev.t_type !== 'blind' || ev.sid == null) continue;
    const remain = ev.dur - (curTick - ev.tick) / 64;
    if (remain > 0.15) blindNow[ev.sid] = true;
  }

  const myKills  = _rpUserKillsToTick(curTick);
  const myDeaths = _rpUserDeathsToTick(curTick);

  // Grenade inference from equip budget
  function inferNades(equip) {
    const nades = [];
    if (equip >= 300)  nades.push({k:'he',     sym:'HE', col:'#e05028'});
    if (equip >= 600)  nades.push({k:'flash',  sym:'F',  col:'#e0c028'});
    if (equip >= 1000) nades.push({k:'smoke',  sym:'S',  col:'#8890a0'});
    if (equip >= 1500) nades.push({k:'mol',    sym:'🔥', col:'#e07828'});
    return nades;
  }

  function playerCard(sid, pinfo, team) {
    const ps     = states?.[sid];
    const alive  = ps ? ps[2] === 1 : false;
    const hp     = ps ? Math.max(0, ps[3] || 0) : 0;
    const money  = ps ? (ps[4] || 0) : 0;
    const equip  = ps ? (ps[5] || 0) : 0;
    const weapon = ps?.[7] ? String(ps[7]) : '';
    const isMe   = pinfo.is_me;
    const isBlind = blindNow[sid];
    const name   = (pinfo.name || '?');
    const dn     = name.length > 14 ? name.slice(0,13)+'…' : name;

    const hpBarCol = hp > 60 ? 'var(--green)' : hp > 25 ? 'var(--yellow)' : 'var(--red)';
    const deadClass  = alive ? '' : ' rp-pc-dead';
    const meClass    = isMe  ? ' rp-pc-me'   : '';
    const teamClass  = team === 'T' ? ' rp-pc-t' : ' rp-pc-ct';
    const blindBadge = isBlind ? '<span class="rp-pc-blind">BLIND</span>' : '';

    const kills = isMe ? myKills : null;
    const deaths = isMe ? myDeaths : null;
    const kdHtml = isMe
      ? `<span class="rp-pc-kd">${kills}/${deaths}</span>`
      : '';

    const nades = alive ? inferNades(equip) : [];
    const nadesHtml = nades.length
      ? `<div class="rp-pc-nades">${nades.map(n=>`<span class="rp-pc-nade" title="${n.k}" style="color:${n.col}">${n.sym}</span>`).join('')}</div>`
      : '';

    const weaponHtml = alive && weapon
      ? `<div class="rp-pc-weapon"><img src="${wIconSrc(weapon)}" alt="${weapon}" title="${weapon}" class="rp-pc-wpn-icon" onerror="this.style.display='none'"></div>`
      : `<div class="rp-pc-weapon"></div>`;

    const moneyHtml = alive
      ? `<span class="rp-pc-money">$${money.toLocaleString()}</span>`
      : '';

    const hpBox = alive
      ? `<div class="rp-pc-hp-box" style="--hp:${hp}%;--hpcol:${hpBarCol}">${hp}</div>`
      : `<div class="rp-pc-hp-box rp-pc-hp-dead">✕</div>`;

    return `<div class="rp-pc${deadClass}${meClass}${teamClass}">
      ${hpBox}
      <div class="rp-pc-body">
        <div class="rp-pc-row1">
          <span class="rp-pc-name">${dn}${blindBadge}</span>
          ${weaponHtml}
        </div>
        <div class="rp-pc-row2">
          ${moneyHtml}${kdHtml}${nadesHtml}
        </div>
      </div>
    </div>`;
  }

  const ctPlayers = [], tPlayers = [];
  for (const [sid, pinfo] of Object.entries(players)) {
    if (pinfo.team === 'CT') ctPlayers.push([sid, pinfo]);
    else tPlayers.push([sid, pinfo]);
  }
  const sortFn = ([sidA, a],[sidB, b]) => {
    if (a.is_me !== b.is_me) return a.is_me ? -1 : 1;
    const aAlive = states?.[sidA]?.[2] ?? 0, bAlive = states?.[sidB]?.[2] ?? 0;
    return bAlive - aAlive;
  };
  ctPlayers.sort(sortFn);
  tPlayers.sort(sortFn);

  // Build HTML blocks
  const ctCards = ctPlayers.map(([sid,p]) => playerCard(sid, p, 'CT')).join('');
  const tCards  = tPlayers.map(([sid,p])  => playerCard(sid, p, 'T')).join('');
  const ctAlive = ctPlayers.filter(([sid]) => states?.[sid]?.[2] === 1).length;
  const tAlive  = tPlayers.filter(([sid])  => states?.[sid]?.[2] === 1).length;

  // Sidebar player panel
  const ppT = $('rpPPT'), ppCT = $('rpPPCT');
  if (ppT) {
    const hdr = ppT.querySelector('.rp-pp-team-hdr');
    ppT.innerHTML = (hdr ? hdr.outerHTML : '<div class="rp-pp-team-hdr rp-pp-t-hdr"><span>TERRORISTS</span><span class="rp-pp-alive-ct" id="rpTAliveCount"></span></div>')
      + tCards;
    const ac = ppT.querySelector('.rp-pp-alive-ct'); if(ac) ac.textContent = tAlive;
  }
  if (ppCT) {
    const hdr = ppCT.querySelector('.rp-pp-team-hdr');
    ppCT.innerHTML = (hdr ? hdr.outerHTML : '<div class="rp-pp-team-hdr rp-pp-ct-hdr"><span>COUNTER-TERRORISTS</span><span class="rp-pp-alive-ct" id="rpCTAliveCount"></span></div>')
      + ctCards;
    const ac = ppCT.querySelector('.rp-pp-alive-ct'); if(ac) ac.textContent = ctAlive;
  }

  // Also update legacy canvas-side panels (kept in DOM, now minimal)
  const ctEl = $('rpCtPanel'), tEl = $('rpTPanel');
  if (ctEl) ctEl.innerHTML = `<div class="rp-tp-hdr">CT <span style="color:var(--ct);margin-left:4px">${ctAlive}</span></div>` + ctCards;
  if (tEl)  tEl.innerHTML  = `<div class="rp-tp-hdr">T <span style="color:var(--orange);margin-left:4px">${tAlive}</span></div>` + tCards;
}

/* Fullscreen */
function rpToggleFullscreen() {
  const el = document.getElementById('v-replay');
  const btn = document.getElementById('rpFsBtn');
  if (!document.fullscreenElement) {
    el.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}
document.addEventListener('fullscreenchange', () => {
  const btn = document.getElementById('rpFsBtn');
  if (btn) btn.textContent = document.fullscreenElement ? '✕ Exit' : '⛶';
  if (rp.data) { rp._radarCache = null; rpRenderFrame(rp.frameIdx, 0); }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'f' || e.key === 'F') && currentTab === 'replay'
      && !e.target.matches('input,select,textarea')) {
    e.preventDefault();
    rpToggleFullscreen();
  }
});

/* ════════════════════════════════════
   COACHING LAYERS
   ════════════════════════════════════ */
function rpToggleLayer(name) {
  rp.layers[name] = !rp.layers[name];
  const btn = document.querySelector(`.rp-layer-btn[data-layer="${name}"]`);
  if (btn) btn.classList.toggle('active', rp.layers[name]);
  if (rp.data) rpRenderFrame(rp.frameIdx, 0);
}

// Layer 1 — Routes: full path polyline for each player, this round only
function rpLayerRoutes(ctx, wx2px, W, H) {
  const data = rp.data;
  if (!data || !data.frames) return;
  const meta = rp.roundMeta || {};
  const won = meta.result === 'win';
  const players = data.players || {};
  // Build per-player paths from all frames
  const paths = {};
  for (const [tick, states] of data.frames) {
    for (const [sid, st] of Object.entries(states)) {
      if (!st || !st.x) continue;
      if (!paths[sid]) paths[sid] = [];
      paths[sid].push(wx2px(st.x, st.y));
    }
  }
  for (const [sid, pts] of Object.entries(paths)) {
    if (pts.length < 2) continue;
    const pinfo = players[sid] || {};
    const isCT = pinfo.team === 'CT';
    const isMe = pinfo.is_me;
    const baseAlpha = isMe ? 0.85 : 0.45;
    ctx.save();
    ctx.globalAlpha = baseAlpha;
    ctx.strokeStyle = isCT
      ? (won ? '#5ec4ff' : '#2a6ea0')
      : (won ? '#ffaa44' : '#804020');
    ctx.lineWidth = isMe ? 2.5 : 1.5;
    ctx.setLineDash(isMe ? [] : [4, 3]);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.restore();
  }
}

// Layer 2 — Utility coverage: smoke/flash/molotov landing circles
function rpLayerUtility(ctx, wx2px) {
  const data = rp.data;
  if (!data || !data.events) return;
  for (const ev of data.events) {
    if (ev.t_type !== 'nade' || ev.lx == null) continue;
    const isSm = ev.gt === 'smoke';
    const isMol = ev.gt === 'molotov' || ev.gt === 'incendiary';
    const isFlash = ev.gt === 'flash';
    if (!isSm && !isMol && !isFlash) continue;
    const [cx, cy] = wx2px(ev.lx, ev.ly);
    // radius in world units: smoke ~105, molotov ~125, flash ~180
    const wRadius = isSm ? 105 : isMol ? 125 : 180;
    const calib = rp.calib;
    const pxR = wRadius / calib.scale * (rp.canvasW / 1024);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, pxR, 0, Math.PI * 2);
    ctx.fillStyle = isSm ? '#aaaacc' : isMol ? '#ff6600' : '#ffdd00';
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = isSm ? '#8888aa' : isMol ? '#dd4400' : '#ccbb00';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

// Layer 3 — Nade paths: throw→land lines with arrowhead
function rpLayerNadePaths(ctx, wx2px) {
  const data = rp.data;
  if (!data || !data.events) return;
  for (const ev of data.events) {
    if (ev.t_type !== 'nade' || ev.tx == null || ev.lx == null) continue;
    const [tx, ty] = wx2px(ev.tx, ev.ty);
    const [lx, ly] = wx2px(ev.lx, ev.ly);
    const isSm = ev.gt === 'smoke';
    const isMol = ev.gt === 'molotov' || ev.gt === 'incendiary';
    const isFlash = ev.gt === 'flash';
    const color = isSm ? '#9999cc' : isMol ? '#ff7722' : isFlash ? '#ffdd33' : '#88cc88';
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    // Arrowhead
    const angle = Math.atan2(ly - ty, lx - tx);
    const aLen = 8;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx - aLen * Math.cos(angle - 0.4), ly - aLen * Math.sin(angle - 0.4));
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx - aLen * Math.cos(angle + 0.4), ly - aLen * Math.sin(angle + 0.4));
    ctx.stroke();
    ctx.restore();
  }
}

// Layer 4 — First contact: gold ring + label at first kill event
function rpLayerContact(ctx, wx2px) {
  const data = rp.data;
  if (!data || !data.events) return;
  const kills = data.events.filter(e => e.t_type === 'kill' && e.ax != null);
  if (!kills.length) return;
  kills.sort((a, b) => a.tick - b.tick);
  const first = kills[0];
  const [cx, cy] = wx2px(first.ax, first.ay);
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#ffd700';
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('1st', cx, cy - 17);
  ctx.restore();
}

// Layer 5 — Danger zones: death heatmap from /api/position_map
function rpLayerDanger(ctx, wx2px, W, H) {
  const mapName = rp.mapName;
  if (!mapName) return;
  if (!rp._dangerCache[mapName]) {
    // Kick off fetch; render nothing until it arrives
    rp._dangerCache[mapName] = 'loading';
    fetch(`/api/position_map?map=${encodeURIComponent(mapName)}&kind=deaths&days=90`)
      .then(r => r.json())
      .then(pts => {
        rp._dangerCache[mapName] = pts;
        if (rp.layers.danger && rp.data) rpRenderFrame(rp.frameIdx, 0);
      })
      .catch(() => { rp._dangerCache[mapName] = []; });
    return;
  }
  if (rp._dangerCache[mapName] === 'loading') return;
  const pts = rp._dangerCache[mapName];
  if (!pts || !pts.length) return;

  // Determine z range for elevation coloring
  const zVals = pts.map(p => p.z).filter(z => z != null);
  const zMin = zVals.length ? Math.min(...zVals) : 0;
  const zMax = zVals.length ? Math.max(...zVals) : 0;
  const zRange = zMax - zMin || 1;

  ctx.save();
  ctx.globalAlpha = 0.45;
  for (const p of pts) {
    const wx = p.x !== undefined ? p.x : p[0];
    const wy = p.y !== undefined ? p.y : p[1];
    const [px, py] = wx2px(wx, wy);
    // Elevation color: low=warm red, mid=orange, high=cool blue-red (multi-floor maps)
    let r = 220, g = 40, b = 40;
    if (p.z != null && zRange > 50) {
      const t = (p.z - zMin) / zRange;
      if (t > 0.6) { r = 80; g = 80; b = 200; }       // upper floor = blue-ish
      else if (t > 0.35) { r = 200; g = 100; b = 50; } // mid = orange
      // else low = default red
    }
    const grad = ctx.createRadialGradient(px, py, 0, px, py, 18);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.restore();
}

// Layer 6 — All-rounds routes: one path per round for "me", green=win red=loss
function rpLayerAllRoutes(ctx, wx2px) {
  const matchId = rp.matchId;
  if (!matchId) return;
  if (!rp._allroutesCache[matchId]) {
    rp._allroutesCache[matchId] = 'loading';
    fetch(`/api/match_replays?match_id=${matchId}`)
      .then(r => r.json())
      .then(rounds => {
        rp._allroutesCache[matchId] = rounds;
        if (rp.layers.allroutes && rp.data) rpRenderFrame(rp.frameIdx, 0);
      })
      .catch(() => { rp._allroutesCache[matchId] = []; });
    return;
  }
  if (rp._allroutesCache[matchId] === 'loading') return;
  const rounds = rp._allroutesCache[matchId];
  if (!rounds || !rounds.length) return;
  const curRound = rp.roundIdx;
  for (const rd of rounds) {
    if (!rd.frames || rd.round_idx === curRound) continue;
    const won = rd.result === 'win';
    const path = [];
    for (const [, states] of rd.frames) {
      for (const [, st] of Object.entries(states)) {
        if (st && st.is_me && st.x) { path.push(wx2px(st.x, st.y)); break; }
      }
    }
    if (path.length < 2) continue;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = won ? '#44cc66' : '#cc4444';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
    ctx.stroke();
    ctx.restore();
  }
}

/* ════════════════════════════════════
   ROUND NARRATIVE SUMMARY
   ════════════════════════════════════ */
function rpGenerateNarrative() {
  const el = $('rpNarrative');
  if (!el) return;
  const data = rp.data;
  const meta = rp.roundMeta;
  if (!data || !data.events) { el.innerHTML = 'No data.'; return; }

  const players = data.players || {};
  const myName = (() => { for (const p of Object.values(players)) if (p.is_me) return p.name || 'You'; return 'You'; })();
  const sr = data.sample_rate || 64;
  const freezeTick = data.freeze_tick || 0;
  const events = data.events || [];
  const kills = events.filter(e => e.t_type === 'kill');
  const nades = events.filter(e => e.t_type === 'nade');
  const blinds = events.filter(e => e.t_type === 'blind');

  const won = meta && meta.result === 'win';
  const side = (meta && meta.side) || '?';
  const roundNum = meta && meta.round_num ? `Round ${meta.round_num}` : 'This round';

  // Find my player
  let myKills = 0, myDied = false, myWeapon = '';
  for (const k of kills) {
    if (k.is_me_attacker) myKills++;
    if (k.is_me_victim) myDied = true;
  }
  // Get my opening weapon from last frame before death/end
  const frames = data.frames || [];
  if (frames.length) {
    const lastFrame = frames[frames.length - 1];
    for (const [sid, st] of Object.entries(lastFrame[1] || {})) {
      if (players[sid] && players[sid].is_me && st[7]) { myWeapon = String(st[7]); break; }
    }
  }

  // Team stats
  let ctKills = 0, tKills = 0, teamNades = 0, enemyFlashed = 0;
  for (const k of kills) {
    const aTeam = k.attacker_team || (k.is_me_attacker ? side : '');
    if (aTeam === 'CT') ctKills++; else if (aTeam === 'T') tKills++;
  }
  for (const n of nades) {
    const nTeam = n.team || side;
    if (nTeam === side) teamNades++;
  }
  for (const b of blinds) {
    if (b.team && b.team !== side) enemyFlashed++;
  }

  const firstKill = kills.sort((a,b) => a.tick - b.tick)[0];
  const firstKillTime = firstKill ? ((firstKill.tick - freezeTick) / sr).toFixed(1) : null;
  const isClutch = kills.filter(k => k.is_me_attacker).length >= 2 && myKills >= 2;
  const econVal = meta && meta.equip_value;
  const econStr = econVal >= 4500 ? 'full buy' : econVal >= 2000 ? 'force buy' : econVal ? 'eco' : '';

  // Build narrative sentences
  const parts = [];
  const outcomeClass = won ? 'narr-win' : 'narr-loss';
  const outcomeWord = won ? 'won' : 'lost';

  parts.push(`<span class="narr-hl">${roundNum}</span> — <span class="${outcomeClass}">${side} ${outcomeWord}</span>`
    + (econStr ? ` on a <span class="narr-hl">${econStr}</span>` : '') + '.');

  if (firstKillTime) {
    const opener = firstKill.is_me_attacker ? `You opened at <span class="narr-hl">${firstKillTime}s</span>`
      : firstKill.is_me_victim ? `You were taken out early at <span class="narr-hl">${firstKillTime}s</span>`
      : `First contact at <span class="narr-hl">${firstKillTime}s</span>`;
    parts.push(opener + (firstKill.hs ? ' (headshot)' : '') + '.');
  }

  if (myKills > 0) parts.push(`You got <span class="narr-hl">${myKills} kill${myKills>1?'s':''}</span>${myWeapon ? ' with ' + myWeapon : ''}.`);
  if (myDied && myKills === 0) parts.push('You died without getting a kill this round.');
  if (isClutch) parts.push(`<span class="narr-hl">Clutch performance</span> — multiple kills under pressure.`);
  if (enemyFlashed > 0) parts.push(`Your team landed <span class="narr-hl">${enemyFlashed} flash${enemyFlashed>1?'es':''}</span> on enemies.`);
  if (teamNades >= 3) parts.push(`Heavy utility usage: <span class="narr-hl">${teamNades} grenades</span> deployed.`);

  // Coaching tip
  let tip = '';
  if (!won && !myDied && myKills === 0) tip = 'Tip: You survived but made no impact — look for lurk trades or info plays.';
  else if (!won && myDied && firstKill && firstKill.is_me_victim && parseFloat(firstKillTime) < 20) tip = 'Tip: Early death hurt the round. Consider a safer angle or wait for utility.';
  else if (won && myKills >= 2) tip = 'Nice round — review your positioning to understand why those angles worked.';
  else if (!won && enemyFlashed === 0 && teamNades < 2) tip = 'Tip: No utility used on entry — smokes and flashes before pushing can change outcomes.';

  el.innerHTML = parts.join(' ') + (tip ? `<span class="narr-tip">${tip}</span>` : '');
}

/* ════════════════════════════════════
   UTILITY TENDENCY PANEL
   ════════════════════════════════════ */
async function rpLoadUtilTend() {
  const map = rp.mapName;
  if (!map) { $('utBody').innerHTML = '<span style="color:var(--mu);font-size:10px">Select a match first.</span>'; return; }
  const side = ($('utSide') && $('utSide').value) || 'all';
  const nade = ($('utNade') && $('utNade').value) || 'all';
  $('utBody').innerHTML = '<div class="spin">Loading…</div>';
  try {
    const params = new URLSearchParams({map, side, nade_type: nade, days: 180, group_by: 'player'});
    const res = await fetch(`/api/util_tendency?${params}`);
    if (!res.ok) { $('utBody').innerHTML = '<span style="color:var(--mu)">No data.</span>'; return; }
    const data = await res.json();
    rpRenderUtilTend(data);
  } catch(e) {
    $('utBody').innerHTML = '<span style="color:var(--mu)">Error loading data.</span>';
  }
}

function rpRenderUtilTend(players) {
  const el = $('utBody');
  if (!players || !players.length) { el.innerHTML = '<span style="color:var(--mu);font-size:10px">No grenade data for this map yet.</span>'; return; }
  const nadeColors = {smoke:'#9999cc', flash:'#ddcc33', molotov:'#ff7722', he:'#88cc44'};
  const html = `<div class="util-tend-grid">${players.map(p => {
    const total = p.total || 1;
    const pctSm  = Math.round((p.smokes||0)/total*100);
    const pctFl  = Math.round((p.flashes||0)/total*100);
    const pctMol = Math.round((p.molotovs||0)/total*100);
    const pctHe  = Math.round((p.he||0)/total*100);
    const rows = [
      p.smokes   ? `<div class="util-tend-row"><span>Smoke</span><span>${p.smokes} (${pctSm}%)</span></div><div class="util-tend-bar" style="width:${pctSm}%;background:#9999cc"></div>` : '',
      p.flashes  ? `<div class="util-tend-row"><span>Flash</span><span>${p.flashes} (${pctFl}%)</span></div><div class="util-tend-bar" style="width:${pctFl}%;background:#ddcc33"></div>` : '',
      p.molotovs ? `<div class="util-tend-row"><span>Molotov</span><span>${p.molotovs} (${pctMol}%)</span></div><div class="util-tend-bar" style="width:${pctMol}%;background:#ff7722"></div>` : '',
      p.he       ? `<div class="util-tend-row"><span>HE</span><span>${p.he} (${pctHe}%)</span></div><div class="util-tend-bar" style="width:${pctHe}%;background:#88cc44"></div>` : '',
    ].filter(Boolean).join('');
    return `<div class="util-tend-card">
      <div class="util-tend-name" title="${p.player}">${p.player}</div>
      <div style="font-size:8px;color:var(--mu);margin-bottom:4px">${total} nades · ${p.rounds||0} rounds</div>
      ${rows}
    </div>`;
  }).join('')}</div>`;
  el.innerHTML = html;
}

/* ════════════════════════════════════
   FEATURE 2: Scrubber event markers
   ════════════════════════════════════ */
function rpDrawScrubMarkers() {
  const canvas = $('rpScrubMarkers');
  if (!canvas || !rp.data) return;
  const W = canvas.offsetWidth || canvas.parentElement.offsetWidth || 300;
  canvas.width = W;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, canvas.height);
  const data = rp.data;
  const freeze = data.freeze_tick || 0;
  const end    = data.end_tick   || freeze + 1;
  const range  = end - freeze || 1;
  const H = canvas.height;
  const mySide = (rp.roundMeta && rp.roundMeta.side) || 'CT';
  const events = data.events || [];

  // Layer 1: damage events (subtle, half-height)
  for (const ev of events) {
    if (ev.t_type !== 'dmg' || ev.tick == null) continue;
    const pct = (ev.tick - freeze) / range;
    if (pct < 0 || pct > 1) continue;
    const x = Math.round(pct * (W - 1));
    if (ev.you) {
      // My hit on enemy — yellow, bottom half
      ctx.fillStyle = 'rgba(210,170,40,0.6)';
      ctx.fillRect(x, Math.round(H * 0.45), 1, Math.round(H * 0.55));
    } else {
      // Enemy hit on me — orange, top half
      ctx.fillStyle = 'rgba(200,80,40,0.6)';
      ctx.fillRect(x, 0, 1, Math.round(H * 0.55));
    }
  }
  // Layer 2: nade events
  for (const ev of events) {
    if (ev.t_type !== 'nade' || ev.tick == null) continue;
    const pct = (ev.tick - freeze) / range;
    if (pct < 0 || pct > 1) continue;
    const x = Math.round(pct * (W - 1));
    ctx.fillStyle = mySide === 'CT' ? 'rgba(78,158,212,0.65)' : 'rgba(212,128,74,0.65)';
    ctx.fillRect(x, 0, 1, H);
  }
  // Layer 3: kill events (boldest, on top)
  for (const ev of events) {
    if (ev.t_type !== 'kill' || ev.tick == null) continue;
    const pct = (ev.tick - freeze) / range;
    if (pct < 0 || pct > 1) continue;
    const x = Math.round(pct * (W - 1));
    ctx.fillStyle = ev.iv ? '#e04444' : '#4aaa6a';
    ctx.fillRect(x, 0, 2, H);
  }
}

/* ════════════════════════════════════
   FEATURE 3: Pattern mode heatmap
   ════════════════════════════════════ */
function rpTogglePatterns() {
  rp.patternMode = !rp.patternMode;
  const btn = $('rpPatternBtn');
  btn.classList.toggle('active', rp.patternMode);
  if (rp.patternMode) {
    rp.allMatchMode = false;
    $('rpAllMatchBtn').classList.remove('active');
    rpStopPlay();
    rpRenderPatterns();
  } else {
    rpRenderFrame(rp.frameIdx, 0);
  }
}

async function rpRenderPatterns() {
  rpResizeCanvas();
  const canvas = $('rpCanvas');
  if (!canvas || !rp.selectedMatchId) return;
  if (!rp._ctx || rp._ctx.canvas !== canvas) rp._ctx = canvas.getContext('2d');
  const ctx = rp._ctx;
  const W = rp.canvasW, H = rp.canvasH;
  if (!W || !H) return;

  // Draw background — use pre-baked radar (darker overlay for pattern mode)
  ctx.clearRect(0, 0, W, H);
  if (!rp._radarCache && rp.radarImgLoaded) rpBakeRadar();
  if (rp._radarCache) {
    ctx.drawImage(rp._radarCache, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';  // extra dim for pattern mode
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#0d0e11';
    ctx.fillRect(0, 0, W, H);
  }

  if (!rp.calib) return;

  // Fetch all rounds we don't have cached yet
  const targetRounds = rpFilteredRounds();
  const fetches = targetRounds.map(async r => {
    const key = `${rp.selectedMatchId}:${r.round_num}`;
    if (!rp.roundCache[key]) {
      try {
        const res = await fetch(`/api/round_replay?match_id=${rp.selectedMatchId}&round=${r.round_num}`);
        if (res.ok) rp.roundCache[key] = await res.json();
      } catch(e) {}
    }
    return rp.roundCache[key];
  });
  await Promise.all(fetches);

  // Build 128x128 density grid for alive positions (MY player)
  const GRID = 128;
  const grid = new Float32Array(GRID * GRID);
  const deaths = [];
  const calib = rp.calib;

  function wx2norm(wx, wy) {
    const px = (wx - calib.origin_x) / calib.scale / 1024;
    const py = (calib.origin_y - wy) / calib.scale / 1024;
    return [px, py];
  }

  for (const r of targetRounds) {
    const key = `${rp.selectedMatchId}:${r.round_num}`;
    const data = rp.roundCache[key];
    if (!data || !data.frames || !data.players) continue;
    // Find my player key
    let myKey = null;
    for (const [k, p] of Object.entries(data.players)) {
      if (p.is_me) { myKey = k; break; }
    }
    if (!myKey) continue;
    for (const frame of data.frames) {
      const states = frame[1];
      const ps = states && states[myKey];
      if (!ps || ps[2] !== 1) continue; // must be alive
      const [nx, ny] = wx2norm(ps[0], ps[1]);
      const gi = Math.floor(nx * GRID), gj = Math.floor(ny * GRID);
      if (gi >= 0 && gi < GRID && gj >= 0 && gj < GRID) {
        grid[gj * GRID + gi]++;
      }
    }
    // Collect death positions from kill events
    for (const ev of (data.events || [])) {
      if (ev.t_type === 'kill' && ev.iv && ev.x != null && ev.y != null) {
        deaths.push([ev.x, ev.y]);
      }
    }
  }

  const maxVal = Math.max(1, ...grid);

  // Render density as orange heat
  for (let gj = 0; gj < GRID; gj++) {
    for (let gi = 0; gi < GRID; gi++) {
      const v = grid[gj * GRID + gi];
      if (v === 0) continue;
      const density = v / maxVal;
      const alpha = Math.pow(density, 0.5) * 0.75;
      const x = (gi / GRID) * W;
      const y = (gj / GRID) * H;
      const cw = W / GRID + 1, ch = H / GRID + 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      // Orange gradient from low (blue-purple) to high (orange-yellow)
      const r2 = Math.round(224 * density + 80 * (1-density));
      const g2 = Math.round(120 * density + 60 * (1-density));
      const b2 = Math.round(40  * density + 180 * (1-density));
      ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
      ctx.fillRect(x, y, cw, ch);
      ctx.restore();
    }
  }

  // Red X markers for deaths
  for (const [wx, wy] of deaths) {
    const [nx, ny] = wx2norm(wx, wy);
    const px = nx * W, py = ny * H;
    if (px < 0 || px > W || py < 0 || py > H) continue;
    const s = 5;
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#e04444';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px-s, py-s); ctx.lineTo(px+s, py+s);
    ctx.moveTo(px+s, py-s); ctx.lineTo(px-s, py+s);
    ctx.stroke();
    ctx.restore();
  }

  // Label
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(4, 4, 160, 20);
  ctx.fillStyle = '#e07828';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Pattern: ${targetRounds.length} rounds · ${deaths.length} deaths`, 8, 14);
  ctx.restore();
}

/* ════════════════════════════════════
   FEATURE: Multi-match position overlay
   ════════════════════════════════════ */

function rpToggleAllMatches() {
  rp.allMatchMode = !rp.allMatchMode;
  const btn = $('rpAllMatchBtn');
  btn.classList.toggle('active', rp.allMatchMode);
  if (rp.allMatchMode) {
    rp.patternMode = false;
    $('rpPatternBtn').classList.remove('active');
    rpStopPlay();
    rpRenderAllMatchOverlay();
  } else {
    rpRenderFrame(rp.frameIdx, 0);
  }
}

async function rpRenderAllMatchOverlay() {
  rpResizeCanvas();
  const canvas = $('rpCanvas');
  if (!canvas || !rp.selectedMatch) return;
  if (!rp._ctx || rp._ctx.canvas !== canvas) rp._ctx = canvas.getContext('2d');
  const ctx = rp._ctx;
  const W = rp.canvasW, H = rp.canvasH;
  if (!W || !H || !rp.calib) return;

  ctx.clearRect(0, 0, W, H);
  if (!rp._radarCache && rp.radarImgLoaded) rpBakeRadar();
  if (rp._radarCache) {
    ctx.drawImage(rp._radarCache, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#0d0e11';
    ctx.fillRect(0, 0, W, H);
  }

  const map = rp.selectedMatch.map;
  const days = sel('s-days');
  const cacheKey = `${map}-${days}`;
  if (!rp._allMatchCache[cacheKey]) {
    try {
      const [kills, deaths] = await Promise.all([
        fetch(`/api/position_map?map=${map}&side=all&days=${days}&kind=kills`).then(r=>r.json()),
        fetch(`/api/position_map?map=${map}&side=all&days=${days}&kind=deaths`).then(r=>r.json()),
      ]);
      rp._allMatchCache[cacheKey] = {kills, deaths};
    } catch(e) { return; }
  }
  const {kills, deaths} = rp._allMatchCache[cacheKey];

  const calib = rp.calib;
  const wx2pxAM = (wx, wy) => [
    (wx - calib.origin_x) / calib.scale * (W / 1024),
    (calib.origin_y - wy) / calib.scale * (H / 1024)
  ];
  const drawDots = (pts, color, r) => {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = color;
    for (const p of pts) {
      const [px, py] = wx2pxAM(p.x, p.y);
      if (px < 0 || px > W || py < 0 || py > H) continue;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  };
  drawDots(deaths, '#e04444', 3);
  drawDots(kills,  '#4aaa6a', 3);

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(4, 4, 200, 20);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`All matches · ${kills.length} kills · ${deaths.length} deaths (${days}d)`, 8, 14);
  ctx.restore();
}

/* ════════════════════════════════════
   FEATURE: Export replay PNG
   ════════════════════════════════════ */
function rpExportPNG() {
  const m = rp.selectedMatch;
  if (!m) { alert('Open a match first'); return; }

  const outW = 900, outH = 540;
  const off = document.createElement('canvas');
  off.width = outW; off.height = outH;
  const ctx = off.getContext('2d');

  // Background
  ctx.fillStyle = '#0d0e11';
  ctx.fillRect(0, 0, outW, outH);

  // Copy radar canvas
  const src = $('rpCanvas');
  if (src) {
    const radarSize = Math.min(outH - 20, outW - 280);
    ctx.drawImage(src, 10, 10, radarSize, radarSize);
  }

  // Stats panel
  const sx = outH - 10;
  ctx.fillStyle = '#161820';
  ctx.fillRect(sx, 0, outW - sx, outH);

  const agg = m.kpis || {};
  const lines = [
    [m.map ? m.map.replace('de_','').toUpperCase() : '—', '#e07828', 22, 700],
    [`${m.team_score ?? '?'} : ${m.opp_score ?? '?'}`, m.won ? '#4aaa6a' : '#c44040', 16, 700],
    [m.played_at ? m.played_at.slice(0,10) : '', '#888', 11, 400],
    ['', '', 0, 400],
    [`K/D   ${agg.kd ?? '—'}`, '#fff', 13, 600],
    [`ADR   ${agg.adr ?? '—'}`, '#fff', 13, 600],
    [`HS%   ${typeof agg.hs_pct !== 'undefined' ? agg.hs_pct+'%' : '—'}`, '#fff', 13, 600],
    [`Kills  ${agg.kills ?? '—'}`, '#fff', 13, 600],
    [`Deaths ${agg.deaths ?? '—'}`, '#fff', 13, 600],
  ];
  let ly = 30;
  for (const [txt, col, size, weight] of lines) {
    if (!size) { ly += 10; continue; }
    ctx.fillStyle = col;
    ctx.font = `${weight} ${size}px system-ui`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(txt, sx + 12, ly);
    ly += size + 8;
  }

  ctx.fillStyle = '#e07828';
  ctx.font = 'bold 10px system-ui';
  ctx.fillText('cs2owl', outW - 60, outH - 16);

  off.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const map = (m.map || 'match').replace('de_','');
    a.download = `cs2owl_${map}_${(m.played_at||'').slice(0,10)}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}


/* ════════════════════════════════════
   FEATURE 4: Kill feed panel
   ════════════════════════════════════ */
/* ── weapon icon helpers ── */
const WEAPON_ICON_MAP = {
  // internal names (from kill/damage events)
  ak47:'ak47', m4a1:'m4a1', m4a1_silencer:'m4a1', m4a4:'m4a4',
  awp:'awp', sg553:'sg553', aug:'aug', ssg08:'ssg08', g3sg1:'g3sg1', scar20:'scar20',
  glock:'glock', usp_s:'usps', p2000:'p2000', p250:'p250', fiveseven:'five-seven',
  deagle:'deagle', cz75a:'cz75a', tec9:'tec9', revolver:'revolver',
  mac10:'mac10', mp5sd:'mp5sd', mp7:'mp7', mp9:'mp9', p90:'p90', bizon:'bizon', ump45:'ump45',
  famas:'famas', galilar:'galilar', m249:'m249', negev:'negev',
  nova:'nova', xm1014:'xm1014', mag7:'mag7', sawed_off:'sawed-off',
  hegrenade:'he-grenade', flashbang:'flashbang', smokegrenade:'smoke-grenade',
  smoke:'smoke-grenade', flash:'flashbang', molotov:'molotov', incgrenade:'incendiary-grenade',
  inferno:'molotov', decoy:'decoy', planted_c4:'bomb', c4:'bomb', zeus:'zeus',
  // display names (from active_weapon_name tick property)
  'ak-47':'ak47', 'm4a4':'m4a4', 'm4a1-s':'m4a1', 'awp':'awp',
  'glock-18':'glock', 'usp-s':'usps', 'p2000':'p2000', 'p250':'p250',
  'five-seven':'five-seven', 'cz75-auto':'cz75a', 'tec-9':'tec9',
  'desert eagle':'deagle', 'r8 revolver':'revolver',
  'mac-10':'mac10', 'mp5-sd':'mp5sd', 'mp7':'mp7', 'mp9':'mp9',
  'p90':'p90', 'pp-bizon':'bizon', 'ump-45':'ump45',
  'sg 553':'sg553', 'aug':'aug', 'ssg 08':'ssg08', 'g3sg1':'g3sg1', 'scar-20':'scar20',
  'famas':'famas', 'galil ar':'galilar', 'm249':'m249', 'negev':'negev',
  'nova':'nova', 'xm1014':'xm1014', 'mag-7':'mag7', 'sawed-off':'sawed-off',
  'dual berettas':'elite',
  'high explosive grenade':'he-grenade', 'flashbang':'flashbang',
  'smoke grenade':'smoke-grenade', 'molotov':'molotov',
  'incendiary grenade':'incendiary-grenade', 'decoy grenade':'decoy',
  'c4 explosive':'bomb', 'zeus x27':'zeus',
  // knives — all map to the single knife icon
  'knife':'knife', 'knife_t':'knife', 'karambit':'knife', 'bayonet':'knife',
  'm9 bayonet':'knife', 'gut knife':'knife', 'flip knife':'knife', 'bowie knife':'knife',
  'butterfly knife':'knife', 'falchion knife':'knife', 'huntsman knife':'knife',
  'navaja knife':'knife', 'stiletto knife':'knife', 'talon knife':'knife',
  'ursus knife':'knife', 'nomad knife':'knife', 'skeleton knife':'knife',
  'paracord knife':'knife', 'survival knife':'knife', 'shadow daggers':'knife',
  'kukri knife':'knife',
  // misc
  'sawed-off':'sawed-off', 'aug':'aug', 'g3sg1':'g3sg1',
};
const _wImgCache = {};
function wIconSrc(w) {
  const fn = WEAPON_ICON_MAP[(w||'').toLowerCase()] || 'world';
  return `/static/icons/weapons/${fn}.svg`;
}
function wImg(w) {
  const src = wIconSrc(w);
  if (!_wImgCache[src]) {
    const img = new Image(); img.src = src;
    _wImgCache[src] = img;
  }
  return _wImgCache[src];
}

const HG_NAMES = {0:'BODY',1:'HEAD',2:'CHEST',3:'STOMACH',4:'L.ARM',5:'R.ARM',6:'L.LEG',7:'R.LEG'};

function rpPopulateKillFeed() {
  const panel = $('rpKillFeedPanel');
  const list  = $('rpKillFeedList');
  if (!rp.data) { if(panel) panel.style.display = 'none'; return; }
  // panel stays hidden — events are surfaced in coach chips instead
  const data = rp.data;
  const freeze = data.freeze_tick || 0;
  const myName = (() => {
    for (const p of Object.values(data.players || {})) if (p.is_me) return p.name || 'You';
    return 'You';
  })();

  const allEvents = (data.events || [])
    .filter(ev => ev.t_type === 'kill' || ev.t_type === 'nade' || (ev.t_type === 'dmg' && ev.you))
    .sort((a, b) => (a.tick || 0) - (b.tick || 0));

  function tickToTime(tick) {
    const secs = (tick - freeze) / 64;
    const s2 = Math.abs(Math.round(secs));
    return (secs < 0 ? '-' : '') + Math.floor(s2/60) + ':' + String(s2%60).padStart(2,'0');
  }

  list.innerHTML = allEvents.map((ev, i) => {
    const tick = ev.tick || 0;
    const t = tickToTime(tick);
    let cls = '', inner = '';

    if (ev.t_type === 'kill') {
      cls = ev.iv ? 'rp-kf-death' : 'rp-kf-kill';
      const hs = ev.hs ? '<span class="rp-kf-hs">&#128128;</span>' : '';
      const icon = `<img class="wicon-sm" src="${wIconSrc(ev.w)}" alt="${ev.w||''}">`;
      if (!ev.iv) {
        inner = `<div class="rp-kf-names"><span class="rp-kf-you">${myName}</span>${icon}<span class="rp-kf-enemy">Enemy</span>${hs}</div>`;
      } else {
        inner = `<div class="rp-kf-names"><span class="rp-kf-enemy">Enemy</span>${icon}<span class="rp-kf-you">${myName}</span>${hs}</div>`;
      }
    } else if (ev.t_type === 'nade') {
      cls = 'rp-kf-nade';
      const icon = `<img class="wicon-sm" src="${wIconSrc(ev.gt || 'smoke')}" alt="${ev.gt||'nade'}">`;
      inner = `<div class="rp-kf-names">${icon}<span style="color:var(--mu)">${ev.gt||'nade'} thrown</span></div>`;
    } else if (ev.t_type === 'dmg') {
      cls = 'rp-kf-dmg';
      const hgName = HG_NAMES[ev.hg] || 'BODY';
      const icon = `<img class="wicon-sm" src="${wIconSrc(ev.w)}" alt="${ev.w||''}">`;
      inner = `<div class="rp-kf-names">${icon}<span>hit <b>${hgName}</b> ${ev.dmg}hp</span></div>`;
    }

    return `<div class="rp-kf-row ${cls}" data-tick="${tick}" data-idx="${i}">
      <span class="rp-kf-time">${t}</span>${inner}
    </div>`;
  }).join('');

  // Populate coach event chips from kill events only (most actionable)
  const chipsEl = $('rpEventChips');
  if (chipsEl) {
    const kills = allEvents.filter(ev => ev.t_type === 'kill');
    if (!kills.length) {
      chipsEl.innerHTML = '';
    } else {
      chipsEl.innerHTML = kills.map((ev, i) => {
        const t = tickToTime(ev.tick || 0);
        const action = ev.iv ? `Died at ${t}${ev.w?' to '+ev.w:''}` : `Kill at ${t}${ev.w?' with '+ev.w:''}${ev.hs?' (HS)':''}`;
        const cls = ev.iv ? 'rp-ev-death' : 'rp-ev-kill';
        const q = ev.iv
          ? `At ${t} I died to ${ev.w||'an enemy'}. Why did I lose this duel and what should I have done?`
          : `At ${t} I got a kill with ${ev.w||'a weapon'}${ev.hs?' (headshot)':''}. What did I do well here?`;
        return `<button class="rp-ev-chip ${cls}" onclick="rpCoachEvent(${JSON.stringify(q)})" title="${action}">${action}</button>`;
      }).join('');
    }
  }
}

function rpCoachEvent(q) {
  const inp = $('rpCoachInput');
  if (inp) { inp.value = q; inp.focus(); }
  const area = $('rpCoachArea');
  if (area && !area.classList.contains('open')) rpToggleCoach();
}

function rpHighlightKillFeed(interpTick, sr) {
  const list = $('rpKillFeedList');
  if (!list) return;
  list.querySelectorAll('.rp-kf-row').forEach(row => {
    const tick = parseFloat(row.dataset.tick) || 0;
    row.classList.toggle('active', Math.abs(tick - interpTick) <= sr);
  });
}

/* ════════════════════════════════════
   FEATURE 5: Aim placement panel
   ════════════════════════════════════ */
function rpRenderAimPanel(interpTick, sr) {
  const panel = $('rpAimPanel');
  const canvas = $('rpAimCanvas');
  if (!panel || !canvas) return;
  if (!rp.data) { panel.style.display = 'none'; return; }
  panel.style.display = '';

  const data = rp.data;
  // Collect dmg events near interpTick (within ±2*sr)
  const window2 = sr * 2;
  const now = performance.now();
  const dmgEvents = (data.events || []).filter(ev =>
    ev.t_type === 'dmg' && Math.abs((ev.tick || 0) - interpTick) <= window2
  );

  // Track flash intensity per region (last 8 events)
  const regionFlash = {}; // hg → {alpha, you}
  for (const ev of dmgEvents.slice(-8)) {
    const age = Math.abs((ev.tick || 0) - interpTick) / sr; // 0=fresh, 2=fading
    const alpha = Math.max(0, 1 - age / 2);
    const hg = ev.hg || 0;
    if (!regionFlash[hg] || regionFlash[hg].alpha < alpha) {
      regionFlash[hg] = {alpha, you: ev.you};
    }
  }

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Silhouette colors
  const silColor = '#2a2c36';
  const hitYou   = '#4aaa6a'; // green = my hit on enemy
  const hitMe    = '#e04444'; // red   = hit on me

  function flashCol(hg) {
    const f = regionFlash[hg];
    if (!f || f.alpha <= 0) return null;
    return {color: f.you ? hitYou : hitMe, alpha: f.alpha};
  }
  function drawRegion(hg, drawFn) {
    const f = flashCol(hg);
    ctx.save();
    ctx.beginPath();
    drawFn();
    ctx.fillStyle = silColor;
    ctx.fill();
    if (f) {
      ctx.globalAlpha = f.alpha * 0.85;
      ctx.fillStyle = f.color;
      ctx.fill();
    }
    ctx.restore();
  }

  const cx = W / 2;
  // Head (hg=1): circle
  drawRegion(1, () => { ctx.arc(cx, 22, 14, 0, Math.PI*2); });
  // Chest (hg=2): upper torso
  drawRegion(2, () => { ctx.rect(cx-16, 38, 32, 30); });
  // Stomach (hg=3): lower torso
  drawRegion(3, () => { ctx.rect(cx-14, 68, 28, 22); });
  // Left arm (hg=4): right side of canvas (player's left)
  drawRegion(4, () => { ctx.rect(cx+16, 38, 12, 40); });
  // Right arm (hg=5): left side of canvas
  drawRegion(5, () => { ctx.rect(cx-28, 38, 12, 40); });
  // Left leg (hg=6)
  drawRegion(6, () => { ctx.rect(cx+2, 90, 12, 45); });
  // Right leg (hg=7)
  drawRegion(7, () => { ctx.rect(cx-14, 90, 12, 45); });
  // Body fallback (hg=0)
  drawRegion(0, () => { ctx.rect(cx-16, 38, 32, 74); });

  // HS stat
  const myKills = (data.events || []).filter(ev => ev.t_type === 'dmg' && ev.you && ev.died);
  const hsKills = myKills.filter(ev => ev.hg === 1);
  const hsPct   = myKills.length > 0 ? Math.round(100 * hsKills.length / myKills.length) : null;
  $('rpAimStat').textContent = hsPct != null ? `Aim: ${hsPct}% HS this round` : 'Aim: — HS';
}

/* ════════════════════════════════════
   FEATURE 6: Coach → round links
   ════════════════════════════════════ */
function rpPostProcessCoachLinks(el) {
  el.querySelectorAll('p, li').forEach(node => {
    node.innerHTML = node.innerHTML.replace(
      /[Rr]ound\s+(\d+)/g,
      (m, n) => `<a href="#" style="color:var(--orange);text-decoration:none" onclick="rpSelectRound(${n});return false">${m}</a>`
    );
  });
}

/* ── coach integration ── */
function rpBuildCoachContext(rd) {
  if (!rd || !rp.selectedMatch) return '';
  const m = rp.selectedMatch;
  const map = (m.map || '').replace('de_','');
  let q = `Round ${rd.round_num} on ${map} (${rd.side}, ${rd.round_won ? 'won' : 'lost'}): ${rd.kills}K / ${rd.damage} dmg`;
  if (rd.was_clutch) q += `, 1v${rd.clutch_vs} clutch${rd.clutch_won ? ' won' : ' lost'}`;
  if (rd.opening_kill) q += ', got opening kill';
  if (rd.opening_death) q += ', died first';
  if (rd.planted_bomb) q += ', planted bomb';
  q += '. What went wrong and what should I improve?';
  return q;
}

/* ── Python deterministic round coach ── */
async function rpLoadPythonCoach() {
  const meta = rp.roundMeta;
  if (!meta || !meta.match_id || !meta.round_num) return;
  const ans = $('rpCoachAnswer');
  if (ans) ans.innerHTML = '<div style="color:var(--mu);font-size:10px;padding:4px 0">Analysing round…</div>';

  try {
    const d = await fetch(`/api/round_coach?match_id=${encodeURIComponent(meta.match_id)}&round=${meta.round_num}`)
                    .then(r => r.json());
    if (ans) ans.innerHTML = _renderPythonCoach(d);
    // Auto-open coach area
    const area = $('rpCoachArea');
    if (area && !area.classList.contains('open')) rpToggleCoach();
  } catch(e) {
    if (ans) ans.innerHTML = '';
  }
}

function _renderPythonCoach(d) {
  const outcome = d.won
    ? `<span class="narr-win">${d.side} won</span>`
    : `<span class="narr-loss">${d.side} lost</span>`;
  const buy = d.buy_type ? ` · ${d.buy_type}` : '';
  const stats = d.stats || {};
  const statsLine = [
    stats.kills != null ? `${stats.kills}K` : null,
    stats.damage != null ? `${stats.damage} dmg` : null,
    stats.hs_pct != null && stats.kills > 0 ? `${stats.hs_pct}% HS` : null,
  ].filter(Boolean).join(' · ');

  const mkRows = (arr, icon, cls) => arr.map(item =>
    `<div class="pc-row pc-${cls}">
      <span class="pc-icon">${icon}</span>
      <div>
        <div class="pc-title">${item.title}</div>
        <div class="pc-detail">${item.detail}</div>
      </div>
    </div>`
  ).join('');

  const strengths = d.strengths?.length
    ? `<div class="pc-section-lbl pc-lbl-s">What worked</div>${mkRows(d.strengths, '✓', 'strength')}`
    : '';
  const fixes = d.fixes?.length
    ? `<div class="pc-section-lbl pc-lbl-f">Fix these</div>${mkRows(d.fixes, '✗', 'fix')}`
    : '';

  return `
    <div class="pc-header">${outcome}${buy}${statsLine ? ' · ' + statsLine : ''}</div>
    ${strengths}${fixes}
    ${d.strengths?.length || d.fixes?.length ? '' : '<div style="color:var(--mu);font-size:10px;padding:4px">No coaching signals for this round.</div>'}
    <div class="pc-ask-prompt">Ask a follow-up about a specific moment below ↓</div>`;
}

function rpToggleCoach() {
  const area = $('rpCoachArea');
  const open = area.classList.toggle('open');
  $('rpCoachCaret').textContent = open ? '▾' : '▸';
}

async function rpAskCoach() {
  const q = $('rpCoachInput').value.trim();
  if (!q) return;
  const ans = $('rpCoachAnswer');
  ans.innerHTML = '<div class="spin">Thinking…</div>';
  const map = rp.selectedMatch ? rp.selectedMatch.map : '';
  try {
    const r = await fetch(`/ask?q=${encodeURIComponent(q)}&map=${map}&days=90&html=true`);
    const data = await r.json();
    ans.innerHTML = data.html || data.answer || '<em>No response</em>';
    rpPostProcessCoachLinks(ans);
  } catch(e) {
    ans.innerHTML = '<em>Error reaching coach</em>';
  }
}

/* ════════════════════════════════════
   FEATURE 7: Round Storyboard Review
   ════════════════════════════════════ */
async function rpOpenReview() {
  if (!rp.selectedMatch || rp.currentRound == null) return;
  const sb = $('rpStoryboard');
  const strip = $('rpSbStrip');
  sb.style.display = 'block';
  strip.innerHTML = '<div class="spin" style="padding:16px 0">Rendering frames…</div>';
  try {
    const mid = rp.selectedMatch.match_id;
    const rnum = rp.currentRound;
    const r = await fetch(`/api/round_review?match_id=${encodeURIComponent(mid)}&round=${rnum}`);
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    rpRenderStoryboard(data);
  } catch(e) {
    strip.innerHTML = `<div class="rp-sb-err">${e.message || 'Failed to load review'}</div>`;
  }
}

function rpCloseReview() {
  const sb = $('rpStoryboard');
  sb.style.display = 'none';
  $('rpSbStrip').innerHTML = '';
}

function rpRenderStoryboard(data) {
  const strip = $('rpSbStrip');
  if (!data.frames || !data.frames.length) {
    strip.innerHTML = '<div class="rp-sb-err">No replay data for this round.</div>';
    return;
  }
  strip.innerHTML = data.frames.map(f => {
    const imgSrc = f.image ? `data:image/jpeg;base64,${f.image}` : '';
    const imgTag = imgSrc
      ? `<img class="rp-sb-img" src="${imgSrc}" alt="${f.label || ''}">`
      : `<div class="rp-sb-img rp-sb-img-empty">—</div>`;
    const comment = f.comment ? `<div class="rp-sb-comment">${_escHtml(f.comment)}</div>` : '';
    return `<div class="rp-sb-frame">
      ${imgTag}
      <div class="rp-sb-label">${_escHtml(f.label || '')}</div>
      ${comment}
    </div>`;
  }).join('');
}

function _escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/* ════════════════════════════════════
   v2 REDESIGN — sidebar, carousel, tiles
   ════════════════════════════════════ */

/* ── Navigate to a specific map from the tile grid ── */
function loadMap(name) {
  document.querySelectorAll('.sidebar-nav-item, .mobile-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.view === 'maps')
  );
  switchTab(name);
}

/* ── Map tiles grid (Overview row 3) ── */
function _updateMapTiles(rows) {
  const container = document.getElementById('map-tiles');
  if (!container || !rows?.length) return;
  container.innerHTML = rows.map(r => {
    const display = (r.map||'').replace('de_','').toUpperCase();
    const winCls  = sc(r.win_pct, 55, 45);
    const kdCls   = sc(r.kd, 1.1, 0.9);
    const adrCls  = sc(r.adr, 85, 70);
    return `<div class="map-tile" onclick="loadMap('${r.map}')">
      <div class="map-tile-name">${display}</div>
      <div class="map-tile-stats">
        <div class="map-tile-stat">
          <div class="val">${r.matches||'—'}</div>
          <div class="lbl">Matches</div>
        </div>
        <div class="map-tile-stat">
          <div class="val ${winCls}">${r.win_pct!=null?r.win_pct+'%':'—'}</div>
          <div class="lbl">Win %</div>
        </div>
        <div class="map-tile-stat">
          <div class="val ${kdCls}">${r.kd||'—'}</div>
          <div class="lbl">K / D</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ── Rank graph toggle (Overview row 1) ── */
let _rankTrendData = null;
let _rankEloData   = null;

function _applyRankToggle(_mode) {
  renderDualTrend(_rankTrendData, _rankEloData, 'd-trend');
}

(function _wireRankToggle() {
  const tog = document.getElementById('rank-graph-toggle');
  if (!tog) return;
  const saved = localStorage.getItem('rank_display') || 'both';
  tog.value = saved;
  tog.addEventListener('change', () => {
    localStorage.setItem('rank_display', tog.value);
    _applyRankToggle(tog.value);
  });
})();

/* ── Carousel auto-advance (7s, pause on hover) ── */
(function _initCarousel() {
  if (typeof goCarousel !== 'function') return;
  const INTERVAL = 7000;
  let timer;

  function advance() {
    const slides = document.getElementById('carousel-slides');
    if (!slides) return;
    const next = ((_carouselIdx || 0) + 1) % slides.children.length;
    goCarousel(next);
  }

  function start() { timer = setInterval(advance, INTERVAL); }
  function stop()  { clearInterval(timer); }

  start();

  const wrap = document.getElementById('carousel-wrap');
  if (wrap) {
    wrap.addEventListener('mouseenter', stop);
    wrap.addEventListener('mouseleave', start);
  }
})();

/* ── Coaching companion: override inline HTML version to use /ask ── */
function sendChatMessage() {
  const inp  = document.getElementById('chat-input');
  const msgs = document.getElementById('chat-messages');
  const welcome = document.getElementById('chat-welcome');
  if (!inp || !msgs) return;
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  if (welcome) welcome.style.display = 'none';

  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user';
  userMsg.textContent = text;
  msgs.appendChild(userMsg);

  const aiMsg = document.createElement('div');
  aiMsg.className = 'chat-msg ai';
  aiMsg.innerHTML = '<span style="color:var(--mu)">Thinking…</span>';
  msgs.appendChild(aiMsg);
  msgs.scrollTop = msgs.scrollHeight;

  const scope = document.getElementById('chat-scope')?.value || 'overview';
  const map   = scope !== 'overview' ? scope : (currentTab?.startsWith('de_') ? currentTab : '');
  const days  = document.getElementById('s-days')?.value || '90';

  fetch(`/ask?q=${encodeURIComponent(text)}&map=${encodeURIComponent(map)}&days=${days}&html=true`)
    .then(r => r.json())
    .then(data => {
      aiMsg.innerHTML = data.html || data.answer || '<span style="color:var(--mu)">No response.</span>';
      msgs.scrollTop = msgs.scrollHeight;
    })
    .catch(() => {
      aiMsg.innerHTML = '<span style="color:var(--red)">Failed — check ANTHROPIC_API_KEY is set.</span>';
      msgs.scrollTop = msgs.scrollHeight;
    });
}

/* ── Player card + rank badge population ── */
async function loadPlayerProfile() {
  try {
    const d = await fetch('/api/player_profile').then(r => r.json());

    if (d.name) {
      ['sidebar-name','pc-name','ov-name'].forEach(id => { const el=$(id); if(el) el.textContent = d.name; });
    }

    if (d.avatar_url) {
      const img = $('pc-avatar-img');
      const fallback = $('pc-avatar');
      if (img) {
        img.src = d.avatar_url;
        img.onload  = () => { img.style.display = 'block'; if (fallback) fallback.style.display = 'none'; };
        img.onerror = () => { img.style.display = 'none';  if (fallback) fallback.style.display = ''; };
      }
      // New identity strip avatar
      const ovImg = $('ov-avatar-img');
      const ovFallback = $('ov-avatar');
      if (ovImg) {
        ovImg.src = d.avatar_url;
        ovImg.onload  = () => { ovImg.style.display = 'block'; if (ovFallback) ovFallback.style.display = 'none'; };
        ovImg.onerror = () => { ovImg.style.display = 'none';  if (ovFallback) ovFallback.style.display = ''; };
      }
    }

    if (d.role) {
      const el = $('pc-role');
      if (el) { el.textContent = d.role; el.title = d.role_detail || ''; el.style.display = ''; }
    }
  } catch(e) {}
}

function _updatePlayerCard(mmKpis, faceitKpis) {
  // Sidebar rank text
  const sidebarParts = [];

  // MM platform block
  if (mmKpis) {
    const score = mmKpis.score != null ? Math.round(mmKpis.score) : null;
    const el = $('pc-mm-score');
    if (el) el.textContent = score != null ? score.toLocaleString() : '—';
    const sub = $('pc-mm-sub');
    if (sub) sub.textContent = score != null ? 'Rating' : 'No data';
    if (score != null) sidebarParts.push(`MM ${score}`);

    // Stats list (label : value rows for narrow column)
    const stats = $('pc-stats');
    if (stats) {
      const rows = [];
      if (mmKpis.kd      != null) rows.push(['K / D',   mmKpis.kd]);
      if (mmKpis.adr     != null) rows.push(['ADR',     Math.round(mmKpis.adr)]);
      if (mmKpis.win_pct != null) rows.push(['Win %',   mmKpis.win_pct + '%']);
      if (mmKpis.hs_pct  != null) rows.push(['HS %',    mmKpis.hs_pct + '%']);
      if (rows.length) {
        stats.innerHTML = rows.map(([lbl, val]) =>
          `<div class="pc-stat"><span>${lbl}</span><strong>${val}</strong></div>`
        ).join('');
      }
    }
  }

  // FACEIT platform block
  if (faceitKpis?.latest_elo) {
    const elo = faceitKpis.latest_elo;
    const lvl = faceitKpis.faceit_level;
    const block = $('pc-faceit-block');
    if (block) block.style.display = '';
    const eloEl = $('pc-faceit-elo');
    if (eloEl) eloEl.textContent = elo.toLocaleString();
    const sub = $('pc-faceit-sub');
    if (sub) sub.textContent = lvl ? `Level ${lvl}` : 'ELO';
    sidebarParts.push(`FACEIT ${elo}`);

    // Level badge
    if (lvl) {
      const lvlColors = lvl <= 3 ? '#999' : lvl <= 5 ? '#f0c030' : lvl <= 7 ? '#ff8c00' : '#ff3c00';
      const badge = $('pc-level-badge');
      if (badge) { badge.textContent = lvl; badge.style.display = 'flex'; badge.style.background = lvlColors; }
      const ovLevel = $('ov-level');
      if (ovLevel) { ovLevel.textContent = lvl; ovLevel.style.display = 'flex'; ovLevel.style.background = lvlColors; }
    }
  }

  const sr = $('sidebar-rank');
  if (sr) sr.textContent = sidebarParts.join(' · ');
}

/* ── Tutorial: auto-show first visit ── */
(function _initTutorial() {
  if (!localStorage.getItem('cs2owl_tutorial_done')) {
    setTimeout(() => {
      if (typeof startTutorial === 'function') startTutorial();
    }, 900);
  }
})();

#!/usr/bin/env python3
"""
CS2 Coach — answers questions about the player's CS2 performance using Claude.

GET  /health
GET  /ask?q=...&map=...&days=30
POST /ask  { "question": "...", "map": "de_inferno", "days": 30 }

Builds a structured stats brief from Postgres, sends it to Claude with prompt
caching (stable system prompt + brief), and returns markdown.

Designed to be embedded in a Grafana text/iframe panel.
"""

import html
import os
from datetime import datetime, timezone
from typing import Optional

import anthropic
import markdown as md
import psycopg2
import psycopg2.extras
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse

DB_DSN = os.environ["DB_DSN"]
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
PORT = int(os.environ.get("PORT", "5000"))
MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-4-7")
EFFORT = os.environ.get("CLAUDE_EFFORT", "medium")  # low|medium|high|max

app = FastAPI()

SYSTEM_PROMPT = """You are a CS2 (Counter-Strike 2) coach analyzing one player's
ranked-match data. You receive a structured stats brief and a question. Your job
is to give specific, evidence-based feedback grounded in the data. You are
coaching the player whose stats are in the brief.

Default behavior — when the question is open-ended (e.g., "review my play",
"how am I doing", "what's up with my game"), give a **balanced read** with both
strengths and weaknesses. Lead with 1–2 strengths to anchor confidence, then
1–3 improvements to focus on. Never give an "all bad" picture if the data
contains genuine bright spots; never give an "all good" picture if there are
real holes.

Question-specific behavior:
- "What am I doing well / strengths / what's working?" → focus on **strengths
  only**. Surface 3–5 things, ranked by impact, each anchored to a specific
  number. Be generous but honest — only call out what the data actually supports.
- "Top N improvements / where am I weakest / what to fix?" → focus on **fixes
  only**. Rank by likely impact on round win rate first, then K/D and ADR. State
  the problem AND the in-game fix.
- "Compare me to last session / am I getting better?" → use trend data; report
  both directions of change.
- Map-specific question → focus on that map's numbers. If the brief has no data
  for that map, say so and stop. Do not hallucinate stats.

Universal rules:
- Be direct and concise. Bullet points over prose. **Bold** the key numbers.
- Every claim must tie to a specific number from the brief. Generic CS tips are
  worthless without an anchor in the data.
- If the question is ambiguous, pick the most useful interpretation and answer.
  Don't ask clarifying questions back.
- Sample sizes matter. Flag any conclusion drawn from < 10 rounds or < 3 matches.
- Use plain markdown. No emoji unless the user uses them first.
- Aim for 150-400 words unless asked for more detail."""


def db():
    return psycopg2.connect(DB_DSN, cursor_factory=psycopg2.extras.RealDictCursor)


def fmt_table(rows, cols, title):
    """Render rows as a compact markdown table; skip if empty."""
    if not rows:
        return f"### {title}\n_no data_\n"
    out = [f"### {title}", "| " + " | ".join(cols) + " |", "|" + "|".join(["---"] * len(cols)) + "|"]
    for r in rows:
        out.append("| " + " | ".join("" if r.get(c) is None else str(r.get(c)) for c in cols) + " |")
    return "\n".join(out) + "\n"


def build_brief(conn, map_filter: Optional[str], days: int) -> str:
    """Construct a markdown stats brief tailored to the question's filters."""
    map_clause = "" if not map_filter or map_filter == "any" else "AND m.map = %(map)s"
    params = {"map": map_filter, "days": days}

    with conn.cursor() as c:
        # Overall recent form (independent of map filter, gives context)
        c.execute("""
            SELECT to_char(played_at,'YYYY-MM-DD HH24:MI') AS played_at,
                   map, won, team_score AS my_score, opp_score
            FROM v_recent_form ORDER BY played_at DESC LIMIT 10
        """)
        recent = c.fetchall()

        # Headline stats on the focus map (or overall if no map)
        c.execute(f"""
            SELECT
                COUNT(DISTINCT m.match_id) AS matches,
                ROUND(100.0 * COUNT(DISTINCT CASE WHEN m.won THEN m.match_id END)::numeric
                      / NULLIF(COUNT(DISTINCT m.match_id),0), 1) AS map_win_pct,
                SUM(pr.kills) AS kills,
                SUM(pr.deaths) AS deaths,
                ROUND(SUM(pr.kills)::numeric / NULLIF(SUM(pr.deaths),0), 2) AS kd,
                ROUND(AVG(pr.damage), 0) AS adr,
                ROUND(100.0 * SUM(pr.headshots)::numeric / NULLIF(SUM(pr.kills),0), 1) AS hs_pct,
                ROUND(100.0 * SUM(CASE WHEN pr.opening_kill THEN 1 ELSE 0 END)::numeric
                      / NULLIF(SUM(CASE WHEN pr.opening_kill OR pr.opening_death THEN 1 ELSE 0 END),0), 1)
                  AS opening_win_pct,
                ROUND(100.0 * SUM(CASE WHEN pr.round_won THEN 1 ELSE 0 END)::numeric
                      / NULLIF(COUNT(*),0), 1) AS round_win_pct
            FROM matches m JOIN player_rounds pr USING(match_id)
            WHERE m.played_at >= now() - (%(days)s || ' days')::interval
              {map_clause}
        """, params)
        headline = c.fetchone() or {}

        # CT vs T splits for the focus map
        if map_filter and map_filter != "any":
            c.execute("""
                SELECT side, rounds, round_win_pct, adr,
                       opening_kill_pct, opening_death_pct,
                       util_per_round, early_death_pct
                FROM v_by_side WHERE map = %(map)s
            """, params)
            sides = c.fetchall()
        else:
            c.execute("""
                SELECT pr.side, COUNT(*) AS rounds,
                  ROUND(100.0*SUM(CASE WHEN pr.round_won THEN 1 ELSE 0 END)::numeric/NULLIF(COUNT(*),0), 1) AS round_win_pct,
                  ROUND(AVG(pr.damage), 0) AS adr,
                  ROUND(100.0*SUM(CASE WHEN pr.opening_kill THEN 1 ELSE 0 END)::numeric/NULLIF(COUNT(*),0), 1) AS opening_kill_pct,
                  ROUND(100.0*SUM(CASE WHEN pr.opening_death THEN 1 ELSE 0 END)::numeric/NULLIF(COUNT(*),0), 1) AS opening_death_pct,
                  ROUND(AVG(pr.util_thrown), 2) AS util_per_round
                FROM player_rounds pr JOIN matches m USING(match_id)
                WHERE m.played_at >= now() - (%(days)s || ' days')::interval
                GROUP BY pr.side ORDER BY pr.side
            """, params)
            sides = c.fetchall()

        # Per-map breakdown (always include — useful context)
        c.execute("""
            SELECT map, matches, win_pct, kd, adr, opening_win_pct,
                   fight_conversion_fail_pct
            FROM v_by_map ORDER BY matches DESC
        """)
        per_map = c.fetchall()

        # Pitfalls (always include — they're map-overlapping right now,
        # but if a map filter is set we re-compute scoped)
        if map_filter and map_filter != "any":
            c.execute("""
                WITH r AS (
                  SELECT pr.* FROM player_rounds pr
                  JOIN matches m USING(match_id)
                  WHERE m.map = %(map)s
                )
                SELECT 'Failed saves' AS pitfall,
                       ROUND(100.0*SUM(CASE WHEN NOT round_won AND NOT survived AND equip_value>=2700 AND NOT saved_weapon THEN 1 END)::numeric
                             / NULLIF(SUM(CASE WHEN NOT round_won THEN 1 END),0), 1) AS rate_pct FROM r
                UNION ALL SELECT 'Zero-util rounds',
                  ROUND(100.0*SUM(CASE WHEN util_thrown=0 THEN 1 END)::numeric/NULLIF(COUNT(*),0),1) FROM r
                UNION ALL SELECT 'Fight conversion fails',
                  ROUND(100.0*SUM(CASE WHEN high_damage_no_kill THEN 1 END)::numeric/NULLIF(COUNT(*),0),1) FROM r
                UNION ALL SELECT 'Early-round deaths',
                  ROUND(100.0*SUM(CASE WHEN death_phase='early' AND deaths>0 THEN 1 END)::numeric
                        / NULLIF(SUM(CASE WHEN deaths>0 THEN 1 END),0),1) FROM r
                UNION ALL SELECT 'T-side opening deaths',
                  ROUND(100.0*SUM(CASE WHEN side='T' AND opening_death THEN 1 END)::numeric
                        / NULLIF(SUM(CASE WHEN side='T' THEN 1 END),0),1) FROM r
            """, params)
        else:
            c.execute("SELECT pitfall, rate_pct FROM v_recent_pitfalls")
        pitfalls = c.fetchall()

        # Top weapons on focus map (or overall)
        c.execute(f"""
            SELECT v.weapon, SUM(v.kills) AS kills, SUM(v.headshots) AS hs,
                   ROUND(100.0*SUM(v.headshots)::numeric/NULLIF(SUM(v.kills),0),1) AS hs_pct,
                   SUM(v.damage_dealt) AS dmg,
                   ROUND(NULLIF(SUM(v.damage_dealt),0)::numeric / NULLIF(SUM(v.hits),0), 1) AS dmg_per_hit
            FROM v_per_weapon v
            JOIN (SELECT DISTINCT map FROM matches m
                  WHERE m.played_at >= now() - (%(days)s || ' days')::interval
                  {map_clause}) mp ON v.map = mp.map
            GROUP BY v.weapon HAVING SUM(v.kills) > 0
            ORDER BY kills DESC LIMIT 8
        """, params)
        my_weapons = c.fetchall()

        # Top death-cause weapons on focus map (or overall)
        c.execute(f"""
            SELECT ke.weapon, COUNT(*) AS deaths
            FROM kill_events ke JOIN matches m USING(match_id)
            WHERE ke.is_victim = TRUE
              AND m.played_at >= now() - (%(days)s || ' days')::interval
              {map_clause}
            GROUP BY ke.weapon ORDER BY deaths DESC LIMIT 6
        """, params)
        death_weapons = c.fetchall()

    parts = [
        f"## Stats brief",
        f"_Window: last {days} days. Map filter: {map_filter or 'any'}. Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}_\n",
        "### Headline (filtered)",
        "```",
        *[f"{k}: {v}" for k, v in headline.items()],
        "```\n",
        fmt_table(recent, ["played_at","map","won","my_score","opp_score"], "Recent form (last 10)"),
        fmt_table(sides, list(sides[0].keys()) if sides else [], "CT vs T splits"),
        fmt_table(per_map, ["map","matches","win_pct","kd","adr","opening_win_pct","fight_conversion_fail_pct"], "Per-map performance"),
        fmt_table(pitfalls, ["pitfall","rate_pct"], "Pitfalls (% of rounds)"),
        fmt_table(my_weapons, ["weapon","kills","hs","hs_pct","dmg","dmg_per_hit"], "Your top weapons"),
        fmt_table(death_weapons, ["weapon","deaths"], "Top weapons that kill you"),
    ]
    return "\n".join(parts)


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL, "api_key_set": bool(ANTHROPIC_API_KEY)}


@app.get("/ask")
def ask_get(
    q: str = Query(..., description="Question for the coach"),
    map: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=3650),
    html_response: bool = Query(False, alias="html"),
):
    return ask_impl(q, map, days, want_html=html_response)


@app.post("/ask")
def ask_post(body: dict):
    q = body.get("question") or body.get("q")
    if not q:
        raise HTTPException(400, "question required")
    return ask_impl(q, body.get("map"), int(body.get("days", 30)), want_html=False)


def ask_impl(question: str, map_filter: Optional[str], days: int, want_html: bool):
    if not ANTHROPIC_API_KEY:
        msg = ("ANTHROPIC_API_KEY not set in .env — add it and `docker compose "
               "restart coach`. The endpoint and stats brief are ready; only "
               "the Claude call needs the key.")
        return _wrap(msg, want_html, status=503)

    conn = db()
    try:
        brief = build_brief(conn, map_filter, days)
    finally:
        conn.close()

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            thinking={"type": "adaptive"},
            output_config={"effort": EFFORT},
            system=[{
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": brief,
                     "cache_control": {"type": "ephemeral"}},
                    {"type": "text", "text": f"Question: {question}"},
                ],
            }],
        )
    except anthropic.APIError as e:
        return _wrap(f"Claude API error ({type(e).__name__}): {e}", want_html, status=502)

    answer = "\n".join(b.text for b in response.content if b.type == "text")
    answer_html = md.markdown(answer, extensions=["extra", "sane_lists"])
    usage = {
        "input": response.usage.input_tokens,
        "cache_read": response.usage.cache_read_input_tokens,
        "cache_write": response.usage.cache_creation_input_tokens,
        "output": response.usage.output_tokens,
    }
    if want_html:
        return HTMLResponse(_render_html(question, answer_html, usage, brief, map_filter, days))
    return JSONResponse({
        "answer": answer,
        "answer_html": answer_html,
        "usage": usage,
        "brief": brief,
    })


def _wrap(msg: str, want_html: bool, status: int = 200):
    if want_html:
        return HTMLResponse(_render_html("(error)", f"<p>{html.escape(msg)}</p>", None, None, None, 30),
                            status_code=status)
    return JSONResponse({"answer": msg}, status_code=status)


def _render_html(question: str, answer_html: str, usage, brief, map_filter, days) -> str:
    """answer_html is already HTML (markdown-rendered) — do NOT escape."""
    usage_line = ""
    if usage:
        tok = usage
        usage_line = (
            f'<div class="meta">'
            f'  <span><strong>{tok["input"]:,}</strong> input</span>'
            f'  <span><strong>{tok["output"]:,}</strong> output</span>'
            f'  <span>cache: <strong>{tok["cache_read"]:,}</strong> read · {tok["cache_write"]:,} write</span>'
            f'</div>'
        )
    map_value = html.escape(map_filter or "any")
    days_value = int(days or 30)
    brief_block = ""
    if brief:
        brief_block = (
            '<details class="brief"><summary>Raw stats brief sent to Claude</summary>'
            f'<pre>{html.escape(brief)}</pre></details>'
        )
    return f"""<!doctype html>
<html lang=en>
<meta charset=utf-8>
<meta name=viewport content="width=device-width, initial-scale=1">
<title>CS2 Coach</title>
<style>
  :root {{
    --bg:        #0b0e14;
    --panel:     #131822;
    --panel-2:   #1a2030;
    --border:    #262d3e;
    --border-2:  #323a4f;
    --text:      #dfe5ee;
    --muted:     #8b94a8;
    --muted-2:   #5e6878;
    --accent:    #7aa2f7;
    --accent-2:  #88c0d0;
    --good:      #9ece6a;
    --warn:      #e0af68;
    --bad:       #f7768e;
  }}
  * {{ box-sizing: border-box }}
  html, body {{ margin: 0; padding: 0; background: var(--bg); color: var(--text);
                 font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI",
                       Roboto, Inter, system-ui, sans-serif;
                 min-height: 100%; }}
  .wrap {{ width: 100%; max-width: 1400px; margin: 0 auto;
            padding: 16px 22px 22px; box-sizing: border-box; }}

  header {{ display: flex; align-items: baseline; justify-content: space-between;
            gap: 12px; margin-bottom: 14px; }}
  header h1 {{ font-size: 16px; font-weight: 600; margin: 0;
               letter-spacing: -0.01em; color: var(--text); }}
  header h1 .dot {{ color: var(--accent); margin-right: 6px; }}
  header .ctx {{ font-size: 12px; color: var(--muted); }}
  header .ctx code {{ background: var(--panel); padding: 2px 6px; border-radius: 4px;
                       font-size: 11px; color: var(--accent-2); }}

  form {{ display: flex; gap: 8px; margin-bottom: 10px; }}
  input[name=q] {{ flex: 1; background: var(--panel); border: 1px solid var(--border);
                    color: var(--text); padding: 11px 14px; border-radius: 8px;
                    font-size: 14px; outline: none; transition: border-color .15s; }}
  input[name=q]:focus {{ border-color: var(--accent); }}
  button {{ background: var(--accent); color: #0b0e14; border: none; padding: 11px 22px;
            border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;
            transition: filter .15s; }}
  button:hover {{ filter: brightness(1.1); }}
  button:disabled {{ opacity: .5; cursor: wait; }}

  .examples {{ display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }}
  .examples a {{ font-size: 12px; color: var(--muted); background: var(--panel);
                  border: 1px solid var(--border); padding: 4px 10px;
                  border-radius: 999px; text-decoration: none;
                  transition: all .15s; cursor: pointer; }}
  .examples a:hover {{ color: var(--text); border-color: var(--border-2);
                        background: var(--panel-2); }}

  .q {{ font-size: 12px; color: var(--muted); margin: 0 0 6px;
         text-transform: uppercase; letter-spacing: 0.06em; }}
  .q strong {{ color: var(--text); text-transform: none; letter-spacing: 0;
                font-size: 14px; font-weight: 500; margin-left: 8px; }}

  .answer {{ background: var(--panel); border: 1px solid var(--border);
              border-left: 3px solid var(--accent); padding: 18px 22px;
              border-radius: 8px; line-height: 1.65; }}
  .answer h1, .answer h2, .answer h3 {{ margin: .9em 0 .35em;
                                          font-size: 15px; font-weight: 600;
                                          color: var(--text); }}
  .answer h1:first-child, .answer h2:first-child, .answer h3:first-child,
  .answer p:first-child, .answer ul:first-child, .answer ol:first-child {{
    margin-top: 0;
  }}
  .answer p {{ margin: .55em 0; }}
  .answer ul, .answer ol {{ margin: .5em 0; padding-left: 22px; }}
  .answer li {{ margin: .3em 0; }}
  .answer li::marker {{ color: var(--accent-2); }}
  .answer strong {{ color: #f5d97a; font-weight: 600; }}
  .answer code {{ background: var(--panel-2); padding: 1px 6px; border-radius: 3px;
                   font-size: 12.5px; color: var(--accent-2);
                   font-family: ui-monospace, SF Mono, Menlo, monospace; }}
  .answer hr {{ border: 0; border-top: 1px solid var(--border); margin: 1em 0; }}
  .answer table {{ border-collapse: collapse; margin: .5em 0; font-size: 13px; }}
  .answer th, .answer td {{ border: 1px solid var(--border); padding: 4px 10px;
                              text-align: left; }}
  .answer th {{ background: var(--panel-2); color: var(--muted); font-weight: 500; }}

  .loading {{ display: flex; align-items: center; gap: 10px;
               color: var(--muted); font-size: 13px; padding: 8px 0; }}
  .spinner {{ width: 14px; height: 14px; border: 2px solid var(--border-2);
               border-top-color: var(--accent); border-radius: 50%;
               animation: spin .8s linear infinite; }}
  @keyframes spin {{ to {{ transform: rotate(360deg) }} }}

  .meta {{ display: flex; gap: 16px; flex-wrap: wrap; margin-top: 10px;
            font-size: 11.5px; color: var(--muted-2); }}
  .meta strong {{ color: var(--muted); font-weight: 600; }}

  details.brief {{ margin-top: 12px; font-size: 12px; }}
  details.brief summary {{ cursor: pointer; color: var(--muted);
                            padding: 4px 0; user-select: none; }}
  details.brief summary:hover {{ color: var(--text); }}
  details.brief pre {{ background: var(--panel); border: 1px solid var(--border);
                        padding: 10px 14px; border-radius: 6px; overflow-x: auto;
                        max-height: 320px; font-size: 11.5px; line-height: 1.45;
                        color: var(--muted); }}
</style>

<div class=wrap>
  <header>
    <h1><span class=dot>●</span> CS2 Coach</h1>
    <div class=ctx>map <code>{map_value}</code> · last <code>{days_value}d</code></div>
  </header>

  <form id=askform>
    <input name=q placeholder="Ask the coach anything about your play…"
           value="{html.escape(question)}" autocomplete=off autofocus>
    <input type=hidden name=html value=true>
    <input type=hidden name=map value="{map_value}">
    <input type=hidden name=days value="{days_value}">
    <button id=submitbtn>Ask</button>
  </form>

  <div class=examples>
    <a data-q="Give me a balanced review — what I'm doing well and what to fix">Balanced review</a>
    <a data-q="What am I doing really well right now? Top 5 strengths.">My strengths</a>
    <a data-q="Top 5 improvements to focus on this session">Top 5 fixes</a>
    <a data-q="Brief me before queuing this map — 3 strengths to lean on and 3 things to focus on">Pre-queue brief</a>
    <a data-q="Compare my CT vs T performance — which side am I strongest and weakest on?">CT vs T</a>
    <a data-q="Top 3 weapons I should drill in practice based on what kills me most">What to drill</a>
    <a data-q="Am I getting better or worse over the last 7 matches?">Trend check</a>
  </div>

  <div class=q>Question<strong>{html.escape(question)}</strong></div>
  <div class=answer id=answer>{answer_html}</div>
  <div id=meta>{usage_line}</div>
  <div id=briefslot>{brief_block}</div>
</div>

<script>
  // Click a chip → fill the input, submit
  document.querySelectorAll('.examples a').forEach(el => {{
    el.addEventListener('click', () => {{
      document.querySelector('input[name=q]').value = el.dataset.q;
      document.getElementById('askform').requestSubmit();
    }});
  }});

  // Intercept submit → fetch JSON → render in place
  const form = document.getElementById('askform');
  form.addEventListener('submit', async (e) => {{
    e.preventDefault();
    const q = form.q.value.trim();
    if (!q) return;
    const btn = document.getElementById('submitbtn');
    const answerEl = document.getElementById('answer');
    const metaEl   = document.getElementById('meta');
    const briefEl  = document.getElementById('briefslot');
    btn.disabled = true; btn.textContent = '…';
    answerEl.innerHTML = '<div class=loading><span class=spinner></span> Coach is thinking…</div>';
    metaEl.innerHTML = ''; briefEl.innerHTML = '';
    document.querySelector('.q strong').textContent = q;

    try {{
      const params = new URLSearchParams({{ q, map: form.map.value, days: form.days.value }});
      const res = await fetch('/ask?' + params.toString());
      const data = await res.json();
      answerEl.innerHTML = data.answer_html || ('<p>' + (data.answer || '') + '</p>');
      const u = data.usage;
      if (u) {{
        metaEl.innerHTML = '<div class=meta>'
          + '<span><strong>' + u.input.toLocaleString() + '</strong> input</span>'
          + '<span><strong>' + u.output.toLocaleString() + '</strong> output</span>'
          + '<span>cache: <strong>' + u.cache_read.toLocaleString() + '</strong> read · '
          + u.cache_write.toLocaleString() + ' write</span></div>';
      }}
      if (data.brief) {{
        const det = document.createElement('details');
        det.className = 'brief';
        det.innerHTML = '<summary>Raw stats brief sent to Claude</summary><pre></pre>';
        det.querySelector('pre').textContent = data.brief;
        briefEl.appendChild(det);
      }}
      // Update URL so a refresh keeps the question
      history.replaceState({{}}, '', '/ask?' + new URLSearchParams({{
        q, map: form.map.value, days: form.days.value, html: 'true'
      }}).toString());
    }} catch (err) {{
      answerEl.innerHTML = '<p style="color:var(--bad)">Request failed: ' + err.message + '</p>';
    }} finally {{
      btn.disabled = false; btn.textContent = 'Ask';
    }}
  }});
</script>
"""


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)

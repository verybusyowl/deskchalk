#!/usr/bin/env python3
# ── imports & constants ────────────────────────────────────────────────────────
import asyncio, base64, io, os, html as _html, json, math, re as _re, time, urllib.request as _urllib
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Optional

import llm
import markdown as md
import psycopg2, psycopg2.extras, uvicorn
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, Response, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from PIL import Image, ImageDraw

DB_DSN        = os.environ["DB_DSN"]
APP_TZ        = os.environ.get("APP_TZ", "America/New_York")
RADARS_DIR    = Path(os.environ.get("RADARS_DIR", "/radars"))
API_KEY       = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL         = os.environ.get("CLAUDE_MODEL", "claude-opus-4-8")
EFFORT        = os.environ.get("CLAUDE_EFFORT", "medium")
PORT          = int(os.environ.get("PORT", "5000"))
RADAR_SIZE    = 1024
STEAM_API_KEY = os.environ.get("STEAM_API_KEY", "")
STEAM_ID64    = os.environ.get("STEAM_ID64", "")

_profile_cache: dict = {}

def _fetch_steam_profile() -> dict:
    if not STEAM_API_KEY or not STEAM_ID64:
        return {}
    cached = _profile_cache.get("data")
    if cached and time.time() - _profile_cache.get("ts", 0) < 3600:
        return cached
    try:
        url = (f"https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/"
               f"?key={STEAM_API_KEY}&steamids={STEAM_ID64}")
        with _urllib.urlopen(url, timeout=5) as r:
            data = json.loads(r.read())
        players = data.get("response", {}).get("players", [])
        result = players[0] if players else {}
        _profile_cache["data"] = result
        _profile_cache["ts"] = time.time()
        return result
    except Exception:
        return {}

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=os.environ.get("SESSION_SECRET", "cs2owl-local-dev"))

@app.on_event("startup")
async def _startup():
    conn = _db()
    try:
        with conn.cursor() as c:
            # Idempotent DDL guards — safe to run on every startup
            c.execute("""
                CREATE TABLE IF NOT EXISTS pro_kills (
                    id   SERIAL PRIMARY KEY,
                    map  TEXT  NOT NULL,
                    x    FLOAT NOT NULL,
                    y    FLOAT NOT NULL,
                    side TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_pk_map ON pro_kills(map);
                ALTER TABLE grenade_lineups ADD COLUMN IF NOT EXISTS ref_url TEXT;
                CREATE TABLE IF NOT EXISTS coach_cache (
                    scope        TEXT PRIMARY KEY,
                    question     TEXT,
                    answer_html  TEXT NOT NULL,
                    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                CREATE TABLE IF NOT EXISTS faceit_matches (
                    faceit_match_id  TEXT PRIMARY KEY,
                    map              TEXT NOT NULL,
                    played_at        TIMESTAMPTZ,
                    won              BOOLEAN,
                    team_score       INT,
                    opp_score        INT,
                    kills            INT DEFAULT 0,
                    deaths           INT DEFAULT 0,
                    assists          INT DEFAULT 0,
                    adr              FLOAT,
                    hs_pct           FLOAT,
                    kd_ratio         FLOAT,
                    mvps             INT DEFAULT 0,
                    opening_kills    INT DEFAULT 0,
                    opening_deaths   INT DEFAULT 0,
                    triple_kills     INT DEFAULT 0,
                    quadro_kills     INT DEFAULT 0,
                    penta_kills      INT DEFAULT 0,
                    faceit_elo       INT,
                    elo_change       INT,
                    faceit_level     INT,
                    demo_url         TEXT,
                    discovered_at    TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                CREATE INDEX IF NOT EXISTS idx_fm_played ON faceit_matches(played_at DESC);
                CREATE INDEX IF NOT EXISTS idx_fm_map    ON faceit_matches(map);
                CREATE TABLE IF NOT EXISTS focus_log (
                    id            SERIAL PRIMARY KEY,
                    assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
                    metric        TEXT NOT NULL,
                    label         TEXT NOT NULL,
                    baseline      FLOAT,
                    better        TEXT NOT NULL DEFAULT 'higher',
                    advice_html   TEXT,
                    drill         TEXT,
                    active        BOOLEAN NOT NULL DEFAULT TRUE
                );
            """)
        conn.commit()
    finally:
        conn.close()
    asyncio.create_task(_coach_refresh_scheduler())
    asyncio.create_task(_focus_scheduler())

# ── DB helpers ─────────────────────────────────────────────────────────────────

def _db():
    # Session timezone makes every to_char()/::date/now() bucket in local time
    # instead of UTC, so late-evening matches don't display as the next day.
    return psycopg2.connect(DB_DSN, cursor_factory=psycopg2.extras.RealDictCursor,
                            options=f"-c timezone={APP_TZ}")

_MAX_SAFE_INT = 2**53

def _j(data):
    def enc(o):
        if isinstance(o, Decimal):
            iv = int(o)
            if o == iv:
                # JS can't safely represent integers > 2^53; send as string
                # to preserve full match_id precision in the browser.
                return str(iv) if abs(iv) > _MAX_SAFE_INT else iv
            return float(o)
        if isinstance(o, datetime): return o.isoformat()
        return str(o)
    return Response(json.dumps(data, default=enc), media_type="application/json")

# ── heatmap renderer ───────────────────────────────────────────────────────────

def _calibration(conn, map_name):
    with conn.cursor() as c:
        c.execute("SELECT origin_x,origin_y,scale,radar_size FROM map_radar_calibration WHERE map=%s", (map_name,))
        row = c.fetchone()
    return (row["origin_x"], row["origin_y"], row["scale"], row["radar_size"]) if row else (-2500.0, 2500.0, 5.0, RADAR_SIZE)

def _world_to_px(wx, wy, ox, oy, scale):
    return (wx - ox) / scale, (oy - wy) / scale

# Crossing this threshold changes rendering mode: data older than DENSITY_CUTOFF
# days is collapsed into a Gaussian density blob; more recent data is shown as
# individual dots so the player can see exact positions without visual noise.
DENSITY_CUTOFF = 30  # days

def _points_in_window(conn, map_name, kind, side, from_days, to_days=0, grenade_type=None, weapon=None, won=None):
    """Return points with played_at in [now-from_days, now-to_days). to_days=0 means 'up to now'.
    won: None = all rounds; True/False = filter to rounds the player won/lost (kills/deaths only)."""
    now = datetime.now(timezone.utc)
    t_from = now - timedelta(days=from_days)
    t_to   = now - timedelta(days=to_days)
    sp = (side,) if side != "all" else ()

    if kind in ("kills", "deaths"):
        victim = "TRUE" if kind == "deaths" else "FALSE"
        xc, yc = ("victim_x","victim_y") if kind == "deaths" else ("attacker_x","attacker_y")
        sc = "" if side == "all" else " AND ke.side=%s"
        # join player_rounds only when filtering by round outcome (win-vs-loss lens)
        wj = " JOIN player_rounds pr ON pr.match_id=ke.match_id AND pr.round_num=ke.round_num" if won is not None else ""
        wc = " AND pr.round_won=%s" if won is not None else ""
        wp = (won,) if won is not None else ()
        sql = (f"SELECT {xc},{yc} FROM kill_events ke JOIN matches m USING(match_id){wj}"
               f" WHERE ke.is_victim={victim} AND m.map=%s{sc}{wc}"
               f" AND m.played_at>=%s AND m.played_at<=%s"
               f" AND {xc} IS NOT NULL AND {yc} IS NOT NULL")
        with conn.cursor() as c:
            c.execute(sql, (map_name,)+sp+wp+(t_from,t_to))
            color = (79,208,116,225) if kind == "kills" else (224,97,28,225)  # chalk green / burnt-orange
            return [(r[xc],r[yc],color,7) for r in c.fetchall()]

    if kind == "aim":
        sc = "" if side == "all" else " AND ke.side=%s"
        wc = "" if not weapon else " AND ke.weapon=%s"
        wp = (weapon,) if weapon else ()
        sql = ("SELECT attacker_x,attacker_y,headshot FROM kill_events ke JOIN matches m USING(match_id)"
               f" WHERE ke.is_victim=FALSE AND m.map=%s{sc}{wc}"
               " AND m.played_at>=%s AND m.played_at<=%s"
               " AND attacker_x IS NOT NULL AND attacker_y IS NOT NULL")
        with conn.cursor() as c:
            c.execute(sql, (map_name,)+sp+wp+(t_from,t_to))
            return [(r["attacker_x"],r["attacker_y"],
                     (50,220,90,230) if r["headshot"] else (240,130,50,200), 7)
                    for r in c.fetchall()]

    if kind in ("grenades", "smokes", "flashes"):
        sc = "" if side == "all" else " AND ge.side=%s"
        # smokes/flashes are dedicated views with an implicit type filter
        if kind == "smokes":
            grenade_type = "smoke"
        elif kind == "flashes":
            grenade_type = "flash"
        gt = "" if not grenade_type else " AND ge.grenade_type=%s"
        gp = (grenade_type,) if grenade_type else ()
        sql = ("SELECT land_x,land_y,grenade_type FROM grenade_events ge JOIN matches m USING(match_id)"
               f" WHERE m.map=%s{sc} AND m.played_at>=%s AND m.played_at<=%s{gt}"
               " AND land_x IS NOT NULL AND land_y IS NOT NULL")
        pal = {"smoke":(220,220,220,200),"flash":(255,240,100,220),"molotov":(255,140,30,230),"he":(255,80,80,230)}
        radius = 11 if kind in ("smokes", "flashes") else 9
        with conn.cursor() as c:
            c.execute(sql, (map_name,)+sp+(t_from,t_to)+gp)
            return [(r["land_x"],r["land_y"],pal.get(r["grenade_type"],(255,255,255,200)),radius)
                    for r in c.fetchall()]
    return []

def _grenade_traj_points(conn, map_name, side, from_days, to_days=0, grenade_type=None):
    """Return (throw_x,throw_y,land_x,land_y,color) for grenade trajectory lines in time window."""
    now = datetime.now(timezone.utc)
    t_from = now - timedelta(days=from_days)
    t_to   = now - timedelta(days=to_days)
    sc = "" if side == "all" else " AND ge.side=%s"
    gt = "" if not grenade_type else " AND ge.grenade_type=%s"
    sp = (side,) if side != "all" else ()
    gp = (grenade_type,) if grenade_type else ()
    sql = ("SELECT throw_x,throw_y,land_x,land_y,grenade_type FROM grenade_events ge JOIN matches m USING(match_id)"
           f" WHERE m.map=%s{sc} AND m.played_at>=%s AND m.played_at<=%s{gt}"
           " AND throw_x IS NOT NULL AND throw_y IS NOT NULL AND land_x IS NOT NULL AND land_y IS NOT NULL")
    pal = {"smoke":(200,200,200),"flash":(255,235,80),"molotov":(255,130,20),"he":(255,70,70)}
    try:
        with conn.cursor() as c:
            c.execute(sql, (map_name,)+sp+(t_from,t_to)+gp)
            return [(r["throw_x"],r["throw_y"],r["land_x"],r["land_y"],
                     pal.get(r["grenade_type"],(255,255,255))) for r in c.fetchall()]
    except Exception:
        return []

# Density colors per kind (RGB, no alpha — alpha is computed from density magnitude)
_DENSITY_RGB = {
    "kills":   (52, 180, 90),    # chalk green  #34B45A
    "deaths":  (212, 82, 10),    # burnt orange #D4520A
    "aim":     (35, 95, 210),
    "grenades": (160, 150, 55),
}
_NADE_DENSITY_RGB = {
    "smoke":   (155, 155, 155),
    "flash":   (205, 185, 35),
    "molotov": (205, 100, 20),
    "he":      (195, 50, 50),
}

def _density_layer(pts, radar_size, ox, oy, scale, rgb):
    """
    2D density heatmap from world-coord points.

    PIL draw.ellipse() SETS pixels (no additive blending), so overlapping points
    would not accumulate with the naive approach. Instead we use a dict-based
    additive accumulator at 1/4 resolution, then Gaussian-blur and normalise.
    No numpy required.
    """
    from PIL import ImageFilter
    if not pts:
        return Image.new("RGBA", (radar_size, radar_size), (0,0,0,0))

    DS  = 4   # work at 1/4 resolution
    ds  = radar_size // DS
    R   = 4   # stamp radius in downscaled pixels (= 16px at full res)
    PER = 10  # accumulation units per point

    # Pre-build a circular stamp as a list of (dx, dy) offsets
    stamp = [(dx, dy) for dx in range(-R, R+1) for dy in range(-R, R+1)
             if dx*dx + dy*dy <= R*R]

    # Additive accumulation into a dict (unbounded, normalised later)
    acc_map: dict = {}
    hit = 0
    for wx, wy, *_ in pts:
        px, py = _world_to_px(wx, wy, ox, oy, scale)
        if 0 <= px < radar_size and 0 <= py < radar_size:
            hx, hy = int(px / DS), int(py / DS)
            for dx, dy in stamp:
                nx, ny = hx + dx, hy + dy
                if 0 <= nx < ds and 0 <= ny < ds:
                    acc_map[(nx, ny)] = acc_map.get((nx, ny), 0) + PER
            hit += 1

    if hit == 0:
        return Image.new("RGBA", (radar_size, radar_size), (0,0,0,0))

    # Write accumulated values into a grayscale image
    max_v = max(acc_map.values())
    norm  = 210.0 / max_v          # normalise peak → 210
    acc   = Image.new("L", (ds, ds), 0)
    pix   = acc.load()
    for (x, y), v in acc_map.items():
        pix[x, y] = min(255, int(v * norm))

    # Smooth: single Gaussian pass for blob effect
    acc = acc.filter(ImageFilter.GaussianBlur(radius=7))
    acc = acc.resize((radar_size, radar_size), Image.BILINEAR)

    # Re-normalise after blur (blur reduces peak) to keep max at ~210
    _, post_max = acc.getextrema()
    if post_max == 0:
        return Image.new("RGBA", (radar_size, radar_size), (0,0,0,0))
    renorm_lut = [min(255, int(v * 210 // post_max)) for v in range(256)]
    acc = acc.point(renorm_lut, 'L')

    # Apply colormap — max alpha 145 so radar stays readable beneath
    r0, g0, b0 = rgb
    r_lut = [min(255, int(v * r0 / 255)) for v in range(256)]
    g_lut = [min(255, int(v * g0 / 255)) for v in range(256)]
    b_lut = [min(255, int(v * b0 / 255)) for v in range(256)]
    # sqrt alpha curve: dim at low density → saturates at ~145 near peak
    a_lut = [min(145, int((v / 255) ** 0.5 * 150)) for v in range(256)]

    return Image.merge("RGBA", (
        acc.point(r_lut, 'L'),
        acc.point(g_lut, 'L'),
        acc.point(b_lut, 'L'),
        acc.point(a_lut, 'L'),
    ))

def _background(map_name):
    p = RADARS_DIR / f"{map_name}.png"
    if p.exists():
        img = Image.open(p).convert("RGBA")
        if img.size != (RADAR_SIZE, RADAR_SIZE):
            img = img.resize((RADAR_SIZE, RADAR_SIZE))
        return img
    img = Image.new("RGBA", (RADAR_SIZE, RADAR_SIZE), (22,26,34,255))
    d = ImageDraw.Draw(img)
    for i in range(0, RADAR_SIZE, 128):
        d.line([(i,0),(i,RADAR_SIZE)], fill=(40,46,56,255))
        d.line([(0,i),(RADAR_SIZE,i)], fill=(40,46,56,255))
    try:
        from PIL import ImageFont
        f = ImageFont.load_default(size=42)
        s = (map_name or "unknown").upper()
        tw = d.textlength(s, font=f)
        d.text(((RADAR_SIZE-tw)/2, 36), s, fill=(160,175,200,255), font=f)
    except Exception:
        pass
    return img

def _render_duel(map_name, side, days, caption=True):
    """Duel map: deaths (orange) + kills (green) density on one frame.
    Colour dominance shows where you win vs lose fights — no per-map zones needed."""
    conn = _db()
    try:
        ox, oy, scale, _ = _calibration(conn, map_name)
        deaths = _points_in_window(conn, map_name, "deaths", side, days)
        kills  = _points_in_window(conn, map_name, "kills",  side, days)
    finally:
        conn.close()

    img = _background(map_name)
    ov  = Image.new("RGBA", img.size, (0,0,0,0))
    if deaths:
        ov = Image.alpha_composite(ov, _density_layer(deaths, RADAR_SIZE, ox, oy, scale, _DENSITY_RGB["deaths"]))
    if kills:
        ov = Image.alpha_composite(ov, _density_layer(kills,  RADAR_SIZE, ox, oy, scale, _DENSITY_RGB["kills"]))
    out = Image.alpha_composite(img, ov)

    if caption:
        cap = f"{map_name}  duel  {side}  {days}d  kills={len(kills)} deaths={len(deaths)}"
        tl = Image.new("RGBA", img.size, (0,0,0,0))
        td = ImageDraw.Draw(tl)
        td.rectangle((4,4,4+8*len(cap)+8,22), fill=(0,0,0,180))
        td.text((10,8), cap, fill=(220,220,220,255))
        out = Image.alpha_composite(out, tl)

    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()

def _render_heatmap(map_name, kind, side, days, pro=False, grenade_type=None, weapon=None, caption=True, lens=None, won=None):
    if lens == "duel":
        return _render_duel(map_name, side, days, caption)
    conn = _db()
    try:
        ox, oy, scale, _ = _calibration(conn, map_name)

        # smokes/flashes are dedicated nade-type views
        if kind == "smokes":
            grenade_type = "smoke"; kind = "grenades"
        elif kind == "flashes":
            grenade_type = "flash"; kind = "grenades"

        # Split into historical (density) and recent (dots)
        use_density = days > DENSITY_CUTOFF
        if use_density:
            hist_pts   = _points_in_window(conn, map_name, kind, side, days, DENSITY_CUTOFF, grenade_type, weapon, won)
            recent_pts = _points_in_window(conn, map_name, kind, side, DENSITY_CUTOFF, 0, grenade_type, weapon, won)
            traj_pts   = _grenade_traj_points(conn, map_name, side, DENSITY_CUTOFF, 0, grenade_type) if kind == "grenades" else []
        else:
            hist_pts   = []
            recent_pts = _points_in_window(conn, map_name, kind, side, days, 0, grenade_type, weapon, won)
            traj_pts   = _grenade_traj_points(conn, map_name, side, days, 0, grenade_type) if kind == "grenades" else []

        pro_pts = []
        if pro and kind in ("kills", "deaths", "aim"):
            sc = "" if side == "all" else " AND side=%s"
            p  = [map_name] + ([side] if side != "all" else [])
            with conn.cursor() as c:
                c.execute(f"SELECT x,y FROM pro_kills WHERE map=%s{sc}", p)
                pro_pts = [(r["x"], r["y"], (80,140,255,80), 5) for r in c.fetchall()]
    finally:
        conn.close()

    # Pick density color
    if kind == "grenades":
        density_rgb = _NADE_DENSITY_RGB.get(grenade_type or "", (160,150,55))
    else:
        density_rgb = _DENSITY_RGB.get(kind, (120,120,120))

    img = _background(map_name)
    ov  = Image.new("RGBA", img.size, (0,0,0,0))

    # ── Layer 1: pro kill overlay ──
    draw = ImageDraw.Draw(ov)
    for wx, wy, color, r in pro_pts:
        px, py = _world_to_px(wx, wy, ox, oy, scale)
        if 0 <= px < RADAR_SIZE and 0 <= py < RADAR_SIZE:
            draw.ellipse((px-r,py-r,px+r,py+r), fill=color)

    # ── Layer 2: historical density (Gaussian blob) ──
    if hist_pts:
        density = _density_layer(hist_pts, RADAR_SIZE, ox, oy, scale, density_rgb)
        ov = Image.alpha_composite(ov, density)
        draw = ImageDraw.Draw(ov)

    # ── Layer 3: grenade trajectories (recent only, avoids clutter) ──
    for twx, twy, lwx, lwy, rgb in traj_pts:
        tx, ty = _world_to_px(twx, twy, ox, oy, scale)
        lx, ly = _world_to_px(lwx, lwy, ox, oy, scale)
        in_t = 0 <= tx < RADAR_SIZE and 0 <= ty < RADAR_SIZE
        in_l = 0 <= lx < RADAR_SIZE and 0 <= ly < RADAR_SIZE
        if in_t or in_l:
            draw.line([(tx,ty),(lx,ly)], fill=(*rgb,110), width=2)
            if in_t:
                draw.ellipse((tx-3,ty-3,tx+3,ty+3), fill=(*rgb,210))
            if in_l:
                angle = math.atan2(ly-ty, lx-tx)
                for da in (-0.5, 0.5):
                    draw.line([(lx,ly),(lx-10*math.cos(angle+da),ly-10*math.sin(angle+da))],
                              fill=(*rgb,180), width=2)

    # ── Layer 4: recent individual dots ──
    n_recent = 0
    for wx, wy, color, r in recent_pts:
        px, py = _world_to_px(wx, wy, ox, oy, scale)
        if 0 <= px < RADAR_SIZE and 0 <= py < RADAR_SIZE:
            draw.ellipse((px-r,py-r,px+r,py+r), fill=color, outline=(0,0,0,210), width=1)
            n_recent += 1

    out = Image.alpha_composite(img, ov)

    # ── Caption (debug overlay; suppressed for the dashboard view) ──
    if caption:
        if use_density:
            cap = (f"{map_name}  {kind}  {side}  {days}d"
                   f"  density={len(hist_pts)} (>{DENSITY_CUTOFF}d)"
                   f"  dots={n_recent} (≤{DENSITY_CUTOFF}d)")
        else:
            cap = f"{map_name}  {kind}  {side}  {days}d  n={n_recent}"
        if pro and pro_pts:
            cap += f"  pro={len(pro_pts)}"

        tl = Image.new("RGBA", img.size, (0,0,0,0))
        td = ImageDraw.Draw(tl)
        td.rectangle((4,4,4+8*len(cap)+8,22), fill=(0,0,0,180))
        td.text((10,8), cap, fill=(220,220,220,255))
        out = Image.alpha_composite(out, tl)

    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()

def _lerp(c1, c2, t):
    return tuple(int(a+(b-a)*t) for a,b in zip(c1,c2))

def _stoplight(pct):
    if pct is None: return (60,65,78,180)
    t = max(0.0, min(1.0, pct/100.0))
    if t < 0.5: rgb = _lerp((110,200,110),(230,200,90),t*2)
    else:        rgb = _lerp((230,200,90),(235,80,90),(t-0.5)*2)
    return (*rgb, 230)

SIDE_THEMES = {
    "CT":  ((110,168,232,255),(66,132,210,255),"CT"),
    "T":   ((230,154,70,255),(210,110,36,255),"T"),
    "all": ((110,122,144,255),(90,100,122,255),"ALL"),
}

# ── hitbox renderer ─────────────────────────────────────────────────────────────

def _render_hitbox(map_name, days, perspective, side):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    conn = _db()
    try:
        is_me = "FALSE" if perspective == "incoming" else "TRUE"
        clauses = [f"de.attacker_is_you={is_me}", "m.played_at>=%s", "de.hitgroup IS NOT NULL"]
        params = [cutoff]
        if map_name and map_name != "any":
            clauses.append("m.map=%s"); params.append(map_name)
        if side in ("CT","T"):
            clauses.append("de.side=%s"); params.append(side)
        sql = ("SELECT hitgroup,COUNT(*) AS hits,SUM(CASE WHEN victim_died THEN 1 ELSE 0 END) AS lethal"
               " FROM damage_events de JOIN matches m USING(match_id)"
               " WHERE " + " AND ".join(clauses) + " GROUP BY hitgroup")
        with conn.cursor() as c:
            c.execute(sql, params)
            rows = {int(r["hitgroup"]): {"hits":int(r["hits"]),"lethal":int(r["lethal"])} for r in c.fetchall()}
    finally:
        conn.close()

    outline_c, badge_c, side_label = SIDE_THEMES.get(side, SIDE_THEMES["all"])
    total = sum(r["hits"] for r in rows.values()) or 1
    img = Image.new("RGBA", (520,720), (15,18,26,255))
    d = ImageDraw.Draw(img)
    label = ("DAMAGE YOU TAKE" if perspective == "incoming" else "DAMAGE YOU DEAL")
    label += f"  ·  map:{map_name or 'any'}  ·  last {days}d  ·  n={total}"
    d.rectangle((0,0,520,30), fill=(20,24,34,255))
    d.text((14,9), label, fill=(190,200,220,255))
    bw = 56
    d.rounded_rectangle((520-bw-10,5,520-10,25), radius=10, fill=badge_c)
    d.text((520-bw-10+(bw-8*len(side_label))//2+4, 9), side_label, fill=(15,18,26,255))
    # Body layout geometry on a 520×720 canvas:
    #   cx=centre-x, hr=head radius, hcy=head centre y,
    #   tt=torso top, ch=chest height, sh=stomach height,
    #   tw2=torso half-width, aw=arm width, lh=leg height, lg=leg gap
    cx=260; hr=38; hcy=90; tt=hcy+hr+4; ch=90; sh=70; tw2=130; aw=36; lh=230; lg=8
    regions = {
        1: ("Head",   (cx-hr, hcy-hr, cx+hr, hcy+hr)),
        2: ("Chest",  (cx-tw2//2, tt, cx+tw2//2, tt+ch)),
        3: ("Stomach",(cx-tw2//2, tt+ch, cx+tw2//2, tt+ch+sh)),
        4: ("L arm",  (cx-tw2//2-aw-4, tt, cx-tw2//2-4, tt+ch+sh)),
        5: ("R arm",  (cx+tw2//2+4, tt, cx+tw2//2+aw+4, tt+ch+sh)),
        6: ("L leg",  (cx-lg//2-lh//2, tt+ch+sh+4, cx-lg//2, tt+ch+sh+4+lh)),
        7: ("R leg",  (cx+lg//2, tt+ch+sh+4, cx+lg//2+lh//2, tt+ch+sh+4+lh)),
    }
    for hg, (name, box) in regions.items():
        r2 = rows.get(hg, {"hits":0,"lethal":0})
        hits, lethal = r2["hits"], r2["lethal"]
        sp = 100.0*hits/total
        lp = 100.0*lethal/hits if hits else None
        fill = _stoplight(lp) if perspective=="incoming" else _stoplight(100-(lp or 0))
        if perspective=="outgoing" and lp is not None: fill = _stoplight(100-lp)
        if hg == 1: d.ellipse(box, fill=fill, outline=outline_c, width=3)
        else:       d.rounded_rectangle(box, radius=10, fill=fill, outline=outline_c, width=3)
        if hg==1:         tx,ty = box[2]+12, box[1]+4
        elif hg in(4,6):  tx,ty = box[0]-80, (box[1]+box[3])//2-14
        elif hg in(5,7):  tx,ty = box[2]+8,  (box[1]+box[3])//2-14
        else:              tx,ty = box[0]+10, (box[1]+box[3])//2-14
        d.text((tx,ty), f"{name}\n{hits} ({sp:.0f}%)\n{lp:.0f}% lethal" if lp else f"{name}\n{hits} ({sp:.0f}%)", fill=(220,226,238,255))
    d.text((14,678), "color: green=good outcome  red=bad outcome", fill=(120,130,150,255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

# ── coach ──────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a blunt CS2 coach. Talk directly to the player — second person, imperative sentences, zero hedging. Lead with the single highest-impact fix, then 1-2 more ranked by round-win impact, then 1-2 things they're doing right. Every point anchors to a specific number. No "you might want to consider" — say "Stop doing X" or "Add a flash before every peek."

Rules:
- State the problem and the exact fix in one sentence each. Example: "Your T-side opening death rate is 68% — stay passive for the first 20s and let CT positions over-extend."
- Bold the key numbers. Flag patterns based on <10 rounds as limited sample.
- Maximum 3 fixes, maximum 2 strengths. No filler. Under 300 words."""

def _fmt_table(rows, cols, title):
    if not rows: return f"### {title}\n_no data_\n"
    out = [f"### {title}", "| "+" | ".join(cols)+" |", "|"+"---|"*len(cols)]
    for r in rows:
        out.append("| "+" | ".join("" if r.get(c) is None else str(r.get(c)) for c in cols)+" |")
    return "\n".join(out)+"\n"

def _build_brief(conn, map_filter, days):
    mp = {"map": map_filter, "days": days}
    mc = "" if not map_filter or map_filter=="any" else "AND m.map=%(map)s"
    with conn.cursor() as c:
        c.execute("SELECT to_char(played_at,'YYYY-MM-DD HH24:MI') AS played_at,map,won,team_score AS my_score,opp_score FROM v_recent_form ORDER BY played_at DESC LIMIT 10")
        recent = c.fetchall()
        c.execute(f"""SELECT COUNT(DISTINCT m.match_id) AS matches,
            ROUND(100.0*COUNT(DISTINCT CASE WHEN m.won THEN m.match_id END)::numeric/NULLIF(COUNT(DISTINCT m.match_id),0),1) AS map_win_pct,
            SUM(pr.kills) AS kills,SUM(pr.deaths) AS deaths,
            ROUND(SUM(pr.kills)::numeric/NULLIF(SUM(pr.deaths),0),2) AS kd,
            ROUND(AVG(pr.damage),0) AS adr,
            ROUND(100.0*SUM(pr.headshots)::numeric/NULLIF(SUM(pr.kills),0),1) AS hs_pct,
            ROUND(100.0*SUM(CASE WHEN pr.opening_kill THEN 1 ELSE 0 END)::numeric/NULLIF(SUM(CASE WHEN pr.opening_kill OR pr.opening_death THEN 1 ELSE 0 END),0),1) AS opening_win_pct
            FROM matches m JOIN player_rounds pr USING(match_id)
            WHERE m.played_at>=now()-(%(days)s||' days')::interval {mc}""", mp)
        headline = c.fetchone() or {}
        c.execute("SELECT map,matches,win_pct,kd,adr,opening_win_pct FROM v_by_map ORDER BY matches DESC")
        per_map = c.fetchall()
        c.execute("SELECT pitfall,rate_pct FROM v_recent_pitfalls")
        pitfalls = c.fetchall()
        c.execute(f"""SELECT v.weapon,SUM(v.kills) AS kills,SUM(v.headshots) AS hs,
            ROUND(100.0*SUM(v.headshots)::numeric/NULLIF(SUM(v.kills),0),1) AS hs_pct
            FROM v_per_weapon v
            JOIN (SELECT DISTINCT map FROM matches m WHERE m.played_at>=now()-(%(days)s||' days')::interval {mc}) mp ON v.map=mp.map
            GROUP BY v.weapon HAVING SUM(v.kills)>0 ORDER BY kills DESC LIMIT 8""", mp)
        weapons = c.fetchall()
        # FACEIT — the platform actually being played; aggregate API stats
        fc_filter = "" if not map_filter or map_filter == "any" else "AND map=%(map)s"
        c.execute(f"""SELECT COUNT(*) AS matches,
            ROUND(100.0*COUNT(*) FILTER (WHERE won)::numeric/NULLIF(COUNT(*),0),1) AS win_pct,
            ROUND(AVG(kd_ratio)::numeric,2) AS kd, ROUND(AVG(adr)::numeric,0) AS adr,
            ROUND(AVG(hs_pct)::numeric,1) AS hs_pct,
            SUM(elo_change) AS elo_delta,
            MAX(faceit_elo) FILTER (WHERE played_at=(SELECT MAX(played_at) FROM faceit_matches)) AS current_elo
            FROM faceit_matches
            WHERE played_at>=now()-(%(days)s||' days')::interval {fc_filter}""", mp)
        fc_headline = c.fetchone() or {}
        c.execute(f"""SELECT to_char(played_at,'MM-DD') AS d, map, won,
            kd_ratio AS kd, ROUND(adr::numeric,0) AS adr, elo_change
            FROM faceit_matches WHERE TRUE {fc_filter}
            ORDER BY played_at DESC LIMIT 10""", mp)
        fc_recent = c.fetchall()
        # Tier-1 mechanics (demo-derived): rolling windows + recent per match
        try:
            c.execute("SELECT * FROM v_mechanics_trend")
            mech_trend = c.fetchall()
            c.execute("""SELECT to_char(played_at,'MM-DD') AS d, map, platform,
                counter_strafe_pct, first_bullet_acc_pct, spray_early_acc_pct,
                ttd_ms, crosshair_err_deg, deaths_blinded
                FROM v_mechanics LIMIT 10""")
            mech_recent = c.fetchall()
        except Exception:
            conn.rollback()
            mech_trend, mech_recent = [], []
    parts = [
        f"## Stats brief — last {days}d, map: {map_filter or 'any'}\n",
        "### FACEIT headline (primary platform)\n```\n"
        + "\n".join(f"{k}: {v}" for k, v in fc_headline.items()) + "\n```\n",
        _fmt_table(fc_recent, ["d","map","won","kd","adr","elo_change"], "FACEIT recent form"),
        _fmt_table(mech_trend,
                   ["window","matches","counter_strafe_pct","first_bullet_acc_pct",
                    "spray_early_acc_pct","spray_late_acc_pct","ttd_ms",
                    "crosshair_err_deg","deaths_blinded"],
                   "Mechanics — recent 10 demos vs previous 10 (counter_strafe = % of first shots while stopped; "
                   "ttd_ms = ms from firing to first damage; crosshair_err_deg + = aiming below head level)"),
        _fmt_table(mech_recent,
                   ["d","map","platform","counter_strafe_pct","first_bullet_acc_pct",
                    "spray_early_acc_pct","ttd_ms","crosshair_err_deg","deaths_blinded"],
                   "Mechanics per match (demo-parsed)"),
        "### MM headline (legacy platform)\n```\n"
        + "\n".join(f"{k}: {v}" for k, v in headline.items()) + "\n```\n",
        _fmt_table(recent,["played_at","map","won","my_score","opp_score"],"MM recent form"),
        _fmt_table(per_map,["map","matches","win_pct","kd","adr","opening_win_pct"],"Per-map (MM demos)"),
        _fmt_table(pitfalls,["pitfall","rate_pct"],"Pitfalls (MM demos)"),
        _fmt_table(weapons,["weapon","kills","hs","hs_pct"],"Your weapons"),
        "\n_Note: flag any pattern from fewer than 10 rounds or 5 matches as a limited sample._\n",
    ]
    return "\n".join(parts)

def _ask(question, map_filter, days, want_html):
    if not llm.available():
        msg = llm.not_configured_message()
        return HTMLResponse(f"<p>{_html.escape(msg)}</p>", status_code=503) if want_html else {"answer": msg}
    conn = _db()
    try:
        brief = _build_brief(conn, map_filter, days)
    finally:
        conn.close()
    try:
        resp = llm.create(
            model=MODEL, max_tokens=2048,
            thinking={"type": "adaptive"},
            output_config={"effort": EFFORT},
            system=[{"type":"text","text":SYSTEM_PROMPT,"cache_control":{"type":"ephemeral"}}],
            messages=[{"role":"user","content":[
                {"type":"text","text":brief,"cache_control":{"type":"ephemeral"}},
                {"type":"text","text":f"Question: {question}"},
            ]}],
        )
    except llm.LLMError as e:
        msg = f"Claude API error: {e}"
        return HTMLResponse(f"<p>{_html.escape(msg)}</p>", 502) if want_html else {"answer": msg}
    answer = "\n".join(b.text for b in resp.content if b.type=="text")
    answer_html = md.markdown(answer, extensions=["extra","sane_lists"])
    usage = {"input":resp.usage.input_tokens,"cache_read":resp.usage.cache_read_input_tokens,
             "cache_write":resp.usage.cache_creation_input_tokens,"output":resp.usage.output_tokens}
    if want_html:
        return HTMLResponse(_coach_html(question, answer_html, usage, brief, map_filter, days))
    return {"answer":answer,"answer_html":answer_html,"usage":usage,"brief":brief}

def _coach_html(question, answer_html, usage, brief, map_filter, days):
    mval = _html.escape(map_filter or "any")
    uline = ""
    if usage:
        uline = (f'<div class=meta><span><b>{usage["input"]:,}</b> in</span>'
                 f'<span><b>{usage["output"]:,}</b> out</span>'
                 f'<span>cache: <b>{usage["cache_read"]:,}</b> read · {usage["cache_write"]:,} write</span></div>')
    brief_block = ""
    if brief:
        brief_block = f'<details class=brief><summary>Stats brief</summary><pre>{_html.escape(brief)}</pre></details>'
    chips = [
        ("Balanced review","Give me a balanced review — what I'm doing well and what to fix"),
        ("My strengths","What am I doing really well right now? Top 5 strengths."),
        ("Top 5 fixes","Top 5 improvements to focus on this session"),
        ("Pre-queue brief","Brief me before queuing this map — 3 strengths and 3 things to fix"),
        ("CT vs T","Compare my CT vs T performance"),
        ("Trend check","Am I getting better or worse over the last 7 matches?"),
    ]
    chip_html = "".join(f'<a data-q="{_html.escape(q)}">{_html.escape(l)}</a>' for l,q in chips)
    return f"""<!doctype html><html lang=en><meta charset=utf-8>
<title>CS2 Coach</title>
<style>
:root{{--bg:#0b0e14;--p:#131822;--p2:#1a2030;--bd:#262d3e;--tx:#dfe5ee;--mu:#8b94a8;--ac:#7aa2f7;--gd:#9ece6a;}}
*{{box-sizing:border-box}}html,body{{margin:0;background:var(--bg);color:var(--tx);font:14px/1.55 system-ui,sans-serif}}
.w{{max-width:1400px;margin:0 auto;padding:16px 22px}}
header{{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px}}
h1{{font-size:16px;font-weight:600;margin:0}}h1 .dot{{color:var(--ac)}}
.ctx{{font-size:12px;color:var(--mu)}}code{{background:var(--p);padding:2px 6px;border-radius:4px;font-size:11px;color:var(--gd)}}
form{{display:flex;gap:8px;margin-bottom:10px}}
input[name=q]{{flex:1;background:var(--p);border:1px solid var(--bd);color:var(--tx);padding:10px 14px;border-radius:8px;font-size:14px;outline:none}}
input[name=q]:focus{{border-color:var(--ac)}}
button{{background:var(--ac);color:#0b0e14;border:none;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600}}
.chips{{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}}
.chips a{{font-size:12px;color:var(--mu);background:var(--p);border:1px solid var(--bd);padding:4px 10px;border-radius:999px;text-decoration:none;cursor:pointer}}
.chips a:hover{{color:var(--tx);background:var(--p2)}}
.qlabel{{font-size:12px;color:var(--mu);margin:0 0 6px;text-transform:uppercase;letter-spacing:.06em}}
.qlabel strong{{color:var(--tx);text-transform:none;letter-spacing:0;font-size:14px;font-weight:500;margin-left:8px}}
.ans{{background:var(--p);border:1px solid var(--bd);border-left:3px solid var(--ac);padding:18px 22px;border-radius:8px;line-height:1.65}}
.ans h1,.ans h2,.ans h3{{margin:.8em 0 .3em;font-size:15px;color:var(--tx)}}
.ans p{{margin:.5em 0}}.ans ul,.ans ol{{margin:.5em 0;padding-left:22px}}.ans li{{margin:.25em 0}}
.ans strong{{color:#f5d97a}}.ans code{{font-size:12px;color:var(--gd)}}
.meta{{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:#5e6878}}
.meta b{{color:var(--mu)}}
details.brief{{margin-top:12px;font-size:12px}}details.brief summary{{cursor:pointer;color:var(--mu)}}
details.brief pre{{background:var(--p);border:1px solid var(--bd);padding:10px;border-radius:6px;overflow-x:auto;max-height:320px;font-size:11px;color:var(--mu)}}
</style>
<div class=w>
<header><h1><span class=dot>●</span> CS2 Coach</h1><div class=ctx>map <code>{mval}</code> · last <code>{days}d</code></div></header>
<form id=f><input name=q value="{_html.escape(question)}" placeholder="Ask the coach…" autocomplete=off>
<input type=hidden name=map value="{mval}"><input type=hidden name=days value="{days}">
<button id=btn>Ask</button></form>
<div class=chips>{chip_html}</div>
<div class=qlabel>Question<strong>{_html.escape(question)}</strong></div>
<div class=ans id=ans>{answer_html}</div>
<div id=meta>{uline}</div>
<div id=bs>{brief_block}</div>
</div>
<script>
document.querySelectorAll('.chips a').forEach(a=>a.addEventListener('click',()=>{{document.querySelector('input[name=q]').value=a.dataset.q;document.getElementById('f').requestSubmit()}}));
document.getElementById('f').addEventListener('submit',async e=>{{
  e.preventDefault();const q=e.target.q.value.trim();if(!q)return;
  const btn=document.getElementById('btn');btn.disabled=true;btn.textContent='…';
  document.getElementById('ans').innerHTML='<p style="color:#8b94a8">Thinking…</p>';
  document.getElementById('meta').innerHTML='';document.getElementById('bs').innerHTML='';
  document.querySelector('.qlabel strong').textContent=q;
  try{{
    const p=new URLSearchParams({{q,map:e.target.map.value,days:e.target.days.value}});
    const r=await fetch('/ask?'+p);const d=await r.json();
    document.getElementById('ans').innerHTML=d.answer_html||'<p>'+d.answer+'</p>';
    if(d.usage){{const u=d.usage;document.getElementById('meta').innerHTML='<div class=meta><span><b>'+u.input.toLocaleString()+'</b> in</span><span><b>'+u.output.toLocaleString()+'</b> out</span><span>cache: <b>'+u.cache_read.toLocaleString()+'</b> read · '+u.cache_write.toLocaleString()+' write</span></div>';}}
    if(d.brief){{const det=document.createElement('details');det.className='brief';det.innerHTML='<summary>Stats brief</summary><pre></pre>';det.querySelector('pre').textContent=d.brief;document.getElementById('bs').appendChild(det);}}
  }}catch(err){{document.getElementById('ans').innerHTML='<p style="color:#f7768e">'+err.message+'</p>';}}
  finally{{btn.disabled=false;btn.textContent='Ask';}}
}});
</script>"""

# ── coach cache & weekly scheduler ────────────────────────────────────────────

def _generate_and_cache_coach(scope: str, map_filter: Optional[str], days: int = 30):
    if not llm.available():
        return
    conn = _db()
    try:
        brief = _build_brief(conn, map_filter, days)
    finally:
        conn.close()

    if map_filter and map_filter not in ("any", "overview"):
        question = (f"Brief me before queuing {map_filter}: name my top 3 strengths on this map "
                    f"and top 3 specific things to fix this session. Be concise.")
    else:
        question = ("Give me a balanced weekly review: my top 3 strengths overall and "
                    "my top 3 most impactful improvements right now.")

    try:
        resp = llm.create(
            model=MODEL, max_tokens=1024,
            thinking={"type": "adaptive"},
            output_config={"effort": EFFORT},
            system=[{"type":"text","text":SYSTEM_PROMPT,"cache_control":{"type":"ephemeral"}}],
            messages=[{"role":"user","content":[
                {"type":"text","text":brief,"cache_control":{"type":"ephemeral"}},
                {"type":"text","text":f"Question: {question}"},
            ]}],
        )
        answer = "\n".join(b.text for b in resp.content if b.type=="text")
        answer_html = md.markdown(answer, extensions=["extra","sane_lists"])
    except Exception as e:
        print(f"[coach] Error generating cache for {scope}: {e}")
        return

    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""INSERT INTO coach_cache(scope, question, answer_html, generated_at)
                         VALUES(%s,%s,%s,now())
                         ON CONFLICT(scope) DO UPDATE
                         SET question=%s, answer_html=%s, generated_at=now()""",
                      (scope, question, answer_html, question, answer_html))
        conn.commit()
        print(f"[coach] Cached brief for scope={scope}")
    except Exception as e:
        print(f"[coach] DB error caching {scope}: {e}")
    finally:
        conn.close()

async def _refresh_all_coach_caches():
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("SELECT DISTINCT map FROM matches ORDER BY map")
            maps = [r["map"] for r in c.fetchall()]
    finally:
        conn.close()

    loop = asyncio.get_event_loop()
    # Overview first
    await loop.run_in_executor(None, _generate_and_cache_coach, "overview", None, 30)
    # Then each active map
    for m in maps:
        await loop.run_in_executor(None, _generate_and_cache_coach, m, m, 30)

async def _coach_refresh_scheduler():
    """Runs _refresh_all_coach_caches every Friday at 16:00 UTC."""
    while True:
        now = datetime.now(timezone.utc)
        days_until_friday = (4 - now.weekday()) % 7
        if days_until_friday == 0 and now.hour >= 16:
            days_until_friday = 7
        next_run = (now + timedelta(days=days_until_friday)).replace(
            hour=16, minute=0, second=0, microsecond=0)
        wait = (next_run - now).total_seconds()
        print(f"[coach] Next refresh in {wait/3600:.1f}h at {next_run.isoformat()}")
        await asyncio.sleep(wait)
        print("[coach] Starting weekly refresh…")
        try:
            await _refresh_all_coach_caches()
        except Exception as e:
            print(f"[coach] Refresh failed: {e}")

# ── Map fundamentals coach ─────────────────────────────────────────────────────

FUNDAMENTALS_PROMPT = """You are a CS2 coach writing a one-page map guide for a solo-queue FACEIT player (level 5-7). Structure EXACTLY as:

## T-Side: <name of the default you recommend>
**The Problem:** <the typical mistake solo players make on this map's T side, tied to the player's stats if provided>
**The Fix:** <a simple default setup with player counts and roles, e.g. 1-3-1: who goes where in the first 30-45s and why>
**Key Takeaway:** <one sentence>

## CT-Side: <name of the defensive principle>
**The Problem:** <typical CT mistake on this map>
**The Fix:** <site setups and one crossfire per site, when to fall back, when to rotate>
**Key Takeaway:** <one sentence>

## Utility Homework
<2-3 specific must-know lineups for this map (smoke/flash), named by position>

## Immediate Action Items
<2-3 bullet habits to apply next match>

Rules: this is for SOLO QUEUE — assume no team coordination; advice must work with random teammates. Be concrete with position names. Under 350 words. If player stats are provided, anchor at least two points to them."""

@app.get("/api/map_fundamentals")
def api_map_fundamentals(map: str = Query(...), refresh: int = Query(0)):
    scope = f"fund_{map}"
    conn = _db()
    try:
        if not refresh:
            with conn.cursor() as c:
                c.execute("SELECT answer_html, generated_at FROM coach_cache WHERE scope=%s", (scope,))
                row = c.fetchone()
            if row:
                return {"map": map, "html": row["answer_html"],
                        "generated_at": row["generated_at"].isoformat()}
        if not llm.available():
            raise HTTPException(503, llm.not_configured_message())
        # personalize with whatever per-map data exists
        stats_bits = []
        with conn.cursor() as c:
            c.execute("""SELECT COUNT(*) AS matches,
                         ROUND(100.0*COUNT(*) FILTER (WHERE won)/NULLIF(COUNT(*),0),1) AS win_pct,
                         ROUND(AVG(kd_ratio)::numeric,2) AS kd, ROUND(AVG(adr)::numeric,0) AS adr,
                         ROUND(100.0*SUM(opening_kills)::numeric/NULLIF(SUM(opening_kills+opening_deaths),0),1) AS opening_win_pct
                         FROM faceit_matches WHERE map=%s""", (map,))
            fc = dict(c.fetchone() or {})
            if fc.get("matches"):
                stats_bits.append(f"FACEIT on {map}: {fc}")
            c.execute("SELECT * FROM v_by_side WHERE map=%s", (map,))
            for r in c.fetchall():
                stats_bits.append(f"demo side split: {dict(r)}")
        resp = llm.create(
            model=MODEL, max_tokens=2048,
            thinking={"type": "adaptive"},
            output_config={"effort": EFFORT},
            system=[{"type": "text", "text": FUNDAMENTALS_PROMPT,
                     "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content":
                       f"Map: {map}\nPlayer stats:\n" +
                       ("\n".join(stats_bits) if stats_bits else "(none yet)")}],
        )
        txt = "\n".join(b.text for b in resp.content if b.type == "text")
        html = md.markdown(txt, extensions=["extra", "sane_lists"])
        with conn.cursor() as c:
            c.execute("""INSERT INTO coach_cache(scope, question, answer_html, generated_at)
                         VALUES (%s, %s, %s, now())
                         ON CONFLICT (scope) DO UPDATE
                         SET answer_html=EXCLUDED.answer_html, generated_at=now()""",
                      (scope, f"fundamentals {map}", html))
        conn.commit()
        return {"map": map, "html": html,
                "generated_at": datetime.now(timezone.utc).isoformat()}
    finally:
        conn.close()

# ── Today's Focus engine ───────────────────────────────────────────────────────
# Deterministic picker chooses the weakest Tier-1 metric; Claude only writes
# the advice. Focus persists in focus_log so progress is measurable (Phase 3).

DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK_URL", "")

# key: (label, better, threshold, min_sample, drill_fallback)
FOCUS_METRICS = {
    "counter_strafe_pct":  ("Counter-strafing", "higher", 65.0, 150,
                            "aim_botz: 200 kills, strafe-stop before every shot"),
    "first_bullet_acc_pct":("First-bullet accuracy", "higher", 22.0, 150,
                            "aim_botz: 100 one-tap kills at mid range, reset on miss"),
    "spray_late_acc_pct":  ("Spray control (bullets 6+)", "higher", 18.0, 100,
                            "recoil_master: 15 min AK/M4 wall sprays, then 50 spray-down kills"),
    "ttd_ms":              ("Time to damage", "lower", 500.0, 20,
                            "aim_botz: reaction one-taps — fire within 300ms of target appearing"),
    "crosshair_err_deg":   ("Crosshair placement", "lower", 4.0, 20,
                            "yprac maps: walk routes keeping crosshair at head height on every corner"),
    "untraded_death_pct":  ("Dying untraded", "lower", 55.0, 30,
                            "review last 5 deaths: were you in trade range of a teammate?"),
    "opening_duel_win_pct":("Opening duels", "higher", 48.0, 20,
                            "stop dry-peeking first contact — flash or wait for util every time"),
    "deaths_blinded_pct":  ("Dying while flashed", "lower", 12.0, 30,
                            "turn away or jiggle off angles when flashes pop — never hold blind"),
    "util_unused_at_death":("Dying with unused utility", "lower", 0.8, 30,
                            "use grenades before engaging — utility in inventory wins nothing"),
}

def _metric_value(conn, metric: str, since=None):
    """Current value of a focus metric over demo-parsed matches, optionally
    restricted to matches after `since`. Returns (value, sample_size)."""
    tw = "AND m.played_at >= %(since)s" if since else ""
    p = {"since": since}
    with conn.cursor() as c:
        if metric in ("counter_strafe_pct", "first_bullet_acc_pct", "spray_late_acc_pct"):
            cond = {"counter_strafe_pct":   "se.burst_idx = 1 AND se.speed < 34",
                    "first_bullet_acc_pct": "se.burst_idx = 1 AND se.hit",
                    "spray_late_acc_pct":   "se.burst_idx > 5 AND se.hit"}[metric]
            base = {"counter_strafe_pct":   "se.burst_idx = 1",
                    "first_bullet_acc_pct": "se.burst_idx = 1",
                    "spray_late_acc_pct":   "se.burst_idx > 5"}[metric]
            c.execute(f"""SELECT ROUND(100.0*COUNT(*) FILTER (WHERE {cond})::numeric
                          /NULLIF(COUNT(*) FILTER (WHERE {base}),0),1) AS v,
                          COUNT(*) FILTER (WHERE {base}) AS n
                          FROM shot_events se JOIN matches m USING(match_id)
                          WHERE se.burst_idx IS NOT NULL {tw}""", p)
        elif metric == "ttd_ms":
            c.execute(f"""SELECT ROUND(AVG(pr.ttd_ms)::numeric,0) AS v, COUNT(pr.ttd_ms) AS n
                          FROM player_rounds pr JOIN matches m USING(match_id)
                          WHERE pr.ttd_ms IS NOT NULL {tw}""", p)
        elif metric == "crosshair_err_deg":
            c.execute(f"""SELECT ROUND(ABS(AVG(pr.crosshair_err_deg))::numeric,2) AS v,
                          COUNT(pr.crosshair_err_deg) AS n
                          FROM player_rounds pr JOIN matches m USING(match_id)
                          WHERE pr.crosshair_err_deg IS NOT NULL {tw}""", p)
        elif metric == "untraded_death_pct":
            c.execute(f"""SELECT ROUND(100.0*COUNT(*) FILTER (WHERE NOT pr.traded_death)::numeric
                          /NULLIF(COUNT(*),0),1) AS v, COUNT(*) AS n
                          FROM player_rounds pr JOIN matches m USING(match_id)
                          WHERE pr.deaths > 0 {tw}""", p)
        elif metric == "opening_duel_win_pct":
            c.execute(f"""SELECT ROUND(100.0*COUNT(*) FILTER (WHERE pr.opening_kill)::numeric
                          /NULLIF(COUNT(*),0),1) AS v, COUNT(*) AS n
                          FROM player_rounds pr JOIN matches m USING(match_id)
                          WHERE (pr.opening_kill OR pr.opening_death) {tw}""", p)
        elif metric == "deaths_blinded_pct":
            c.execute(f"""SELECT ROUND(100.0*COUNT(*) FILTER (WHERE pr.death_blinded)::numeric
                          /NULLIF(COUNT(*),0),1) AS v, COUNT(*) AS n
                          FROM player_rounds pr JOIN matches m USING(match_id)
                          WHERE pr.deaths > 0 {tw}""", p)
        elif metric == "util_unused_at_death":
            c.execute(f"""SELECT ROUND(AVG(pr.death_unused_util)::numeric,2) AS v, COUNT(*) AS n
                          FROM player_rounds pr JOIN matches m USING(match_id)
                          WHERE pr.death_unused_util IS NOT NULL {tw}""", p)
        else:
            return None, 0
        row = c.fetchone() or {}
    v = row.get("v")
    return (float(v) if v is not None else None), int(row.get("n") or 0)

def _pick_focus(conn):
    """Score every metric against its threshold; return the worst offender."""
    best = None
    for key, (label, better, threshold, min_sample, drill) in FOCUS_METRICS.items():
        try:
            value, n = _metric_value(conn, key)
        except Exception:
            conn.rollback()
            continue
        if value is None or n < min_sample:
            continue
        if better == "higher":
            score = (threshold - value) / threshold
        else:
            score = (value - threshold) / threshold
        if score > 0 and (best is None or score > best["score"]):
            best = {"metric": key, "label": label, "better": better,
                    "value": value, "threshold": threshold, "sample": n,
                    "drill": drill, "score": round(score, 3)}
    return best

def _focus_progress(conn, focus_row):
    """Value of the focus metric on matches played since it was assigned."""
    value, n = _metric_value(conn, focus_row["metric"], since=focus_row["assigned_at"])
    if value is None:
        return None
    baseline = focus_row.get("baseline")
    delta = None
    if baseline is not None:
        delta = round(value - float(baseline), 2)
        if focus_row["better"] == "lower":
            delta = -delta  # positive delta always means "improved"
    return {"current": value, "sample": n, "delta": delta}

def _generate_focus(notify: bool = False):
    """Pick the weakest metric, have Claude write the advice, store + return it."""
    conn = _db()
    try:
        picked = _pick_focus(conn)
        if picked is None:
            return None
        advice_html, drill = "", picked["drill"]
        if llm.available():
            try:
                brief = _build_brief(conn, None, 30)
                resp = llm.create(
                    model=MODEL, max_tokens=1024,
                    thinking={"type": "adaptive"},
                    output_config={"effort": EFFORT},
                    system=[{"type": "text", "text": SYSTEM_PROMPT,
                             "cache_control": {"type": "ephemeral"}}],
                    messages=[{"role": "user", "content": [
                        {"type": "text", "text": brief, "cache_control": {"type": "ephemeral"}},
                        {"type": "text", "text":
                         f"The focus metric this week is **{picked['label']}** "
                         f"({picked['metric']}): currently {picked['value']} vs target "
                         f"{picked['threshold']} ({picked['better']} is better, "
                         f"n={picked['sample']}).\n"
                         "Write EXACTLY two lines:\n"
                         "1. One blunt paragraph (max 60 words): why this costs rounds "
                         "and the in-game habit to change.\n"
                         "2. One practice drill, 15 minutes or less, formatted as "
                         "'DRILL: <drill>'."},
                    ]}],
                )
                txt = "\n".join(b.text for b in resp.content if b.type == "text")
                lines = [l for l in txt.splitlines() if l.strip()]
                drill_lines = [l for l in lines if l.upper().startswith("DRILL")]
                if drill_lines:
                    drill = drill_lines[0].split(":", 1)[-1].strip()
                    lines = [l for l in lines if l not in drill_lines]
                advice_html = md.markdown("\n".join(lines), extensions=["extra"])
            except Exception as e:
                print(f"[focus] Claude advice failed, using fallback: {e}")
        # outcome of the focus being retired, for the weekly report
        prev_outcome = ""
        with conn.cursor() as c:
            c.execute("""SELECT id, assigned_at, metric, label, baseline, better
                         FROM focus_log WHERE active ORDER BY assigned_at DESC LIMIT 1""")
            prev = c.fetchone()
        if prev is not None and prev["metric"] != picked["metric"]:
            prog = _focus_progress(conn, dict(prev))
            if prog and prog.get("delta") is not None:
                verdict = "improved" if prog["delta"] > 0 else "got worse"
                prev_outcome = (f"Last week's focus ({prev['label']}): "
                                f"{prev['baseline']} → {prog['current']} — {verdict}.\n")
        with conn.cursor() as c:
            c.execute("UPDATE focus_log SET active=FALSE WHERE active")
            c.execute("""INSERT INTO focus_log(metric,label,baseline,better,advice_html,drill)
                         VALUES (%s,%s,%s,%s,%s,%s) RETURNING id, assigned_at""",
                      (picked["metric"], picked["label"], picked["value"],
                       picked["better"], advice_html, drill))
        conn.commit()
        if notify:
            _post_discord(f"{prev_outcome}🎯 **New focus: {picked['label']}** — "
                          f"{picked['value']} now, target {picked['threshold']} "
                          f"({'higher' if picked['better']=='higher' else 'lower'} is better).\n"
                          f"Drill: {drill}")
        picked["advice_html"] = advice_html
        picked["drill"] = drill
        return picked
    finally:
        conn.close()

def _post_discord(content: str):
    if not DISCORD_WEBHOOK:
        return
    try:
        req = _urllib.Request(
            DISCORD_WEBHOOK,
            data=json.dumps({"content": content[:1900]}).encode(),
            headers={"Content-Type": "application/json"})
        _urllib.urlopen(req, timeout=10)
    except Exception as e:
        print(f"[focus] Discord post failed: {e}")

@app.get("/api/todays_focus")
def api_todays_focus():
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""SELECT id, assigned_at, metric, label, baseline, better,
                         advice_html, drill FROM focus_log
                         WHERE active ORDER BY assigned_at DESC LIMIT 1""")
            row = c.fetchone()
        if row is None:
            picked = _generate_focus()
            if picked is None:
                return {"focus": None,
                        "reason": "not enough demo-parsed data yet"}
            with conn.cursor() as c:
                c.execute("""SELECT id, assigned_at, metric, label, baseline, better,
                             advice_html, drill FROM focus_log
                             WHERE active ORDER BY assigned_at DESC LIMIT 1""")
                row = c.fetchone()
        row = dict(row)
        progress = _focus_progress(conn, row)
        row["assigned_at"] = row["assigned_at"].isoformat()
        thr = FOCUS_METRICS.get(row["metric"], (None, None, None))[2]
        return {"focus": row, "progress": progress, "threshold": thr}
    finally:
        conn.close()

@app.post("/api/refresh_focus")
def api_refresh_focus():
    picked = _generate_focus(notify=True)
    if picked is None:
        return {"ok": False, "reason": "not enough demo-parsed data yet"}
    return {"ok": True, "focus": picked}

async def _focus_scheduler():
    """Post-session recap + weekly focus rotation.
    Every 15 min: if the newest demo-parsed match is 45min-3h old and newer than
    the last recap, the session just ended — post a recap with focus progress.
    Rotate the focus itself weekly (or when first data arrives)."""
    while True:
        try:
            conn = _db()
            try:
                with conn.cursor() as c:
                    c.execute("SELECT MAX(played_at) AS last FROM matches")
                    last_match = (c.fetchone() or {}).get("last")
                    c.execute("""SELECT generated_at FROM coach_cache
                                 WHERE scope='_last_session_recap'""")
                    marker = c.fetchone()
                    last_recap = marker["generated_at"] if marker else None
                    c.execute("""SELECT id, assigned_at, metric, label, baseline, better
                                 FROM focus_log WHERE active
                                 ORDER BY assigned_at DESC LIMIT 1""")
                    focus = c.fetchone()
                now = datetime.now(timezone.utc)
                # weekly rotation (also bootstraps the first focus)
                if focus is None or (now - focus["assigned_at"]).days >= 7:
                    loop = asyncio.get_event_loop()
                    await loop.run_in_executor(None, _generate_focus, True)
                elif last_match is not None:
                    age = (now - last_match).total_seconds()
                    if 2700 <= age <= 10800 and (last_recap is None or last_match > last_recap):
                        # session over — recap matches since 2h before last match
                        session_start = last_match - timedelta(hours=2)
                        with conn.cursor() as c:
                            c.execute("""SELECT COUNT(*) AS n,
                                         COUNT(*) FILTER (WHERE won) AS w
                                         FROM matches WHERE played_at >= %s""",
                                      (session_start,))
                            s = c.fetchone()
                        prog = _focus_progress(conn, dict(focus))
                        msg = (f"📊 **Session recap** — {s['n']} match(es), "
                               f"{s['w']}W/{s['n']-s['w']}L.\n"
                               f"Focus ({focus['label']}): ")
                        if prog and prog["delta"] is not None:
                            arrow = "📈 improved" if prog["delta"] > 0 else "📉 worse"
                            msg += (f"{prog['current']} vs baseline {focus['baseline']} "
                                    f"({arrow} by {abs(prog['delta'])})")
                        else:
                            msg += "no demo-parsed rounds this session yet"
                        _post_discord(msg)
                        with conn.cursor() as c:
                            c.execute("""INSERT INTO coach_cache(scope,question,answer_html,generated_at)
                                         VALUES ('_last_session_recap','-','-',now())
                                         ON CONFLICT (scope) DO UPDATE SET generated_at=now()""")
                        conn.commit()
            finally:
                conn.close()
        except Exception as e:
            print(f"[focus] scheduler error: {e}")
        await asyncio.sleep(900)

# ── stats API ──────────────────────────────────────────────────────────────────

def _kpis_for_period(conn, map_filter, cutoff_from, cutoff_to):
    """Return headline KPIs for a given time window."""
    mc = "" if not map_filter else " AND m.map=%s"
    try:
        with conn.cursor() as c:
            c.execute(f"""SELECT
                ROUND(100.0*COUNT(DISTINCT CASE WHEN m.won THEN m.match_id END)::numeric/NULLIF(COUNT(DISTINCT m.match_id),0),1) AS win_pct,
                ROUND(SUM(pr.kills)::numeric/NULLIF(SUM(pr.deaths),0),2) AS kd,
                ROUND(AVG(pr.damage),0) AS adr,
                ROUND(100.0*SUM(pr.headshots)::numeric/NULLIF(SUM(pr.kills),0),1) AS hs_pct,
                ROUND(100.0*SUM(CASE WHEN pr.opening_kill THEN 1 ELSE 0 END)::numeric
                    /NULLIF(SUM(CASE WHEN pr.opening_kill OR pr.opening_death THEN 1 ELSE 0 END),0),1) AS opening_win_pct
                FROM matches m JOIN player_rounds pr USING(match_id)
                WHERE m.played_at>=%s AND m.played_at<%s{mc}""", [cutoff_from, cutoff_to] + ([map_filter] if map_filter else []))
            return dict(c.fetchone() or {})
    except Exception:
        return {}

@app.get("/api/player_profile")
def api_player_profile():
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""
                WITH ks AS (
                    SELECT COUNT(*) AS total_kills,
                        SUM(CASE WHEN weapon IN ('weapon_awp','weapon_ssg08') THEN 1 ELSE 0 END) AS sniper_kills
                    FROM kill_events WHERE NOT is_victim
                ),
                rs AS (
                    SELECT COUNT(*) AS total_rounds,
                        SUM(CASE WHEN opening_kill THEN 1 ELSE 0 END) AS opening_kills,
                        COALESCE(AVG(util_thrown), 0) AS avg_util
                    FROM player_rounds
                )
                SELECT k.total_kills, k.sniper_kills, r.total_rounds, r.opening_kills, r.avg_util,
                    ROUND(100.0*k.sniper_kills/NULLIF(k.total_kills,0),1) AS sniper_pct,
                    ROUND(100.0*r.opening_kills/NULLIF(r.total_rounds,0),1) AS entry_pct
                FROM ks k, rs r
            """)
            row = dict(c.fetchone() or {})
    finally:
        conn.close()

    sniper_pct = float(row.get("sniper_pct") or 0)
    entry_pct  = float(row.get("entry_pct")  or 0)
    avg_util   = float(row.get("avg_util")   or 0)

    if sniper_pct >= 22:
        role = "AWP"
        role_detail = f"Sniper — {sniper_pct:.0f}% of kills with AWP/Scout"
    elif entry_pct >= 35:
        role = "Entry"
        role_detail = f"Entry Fragger — {entry_pct:.0f}% of rounds with opening attempt"
    elif avg_util >= 1.4:
        role = "Support"
        role_detail = f"Support — {avg_util:.1f} util pieces thrown per round"
    else:
        role = "Rifler"
        role_detail = "Balanced rifle player"

    steam = _fetch_steam_profile()
    return _j({
        "name":        steam.get("personaname", "VeryBusyOwl"),
        "avatar_url":  steam.get("avatarfull", ""),
        "role":        role,
        "role_detail": role_detail,
    })


@app.get("/api/stats")
def api_stats(
    map: Optional[str] = Query(None),
    side: str = Query("all"),
    days: int = Query(90),
):
    conn = _db()
    try:
        now = datetime.now(timezone.utc)
        curr_from = now - timedelta(days=days)
        prev_from = now - timedelta(days=days*2)

        with conn.cursor() as c:
            c.execute("SELECT ROUND(AVG(score)::numeric,1) AS score FROM v_match_score")
            score_row = dict(c.fetchone() or {})

            c.execute("""SELECT
                ROUND(100.0*SUM(CASE WHEN won THEN 1 ELSE 0 END)::numeric/NULLIF(COUNT(*),0),1) AS win_pct,
                ROUND(SUM(pr.kills)::numeric/NULLIF(SUM(pr.deaths),0),2) AS kd,
                ROUND(AVG(pr.damage)::numeric,0) AS adr,
                ROUND(100.0*SUM(pr.headshots)::numeric/NULLIF(SUM(pr.kills),0),1) AS hs_pct,
                ROUND(100.0*SUM(CASE WHEN pr.opening_kill THEN 1 ELSE 0 END)::numeric
                    /NULLIF(SUM(CASE WHEN pr.opening_kill OR pr.opening_death THEN 1 ELSE 0 END),0),1) AS opening_win_pct,
                ROUND(100.0*SUM(CASE WHEN pr.round_won THEN 1 ELSE 0 END)::numeric
                    /NULLIF(COUNT(pr.round_num),0),1) AS round_win_pct,
                ROUND(100.0*SUM(CASE WHEN pr.clutch_won THEN 1 ELSE 0 END)::numeric
                    /NULLIF(SUM(CASE WHEN pr.was_clutch THEN 1 ELSE 0 END),0),1) AS clutch_pct
                FROM matches m JOIN player_rounds pr USING(match_id)""")
            stats_row = dict(c.fetchone() or {})

            c.execute("""WITH s AS (SELECT COUNT(*) AS n FROM shot_events),
                              h AS (SELECT COUNT(*) AS n FROM damage_events WHERE attacker_is_you=TRUE)
                         SELECT ROUND(100.0*h.n::numeric/NULLIF(s.n,0),1) AS accuracy_pct FROM h,s""")
            acc_row = dict(c.fetchone() or {})

            c.execute("""SELECT to_char(played_at,'MM-DD HH24:MI') AS "when",map,won,
                                team_score,opp_score,score::float AS rating
                         FROM v_match_score ORDER BY played_at DESC LIMIT 10""")
            recent = [dict(r) for r in c.fetchall()]

            c.execute("SELECT played_at::text,score::float AS score,map FROM v_match_score ORDER BY played_at")
            trend = [dict(r) for r in c.fetchall()]

            # Synthetic performance rating — Elo-style from match results + KPIs
            # CS2 does not expose actual Premier Rating via any public API.
            c.execute("""
                SELECT m.played_at::text, m.won,
                       ROUND(SUM(pr.kills)::numeric/NULLIF(SUM(pr.deaths),0),2)::float AS kd,
                       ROUND(AVG(pr.damage)::numeric,0)::float AS adr,
                       m.map
                FROM matches m JOIN player_rounds pr USING(match_id)
                GROUP BY m.match_id, m.played_at, m.won, m.map
                ORDER BY m.played_at
            """)
            _rating = 9000
            rating_trend = []
            for row in c.fetchall():
                _won = row["won"]
                _kd  = float(row["kd"]  or 1.0)
                _adr = float(row["adr"] or 70.0)
                _base    = 28 if _won else -22
                _kd_mod  = max(-18, min(18, round((_kd  - 1.0) * 15)))
                _adr_mod = max(-12, min(12, round((_adr - 70.0) / 8)))
                _delta   = _base + _kd_mod + _adr_mod
                _rating += _delta
                rating_trend.append({
                    "played_at": row["played_at"],
                    "rating": _rating,
                    "delta": _delta,
                    "won": _won,
                    "map": row["map"],
                })

            c.execute("SELECT DISTINCT map FROM matches ORDER BY map")
            mm_maps_set = {r["map"] for r in c.fetchall()}
            maps_list = sorted(mm_maps_set)

            c.execute("""SELECT map,matches,ROUND(win_pct::numeric,1) AS win_pct,
                                ROUND(kd::numeric,2) AS kd,ROUND(adr::numeric,0) AS adr
                         FROM v_by_map ORDER BY win_pct DESC NULLS LAST""")
            maps_stats = [dict(r) for r in c.fetchall()]

            # FACEIT per-map stats (all time)
            c.execute("""
                SELECT map, COUNT(*) AS matches,
                    ROUND(100.0*COUNT(*) FILTER (WHERE won)/NULLIF(COUNT(*),0),1) AS win_pct,
                    ROUND(AVG(kd_ratio)::numeric,2) AS kd,
                    ROUND(AVG(adr)::numeric,1) AS adr,
                    ROUND(AVG(hs_pct)::numeric,1) AS hs_pct,
                    MAX(faceit_elo) FILTER (WHERE played_at=(
                        SELECT MAX(played_at) FROM faceit_matches f2
                        WHERE f2.map=faceit_matches.map AND f2.faceit_elo IS NOT NULL))
                        AS latest_elo
                FROM faceit_matches
                GROUP BY map ORDER BY COUNT(*) DESC
            """)
            faceit_maps_stats = [dict(r) for r in c.fetchall()]
            faceit_maps_set = {r["map"] for r in faceit_maps_stats}
            # All maps across both platforms, MM first then FACEIT-only
            all_maps = sorted(mm_maps_set | faceit_maps_set)

            c.execute("""WITH sh AS (SELECT weapon,COUNT(*) AS n FROM shot_events GROUP BY weapon),
                              h  AS (SELECT weapon,COUNT(*) AS n FROM damage_events WHERE attacker_is_you=TRUE GROUP BY weapon),
                              k  AS (SELECT weapon,COUNT(*) FILTER(WHERE NOT is_victim) AS kills,
                                            SUM(CASE WHEN headshot AND NOT is_victim THEN 1 ELSE 0 END) AS hs
                                     FROM kill_events GROUP BY weapon)
                         SELECT COALESCE(k.weapon,sh.weapon,h.weapon) AS weapon,
                                COALESCE(k.kills,0) AS kills,COALESCE(k.hs,0) AS hs,
                                ROUND(100.0*COALESCE(k.hs,0)::numeric/NULLIF(COALESCE(k.kills,0),0),1) AS hs_pct,
                                COALESCE(sh.n,0) AS shots,COALESCE(h.n,0) AS hits,
                                ROUND(100.0*COALESCE(h.n,0)::numeric/NULLIF(COALESCE(sh.n,0),0),1) AS accuracy_pct
                         FROM k FULL OUTER JOIN sh USING(weapon) FULL OUTER JOIN h USING(weapon)
                         WHERE COALESCE(k.kills,0)>0 ORDER BY kills DESC LIMIT 10""")
            weapons = [dict(r) for r in c.fetchall()]

            c.execute("SELECT pitfall,rate_pct FROM v_recent_pitfalls ORDER BY rate_pct DESC NULLS LAST")
            pitfalls = [dict(r) for r in c.fetchall()]

            # Session: today vs 30-day average
            c.execute("""SELECT
                COUNT(DISTINCT m.match_id) AS matches_today,
                ROUND(AVG(pr.damage),0) AS adr_today,
                ROUND(SUM(pr.kills)::numeric/NULLIF(SUM(pr.deaths),0),2) AS kd_today
                FROM matches m JOIN player_rounds pr USING(match_id)
                WHERE m.played_at >= now() - interval '24 hours'""")
            session = dict(c.fetchone() or {})

        kpis = {
            "score":           score_row.get("score"),
            "win_pct":         stats_row.get("win_pct"),
            "kd":              stats_row.get("kd"),
            "adr":             stats_row.get("adr"),
            "hs_pct":          stats_row.get("hs_pct"),
            "accuracy_pct":    acc_row.get("accuracy_pct"),
            "opening_win_pct": stats_row.get("opening_win_pct"),
            "round_win_pct":   stats_row.get("round_win_pct"),
            "clutch_pct":      stats_row.get("clutch_pct"),
        }
        prev_kpis = _kpis_for_period(conn, map, prev_from, curr_from)
        curr_kpis = _kpis_for_period(conn, map, curr_from, now)

    finally:
        conn.close()

    return _j({
        "kpis":             kpis,
        "curr_kpis":        curr_kpis,
        "prev_kpis":        prev_kpis,
        "recent_form":       recent,
        "score_trend":       trend,
        "rating_trend":      rating_trend,
        "maps":              all_maps,
        "maps_list_mm":      maps_list,
        "maps_stats":        maps_stats,
        "faceit_maps_stats": faceit_maps_stats,
        "weapons":           weapons,
        "pitfalls":          pitfalls,
        "session":           session,
    })

# ── map detail API ────────────────────────────────────────────────────────────

@app.get("/api/map_detail")
def api_map_detail(
    map: str = Query(...),
    side: str = Query("all"),
    days: int = Query(90),
):
    conn = _db()
    try:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=days)
        prev_cutoff = now - timedelta(days=days*2)
        sc  = " AND pr.side=%s" if side != "all" else ""
        sp  = [map, cutoff] + ([side] if side != "all" else [])
        sv  = " AND side=%s"  if side != "all" else ""
        svp = [map]          + ([side] if side != "all" else [])
        with conn.cursor() as c:
            c.execute(f"""
                SELECT COUNT(DISTINCT m.match_id) AS matches,
                    ROUND(100.0*COUNT(DISTINCT CASE WHEN m.won THEN m.match_id END)::numeric
                          /NULLIF(COUNT(DISTINCT m.match_id),0),1) AS win_pct,
                    ROUND(SUM(pr.kills)::numeric/NULLIF(SUM(pr.deaths),0),2)    AS kd,
                    ROUND(AVG(pr.damage),0)                                     AS adr,
                    ROUND(100.0*SUM(pr.headshots)::numeric/NULLIF(SUM(pr.kills),0),1) AS hs_pct,
                    ROUND(100.0*SUM(CASE WHEN pr.opening_kill THEN 1 ELSE 0 END)::numeric
                          /NULLIF(SUM(CASE WHEN pr.opening_kill OR pr.opening_death THEN 1 ELSE 0 END),0),1)
                          AS opening_win_pct
                FROM matches m JOIN player_rounds pr USING(match_id)
                WHERE m.map=%s AND m.played_at>=%s{sc}
            """, sp)
            kpis = dict(c.fetchone() or {})

            c.execute("""
                SELECT vs.played_at::text, vs.score::float AS score, vs.map,
                       ROUND(AVG(pr.damage),0)::float AS adr,
                       ROUND(SUM(pr.kills)::numeric/NULLIF(SUM(pr.deaths),0),2)::float AS kd,
                       ROUND(100.0*SUM(pr.headshots)::numeric/NULLIF(SUM(pr.kills),0),1)::float AS hs_pct
                FROM v_match_score vs
                JOIN player_rounds pr USING(match_id)
                WHERE vs.map=%s
                GROUP BY vs.played_at, vs.score, vs.match_id, vs.map
                ORDER BY vs.played_at
            """, (map,))
            trend = [dict(r) for r in c.fetchall()]

            c.execute("""SELECT side,round_win_pct,adr,opening_kill_pct,opening_death_pct,
                                early_death_pct,util_per_round
                         FROM v_by_side WHERE map=%s ORDER BY side""", (map,))
            sides = [dict(r) for r in c.fetchall()]

            c.execute(f"""SELECT weapon,SUM(kills) AS kills,SUM(headshots) AS hs,
                                ROUND(100.0*SUM(headshots)::numeric/NULLIF(SUM(kills),0),1) AS hs_pct
                          FROM v_per_weapon WHERE map=%s{sv}
                          GROUP BY weapon HAVING SUM(kills)>0 ORDER BY kills DESC LIMIT 8""", svp)
            weapons = [dict(r) for r in c.fetchall()]

            c.execute(f"""
                WITH recent AS (
                    SELECT pr.* FROM player_rounds pr
                    JOIN matches m USING(match_id) WHERE m.map=%s AND m.played_at>=%s
                )
                SELECT 'T-side opening deaths'          AS pitfall,
                    ROUND(100.0*SUM(CASE WHEN side='T' AND opening_death THEN 1 END)
                          /NULLIF(SUM(CASE WHEN side='T' THEN 1 END),0),1) AS rate_pct FROM recent
                UNION ALL SELECT 'Failed weapon saves',
                    ROUND(100.0*SUM(CASE WHEN NOT round_won AND NOT survived
                          AND equip_value>=2700 AND NOT saved_weapon THEN 1 END)
                          /NULLIF(SUM(CASE WHEN NOT round_won THEN 1 END),0),1) FROM recent
                UNION ALL SELECT 'Bad force-buys',
                    ROUND(100.0*SUM(CASE WHEN buy_type='force' AND NOT round_won AND damage<50 THEN 1 END)
                          /NULLIF(SUM(CASE WHEN buy_type='force' THEN 1 END),0),1) FROM recent
                UNION ALL SELECT 'Zero utility rounds',
                    ROUND(100.0*SUM(CASE WHEN util_thrown=0 THEN 1 END)/NULLIF(COUNT(*),0),1) FROM recent
                UNION ALL SELECT 'Fight conversion failures',
                    ROUND(100.0*SUM(CASE WHEN high_damage_no_kill THEN 1 END)/NULLIF(COUNT(*),0),1) FROM recent
                UNION ALL SELECT 'Early round deaths',
                    ROUND(100.0*SUM(CASE WHEN death_phase='early' AND deaths>0 THEN 1 END)
                          /NULLIF(SUM(CASE WHEN deaths>0 THEN 1 END),0),1) FROM recent
            """, [map, cutoff])
            pitfalls = [dict(r) for r in c.fetchall()]

            c.execute("""SELECT to_char(m.played_at,'MM-DD HH24:MI') AS "when",m.match_id,m.map,m.won,
                                m.team_score,m.opp_score,vs.score::float AS rating
                         FROM v_match_score vs JOIN matches m ON vs.match_id=m.match_id
                         WHERE vs.map=%s ORDER BY m.played_at DESC LIMIT 10""", (map,))
            recent = [dict(r) for r in c.fetchall()]

            # Death phase breakdown
            phase_breakdown = {}
            try:
                c.execute("""
                    SELECT pr.side, pr.death_phase, COUNT(*) AS n
                    FROM player_rounds pr JOIN matches m USING(match_id)
                    WHERE m.map=%s AND m.played_at>=%s AND pr.deaths > 0
                    GROUP BY pr.side, pr.death_phase
                """, [map, cutoff])
                for r in c.fetchall():
                    s = r['side']
                    if s not in phase_breakdown:
                        phase_breakdown[s] = {'early': 0, 'mid': 0, 'late': 0}
                    ph = r['death_phase'] or 'mid'
                    if ph in ('early', 'mid', 'late'):
                        phase_breakdown[s][ph] = int(r['n'] or 0)
            except Exception:
                pass

            # Flash / utility efficiency
            flash_stats = {}
            try:
                c.execute("""
                    SELECT
                        COUNT(*) FILTER(WHERE ge.grenade_type='flash') AS flashes,
                        COALESCE(SUM(ge.enemies_flashed) FILTER(WHERE ge.grenade_type='flash'),0) AS ef,
                        COALESCE(SUM(ge.teammates_flashed) FILTER(WHERE ge.grenade_type='flash'),0) AS tf,
                        COUNT(*) FILTER(WHERE ge.grenade_type='smoke') AS smokes,
                        COUNT(*) FILTER(WHERE ge.grenade_type='molotov') AS mols,
                        COUNT(*) FILTER(WHERE ge.grenade_type='he') AS hes,
                        ROUND(AVG(ge.enemies_flashed) FILTER(WHERE ge.grenade_type='flash'),2) AS avg_ef
                    FROM grenade_events ge JOIN matches m USING(match_id)
                    WHERE m.map=%s AND m.played_at>=%s
                """, [map, cutoff])
                flash_stats = dict(c.fetchone() or {})
            except Exception:
                pass

            # Economy panel
            economy = {}
            try:
                c.execute("""SELECT
                    ROUND(100.0*SUM(CASE WHEN buy_type='force' AND NOT round_won AND damage<50 THEN 1 END)::numeric
                          /NULLIF(SUM(CASE WHEN buy_type='force' THEN 1 END),0),1) AS force_waste_pct,
                    ROUND(100.0*SUM(CASE WHEN NOT round_won AND NOT survived
                          AND equip_value>=2700 AND NOT saved_weapon THEN 1 END)::numeric
                          /NULLIF(SUM(CASE WHEN NOT round_won THEN 1 END),0),1) AS failed_save_pct,
                    ROUND(100.0*SUM(CASE WHEN buy_type='eco' AND round_won THEN 1 END)::numeric
                          /NULLIF(SUM(CASE WHEN buy_type='eco' THEN 1 END),0),1) AS eco_win_pct,
                    ROUND(AVG(CASE WHEN buy_type='full' THEN damage END),0) AS full_buy_adr
                    FROM player_rounds pr JOIN matches m USING(match_id)
                    WHERE m.map=%s AND m.played_at>=%s""", [map, cutoff])
                economy = dict(c.fetchone() or {})
            except Exception:
                pass

            # Clutch panel
            clutch = {}
            try:
                c.execute("""SELECT
                    SUM(CASE WHEN clutch_vs=1 THEN 1 ELSE 0 END) AS v1_total,
                    SUM(CASE WHEN clutch_vs=1 AND round_won THEN 1 ELSE 0 END) AS v1_won,
                    SUM(CASE WHEN clutch_vs=2 THEN 1 ELSE 0 END) AS v2_total,
                    SUM(CASE WHEN clutch_vs=2 AND round_won THEN 1 ELSE 0 END) AS v2_won,
                    SUM(CASE WHEN clutch_vs>=3 THEN 1 ELSE 0 END) AS v3p_total,
                    SUM(CASE WHEN clutch_vs>=3 AND round_won THEN 1 ELSE 0 END) AS v3p_won
                    FROM player_rounds pr JOIN matches m USING(match_id)
                    WHERE m.map=%s AND m.played_at>=%s AND clutch_vs IS NOT NULL""", [map, cutoff])
                clutch = dict(c.fetchone() or {})
            except Exception:
                pass

        # Prev-period KPIs for trend arrows
        prev_kpis = _kpis_for_period(conn, map, prev_cutoff, cutoff)
        curr_kpis = _kpis_for_period(conn, map, cutoff, now)

        # FACEIT stats for this map
        faceit_kpis = {}
        faceit_form = []
        try:
            with conn.cursor() as c:
                c.execute("""
                    SELECT COUNT(*) AS matches,
                        ROUND(100.0*COUNT(*) FILTER (WHERE won)/NULLIF(COUNT(*),0),1) AS win_pct,
                        ROUND(AVG(kd_ratio)::numeric,2) AS kd,
                        ROUND(AVG(adr)::numeric,1) AS adr,
                        ROUND(AVG(hs_pct)::numeric,1) AS hs_pct,
                        ROUND(100.0*SUM(opening_kills)::numeric/NULLIF(SUM(opening_kills+opening_deaths),0),1)
                            AS opening_win_pct,
                        SUM(triple_kills) AS triple_kills,
                        SUM(quadro_kills) AS quadro_kills,
                        SUM(penta_kills)  AS penta_kills,
                        MAX(faceit_elo) FILTER (WHERE played_at=(
                            SELECT MAX(played_at) FROM faceit_matches f2
                            WHERE f2.map=%s AND f2.faceit_elo IS NOT NULL)) AS latest_elo
                    FROM faceit_matches WHERE map=%s
                """, [map, map])
                faceit_kpis = dict(c.fetchone() or {})

                c.execute("""
                    SELECT to_char(played_at,'MM-DD HH24:MI') AS "when",
                           won, team_score, opp_score,
                           kd_ratio::float AS kd, adr::float AS adr,
                           kills, deaths, hs_pct::float AS hs_pct,
                           faceit_elo, elo_change, faceit_match_id
                    FROM faceit_matches WHERE map=%s
                    ORDER BY played_at DESC LIMIT 15
                """, [map])
                faceit_form = [dict(r) for r in c.fetchall()]
        except Exception as _fe:
            import traceback; traceback.print_exc()

    finally:
        conn.close()

    return _j({"kpis": kpis, "curr_kpis": curr_kpis, "prev_kpis": prev_kpis,
                "score_trend": trend, "sides": sides,
                "weapons": weapons, "pitfalls": pitfalls, "recent_form": recent,
                "economy": economy, "clutch": clutch,
                "phase_breakdown": phase_breakdown, "flash_stats": flash_stats,
                "faceit_kpis": faceit_kpis, "faceit_form": faceit_form})

# ── image & static endpoints ───────────────────────────────────────────────────

@app.get("/radar/{map_name}.png")
def radar_png(map_name: str):
    import re
    if not re.match(r'^[a-z0-9_]+$', map_name):
        raise HTTPException(400, "bad map name")
    p = Path(os.environ.get("RADARS_DIR", "/radars")) / f"{map_name}.png"
    if not p.exists():
        raise HTTPException(404, "no radar for this map")
    return FileResponse(str(p), media_type="image/png")

# ── replay endpoints ───────────────────────────────────────────────────────────

@app.get("/api/round_replay")
def api_round_replay(match_id: str, round: int):
    mid = int(match_id)
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute(
                "SELECT data FROM round_replays WHERE match_id=%s AND round_num=%s",
                (mid, round)
            )
            row = c.fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(404, "no replay data for this round")
    import json as _json
    return Response(_json.dumps(row["data"]), media_type="application/json")

@app.get("/api/match_replays")
def api_match_replays(match_id: str):
    """Return all round replays for a match (lightweight: frames + result only)."""
    mid = int(match_id)
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute(
                """SELECT rr.round_num, rr.data,
                          pr.round_won
                   FROM round_replays rr
                   LEFT JOIN player_rounds pr
                     ON pr.match_id = rr.match_id AND pr.round_num = rr.round_num
                   WHERE rr.match_id=%s
                   ORDER BY rr.round_num""",
                (mid,)
            )
            rows = c.fetchall()
    finally:
        conn.close()
    import json as _json
    out = []
    for row in rows:
        d = row["data"] if isinstance(row["data"], dict) else _json.loads(row["data"])
        out.append({
            "round_idx": row["round_num"],
            "result": "win" if row["round_won"] else "loss",
            "frames": d.get("frames", []),
        })
    return Response(_json.dumps(out), media_type="application/json")

@app.get("/api/radar_calibration")
def api_radar_calibration(map: str = Query(...)):
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute(
                "SELECT origin_x, origin_y, scale FROM map_radar_calibration WHERE map=%s",
                (map,)
            )
            row = c.fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(404, "no calibration for this map")
    return _j({"origin_x": row["origin_x"], "origin_y": row["origin_y"], "scale": row["scale"]})

@app.get("/")
def root(request: Request):
    if request.session.get("user"):
        return RedirectResponse("/app", status_code=302)
    return FileResponse("/app/static/landing/index.html")

@app.get("/app")
def app_dashboard(request: Request):
    if not request.session.get("user"):
        return RedirectResponse("/", status_code=302)
    return FileResponse("/app/static/v2/index.html")


@app.post("/auth/steam/stub")
def auth_steam_stub(request: Request):
    request.session["user"] = {"name": "VeryBusyOwl", "stub": True}
    return RedirectResponse("/app", status_code=302)

@app.get("/auth/logout")
def auth_logout(request: Request):
    request.session.clear()
    return RedirectResponse("/", status_code=302)

@app.get("/heatmap")
def heatmap(
    map: str = Query(...),
    type: str = Query("kills"),
    side: str = Query("all"),
    days: int = Query(30),
    pro: bool = Query(False),
    grenade_type: Optional[str] = Query(None),
    weapon: Optional[str] = Query(None),
    caption: bool = Query(True),
    lens: Optional[str] = Query(None),
    _: Optional[str] = Query(None),
):
    if type not in ("kills","deaths","grenades","aim","smokes","flashes"): raise HTTPException(400,"type must be kills|deaths|grenades|aim|smokes|flashes")
    if side not in ("CT","T","all"): raise HTTPException(400,"side must be CT|T|all")
    if lens and lens not in ("deaths","duel","winloss"): raise HTTPException(400,"lens must be deaths|duel|winloss")
    if grenade_type and grenade_type not in ("smoke","flash","molotov","he"):
        raise HTTPException(400,"grenade_type must be smoke|flash|molotov|he")
    # coaching lenses: winloss = deaths in rounds you lost; duel = kills-vs-deaths overlay
    won = None
    if lens == "winloss":
        type, won = "deaths", False
    elif lens == "deaths":
        type = "deaths"
    return Response(_render_heatmap(map,type,side,days,pro,grenade_type,weapon,caption,lens,won), media_type="image/png",
                    headers={"Cache-Control":"no-cache"})

HEAT_MIN_SAMPLE = 8  # below this, don't pretend a pattern is real

@app.get("/api/heat_insight")
def api_heat_insight(map: str = Query(...), side: str = Query("all"), lens: str = Query("deaths"), days: int = Query(120)):
    """Coaching verdict for the kill/death map — the text that turns the picture into advice.
    All numbers come from data-driven cause flags; gated behind a min-sample guard.
    `days` MUST match the window the /heatmap image uses, so the verdict describes what's drawn."""
    if side not in ("CT","T","all"): raise HTTPException(400,"side must be CT|T|all")
    if lens not in ("deaths","duel","winloss"): raise HTTPException(400,"lens must be deaths|duel|winloss")
    sc = "" if side == "all" else " AND ke.side=%s"
    sp = (side,) if side != "all" else ()
    t_from = datetime.now(timezone.utc) - timedelta(days=days)
    conn = _db()
    try:
        with conn.cursor() as c:
            # untraded/opening etc. require a player_rounds row — INNER-join on the cause
            # flags so a death with a missing pr row isn't silently bucketed as "untraded".
            c.execute(f"""
              SELECT
                count(*) FILTER (WHERE ke.is_victim)                                            AS deaths,
                count(*) FILTER (WHERE NOT ke.is_victim)                                         AS kills,
                count(*) FILTER (WHERE ke.is_victim AND pr.opening_death)                        AS opening,
                count(*) FILTER (WHERE ke.is_victim AND pr.traded_death=FALSE)                    AS untraded,
                count(*) FILTER (WHERE ke.is_victim AND ke.was_blind)                            AS blind,
                count(*) FILTER (WHERE ke.is_victim AND ke.through_smoke)                         AS smoke,
                count(*) FILTER (WHERE ke.is_victim AND pr.round_won)                            AS d_won,
                count(*) FILTER (WHERE ke.is_victim AND pr.round_won=FALSE)                       AS d_lost,
                count(*) FILTER (WHERE ke.is_victim AND pr.round_won=FALSE AND pr.opening_death)  AS opn_lost,
                count(*) FILTER (WHERE ke.is_victim AND pr.round_won=TRUE  AND pr.opening_death)  AS opn_won
              FROM kill_events ke JOIN matches m USING(match_id)
              LEFT JOIN player_rounds pr ON pr.match_id=ke.match_id AND pr.round_num=ke.round_num
              WHERE m.map=%s{sc} AND m.played_at>=%s
            """, (map,)+sp+(t_from,))
            r = c.fetchone()
    finally:
        conn.close()

    deaths, kills = r["deaths"], r["kills"]
    pct = lambda n, d: int(round(100*n/d)) if d else 0
    mname = (map or "").replace("de_","").title()

    if lens == "duel":
        n = kills + deaths
        if n < HEAT_MIN_SAMPLE:
            return {"lens":lens,"n":n,"enough":False,"tone":"info",
                    "headline":f"Only {n} duels logged on {mname}",
                    "detail":"Play a few more matches — the win/lose zones will firm up."}
        net = kills - deaths
        # require a margin beyond a duel or two of noise before calling it good/bad
        margin = max(3, round(0.1 * n))
        tone = "good" if net >= margin else "warn" if net <= -margin else "info"
        sign = f"+{net}" if net > 0 else str(net)
        return {"lens":lens,"n":n,"enough":True,"tone":tone,
                "headline":f"{kills} kills vs {deaths} deaths on {mname} ({sign})",
                "detail":"Green = where you win fights, orange = where you lose them. "
                         "Keep taking the green angles; rethink how you enter the orange ones."}

    if lens == "winloss":
        d_lost, d_won = r["d_lost"], r["d_won"]
        if d_lost < HEAT_MIN_SAMPLE:
            return {"lens":lens,"n":d_lost,"enough":False,"tone":"info",
                    "headline":f"Only {d_lost} deaths in lost rounds on {mname}",
                    "detail":"Not enough lost-round deaths yet to spot a losing pattern."}
        opn_lost_p, opn_won_p = pct(r["opn_lost"], d_lost), pct(r["opn_won"], d_won)
        if d_won < HEAT_MIN_SAMPLE:
            # too few (or zero) won-round deaths to form an honest baseline — describe losses only
            detail = (f"{opn_lost_p}% of your deaths in lost rounds are opening deaths. "
                      "Dying first this often is usually what loses the round — the map shows where it happens.")
            tone = "warn" if opn_lost_p >= 30 else "info"
        elif opn_lost_p - opn_won_p >= 12:
            detail = (f"{opn_lost_p}% of your deaths in lost rounds are opening deaths, vs {opn_won_p}% in rounds you win. "
                      "You're trading your entry away early — when you die first, the round is usually already gone.")
            tone = "warn"
        else:
            detail = (f"In rounds you lose you die in much the same spots as rounds you win "
                      f"({opn_lost_p}% openings vs {opn_won_p}%). The map below shows where the losses concentrate.")
            tone = "info"
        return {"lens":lens,"n":d_lost,"enough":True,"tone":tone,
                "headline":f"Where you die in rounds you lose on {mname}","detail":detail}

    # lens == "deaths"
    if deaths < HEAT_MIN_SAMPLE:
        return {"lens":lens,"n":deaths,"enough":False,"tone":"info",
                "headline":f"Only {deaths} deaths logged on {mname}",
                "detail":"Play a few more matches and your death pattern will sharpen."}
    causes = [
        ("opening",  r["opening"],  "you're the first to die — stop taking dry duels; wait for util or a teammate to trade."),
        ("untraded", r["untraded"], "you're dying isolated, with no teammate to trade the kill — play closer to support."),
        ("while flashed", r["blind"], "you're getting flashed before you die — fix flash discipline and pre-aim known pop-flashes."),
        ("through smoke", r["smoke"], "you're holding or pushing blind into smoke — stop challenging fights you can't see."),
    ]
    name, cnt, advice = max(causes, key=lambda x: x[1])
    p = pct(cnt, deaths)
    return {"lens":lens,"n":deaths,"enough":True,"tone":"warn" if p >= 30 else "info",
            "headline":f"Where you die on {mname}",
            "detail":f"{p}% of your {deaths} deaths here are {name} deaths — {advice}"}

@app.get("/hitbox")
def hitbox(
    map: Optional[str] = Query(None),
    days: int = Query(30),
    perspective: str = Query("incoming"),
    side: str = Query("all"),
    _: Optional[str] = Query(None),
):
    if perspective not in ("incoming","outgoing"): raise HTTPException(400)
    if side not in ("CT","T","all"): raise HTTPException(400)
    return Response(_render_hitbox(map,days,perspective,side), media_type="image/png",
                    headers={"Cache-Control":"no-cache"})

# ── grenade lineup & coach brief endpoints ─────────────────────────────────────

@app.get("/api/lineups")
def api_lineups(map: str = Query(...)):
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""SELECT grenade_type,name,side,difficulty,notes,ref_url
                         FROM grenade_lineups WHERE map=%s
                         ORDER BY grenade_type,side,difficulty""", (map,))
            rows = [dict(r) for r in c.fetchall()]
    finally:
        conn.close()
    return _j(rows)

@app.get("/api/coach_brief")
def api_coach_brief(scope: str = Query("overview")):
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("SELECT question,answer_html,generated_at FROM coach_cache WHERE scope=%s", (scope,))
            row = c.fetchone()
    finally:
        conn.close()
    if not row:
        return _j({"cached": False, "answer_html": None, "generated_at": None, "question": None})
    return _j({"cached": True, "answer_html": row["answer_html"],
               "generated_at": row["generated_at"], "question": row["question"]})

@app.post("/api/refresh_coach")
async def api_refresh_coach(scope: str = Query("overview")):
    map_filter = None if scope == "overview" else scope
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _generate_and_cache_coach, scope, map_filter, 30)
    return {"status": "refreshing", "scope": scope}

# ── match history endpoints ────────────────────────────────────────────────────

@app.get("/api/matches")
def api_matches(map: Optional[str] = Query(None), limit: int = Query(20)):
    conn = _db()
    try:
        mc = " AND m.map=%s" if map else ""
        p  = ([map] if map else []) + [limit]
        with conn.cursor() as c:
            c.execute(f"""SELECT m.match_id::text AS match_id,
                                to_char(m.played_at,'YYYY-MM-DD HH24:MI') AS played_at,
                                m.map,m.won,m.team_score,m.opp_score,
                                COALESCE(m.platform,'mm') AS platform,
                                ROUND(SUM(pr.kills)::numeric/NULLIF(SUM(pr.deaths),0),2) AS kd,
                                ROUND(AVG(pr.damage),0) AS adr,
                                SUM(pr.kills) AS kills, SUM(pr.deaths) AS deaths,
                                ROUND(100.0*SUM(pr.headshots)::numeric/NULLIF(SUM(pr.kills),0),1) AS hs_pct,
                                TRUE AS has_replay
                         FROM matches m JOIN player_rounds pr USING(match_id)
                         WHERE 1=1{mc}
                         GROUP BY m.match_id,m.played_at,m.map,m.won,m.team_score,m.opp_score,m.platform
                         ORDER BY m.played_at DESC LIMIT %s""", p)
            mm_rows = [dict(r) for r in c.fetchall()]

            # FACEIT matches — stats available, no replay
            fc = " AND map=%s" if map else ""
            fp = ([map] if map else []) + [limit]
            c.execute(f"""
                SELECT faceit_match_id AS match_id,
                       to_char(played_at,'YYYY-MM-DD HH24:MI') AS played_at,
                       map, won, team_score, opp_score,
                       'faceit' AS platform,
                       kd_ratio AS kd, adr, kills, deaths, hs_pct,
                       FALSE AS has_replay,
                       faceit_elo, elo_change,
                       triple_kills, quadro_kills, penta_kills
                FROM faceit_matches
                WHERE 1=1{fc}
                ORDER BY played_at DESC LIMIT %s
            """, fp)
            fc_rows = [dict(r) for r in c.fetchall()]

        # Merge and sort by played_at descending
        all_rows = sorted(mm_rows + fc_rows,
                          key=lambda r: r.get("played_at") or "", reverse=True)[:limit]
    finally:
        conn.close()
    return _j(all_rows)

@app.get("/api/match_rounds")
def api_match_rounds(match_id: str = Query(...)):
    mid = int(match_id)
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""
                SELECT round_num, side, round_won, kills, deaths,
                       damage, was_clutch, clutch_vs, clutch_won,
                       opening_kill, planted_bomb, survived, death_phase,
                       equip_value, money_start, buy_type, spent
                FROM player_rounds
                WHERE match_id = %s
                ORDER BY round_num
            """, (mid,))
            rows = [dict(r) for r in c.fetchall()]
    finally:
        conn.close()
    return _j(rows)

@app.get("/api/death_patterns")
def api_death_patterns(map: str = Query(...), days: int = Query(90)):
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""
                SELECT ke.victim_x AS x, ke.victim_y AS y, ke.weapon, ke.headshot,
                       pr.side, pr.round_won
                FROM kill_events ke
                JOIN player_rounds pr ON pr.match_id = ke.match_id AND pr.round_num = ke.round_num
                JOIN matches m ON m.match_id = ke.match_id
                WHERE m.map = %s
                  AND ke.is_victim = true
                  AND ke.victim_x IS NOT NULL
                  AND m.played_at >= NOW() - INTERVAL '%s days'
                ORDER BY m.played_at DESC
            """ % ('%s', int(days)), (map,))
            rows = [dict(r) for r in c.fetchall()]
    finally:
        conn.close()
    return _j(rows)

@app.get("/api/match_detail")
def api_match_detail(match_id: str = Query(...)):
    conn = _db()
    mid = int(match_id)  # Decimal/numeric comparison
    try:
        with conn.cursor() as c:
            # Match header
            c.execute("""SELECT m.match_id,to_char(m.played_at,'YYYY-MM-DD HH24:MI') AS played_at,
                                m.map,m.won,m.team_score,m.opp_score
                         FROM matches m WHERE m.match_id=%s""", (mid,))
            header = dict(c.fetchone() or {})
            if not header:
                raise HTTPException(404, "Match not found")

            # Per-round breakdown
            c.execute("""SELECT round_num,side,round_won,kills,deaths,damage,
                                equip_value,buy_type,opening_kill,opening_death,
                                util_thrown,survived
                         FROM player_rounds WHERE match_id=%s ORDER BY round_num""", (mid,))
            rounds = [dict(r) for r in c.fetchall()]

            # Kill events for this match
            c.execute("""SELECT weapon,headshot,is_victim,attacker_x,attacker_y,victim_x,victim_y,side
                         FROM kill_events WHERE match_id=%s ORDER BY id""", (mid,))
            kills = [dict(r) for r in c.fetchall()]

            # Aggregate stats for this match
            c.execute("""SELECT
                ROUND(SUM(kills)::numeric/NULLIF(SUM(deaths),0),2) AS kd,
                ROUND(AVG(damage),0) AS adr,
                SUM(kills) AS kills, SUM(deaths) AS deaths, SUM(assists) AS assists,
                ROUND(100.0*SUM(headshots)::numeric/NULLIF(SUM(kills),0),1) AS hs_pct,
                ROUND(100.0*SUM(CASE WHEN opening_kill THEN 1 ELSE 0 END)::numeric
                      /NULLIF(SUM(CASE WHEN opening_kill OR opening_death THEN 1 ELSE 0 END),0),1) AS opening_win_pct,
                SUM(CASE WHEN survived THEN 1 ELSE 0 END) AS survived_rounds
                FROM player_rounds WHERE match_id=%s""", (mid,))
            agg = dict(c.fetchone() or {})

            # CT / T split for this match
            c.execute("""SELECT side,
                COUNT(*) AS rounds_played,
                SUM(CASE WHEN round_won THEN 1 ELSE 0 END) AS rounds_won,
                ROUND(AVG(damage),0) AS adr,
                SUM(kills) AS kills
                FROM player_rounds WHERE match_id=%s GROUP BY side""", (mid,))
            side_split = [dict(r) for r in c.fetchall()]

            # vs average (last 30 matches on same map)
            map_name = header.get("map")
            c.execute("""SELECT
                ROUND(AVG(kd_agg)::numeric,2) AS avg_kd,
                ROUND(AVG(adr_agg)::numeric,0) AS avg_adr,
                ROUND((100.0*AVG(hs_pct_agg))::numeric,1) AS avg_hs_pct
                FROM (
                    SELECT m.match_id,
                        SUM(pr.kills)::float/NULLIF(SUM(pr.deaths),0) AS kd_agg,
                        AVG(pr.damage) AS adr_agg,
                        SUM(pr.headshots)::float/NULLIF(SUM(pr.kills),0) AS hs_pct_agg
                    FROM matches m JOIN player_rounds pr USING(match_id)
                    WHERE m.map=%s GROUP BY m.match_id ORDER BY m.played_at DESC LIMIT 30
                ) sub""", (map_name,))
            avg_stats = dict(c.fetchone() or {})

    finally:
        conn.close()

    return _j({
        "header":     header,
        "agg":        agg,
        "side_split": side_split,
        "rounds":     rounds,
        "kills":      kills,
        "vs_avg":     avg_stats,
    })

@app.get("/ask")
def ask_get(
    q: str = Query(...),
    map: Optional[str] = Query(None),
    days: int = Query(30),
    html: bool = Query(False),
):
    return _ask(q, map, days, want_html=html)

@app.post("/ask")
def ask_post(body: dict):
    q = body.get("question") or body.get("q")
    if not q: raise HTTPException(400,"question required")
    return _ask(q, body.get("map"), int(body.get("days",30)), want_html=False)

@app.get("/coach")
def coach_page(
    q: Optional[str] = Query(None),
    map: Optional[str] = Query(None),
    days: int = Query(30),
):
    if q:
        return _ask(q, map, days, want_html=True)
    placeholder = "<p style='color:#8b94a8'>Ask the coach a question above to get started.</p>"
    return HTMLResponse(_coach_html("", placeholder, None, None, map, days))

@app.get("/health")
def health():
    return {"status":"ok","model":MODEL,"api_key_set":bool(API_KEY),"ai_configured":llm.available(),"provider":llm.PROVIDER}

@app.get("/api/setup_state")
def api_setup_state():
    """What a fresh install still needs — drives the first-run setup screen so a
    new user sees guidance, not empty panels. `ready` = at least one data source
    is connected AND the AI provider is usable."""
    faceit = bool(os.environ.get("FACEIT_API_KEY") and os.environ.get("FACEIT_NICKNAME"))
    steam  = bool(os.environ.get("STEAM_API_KEY") and os.environ.get("STEAM_ID64"))
    try:
        conn = _db()
        try:
            with conn.cursor() as c:
                c.execute("SELECT count(*) AS n FROM matches")
                has_data = c.fetchone()["n"] > 0
        finally:
            conn.close()
    except Exception:
        has_data = False
    ai = llm.available()
    return {
        "ai":       {"configured": ai, "provider": llm.PROVIDER},
        "faceit":   {"configured": faceit},
        "steam":    {"configured": steam},
        "has_data": has_data,
        # ready once the coach can talk AND there's a source feeding it
        "ready":    ai and (faceit or steam or has_data),
    }

# ── calibration verification ────────────────────────────────────────────────────

@app.get("/api/admin/calibration_check")
def api_calibration_check():
    """Sample up to 200 kill positions per map and report what % land within
    the [0, RADAR_SIZE] pixel square under the current calibration."""
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("SELECT DISTINCT map FROM kill_events ke JOIN matches m USING(match_id)")
            maps_with_kills = [r["map"] for r in c.fetchall()]

            c.execute("SELECT map, origin_x, origin_y, scale FROM map_radar_calibration")
            calib = {r["map"]: (r["origin_x"], r["origin_y"], r["scale"]) for r in c.fetchall()}

        results = []
        for map_name in sorted(maps_with_kills):
            with conn.cursor() as c:
                c.execute("""
                    SELECT attacker_x AS x, attacker_y AS y
                    FROM kill_events ke JOIN matches m USING(match_id)
                    WHERE m.map=%s AND attacker_x IS NOT NULL
                    ORDER BY random() LIMIT 200
                """, (map_name,))
                pts = c.fetchall()

            n = len(pts)
            if n == 0:
                results.append({"map": map_name, "n": 0, "in_bounds_pct": None,
                                 "has_calibration": map_name in calib})
                continue

            if map_name not in calib:
                results.append({"map": map_name, "n": n, "in_bounds_pct": None,
                                 "has_calibration": False,
                                 "note": "no calibration row — add to map_radar_calibration"})
                continue

            ox, oy, scale = calib[map_name]
            in_bounds = sum(
                1 for r in pts
                if 0 <= (r["x"] - ox) / scale <= RADAR_SIZE
                and 0 <= (oy - r["y"]) / scale <= RADAR_SIZE
            )
            x_vals = [(r["x"] - ox) / scale for r in pts]
            y_vals = [(oy - r["y"]) / scale for r in pts]
            results.append({
                "map":            map_name,
                "n":              n,
                "in_bounds_pct":  round(100 * in_bounds / n, 1),
                "has_calibration": True,
                "px_x_range":     [round(min(x_vals)), round(max(x_vals))],
                "px_y_range":     [round(min(y_vals)), round(max(y_vals))],
                "status":         "ok" if in_bounds / n >= 0.90 else "WARN — <90% in bounds",
            })
    finally:
        conn.close()
    return _j(results)

# ── consistency sparkline ──────────────────────────────────────────────────────

@app.get("/api/consistency")
def api_consistency(map: str = Query(...), days: int = Query(180)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""
                WITH per_match AS (
                    SELECT m.played_at, m.won,
                           SUM(pr.kills)::float  AS kills,
                           SUM(pr.deaths)::float AS deaths
                    FROM matches m JOIN player_rounds pr USING(match_id)
                    WHERE m.map=%s AND m.played_at>=%s
                    GROUP BY m.match_id, m.played_at, m.won
                    ORDER BY m.played_at
                )
                SELECT played_at::text, won, kills, deaths,
                    ROUND((STDDEV(kills) OVER w / NULLIF(AVG(kills) OVER w, 0))::numeric, 3)::float AS cv,
                    COUNT(*) OVER w AS window_n
                FROM per_match
                WINDOW w AS (ORDER BY played_at ROWS BETWEEN 9 PRECEDING AND CURRENT ROW)
                ORDER BY played_at
            """, (map, cutoff))
            rows = [dict(r) for r in c.fetchall()]
    finally:
        conn.close()
    return _j(rows)

# ── economy advisor ─────────────────────────────────────────────────────────────

@app.get("/api/economy_advisor")
def api_economy_advisor(map: str = Query(...), days: int = Query(90)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""
                SELECT
                    COUNT(*) AS total_rounds,
                    -- Bad force: spent money to force, lost the round, barely contributed
                    COUNT(*) FILTER (WHERE buy_type='force' AND NOT round_won AND damage < 50)  AS bad_forces,
                    COUNT(*) FILTER (WHERE buy_type='force')                                     AS force_rounds,
                    -- Failed save: had decent kit going in, lost it
                    COUNT(*) FILTER (WHERE equip_value >= 2700 AND NOT round_won
                                     AND NOT survived AND NOT saved_weapon)                      AS failed_saves,
                    COUNT(*) FILTER (WHERE equip_value >= 2700 AND NOT round_won)                AS save_attempts,
                    -- Eco discipline: eco rounds won (positive) vs eco breaks (negative)
                    COUNT(*) FILTER (WHERE buy_type='eco' AND round_won)                         AS eco_wins,
                    COUNT(*) FILTER (WHERE buy_type='eco')                                       AS eco_rounds,
                    -- Good saves: had kit, round lost, kept it
                    COUNT(*) FILTER (WHERE equip_value >= 2700 AND NOT round_won
                                     AND (survived OR saved_weapon))                             AS good_saves,
                    -- Zero-util rounds: had money but threw nothing
                    COUNT(*) FILTER (WHERE equip_value >= 2000 AND util_thrown = 0)              AS no_util_rounds,
                    COUNT(*) FILTER (WHERE equip_value >= 2000)                                  AS buy_rounds
                FROM player_rounds pr
                JOIN matches m USING(match_id)
                WHERE m.map=%s AND m.played_at>=%s
            """, (map, cutoff))
            row = dict(c.fetchone() or {})
    finally:
        conn.close()

    def pct(a, b):
        a, b = int(a or 0), int(b or 0)
        return round(100 * a / b, 1) if b else None

    return _j({
        "total_rounds":     int(row.get("total_rounds") or 0),
        "bad_force_rate":   pct(row["bad_forces"],   row["force_rounds"]),
        "bad_forces":       int(row.get("bad_forces") or 0),
        "force_rounds":     int(row.get("force_rounds") or 0),
        "failed_save_rate": pct(row["failed_saves"],  row["save_attempts"]),
        "failed_saves":     int(row.get("failed_saves") or 0),
        "save_attempts":    int(row.get("save_attempts") or 0),
        "good_saves":       int(row.get("good_saves") or 0),
        "eco_win_rate":     pct(row["eco_wins"], row["eco_rounds"]),
        "eco_wins":         int(row.get("eco_wins") or 0),
        "eco_rounds":       int(row.get("eco_rounds") or 0),
        "no_util_rate":     pct(row["no_util_rounds"], row["buy_rounds"]),
        "no_util_rounds":   int(row.get("no_util_rounds") or 0),
        "buy_rounds":       int(row.get("buy_rounds") or 0),
    })

# ── aim profile (crosshair placement proxy) ─────────────────────────────────────

@app.get("/api/aim_profile")
def api_aim_profile(map: str = Query(...), days: int = Query(90)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""
                SELECT
                    CASE
                        WHEN SQRT(POW(attacker_x - victim_x, 2) + POW(attacker_y - victim_y, 2)) < 400  THEN 'close'
                        WHEN SQRT(POW(attacker_x - victim_x, 2) + POW(attacker_y - victim_y, 2)) < 1200 THEN 'mid'
                        ELSE 'far'
                    END AS range_bucket,
                    COUNT(*) AS kills,
                    SUM(CASE WHEN headshot THEN 1 ELSE 0 END) AS hs,
                    ROUND(100.0 * SUM(CASE WHEN headshot THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0), 1) AS hs_pct
                FROM kill_events ke
                JOIN matches m USING(match_id)
                WHERE m.map=%s AND m.played_at>=%s
                  AND ke.is_victim = FALSE
                  AND attacker_x IS NOT NULL AND victim_x IS NOT NULL
                GROUP BY range_bucket
                ORDER BY
                    CASE range_bucket WHEN 'close' THEN 1 WHEN 'mid' THEN 2 ELSE 3 END
            """, (map, cutoff))
            buckets = {r["range_bucket"]: dict(r) for r in c.fetchall()}

            # Total for cross-bucket HS rate reference
            c.execute("""
                SELECT ROUND(100.0*SUM(CASE WHEN headshot THEN 1 ELSE 0 END)::numeric/NULLIF(COUNT(*),0),1) AS overall_hs
                FROM kill_events ke JOIN matches m USING(match_id)
                WHERE m.map=%s AND m.played_at>=%s AND ke.is_victim=FALSE
            """, (map, cutoff))
            overall = dict(c.fetchone() or {})
    finally:
        conn.close()

    return _j({
        "close":      buckets.get("close",  {"kills":0,"hs":0,"hs_pct":None}),
        "mid":        buckets.get("mid",    {"kills":0,"hs":0,"hs_pct":None}),
        "far":        buckets.get("far",    {"kills":0,"hs":0,"hs_pct":None}),
        "overall_hs": overall.get("overall_hs"),
    })

# ── combat profile: opening duels, trade discipline, clutch ────────────────────

@app.get("/api/combat_profile")
def api_combat_profile(map: str = Query(...), days: int = Query(90)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE opening_kill)                                      AS opener_rounds,
                    COUNT(*) FILTER (WHERE opening_death)                                     AS opened_on_rounds,
                    COUNT(*) FILTER (WHERE opening_kill OR opening_death)                     AS involved_rounds,
                    COUNT(*) FILTER (WHERE opening_kill AND round_won)                        AS opener_won,
                    COUNT(*) FILTER (WHERE opening_death AND round_won)                       AS opened_on_won,
                    ROUND(100.0 * COUNT(*) FILTER (WHERE opening_kill)::numeric
                          / NULLIF(COUNT(*) FILTER (WHERE opening_kill OR opening_death), 0), 1) AS open_rate,
                    ROUND(100.0 * COUNT(*) FILTER (WHERE opening_kill AND round_won)::numeric
                          / NULLIF(COUNT(*) FILTER (WHERE opening_kill), 0), 1)               AS open_wr,
                    ROUND(100.0 * COUNT(*) FILTER (WHERE opening_death AND round_won)::numeric
                          / NULLIF(COUNT(*) FILTER (WHERE opening_death), 0), 1)              AS opened_on_wr
                FROM player_rounds pr
                JOIN matches m USING(match_id)
                WHERE m.map=%s AND m.played_at>=%s
            """, (map, cutoff))
            opening = dict(c.fetchone() or {})

            c.execute("""
                SELECT
                    COUNT(*)                                                         AS total_rounds,
                    COUNT(*) FILTER (WHERE traded_kill)                              AS traded,
                    COUNT(*) FILTER (WHERE high_damage_no_kill)                      AS spray_wasted,
                    ROUND(100.0 * COUNT(*) FILTER (WHERE traded_kill)::numeric
                          / NULLIF(COUNT(*), 0), 1)                                 AS trade_rate,
                    ROUND(100.0 * COUNT(*) FILTER (WHERE high_damage_no_kill)::numeric
                          / NULLIF(COUNT(*), 0), 1)                                 AS spray_waste_rate
                FROM player_rounds pr
                JOIN matches m USING(match_id)
                WHERE m.map=%s AND m.played_at>=%s
            """, (map, cutoff))
            trade = dict(c.fetchone() or {})

            c.execute("""
                SELECT
                    SUM(CASE WHEN clutch_vs=1  THEN 1 ELSE 0 END)             AS v1_total,
                    SUM(CASE WHEN clutch_vs=1  AND round_won THEN 1 ELSE 0 END) AS v1_won,
                    SUM(CASE WHEN clutch_vs=2  THEN 1 ELSE 0 END)             AS v2_total,
                    SUM(CASE WHEN clutch_vs=2  AND round_won THEN 1 ELSE 0 END) AS v2_won,
                    SUM(CASE WHEN clutch_vs>=3 THEN 1 ELSE 0 END)             AS v3p_total,
                    SUM(CASE WHEN clutch_vs>=3 AND round_won THEN 1 ELSE 0 END) AS v3p_won
                FROM player_rounds pr
                JOIN matches m USING(match_id)
                WHERE m.map=%s AND m.played_at>=%s AND clutch_vs IS NOT NULL
            """, (map, cutoff))
            clutch = dict(c.fetchone() or {})
    finally:
        conn.close()
    return _j({"opening": opening, "trade": trade, "clutch": clutch})

# ── duel / combat breakdown ─────────────────────────────────────────────────────

@app.get("/api/duel_breakdown")
def api_duel_breakdown(map: str = Query(...), days: int = Query(90)):
    conn = _db()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        with conn.cursor() as c:
            c.execute("""
                SELECT ke.weapon, COUNT(*) AS n,
                    SUM(CASE WHEN ke.headshot THEN 1 ELSE 0 END) AS hs
                FROM kill_events ke JOIN matches m USING(match_id)
                WHERE m.map=%s AND ke.is_victim=TRUE AND m.played_at>=%s
                  AND ke.weapon IS NOT NULL AND ke.weapon != ''
                GROUP BY ke.weapon ORDER BY n DESC LIMIT 10
            """, (map, cutoff))
            deaths_by_weapon = [dict(r) for r in c.fetchall()]

            c.execute("""
                SELECT ke.weapon, COUNT(*) AS n,
                    SUM(CASE WHEN ke.headshot THEN 1 ELSE 0 END) AS hs
                FROM kill_events ke JOIN matches m USING(match_id)
                WHERE m.map=%s AND ke.is_victim=FALSE AND m.played_at>=%s
                  AND ke.weapon IS NOT NULL AND ke.weapon != ''
                GROUP BY ke.weapon ORDER BY n DESC LIMIT 10
            """, (map, cutoff))
            kills_by_weapon = [dict(r) for r in c.fetchall()]

            # Death positions for top 3 weapons
            top3 = [r["weapon"] for r in deaths_by_weapon[:3]]
            death_positions = {}
            for w in top3:
                c.execute("""
                    SELECT victim_x AS x, victim_y AS y, headshot AS hs
                    FROM kill_events ke JOIN matches m USING(match_id)
                    WHERE m.map=%s AND ke.is_victim=TRUE AND ke.weapon=%s
                      AND m.played_at>=%s AND victim_x IS NOT NULL
                """, (map, w, cutoff))
                death_positions[w] = [{"x": float(r["x"]), "y": float(r["y"]), "hs": bool(r["hs"])}
                                       for r in c.fetchall()]
    finally:
        conn.close()
    return _j({"deaths_by_weapon": deaths_by_weapon, "kills_by_weapon": kills_by_weapon,
                "death_positions": death_positions})

# ── auto-detected grenade lineups ───────────────────────────────────────────────

@app.get("/api/auto_lineups")
def api_auto_lineups(map: str = Query(...), min_count: int = Query(2)):
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""
                SELECT grenade_type,
                    ROUND(throw_x / 50) * 50 AS tx_b,
                    ROUND(throw_y / 50) * 50 AS ty_b,
                    ROUND(land_x  / 30) * 30 AS lx_b,
                    ROUND(land_y  / 30) * 30 AS ly_b,
                    COUNT(DISTINCT m.match_id) AS match_count,
                    COUNT(*) AS throw_count,
                    AVG(throw_x)::float AS throw_x,
                    AVG(throw_y)::float AS throw_y,
                    AVG(land_x)::float  AS land_x,
                    AVG(land_y)::float  AS land_y,
                    MAX(side) AS side
                FROM grenade_events ge JOIN matches m USING(match_id)
                WHERE m.map=%s AND ge.throw_x IS NOT NULL AND ge.land_x IS NOT NULL
                GROUP BY grenade_type, tx_b, ty_b, lx_b, ly_b
                HAVING COUNT(DISTINCT m.match_id) >= %s
                ORDER BY throw_count DESC LIMIT 20
            """, (map, min_count))
            rows = [dict(r) for r in c.fetchall()]
    finally:
        conn.close()
    return _j(rows)

@app.post("/api/save_lineup")
def save_lineup(body: dict):
    map_name     = body.get("map")
    grenade_type = body.get("grenade_type")
    if not map_name or grenade_type not in ("smoke","flash","molotov","he"):
        raise HTTPException(400, "map and valid grenade_type required")
    side = body.get("side", "both")
    if side not in ("CT","T","both"): side = "both"
    difficulty = body.get("difficulty", "medium")
    if difficulty not in ("easy","medium","hard"): difficulty = "medium"
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""
                INSERT INTO grenade_lineups
                (map, grenade_type, name, side, difficulty, notes, throw_x, throw_y, land_x, land_y)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (map_name, grenade_type, body.get("name","Untitled"), side, difficulty,
                  body.get("notes",""), body.get("throw_x"), body.get("throw_y"),
                  body.get("land_x"), body.get("land_y")))
            new_id = c.fetchone()["id"]
        conn.commit()
    finally:
        conn.close()
    return _j({"id": new_id, "status": "saved"})

@app.delete("/api/lineup/{lineup_id}")
def delete_lineup(lineup_id: int):
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("DELETE FROM grenade_lineups WHERE id=%s", (lineup_id,))
        conn.commit()
    finally:
        conn.close()
    return _j({"status": "deleted"})

# ── drill recommendations ───────────────────────────────────────────────────────

DRILLS_SYSTEM = """You are a blunt CS2 trainer. Find the 3 weakest areas from the stats and give one concrete drill each. Use imperative sentences — "Do X", "Practice Y". Respond ONLY with a JSON array, no prose, no markdown wrapper. Format: [{"area":"short label (3-5 words)","drill":"one or two imperative sentences — exactly what to do in practice","target":"one measurable success condition"}]."""

@app.get("/api/drills")
def api_drills(map: Optional[str] = Query(None), days: int = Query(30)):
    import re as _re
    if not llm.available():
        return _j({"drills": [], "error": llm.not_configured_message()})
    conn = _db()
    try:
        brief = _build_brief(conn, map, days)
    finally:
        conn.close()
    try:
        resp = llm.create(
            model=MODEL, max_tokens=600,
            system=[{"type":"text","text":DRILLS_SYSTEM,"cache_control":{"type":"ephemeral"}}],
            messages=[{"role":"user","content":[
                {"type":"text","text":brief,"cache_control":{"type":"ephemeral"}},
                {"type":"text","text":"Generate 3 training drills as JSON array."},
            ]}],
        )
    except llm.LLMError as e:
        return _j({"drills": [], "error": str(e)})
    raw = "\n".join(b.text for b in resp.content if b.type == "text")
    m = _re.search(r'\[.*\]', raw, _re.DOTALL)
    if m:
        try:
            return _j({"drills": json.loads(m.group())})
        except Exception:
            pass
    return _j({"drills": [], "raw": raw})

@app.post("/api/drill_log")
def api_drill_log_post(body: dict):
    status = body.get("status", "done")
    if status not in ("done", "skipped"):
        raise HTTPException(400, "status must be 'done' or 'skipped'")
    drill = (body.get("drill") or "").strip()
    if not drill:
        raise HTTPException(400, "drill text required")
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""
                INSERT INTO drill_log (drill_text, area, target, status, map_context)
                VALUES (%s, %s, %s, %s, %s)
            """, (drill, body.get("area"), body.get("target"), status, body.get("map_context")))
        conn.commit()
    finally:
        conn.close()
    return _j({"ok": True})

@app.get("/api/drill_log")
def api_drill_log_get(limit: int = Query(30)):
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("""
                SELECT drill_text, area, status, map_context, logged_at
                FROM drill_log ORDER BY logged_at DESC LIMIT %s
            """, (min(limit, 100),))
            rows = c.fetchall()
    finally:
        conn.close()
    return _j({"log": [
        {"drill": r["drill_text"], "area": r["area"], "status": r["status"],
         "map": r["map_context"], "logged_at": str(r["logged_at"])}
        for r in rows
    ]})

# ── position density for multi-match overlay ────────────────────────────────────

@app.get("/api/position_map")
def api_position_map(
    map: str = Query(...),
    side: str = Query("all"),
    days: int = Query(90),
    kind: str = Query("kills"),
):
    if kind not in ("kills","deaths","aim"): raise HTTPException(400)
    if side not in ("CT","T","all"): raise HTTPException(400)
    now = datetime.now(timezone.utc)
    t_from = now - timedelta(days=days)
    conn = _db()
    try:
        # kills/deaths need the z-coordinate for elevation-aware danger zones,
        # so we query directly rather than going through _points_in_window (which
        # doesn't return z).  Aim falls back to _points_in_window since z isn't
        # relevant there.
        if kind in ("kills", "deaths"):
            victim = "TRUE" if kind == "deaths" else "FALSE"
            xc = "victim_x" if kind == "deaths" else "attacker_x"
            yc = "victim_y" if kind == "deaths" else "attacker_y"
            zc = "victim_z" if kind == "deaths" else "attacker_z"
            sc = "" if side == "all" else " AND ke.side=%s"
            sp = () if side == "all" else (side,)
            sql = (f"SELECT {xc},{yc},{zc} FROM kill_events ke JOIN matches m USING(match_id)"
                   f" WHERE ke.is_victim={victim} AND m.map=%s{sc}"
                   f" AND m.played_at>=%s AND {xc} IS NOT NULL")
            with conn.cursor() as c:
                c.execute(sql, (map,)+sp+(t_from,))
                rows = c.fetchall()
            pts = [{"x": float(r[xc]), "y": float(r[yc]),
                    "z": float(r[zc]) if r[zc] is not None else None} for r in rows]
        else:
            raw = _points_in_window(conn, map, kind, side, days)
            pts = [{"x": float(p[0]), "y": float(p[1]), "z": None} for p in raw]
    finally:
        conn.close()
    return _j(pts)


@app.get("/api/util_tendency")
def api_util_tendency(
    map: str = Query(...),
    side: str = Query("all"),
    nade_type: str = Query("all"),
    days: int = Query(180),
):
    if side not in ("CT","T","all"): raise HTTPException(400)
    if nade_type not in ("all","smoke","flash","molotov","he","incendiary"): raise HTTPException(400)
    now = datetime.now(timezone.utc)
    t_from = now - timedelta(days=days)
    sc = "" if side == "all" else " AND ge.side=%s"
    sp = () if side == "all" else (side,)
    gc = "" if nade_type == "all" else " AND ge.grenade_type IN (%s,'incendiary')" if nade_type == "molotov" else " AND ge.grenade_type=%s"
    gp = () if nade_type == "all" else ((nade_type,) if nade_type != "molotov" else (nade_type,))
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute(f"""
                SELECT ge.attacker_name AS player, ge.side,
                       COUNT(*) FILTER (WHERE ge.grenade_type='smoke') AS smokes,
                       COUNT(*) FILTER (WHERE ge.grenade_type='flash') AS flashes,
                       COUNT(*) FILTER (WHERE ge.grenade_type IN ('molotov','incendiary')) AS molotovs,
                       COUNT(*) FILTER (WHERE ge.grenade_type='he') AS he,
                       COUNT(*) AS total,
                       COUNT(DISTINCT ge.match_id) AS rounds
                FROM grenade_events ge
                JOIN matches m USING(match_id)
                WHERE m.map=%s{sc} AND m.played_at>=%s
                  AND ge.attacker_name IS NOT NULL
                GROUP BY ge.attacker_name, ge.side
                ORDER BY total DESC
                LIMIT 20
            """, (map,)+sp+(t_from,))
            rows = c.fetchall()
    finally:
        conn.close()
    return _j([{
        "player": r["player"], "side": r["side"],
        "smokes": r["smokes"], "flashes": r["flashes"],
        "molotovs": r["molotovs"], "he": r["he"],
        "total": r["total"], "rounds": r["rounds"]
    } for r in rows])

# ── storyboard round review ─────────────────────────────────────────────────────

def _render_frame_thumb(bg_img, frame_state, players, calib, kill_victim_ids=None, size=200):
    ox, oy, scale = calib
    if bg_img:
        img = bg_img.copy().resize((size, size), Image.LANCZOS).convert("RGBA")
    else:
        img = Image.new("RGBA", (size, size), (18, 20, 30, 255))
    draw = ImageDraw.Draw(img)
    kill_victims = set(str(v) for v in (kill_victim_ids or []))

    for sid, state in (frame_state or {}).items():
        if not isinstance(state, (list, tuple)) or len(state) < 3:
            continue
        wx, wy, alive = state[0], state[1], state[2]
        if wx is None or wy is None:
            continue
        px = (wx - ox) / scale / RADAR_SIZE * size
        py = (oy - wy) / scale / RADAR_SIZE * size
        if not (3 <= px < size - 3 and 3 <= py < size - 3):
            continue
        p   = players.get(str(sid), {})
        is_me = p.get("is_me", False)
        side  = p.get("team", "CT")
        if not alive:
            r = 4
            draw.line([(px-r,py-r),(px+r,py+r)], fill=(90,90,90,200), width=2)
            draw.line([(px+r,py-r),(px-r,py+r)], fill=(90,90,90,200), width=2)
            continue
        if str(sid) in kill_victims:
            draw.ellipse((px-11,py-11,px+11,py+11), outline=(255,60,60,220), width=2)
        r = 8 if is_me else 5
        color = (255,255,255,230) if is_me else ((66,132,210,220) if side=="CT" else (210,110,36,220))
        draw.ellipse((px-r,py-r,px+r,py+r), fill=color, outline=(0,0,0,200), width=1)
    return img

def _frame_to_b64(img):
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=78)
    return base64.b64encode(buf.getvalue()).decode()

def _select_key_ticks(frames, events, max_frames=6):
    if not frames:
        return []
    ticks = [frames[0][0]]
    for e in events:
        if e.get("t_type") == "kill":
            ticks.append(e["tick"])
    ticks.append(frames[-1][0])
    ticks = sorted(set(ticks))
    merged = [ticks[0]]
    for t in ticks[1:]:
        if t - merged[-1] > 96:
            merged.append(t)
    if len(merged) > max_frames:
        merged = [merged[0]] + merged[1:-1][:max_frames-2] + [merged[-1]]
    return merged

def _storyboard_commentary(map_name, round_num, side, won, moments):
    if not llm.available() or not moments:
        return [""] * len(moments)
    desc = "\n".join(f"  {i+1}. {m['label']}" for i, m in enumerate(moments))
    prompt = (f"Map: {map_name}. Round {round_num} ({side}). "
              f"Result: {'WIN' if won else 'LOSS'}.\nKey moments:\n{desc}\n\n"
              f"Give a tactical coaching tip (max 12 words) for each moment. "
              f"Respond with a JSON array of exactly {len(moments)} strings, nothing else.")
    try:
        resp   = llm.create(model=MODEL, max_tokens=350,
                     messages=[{"role":"user","content":prompt}])
        text = resp.content[0].text
        m = _re.search(r'\[.*\]', text, _re.DOTALL)
        if m:
            return json.loads(m.group())
    except Exception as e:
        print(f"[storyboard] commentary error: {e}")
    return [""] * len(moments)

@app.get("/api/round_review")
async def api_round_review(match_id: str, round: int = Query(...)):
    mid = int(match_id)
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("SELECT data FROM round_replays WHERE match_id=%s AND round_num=%s", (mid, round))
            row = c.fetchone()
            if not row:
                raise HTTPException(404, "no replay data for this round")
            rd = row["data"]
            c.execute("SELECT map, won FROM matches WHERE match_id=%s", (mid,))
            mr = c.fetchone()
            if not mr:
                raise HTTPException(404, "match not found")
            map_name = mr["map"]
            won      = bool(mr["won"])
            c.execute("SELECT side FROM player_rounds WHERE match_id=%s AND round_num=%s", (mid, round))
            pr   = c.fetchone()
            side = pr["side"] if pr else "CT"
            c.execute("SELECT origin_x,origin_y,scale FROM map_radar_calibration WHERE map=%s", (map_name,))
            cal   = c.fetchone()
            calib = (cal["origin_x"], cal["origin_y"], cal["scale"]) if cal else (-2500.0, 2500.0, 5.0)
    finally:
        conn.close()

    players = rd.get("players", {})
    frames  = rd.get("frames",  [])
    events  = rd.get("events",  [])
    if not frames:
        return _j({"frames": []})

    tick_events = defaultdict(list)
    for ev in events:
        tick_events[ev.get("tick", 0)].append(ev)

    key_ticks  = _select_key_ticks(frames, events)
    frame_map  = {f[0]: f for f in frames}
    all_ticks  = sorted(frame_map.keys())

    def nearest(t):
        return frame_map[min(all_ticks, key=lambda x: abs(x - t))]

    radar_path = RADARS_DIR / f"{map_name}.png"
    bg_img     = Image.open(radar_path).convert("RGBA") if radar_path.exists() else None

    moments = []
    first_tick = frames[0][0]
    for tick in key_ticks:
        f    = nearest(tick)
        evs  = tick_events.get(tick, [])
        kills = [e for e in evs if e.get("t_type") == "kill"]

        if tick == first_tick:
            label = "Round start"
        elif tick == frames[-1][0]:
            label = "Round end"
        elif kills:
            parts = []
            for e in kills[:2]:
                wpn = (e.get("w") or "?")[:8]
                hs  = " HS" if e.get("hs") else ""
                who = "You died" if e.get("iv") else "You killed"
                parts.append(f"{who} ({wpn}){hs}")
            label = " · ".join(parts)
        else:
            elapsed = max(0, int((tick - first_tick) / 64))
            label   = f"t+{elapsed}s"

        state = f[1] if isinstance(f, (list, tuple)) and len(f) > 1 else {}
        thumb = _render_frame_thumb(bg_img, state, players, calib)
        moments.append({"tick": tick, "label": label, "image": _frame_to_b64(thumb), "comment": ""})

    loop     = asyncio.get_event_loop()
    comments = await loop.run_in_executor(
        None, _storyboard_commentary, map_name, round, side, won, moments)
    for i, c2 in enumerate(comments):
        if i < len(moments):
            moments[i]["comment"] = c2

    return _j({"frames": moments, "map": map_name, "round": round, "side": side, "won": won})


# ── deterministic Python round coach (no AI) ──────────────────────────────────

@app.get("/api/round_coach")
def api_round_coach(match_id: str, round: int = Query(...)):
    """Instant deterministic coaching for a single round — no AI needed."""
    mid = int(match_id)
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute("SELECT data FROM round_replays WHERE match_id=%s AND round_num=%s", (mid, round))
            row = c.fetchone()
            if not row:
                raise HTTPException(404, "no replay data")
            rd = row["data"]
            c.execute("SELECT map, won FROM matches WHERE match_id=%s", (mid,))
            mr = c.fetchone()
            if not mr:
                raise HTTPException(404, "match not found")
            map_name = mr["map"]
            c.execute("""
                SELECT kills, deaths, assists, damage, headshots, multikill,
                       opening_kill, opening_death, traded_death, traded_kill, survived,
                       high_damage_no_kill, equip_value, spent, buy_type, weapon_purchased,
                       saved_weapon, lost_kit_on_eco,
                       util_thrown, util_wasted, util_damage, flash_assists, team_flashes,
                       death_tick, death_phase, avg_ttk_ms, duel_entry_hp,
                       was_clutch, clutch_vs, clutch_won, planted_bomb, round_won, side
                FROM player_rounds WHERE match_id=%s AND round_num=%s
            """, (mid, round))
            pr = dict(c.fetchone() or {})
    finally:
        conn.close()

    players  = rd.get("players", {})
    events   = rd.get("events",  [])
    frames   = rd.get("frames",  [])
    freeze   = rd.get("freeze_tick", 0)
    sr       = rd.get("sample_rate", 64)

    def tick_to_s(t): return round((t - freeze) / sr, 1)

    # ── convenience aliases ───────────────────────────────────────────────────
    won         = bool(pr.get("round_won"))
    side        = pr.get("side", "CT")
    buy_type    = pr.get("buy_type") or ""
    n_kills     = int(pr.get("kills")     or 0)
    n_deaths    = int(pr.get("deaths")    or 0)
    damage      = int(pr.get("damage")    or 0)
    headshots   = int(pr.get("headshots") or 0)
    multikill   = int(pr.get("multikill") or 0)
    opening_kill  = bool(pr.get("opening_kill"))
    opening_death = bool(pr.get("opening_death"))
    traded_death  = bool(pr.get("traded_death"))
    traded_kill   = bool(pr.get("traded_kill"))
    survived      = bool(pr.get("survived"))
    hi_dmg_no_kill = bool(pr.get("high_damage_no_kill"))
    util_thrown  = int(pr.get("util_thrown") or 0)
    util_wasted  = int(pr.get("util_wasted") or 0)
    util_damage  = int(pr.get("util_damage") or 0)
    flash_assists = int(pr.get("flash_assists") or 0)
    team_flashes  = int(pr.get("team_flashes")  or 0)
    was_clutch  = bool(pr.get("was_clutch"))
    clutch_vs   = int(pr.get("clutch_vs")  or 0)
    clutch_won  = bool(pr.get("clutch_won"))
    planted     = bool(pr.get("planted_bomb"))
    duel_hp     = pr.get("duel_entry_hp")
    death_phase = pr.get("death_phase") or ""
    ttk_ms      = pr.get("avg_ttk_ms")

    hs_pct = round(100 * headshots / n_kills) if n_kills else 0

    kill_evs  = [e for e in events if e.get("t_type") == "kill"]
    my_kills  = [e for e in kill_evs if e.get("is_me_attacker")]
    my_death  = next((e for e in kill_evs if e.get("is_me_victim")), None)
    first_ev  = sorted(kill_evs, key=lambda e: e.get("tick", 0))[0] if kill_evs else None
    first_t   = tick_to_s(first_ev["tick"]) if first_ev else None

    buy_labels = {"full": "full buy", "force": "force buy", "eco": "eco", "save": "save"}
    buy_label  = buy_labels.get(buy_type, buy_type)

    # ── coaching output ───────────────────────────────────────────────────────
    strengths: list[dict] = []
    fixes:     list[dict] = []
    moments:   list[dict] = []

    def s(title, detail): strengths.append({"title": title, "detail": detail})
    def f(title, detail): fixes.append({"title": title, "detail": detail})

    # Opening duel
    if opening_kill:
        s("Opening duel win",
          "You got the first kill of the round — putting your team at a man advantage from the start. "
          "This is one of the highest-impact plays in CS2.")
    elif opening_death:
        f("Lost the opening duel",
          f"You were first to die this round{' in the ' + death_phase + ' phase' if death_phase else ''}. "
          "Opening deaths immediately put your team at a disadvantage. "
          "Consider using utility to peek, or holding a tighter angle rather than peeking aggressively.")

    # Multi-kill / clutch
    if multikill >= 3 and won:
        s(f"{multikill}-kill round",
          f"A {multikill}K performance is a match-defining play. "
          "High kill rounds like this swing round economy and team momentum significantly.")
    elif multikill >= 2:
        s(f"{multikill} kills",
          f"Two kills in a round is solid value — you're pulling your weight and forcing enemy resources.")

    if was_clutch:
        if clutch_won:
            s(f"Won a {clutch_vs}v1 clutch",
              "Winning clutch situations requires game sense, positioning, and composure. "
              "This is the highest-pressure skill in CS2 and you executed well.")
        else:
            f(f"Lost a {clutch_vs}v1 clutch",
              "Review where you peeked and whether you gathered information first. "
              "In clutches: reset position, bait rotations, and take duels one at a time.")

    # Trade discipline
    if traded_death:
        s("Your death was traded",
          "Your teammate immediately took the kill after you died — this is excellent team discipline. "
          "The round stayed even despite the loss.")
    if traded_kill:
        s("Traded a kill",
          "You converted a trade kill — punishing the enemy's kill by retaliating instantly. "
          "This keeps the numbers even and shows reactive awareness.")

    # Headshot accuracy
    if n_kills >= 2 and hs_pct >= 75:
        s(f"{hs_pct}% headshot rate",
          "Consistent headshots indicate excellent crosshair placement and aim. "
          "You're hitting the fastest-kill hitbox reliably.")
    elif n_kills >= 2 and hs_pct == 0:
        f("No headshots on multiple kills",
          "All kills were body shots. Body-shot kills take more bullets and time. "
          "Practice keeping your crosshair at head level as you hold angles and move between positions.")

    # Damage without kill
    if hi_dmg_no_kill:
        f("High damage, no kill",
          "You dealt heavy damage but didn't secure the kill. Common causes: peaked around a corner, "
          "spraying rather than burst-firing, or not pressing the advantage after landing hits. "
          "When you hear an enemy take damage, push immediately if safe to do so.")

    # Economy
    if buy_type == "eco" and n_kills >= 2:
        s(f"{n_kills} kills on an eco",
          "Getting multi-kills on an eco is exceptional value — you denied the enemy equipment "
          "while preserving your team's buy cycle. This is how eco rounds are won.")
    elif buy_type == "force" and not won:
        f("Force buy didn't convert",
          "Losing a force buy is costly — you spent money without winning the round, "
          "which may desync your team's economy. When teammates aren't all forcing, consider saving "
          "to synchronize a full buy next round.")
    elif buy_type == "save" and survived:
        s("Successful save",
          f"You saved your weapon through a losing round — preserving equipment for the team's next buy.")

    # Utility
    if util_thrown == 0 and buy_type in ("full", "force"):
        f("No utility used",
          "You had a buy round but didn't throw any grenades. Utility directly creates advantages: "
          "smokes cut sightlines, flashes blind pushes, molotovs deny bomb sites. "
          "Even one well-timed smoke can win a round.")
    elif util_thrown >= 2 and (flash_assists >= 1 or util_damage >= 30):
        detail = []
        if flash_assists >= 1: detail.append(f"{flash_assists} flash assist{'s' if flash_assists>1 else ''}")
        if util_damage >= 30:  detail.append(f"{util_damage} utility damage")
        s("Effective utility usage",
          f"You threw {util_thrown} grenades with real impact ({', '.join(detail)}). "
          "Consistent utility usage is a top-percentile skill.")
    elif util_wasted >= 2:
        f("Utility wasted",
          f"{util_wasted} grenades were thrown without meaningful effect. "
          "Save grenades for moments when they open a duel or deny enemy movement.")

    # Team flash discipline
    if team_flashes >= 2:
        f("Flashed teammates",
          f"You blinded your own team {team_flashes} times. Check teammates' positions on radar "
          "before throwing flashes. One bad flash can throw an open duel.")

    # Bomb plant
    if planted:
        s("Planted the bomb",
          "Successfully planting puts time pressure on CT and forces enemy rotations — "
          "even if the round is lost, a plant gives your team a cash bonus.")

    # TTK / duel quality
    if ttk_ms and ttk_ms < 180 and n_kills >= 1:
        s("Fast duel kills",
          f"Average time-to-kill was {round(ttk_ms)}ms — snapping onto targets quickly and "
          "executing efficiently reduces the enemy's ability to counter-strafe.")

    # Death phase insight
    if death_phase == "early" and not opening_death:
        f("Died early in the round",
          "An early death without being the opener often means over-extending or peeking unsupported. "
          "Make sure teammates are in position before crossing open ground.")

    # ── key moments timeline ──────────────────────────────────────────────────
    for ev in sorted(kill_evs, key=lambda e: e.get("tick", 0)):
        t = tick_to_s(ev.get("tick", 0))
        wpn = ev.get("w") or "unknown"
        hs  = " (HS)" if ev.get("hs") else ""
        if ev.get("is_me_attacker"):
            moments.append({
                "time": t, "type": "kill",
                "text": f"Kill · {wpn}{hs} at {t}s",
                "coach_q": f"At {t}s I got a kill with {wpn}{hs}. What did I do well and what could I improve?",
            })
        elif ev.get("is_me_victim"):
            moments.append({
                "time": t, "type": "death",
                "text": f"Death · {wpn} at {t}s",
                "coach_q": f"At {t}s I died to {wpn}. What mistake led to this and how do I fix it?",
            })

    narrative = (
        f"Round {round} — {side} {'won' if won else 'lost'}"
        + (f" on {buy_label}" if buy_label else "")
        + (f" · {n_kills}K / {damage} dmg" if n_kills or damage else "")
    )

    return _j({
        "round": round, "map": map_name, "side": side, "won": won, "buy_type": buy_type,
        "stats": {"kills": n_kills, "damage": damage, "hs_pct": hs_pct, "util_thrown": util_thrown},
        "strengths": strengths[:4],
        "fixes": fixes[:4],
        "moments": moments,
        "narrative": narrative,
    })


@app.get("/companion")
def companion_page():
    return FileResponse("/app/static/archive/v1/companion.html")

@app.get("/api/companion_data")
def api_companion_data(
    map: Optional[str] = Query(None),
    days: int = Query(30),
):
    map_filter = map if map and map != "any" else None
    conn = _db()
    try:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=days)
        mc = "" if not map_filter else " AND m.map=%(map)s"
        params = {"days": days, "map": map_filter}

        with conn.cursor() as c:
            # KPIs
            c.execute(f"""
                SELECT
                    COUNT(DISTINCT m.match_id) AS matches,
                    SUM(pr.kills)  AS kills,
                    SUM(pr.deaths) AS deaths,
                    ROUND(100.0*COUNT(DISTINCT CASE WHEN m.won THEN m.match_id END)::numeric
                          /NULLIF(COUNT(DISTINCT m.match_id),0),1) AS win_pct,
                    ROUND(SUM(pr.kills)::numeric/NULLIF(SUM(pr.deaths),0),2) AS kd,
                    ROUND(AVG(pr.damage),0) AS adr,
                    ROUND(100.0*SUM(pr.headshots)::numeric/NULLIF(SUM(pr.kills),0),1) AS hs_pct
                FROM matches m JOIN player_rounds pr USING(match_id)
                WHERE m.played_at >= now() - (%(days)s || ' days')::interval {mc}
            """, params)
            kpis = dict(c.fetchone() or {})

            # Coach briefs
            c.execute("SELECT scope, answer_html, generated_at FROM coach_cache ORDER BY generated_at DESC")
            coach_briefs = [dict(r) for r in c.fetchall()]

            # Maps available
            c.execute("SELECT DISTINCT map FROM matches ORDER BY map")
            maps_available = [r["map"] for r in c.fetchall()]

            # Grenade lineups — clustered by land zone
            grenade_sql = """
                SELECT m.map,
                       ge.grenade_type,
                       COUNT(*) AS count,
                       AVG(ge.throw_x)::float AS throw_x,
                       AVG(ge.throw_y)::float AS throw_y,
                       AVG(ge.land_x)::float  AS land_x,
                       AVG(ge.land_y)::float  AS land_y,
                       ROUND(ge.land_x / 200) * 200 AS land_zone_x,
                       ROUND(ge.land_y / 200) * 200 AS land_zone_y
                FROM grenade_events ge
                JOIN matches m USING(match_id)
                WHERE ge.land_x IS NOT NULL
                  AND ge.throw_x IS NOT NULL
                  AND m.played_at >= now() - (%(days)s || ' days')::interval
            """
            if map_filter:
                grenade_sql += " AND m.map = %(map)s"
            grenade_sql += """
                GROUP BY m.map, ge.grenade_type,
                         ROUND(ge.land_x / 200) * 200,
                         ROUND(ge.land_y / 200) * 200
                HAVING COUNT(*) >= 2
                ORDER BY m.map, ge.grenade_type, count DESC
            """
            c.execute(grenade_sql, params)
            grenade_lineups = [dict(r) for r in c.fetchall()]

            # Focus areas — top coaching signals
            focus_areas: list = []
            try:
                c.execute(f"""
                    SELECT
                        ROUND(100.0 * SUM(CASE WHEN pr.opening_kill THEN 1 END)::numeric
                              / NULLIF(SUM(CASE WHEN pr.opening_kill OR pr.opening_death THEN 1 END),0),1
                        ) AS opening_win_pct,
                        ROUND(100.0 * SUM(CASE WHEN pr.buy_type='force' AND NOT pr.round_won THEN 1 END)::numeric
                              / NULLIF(SUM(CASE WHEN pr.buy_type='force' THEN 1 END),0),1
                        ) AS bad_force_pct,
                        ROUND(100.0 * SUM(CASE WHEN pr.buy_type='force' THEN 1 END)::numeric
                              / NULLIF(COUNT(*),0),1
                        ) AS force_rate,
                        ROUND(100.0 * SUM(CASE WHEN pr.util_thrown > 0 THEN 1 END)::numeric
                              / NULLIF(COUNT(*),0),1
                        ) AS util_use_pct,
                        ROUND(100.0 * SUM(CASE WHEN pr.high_damage_no_kill THEN 1 END)::numeric
                              / NULLIF(COUNT(*),0),1
                        ) AS spray_rate
                    FROM player_rounds pr
                    JOIN matches m USING(match_id)
                    WHERE m.played_at >= now() - (%(days)s || ' days')::interval {mc}
                """, params)
                fa = dict(c.fetchone() or {})

                c.execute(f"""
                    SELECT
                        ROUND(100.0 * SUM(CASE WHEN ke.headshot
                              AND SQRT(POWER(ke.attacker_x-ke.victim_x,2)+POWER(ke.attacker_y-ke.victim_y,2)) > 1500
                              THEN 1 END)::numeric
                            / NULLIF(SUM(CASE WHEN
                              SQRT(POWER(ke.attacker_x-ke.victim_x,2)+POWER(ke.attacker_y-ke.victim_y,2)) > 1500
                              THEN 1 END),0),1
                        ) AS hs_far_pct,
                        SUM(CASE WHEN
                            SQRT(POWER(ke.attacker_x-ke.victim_x,2)+POWER(ke.attacker_y-ke.victim_y,2)) > 1500
                            THEN 1 END) AS far_kills
                    FROM kill_events ke
                    JOIN matches m USING(match_id)
                    WHERE ke.is_victim = false
                      AND ke.attacker_x IS NOT NULL AND ke.victim_x IS NOT NULL
                      AND m.played_at >= now() - (%(days)s || ' days')::interval {mc}
                """, params)
                aim_fa = dict(c.fetchone() or {})

                candidates: list = []
                ow = fa.get("opening_win_pct")
                if ow is not None:
                    if float(ow) < 35:
                        candidates.append(("rd", 45 - float(ow), "Win Opening Duels",
                            f"Only {ow:.0f}% of opening duels go your way — seek spots where you hold the info advantage."))
                    elif float(ow) < 45:
                        candidates.append(("yw", 45 - float(ow), "Improve Opening Duels",
                            f"Opening win rate is {ow:.0f}% — pre-aim common angles before committing to a peek."))

                bf = fa.get("bad_force_pct"); fr = fa.get("force_rate")
                if bf is not None and float(bf) > 65 and fr is not None and float(fr) > 15:
                    candidates.append(("yw", float(bf) - 60, "Force-Buy Discipline",
                        f"You lose {bf:.0f}% of your force rounds — consider saving when the econ math doesn't add up."))

                util = fa.get("util_use_pct")
                if util is not None and float(util) < 45:
                    candidates.append(("ac", 45 - float(util), "Use Your Utility",
                        f"Utility thrown in only {util:.0f}% of rounds — one smoke or flash can swing round control."))

                spray = fa.get("spray_rate")
                if spray is not None and float(spray) > 30:
                    candidates.append(("yw", float(spray) - 20, "Convert High-Damage Hits",
                        f"In {spray:.0f}% of rounds you deal 80+ dmg without a kill — tighten spray patterns to finish duels."))

                hs_far = aim_fa.get("hs_far_pct"); fk = aim_fa.get("far_kills")
                if hs_far is not None and float(hs_far) < 15 and (fk or 0) >= 10:
                    candidates.append(("ac", 15 - float(hs_far), "Crosshair Placement at Range",
                        f"HS% drops to {hs_far:.0f}% at long range — raise crosshair to head height before long duels."))

                candidates.sort(key=lambda x: -x[1])
                focus_areas = [{"color": it[0], "title": it[2], "tip": it[3]} for it in candidates[:3]]
            except Exception:
                pass

    finally:
        conn.close()

    return _j({
        "kpis":            kpis,
        "coach_briefs":    coach_briefs,
        "grenade_lineups": grenade_lineups,
        "maps_available":  maps_available,
        "focus_areas":     focus_areas,
    })

@app.get("/api/faceit_overview")
def api_faceit_overview(days: int = Query(90)):
    conn = _db()
    try:
        with conn.cursor() as c:
            c.execute(f"SELECT COUNT(*) AS n FROM faceit_matches WHERE played_at > now() - INTERVAL '{days} days'")
            if (c.fetchone() or {}).get("n", 0) == 0:
                return {"has_data": False}

            c.execute(f"""
                SELECT
                    COUNT(*)                                                              AS matches,
                    ROUND(100.0*COUNT(*) FILTER (WHERE won)/NULLIF(COUNT(*),0),1)        AS win_pct,
                    ROUND(AVG(kd_ratio)::numeric,2)                                      AS kd,
                    ROUND(AVG(adr)::numeric,1)                                           AS adr,
                    ROUND(AVG(hs_pct)::numeric,1)                                        AS hs_pct,
                    ROUND(AVG(kills)::numeric,1)                                         AS avg_kills,
                    ROUND(AVG(deaths)::numeric,1)                                        AS avg_deaths,
                    ROUND(100.0*SUM(opening_kills)::numeric/NULLIF(SUM(opening_kills+opening_deaths),0),1)
                                                                                         AS opening_win_pct,
                    SUM(triple_kills)  AS triple_kills,
                    SUM(quadro_kills)  AS quadro_kills,
                    SUM(penta_kills)   AS penta_kills,
                    MAX(faceit_elo) FILTER (WHERE played_at=(SELECT MAX(played_at) FROM faceit_matches
                                                             WHERE faceit_elo IS NOT NULL))
                                                                                         AS latest_elo,
                    MAX(faceit_level) FILTER (WHERE played_at=(SELECT MAX(played_at) FROM faceit_matches
                                                               WHERE faceit_level IS NOT NULL))
                                                                                         AS faceit_level,
                    ROUND(AVG(elo_change) FILTER (WHERE elo_change IS NOT NULL)::numeric,1)
                                                                                         AS avg_elo_change
                FROM faceit_matches
                WHERE played_at > now() - INTERVAL '{days} days'
            """)
            kpis = dict(c.fetchone() or {})

            c.execute(f"""
                SELECT to_char(played_at,'MM-DD HH24:MI') AS "when",
                       map, won, team_score, opp_score,
                       kd_ratio::float AS kd, adr::float AS adr, hs_pct::float AS hs_pct,
                       faceit_elo, elo_change
                FROM faceit_matches
                WHERE played_at > now() - INTERVAL '{days} days'
                ORDER BY played_at DESC LIMIT 10
            """)
            recent = [dict(r) for r in c.fetchall()]

            c.execute(f"""
                SELECT map, COUNT(*) AS matches,
                    ROUND(100.0*COUNT(*) FILTER (WHERE won)/NULLIF(COUNT(*),0),1) AS win_pct,
                    ROUND(AVG(kd_ratio)::numeric,2) AS kd,
                    ROUND(AVG(adr)::numeric,1) AS adr,
                    ROUND(AVG(hs_pct)::numeric,1) AS hs_pct
                FROM faceit_matches
                WHERE played_at > now() - INTERVAL '{days} days'
                GROUP BY map ORDER BY COUNT(*) DESC
            """)
            by_map = [dict(r) for r in c.fetchall()]

            c.execute(f"""
                SELECT played_at::text, faceit_elo, elo_change, won, map
                FROM faceit_matches
                WHERE faceit_elo IS NOT NULL
                  AND played_at > now() - INTERVAL '{days} days'
                ORDER BY played_at
            """)
            elo_trend = [dict(r) for r in c.fetchall()]

        return _j({
            "has_data": True,
            "kpis": kpis,
            "recent_form": recent,
            "by_map": by_map,
            "elo_trend": elo_trend,
        })
    finally:
        conn.close()


app.mount("/static", StaticFiles(directory="/app/static"), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)

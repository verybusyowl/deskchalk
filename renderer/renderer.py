#!/usr/bin/env python3
"""
CS2 heatmap renderer.

GET /heatmap?map=de_mirage&type=kills&side=T&days=30
  -> 1024x1024 PNG of point clusters on the map, in radar coords.

If /radars/{map}.png is present, it's used as the background; otherwise we
render onto a dark slate background so the points still read clearly.

Powers the Map Lab Grafana dashboard via a text panel containing an <img>.
"""

import io
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import psycopg2
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Response
from PIL import Image, ImageDraw

DB_DSN = os.environ["DB_DSN"]
RADARS_DIR = Path(os.environ.get("RADARS_DIR", "/radars"))
PORT = int(os.environ.get("PORT", "5000"))
RADAR_SIZE = 1024  # CS2 radar images are 1024x1024 by convention

app = FastAPI()


def db():
    return psycopg2.connect(DB_DSN)


def get_calibration(conn, map_name: str):
    with conn.cursor() as c:
        c.execute(
            "SELECT origin_x, origin_y, scale, radar_size "
            "FROM map_radar_calibration WHERE map = %s",
            (map_name,),
        )
        row = c.fetchone()
    if row is None:
        # Sensible default so unknown maps still produce something
        return -2500.0, 2500.0, 5.0, RADAR_SIZE
    return row


def fetch_points(conn, map_name: str, kind: str, side: str, days: int):
    """Returns list of (world_x, world_y, color, radius)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    side_clause = "" if side == "all" else f" AND ke.side = %s"

    if kind in ("kills", "deaths"):
        is_victim = "TRUE" if kind == "deaths" else "FALSE"
        x_col, y_col = ("victim_x", "victim_y") if kind == "deaths" else ("attacker_x", "attacker_y")
        sql = (
            f"SELECT {x_col}, {y_col} "
            f"FROM kill_events ke JOIN matches m USING(match_id) "
            f"WHERE ke.is_victim = {is_victim} "
            f"  AND m.map = %s {side_clause} "
            f"  AND m.played_at >= %s "
            f"  AND {x_col} IS NOT NULL AND {y_col} IS NOT NULL"
        )
        params = (map_name,) + ((side,) if side != "all" else ()) + (cutoff,)
        color = (60, 220, 90, 220) if kind == "kills" else (240, 70, 70, 220)
        with conn.cursor() as c:
            c.execute(sql, params)
            rows = c.fetchall()
        return [(x, y, color, 7) for (x, y) in rows]

    if kind in ("grenades", "smokes", "flashes"):
        side_clause2 = "" if side == "all" else " AND ge.side = %s"
        type_filter = ""
        if kind == "smokes":
            type_filter = " AND ge.grenade_type = 'smoke'"
        elif kind == "flashes":
            type_filter = " AND ge.grenade_type = 'flash'"
        sql = (
            "SELECT land_x, land_y, grenade_type "
            "FROM grenade_events ge JOIN matches m USING(match_id) "
            "WHERE m.map = %s" + side_clause2 + type_filter +
            "  AND m.played_at >= %s "
            "  AND land_x IS NOT NULL AND land_y IS NOT NULL"
        )
        params = (map_name,) + ((side,) if side != "all" else ()) + (cutoff,)
        with conn.cursor() as c:
            c.execute(sql, params)
            rows = c.fetchall()
        palette = {
            "smoke":   (220, 220, 220, 200),
            "flash":   (255, 240, 100, 220),
            "molotov": (255, 140, 30, 230),
            "he":      (255, 80, 80, 230),
        }
        radius = 11 if kind in ("smokes", "flashes") else 9
        return [(x, y, palette.get(g, (255, 255, 255, 200)), radius) for (x, y, g) in rows]

    return []


def make_background(map_name: str) -> Image.Image:
    """Radar image if /radars/{map}.png exists, else a styled placeholder."""
    bg_path = RADARS_DIR / f"{map_name}.png"
    if bg_path.exists():
        img = Image.open(bg_path).convert("RGBA")
        if img.size != (RADAR_SIZE, RADAR_SIZE):
            img = img.resize((RADAR_SIZE, RADAR_SIZE))
        return img

    # Styled placeholder: dark base + grid + large map name + drop-in hint
    img = Image.new("RGBA", (RADAR_SIZE, RADAR_SIZE), (22, 26, 34, 255))
    d = ImageDraw.Draw(img)
    # Subtle grid
    step = 128
    for i in range(0, RADAR_SIZE, step):
        d.line([(i, 0), (i, RADAR_SIZE)], fill=(40, 46, 56, 255))
        d.line([(0, i), (RADAR_SIZE, i)], fill=(40, 46, 56, 255))
    # Center crosshairs slightly brighter
    d.line([(RADAR_SIZE // 2, 0), (RADAR_SIZE // 2, RADAR_SIZE)], fill=(60, 68, 82, 255))
    d.line([(0, RADAR_SIZE // 2), (RADAR_SIZE, RADAR_SIZE // 2)], fill=(60, 68, 82, 255))
    # Map name large near top-center (PIL default font; modest size limit)
    try:
        from PIL import ImageFont
        font_big = ImageFont.load_default(size=42)
        font_sm = ImageFont.load_default(size=14)
    except Exception:
        font_big = None
        font_sm = None
    name_str = (map_name or "unknown").upper()
    if font_big:
        tw = d.textlength(name_str, font=font_big)
        d.text(((RADAR_SIZE - tw) / 2, 36), name_str,
               fill=(160, 175, 200, 255), font=font_big)
    hint = "Drop a 1024×1024 PNG at /radars/{}.png to replace this background".format(map_name or "MAP")
    if font_sm:
        tw = d.textlength(hint, font=font_sm)
        d.text(((RADAR_SIZE - tw) / 2, RADAR_SIZE - 28), hint,
               fill=(90, 100, 120, 255), font=font_sm)
    return img


def render(map_name: str, kind: str, side: str, days: int) -> bytes:
    conn = db()
    try:
        origin_x, origin_y, scale, radar_size = get_calibration(conn, map_name)
        points = fetch_points(conn, map_name, kind, side, days)
    finally:
        conn.close()

    img = make_background(map_name)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    plotted = 0
    for world_x, world_y, color, radius in points:
        px = (world_x - origin_x) / scale
        py = (origin_y - world_y) / scale
        if 0 <= px < RADAR_SIZE and 0 <= py < RADAR_SIZE:
            draw.ellipse(
                (px - radius, py - radius, px + radius, py + radius),
                fill=color,
                outline=(0, 0, 0, 220),
                width=1,
            )
            plotted += 1

    # Small caption with counts so empty/sparse results are obvious
    cap = f"{map_name}  {kind}  {side}  {days}d   n={plotted}"
    text_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(text_layer)
    td.rectangle((4, 4, 4 + 8 * len(cap) + 8, 22), fill=(0, 0, 0, 180))
    td.text((10, 8), cap, fill=(220, 220, 220, 255))

    out = Image.alpha_composite(img, overlay)
    out = Image.alpha_composite(out, text_layer)

    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()


HITGROUP_REGIONS = [
    # (hitgroup_id, region_label, draw_rect_fn_name)
    (1, "head", "head"),
    (2, "chest", "chest"),
    (3, "stomach", "stomach"),
    (4, "left_arm", "left_arm"),
    (5, "right_arm", "right_arm"),
    (6, "left_leg", "left_leg"),
    (7, "right_leg", "right_leg"),
]


def _lerp(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def _stoplight(pct):
    """0% green → 50% yellow → 100% red (alpha 220)."""
    if pct is None:
        return (60, 65, 78, 180)
    t = max(0.0, min(1.0, pct / 100.0))
    if t < 0.5:
        rgb = _lerp((110, 200, 110), (230, 200, 90), t * 2)
    else:
        rgb = _lerp((230, 200, 90), (235, 80, 90), (t - 0.5) * 2)
    return (*rgb, 230)


SIDE_THEMES = {
    # outline color, accent badge color, body name
    "CT":  ((110, 168, 232, 255), (66, 132, 210, 255), "CT"),
    "T":   ((230, 154, 70, 255),  (210, 110, 36, 255), "T"),
    "all": ((110, 122, 144, 255), (90, 100, 122, 255), "ALL"),
}


def render_hitbox(map_name: Optional[str], days: int, perspective: str, side: str = "all") -> bytes:
    """Render a humanoid silhouette colored by per-region hit stats.
    perspective: 'incoming' = hits I take, 'outgoing' = hits I land.
    side: 'CT' | 'T' | 'all' — themes the body outline + filters data."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    conn = db()
    try:
        is_me = "FALSE" if perspective == "incoming" else "TRUE"
        # Build WHERE clause; side filter applies to player_rounds-style "your side"
        # (de.side already stores the side YOU were on for that round)
        clauses = [f"de.attacker_is_you = {is_me}", "m.played_at >= %s",
                   "de.hitgroup IS NOT NULL"]
        sql_params = [cutoff]
        if map_name and map_name != "any":
            clauses.append("m.map = %s")
            sql_params.append(map_name)
        if side in ("CT", "T"):
            clauses.append("de.side = %s")
            sql_params.append(side)
        sql = ("SELECT hitgroup, COUNT(*) AS hits, "
               "       SUM(CASE WHEN victim_died THEN 1 ELSE 0 END) AS lethal "
               "FROM damage_events de JOIN matches m USING(match_id) "
               "WHERE " + " AND ".join(clauses) + " GROUP BY hitgroup")
        with conn.cursor() as c:
            c.execute(sql, sql_params)
            rows = {int(r[0]): {"hits": int(r[1]), "lethal": int(r[2])} for r in c.fetchall()}
    finally:
        conn.close()

    outline_c, badge_c, side_label = SIDE_THEMES.get(side, SIDE_THEMES["all"])

    total_hits = sum(r["hits"] for r in rows.values()) or 1
    img = Image.new("RGBA", (520, 720), (15, 18, 26, 255))
    d = ImageDraw.Draw(img)

    # Title strip
    label = ("DAMAGE YOU TAKE" if perspective == "incoming" else "DAMAGE YOU DEAL")
    label += f"  ·  map: {map_name or 'any'}  ·  last {days}d  ·  n={total_hits}"
    d.rectangle((0, 0, 520, 30), fill=(20, 24, 34, 255))
    d.text((14, 9), label, fill=(190, 200, 220, 255))
    # Side badge top-right
    badge_w = 56
    d.rounded_rectangle((520 - badge_w - 10, 5, 520 - 10, 25), radius=10,
                        fill=badge_c, outline=None)
    d.text((520 - badge_w - 10 + (badge_w - 8 * len(side_label)) // 2 + 4, 9),
           side_label, fill=(15, 18, 26, 255))

    # Body geometry — proportional, centered
    cx = 260
    head_r = 38
    head_cy = 90
    torso_top = head_cy + head_r + 4
    chest_h = 90
    stomach_h = 70
    torso_w = 130
    arm_w = 36
    arm_h = chest_h + stomach_h
    leg_w = 52
    leg_h = 230
    leg_gap = 8

    # Shapes per hit group
    regions = {
        1: ("Head", _circle_bbox(cx, head_cy, head_r)),
        2: ("Chest", (cx - torso_w//2, torso_top, cx + torso_w//2, torso_top + chest_h)),
        3: ("Stomach", (cx - torso_w//2, torso_top + chest_h, cx + torso_w//2, torso_top + chest_h + stomach_h)),
        4: ("Left arm",  (cx - torso_w//2 - arm_w - 4, torso_top, cx - torso_w//2 - 4, torso_top + arm_h)),
        5: ("Right arm", (cx + torso_w//2 + 4, torso_top, cx + torso_w//2 + arm_w + 4, torso_top + arm_h)),
        6: ("Left leg",  (cx - leg_gap//2 - leg_w, torso_top + chest_h + stomach_h + 4,
                          cx - leg_gap//2, torso_top + chest_h + stomach_h + 4 + leg_h)),
        7: ("Right leg", (cx + leg_gap//2, torso_top + chest_h + stomach_h + 4,
                          cx + leg_gap//2 + leg_w, torso_top + chest_h + stomach_h + 4 + leg_h)),
    }

    # Draw each region
    for hg, (name, box) in regions.items():
        r = rows.get(hg, {"hits": 0, "lethal": 0})
        hits = r["hits"]
        lethal = r["lethal"]
        share_pct = 100.0 * hits / total_hits if total_hits else 0
        lethal_pct = 100.0 * lethal / hits if hits else None
        fill = _stoplight(lethal_pct) if perspective == "incoming" else _stoplight(100 - (lethal_pct or 0))
        # For outgoing: high lethality is GOOD (green). Flip so green = lethal hits.
        if perspective == "outgoing" and lethal_pct is not None:
            fill = _stoplight(100 - lethal_pct)
        # Body outline uses the side's theme color so CT vs T is visually distinct
        if hg == 1:  # head is a circle
            d.ellipse(box, fill=fill, outline=outline_c, width=3)
        else:
            d.rounded_rectangle(box, radius=10, fill=fill, outline=outline_c, width=3)
        # Labels: name + hits + lethality
        if hg == 1:  # head — label to the right of the circle
            tx, ty = box[2] + 12, box[1] + 4
        elif hg in (4, 6):  # left arm / left leg — label to the left
            tx, ty = box[0] - 80, (box[1] + box[3]) // 2 - 14
        elif hg in (5, 7):  # right arm / right leg — label to the right
            tx, ty = box[2] + 8, (box[1] + box[3]) // 2 - 14
        else:  # chest / stomach — label inside
            tx, ty = box[0] + 10, (box[1] + box[3]) // 2 - 14
        sub = f"{hits} hits ({share_pct:.0f}%)"
        if lethal_pct is not None:
            sub += f"\n{lethal_pct:.0f}% lethal"
        d.text((tx, ty), f"{name}\n{sub}", fill=(220, 226, 238, 255))

    # Footer legend
    legend_y = 678
    d.text((14, legend_y),
           "color: green = good outcome, red = bad outcome (lethality)",
           fill=(120, 130, 150, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _circle_bbox(cx, cy, r):
    return (cx - r, cy - r, cx + r, cy + r)


@app.get("/hitbox")
def hitbox(
    map: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=3650),
    perspective: str = Query("incoming", description="incoming|outgoing"),
    side: str = Query("all", description="CT|T|all"),
    _: Optional[str] = Query(None),
):
    if perspective not in ("incoming", "outgoing"):
        raise HTTPException(400, "perspective must be incoming|outgoing")
    if side not in ("CT", "T", "all"):
        raise HTTPException(400, "side must be CT|T|all")
    png = render_hitbox(map, days, perspective, side)
    return Response(content=png, media_type="image/png",
                    headers={"Cache-Control": "no-cache, no-store, must-revalidate"})


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/heatmap")
def heatmap(
    map: str = Query(..., description="Map name e.g. de_mirage"),
    type: str = Query("kills", description="kills|deaths|grenades"),
    side: str = Query("all", description="CT|T|all"),
    days: int = Query(30, ge=1, le=3650),
    _: Optional[str] = Query(None, description="cache-buster"),
):
    if type not in ("kills", "deaths", "grenades", "smokes", "flashes"):
        raise HTTPException(400, "type must be kills|deaths|grenades|smokes|flashes")
    if side not in ("CT", "T", "all"):
        raise HTTPException(400, "side must be CT|T|all")
    png = render(map, type, side, days)
    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)

#!/usr/bin/env python3
"""
CS2 demo worker.

Loop: poll sharecodes WHERE status='pending', decode each, fetch demo (via GC
client or manual drop into /demos), parse with demoparser2 filtered to
STEAM_ID64, and write match + player_rounds + per-event tables in one
transaction. On error: increment attempts; after 3, mark 'expired'.
"""
import bisect
import gzip
import hashlib
import math
import os
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests
from demoparser2 import DemoParser

STEAM_ID64          = int(os.environ["STEAM_ID64"])
DB_DSN              = os.environ["DB_DSN"]
GC_CLIENT_URL       = os.environ.get("GC_CLIENT_URL", "http://gc-client:3000")
DEMOS_DIR           = Path(os.environ.get("DEMOS_DIR", "/demos"))
WORKER_INTERVAL     = int(os.environ.get("WORKER_INTERVAL", "120"))
DEMO_RETENTION_DAYS = int(os.environ.get("DEMO_RETENTION_DAYS", "30"))
DISCORD_WEBHOOK     = os.environ.get("DISCORD_WEBHOOK_URL", "")
FACEIT_API_KEY      = os.environ.get("FACEIT_API_KEY", "")

# Valve's CS2 sharecode alphabet — base58, ambiguous chars excluded (no 0/1/I/l).
# The spec's value was incorrect; this is the canonical alphabet used by
# steam-user / node-globaloffensive / akiver/CSGO-Demos-Manager.
ALPHABET = "ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"


def log(*args):
    print(f"[{datetime.now().isoformat(timespec='seconds')}] [worker]", *args, flush=True)


# ----------------------------------------------------------------------------
# Sharecode decode
# ----------------------------------------------------------------------------
def decode_sharecode(code: str):
    """
    Returns (matchid: int, outcomeid: int, token: int)
    CS2 sharecodes are base58 over ALPHABET. Strip 'CSGO-' and dashes,
    reverse, decode to a 144-bit integer, then split:
      bits   0..63  = matchid
      bits  64..127 = outcomeid (a.k.a. reservation_id)
      bits 128..143 = token (a.k.a. tvport)
    """
    base = len(ALPHABET)
    stripped = code.replace("CSGO-", "").replace("-", "")
    val = 0
    for ch in reversed(stripped):
        val = val * base + ALPHABET.index(ch)
    matchid   = val & 0xFFFFFFFFFFFFFFFF
    outcomeid = (val >> 64) & 0xFFFFFFFFFFFFFFFF
    token     = (val >> 128) & 0xFFFF
    return matchid, outcomeid, token


# ----------------------------------------------------------------------------
# DB helpers
# ----------------------------------------------------------------------------
def db():
    return psycopg2.connect(DB_DSN)


def get_pending(conn):
    with conn.cursor() as c:
        c.execute(
            "SELECT code, attempts FROM sharecodes "
            "WHERE status='pending' ORDER BY discovered_at ASC LIMIT 50"
        )
        return c.fetchall()


def mark_parsed(conn, code):
    with conn.cursor() as c:
        c.execute(
            "UPDATE sharecodes SET status='parsed', parsed_at=now(), last_error=NULL "
            "WHERE code=%s",
            (code,),
        )
    conn.commit()


def mark_failed(conn, code, err, attempts):
    new_status = "expired" if attempts + 1 >= 3 else "failed" if False else "pending"
    # Spec: increment attempts, mark expired after 3 failed attempts.
    # We keep status='pending' between failures so retries continue.
    with conn.cursor() as c:
        if attempts + 1 >= 3:
            c.execute(
                "UPDATE sharecodes SET status='expired', attempts=attempts+1, "
                "last_error=%s WHERE code=%s",
                (str(err)[:500], code),
            )
        else:
            c.execute(
                "UPDATE sharecodes SET attempts=attempts+1, last_error=%s "
                "WHERE code=%s",
                (str(err)[:500], code),
            )
    conn.commit()


# ----------------------------------------------------------------------------
# Demo acquisition
# ----------------------------------------------------------------------------
def existing_demo_path(matchid: int) -> Path | None:
    candidates = [
        DEMOS_DIR / f"{matchid}.dem",
        DEMOS_DIR / f"match730_{matchid:021d}.dem",
    ]
    for p in candidates:
        if p.exists():
            return p
    # Loose manual drop: any .dem whose name contains the matchid
    for p in DEMOS_DIR.glob("*.dem"):
        if str(matchid) in p.name:
            return p
    return None


def request_demo_url(sharecode: str) -> str:
    r = requests.post(
        f"{GC_CLIENT_URL}/fetch",
        json={"sharecode": sharecode},
        timeout=90,
    )
    r.raise_for_status()
    url = r.json().get("demo_url")
    if not url:
        raise RuntimeError("gc-client returned no demo_url")
    return url


def find_manual_faceit_demo(faceit_id: str, numeric_id: int) -> Path | None:
    """Pick up demos downloaded manually from a FACEIT match room ("Watch
    Demo" in the browser) and dropped into DEMOS_DIR. Their filenames contain
    the match UUID (e.g. 1-<uuid>-1-1.dem.zst). Compressed drops are
    decompressed to the canonical {numeric_id}.dem."""
    import shutil
    for p in DEMOS_DIR.glob("*"):
        if faceit_id not in p.name:
            continue
        if p.name.endswith(".dem"):
            return p
        dest = DEMOS_DIR / f"{numeric_id}.dem"
        if p.name.endswith(".zst"):
            import zstandard
            dctx = zstandard.ZstdDecompressor()
            with open(p, "rb") as src, open(dest, "wb") as out:
                dctx.copy_stream(src, out)
            return dest
        if p.name.endswith(".gz"):
            with gzip.open(p, "rb") as src, open(dest, "wb") as out:
                shutil.copyfileobj(src, out)
            return dest
        if p.name.endswith(".bz2"):
            import bz2
            with bz2.open(p, "rb") as src, open(dest, "wb") as out:
                shutil.copyfileobj(src, out)
            return dest
    return None


def faceit_signed_url(resource_url: str) -> str:
    """Exchange a stored FACEIT demo resource URL for a signed download URL.

    FACEIT killed direct CDN access (backblaze hostnames no longer resolve);
    demos must be fetched via the download API, which needs an API key with
    the 'downloads' scope.
    """
    if not FACEIT_API_KEY:
        raise RuntimeError("FACEIT_API_KEY not set — cannot request signed demo URL")
    r = requests.post(
        "https://open.faceit.com/download/v2/demos/download",
        headers={"Authorization": f"Bearer {FACEIT_API_KEY}",
                 "Content-Type": "application/json"},
        json={"resource_url": resource_url},
        timeout=30,
    )
    if r.status_code != 200:
        raise RuntimeError(f"FACEIT download API {r.status_code}: {r.text[:200]}")
    payload = r.json().get("payload", {})
    signed = payload.get("download_url")
    if not signed:
        raise RuntimeError(f"FACEIT download API returned no download_url: {r.text[:200]}")
    return signed


def download_demo(url: str, matchid: int) -> Path:
    """Download and decompress a demo. Handles .bz2, .gz, and .zst (FACEIT) archives."""
    DEMOS_DIR.mkdir(parents=True, exist_ok=True)
    dest = DEMOS_DIR / f"{matchid}.dem"
    tmp  = dest.with_suffix(".dem.part")
    # Signed URLs carry query strings — check extension on the path only
    url_lower = url.split("?", 1)[0].lower()
    is_bz2 = url_lower.endswith(".bz2")
    is_gz  = url_lower.endswith(".gz")
    is_zst = url_lower.endswith(".zst")

    log(f"downloading demo for {matchid} (bz2={is_bz2}, gz={is_gz}, zst={is_zst})")
    with requests.get(url, stream=True, timeout=300) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 16):
                if chunk:
                    f.write(chunk)

    if is_bz2:
        import bz2, shutil
        with bz2.open(tmp, "rb") as src, open(dest, "wb") as out:
            shutil.copyfileobj(src, out)
        tmp.unlink(missing_ok=True)
    elif is_gz:
        import shutil
        with gzip.open(tmp, "rb") as src, open(dest, "wb") as out:
            shutil.copyfileobj(src, out)
        tmp.unlink(missing_ok=True)
    elif is_zst:
        import shutil, zstandard
        dctx = zstandard.ZstdDecompressor()
        with open(tmp, "rb") as src, open(dest, "wb") as out:
            dctx.copy_stream(src, out)
        tmp.unlink(missing_ok=True)
    else:
        tmp.rename(dest)

    return dest


# ----------------------------------------------------------------------------
# Demo parsing
# ----------------------------------------------------------------------------
SIDE_T, SIDE_CT = 2, 3

# Non-gun "weapons" appearing in weapon_fire — excluded from accuracy /
# counter-strafe metrics. Names are post-_norm_weapon.
NON_GUN_WEAPONS = {"knife", "knife_t", "bayonet", "hegrenade", "flashbang",
                   "smokegrenade", "molotov", "incgrenade", "decoy", "c4", "taser"}
GRENADE_FIRE_WEAPONS = {"hegrenade", "flashbang", "smokegrenade", "molotov",
                        "incgrenade", "decoy"}
# New burst when consecutive shots are more than 0.375s apart (64 tick)
BURST_GAP_TICKS = 24
# Moving faster than this at trigger time means the shot was not counter-strafed
COUNTER_STRAFE_MAX_SPEED = 34.0

GRENADE_EVENT_TO_TYPE = {
    "smokegrenade_detonate": "smoke",
    "flashbang_detonate":    "flash",
    "inferno_startburn":     "molotov",
    "hegrenade_detonate":    "he",
}

# demoparser2 returns hitgroup as a string (e.g. "head") on CS2 demos; the
# schema view (v_hitgroup) expects the numeric encoding.
HITGROUP_MAP = {
    "generic":   0,
    "head":      1,
    "chest":     2,
    "stomach":   3,
    "left_arm":  4, "leftarm":  4,
    "right_arm": 5, "rightarm": 5,
    "left_leg":  6, "leftleg":  6,
    "right_leg": 7, "rightleg": 7,
    "neck":      8,
    "gear":      10,
}

_WEAPON_NORM = {
    "m4a1_silencer": "m4a1",
    "m4a1_silencer_off": "m4a1",
    "usp_silencer": "usp_s",
    "usp_silencer_off": "usp_s",
}

def _norm_weapon(w: str) -> str:
    w = str(w or "").strip()
    if w.startswith("weapon_"):
        w = w[7:]
    return _WEAPON_NORM.get(w, w)


def _to_hitgroup(v):
    if v is None:
        return 0
    try:
        n = int(v)
        return n
    except (ValueError, TypeError):
        return HITGROUP_MAP.get(str(v).strip().lower(), 0)


def _i(v, default=0):
    """NaN/None/string-safe int coercion. demoparser2 yields pandas/polars
    values that may be NaN, None, numpy scalars, or unexpected strings."""
    if v is None:
        return default
    try:
        # NaN trips this path because int(NaN) raises ValueError.
        n = int(v)
        return n
    except (ValueError, TypeError):
        try:
            f = float(v)
            if f != f:  # NaN
                return default
            return int(f)
        except (ValueError, TypeError):
            return default


def _id_match(series, target):
    """Steamid-column comparison that tolerates NaN/strings. Returns bool mask.
    demoparser2 columns occasionally have NaN where the steamid is unknown
    (e.g. assister_steamid when no assist) — .astype('int64') chokes on that."""
    import pandas as pd
    return pd.to_numeric(series, errors='coerce').fillna(0).astype("int64") == int(target)


def _filter_me(df, col="steamid"):
    if df is None or len(df) == 0:
        return df
    return df[_id_match(df[col], STEAM_ID64)] if col in df.columns else df


def _is_me(series):
    return _id_match(series, STEAM_ID64)


# Weapons whose player_hurt damage counts as utility damage.
NADE_DMG_WEAPONS = {"hegrenade", "inferno", "molotov", "incgrenade", "inc_grenade"}


def _round_player_stats(rn, round_teams, d_round, h_round, tickrate,
                        my_sid, names):
    """Per-player round stats for ALL players (team + enemy), derived purely
    from the death/hurt event tables (which already contain every player).
    Returns a list of dicts, one per steamid in round_teams. Trade detection is
    teammate-verified using round_teams (a player's allies = same side that
    round). This is the all-player analogue of the YOU-only player_rounds row.
    """
    rows = []
    if not round_teams:
        return rows

    # Precompute death events once: list of (att, vic, ass, flash, hs, tick).
    deaths = []
    first_att = first_vic = None
    if d_round is not None and len(d_round) > 0:
        d_sorted = d_round.sort_values("tick").reset_index(drop=True)
        a_col = "attacker_steamid" if "attacker_steamid" in d_sorted.columns else "attacker_name"
        v_col = "user_steamid" if "user_steamid" in d_sorted.columns else "user_name"
        has_ass = "assister_steamid" in d_sorted.columns
        has_flash = "assistedflash" in d_sorted.columns
        for _, row in d_sorted.iterrows():
            try:
                att = _i(row.get(a_col, 0), 0)
                vic = _i(row.get(v_col, 0), 0)
                ass = _i(row.get("assister_steamid", 0), 0) if has_ass else 0
                flash = bool(row.get("assistedflash", False)) if has_flash else False
                hs = bool(row.get("headshot", False))
                tk = _i(row.get("tick", 0), 0)
            except Exception:
                continue
            deaths.append((att, vic, ass, flash, hs, tk))
        if deaths:
            first_att, first_vic = deaths[0][0], deaths[0][1]
    # A real opening duel needs a genuine kill (not a suicide/world/bomb death).
    opening_valid = bool(first_att and first_vic and first_att != first_vic)

    # Precompute per-attacker damage (all weapons) and utility damage (nades).
    dmg_by, util_dmg_by = {}, {}
    if h_round is not None and len(h_round) > 0:
        ha_col = "attacker_steamid" if "attacker_steamid" in h_round.columns else "attacker_name"
        has_wpn = "weapon" in h_round.columns
        for _, row in h_round.iterrows():
            try:
                att = _i(row.get(ha_col, 0), 0)
                dmg = _i(row.get("dmg_health", row.get("damage", 0)), 0)
            except Exception:
                continue
            dmg_by[att] = dmg_by.get(att, 0) + dmg
            if has_wpn and str(row.get("weapon", "") or "").lower() in NADE_DMG_WEAPONS:
                util_dmg_by[att] = util_dmg_by.get(att, 0) + dmg

    TRADE_WINDOW = int(5.0 * tickrate)
    for sid, side in round_teams.items():
        teammates = {s for s, t in round_teams.items() if t == side and s != sid}
        kills = deaths_n = assists = headshots = flash_assists = 0
        died_tick = None
        killer = None
        survived = True
        for (att, vic, ass, flash, hs, tk) in deaths:
            if att == sid:
                kills += 1
                if hs:
                    headshots += 1
            if vic == sid:
                deaths_n += 1
                survived = False
                died_tick, killer = tk, att
            if ass == sid:
                assists += 1
                if flash:
                    flash_assists += 1

        traded_death = traded_kill = False
        # I died and a teammate avenged me within the window.
        if died_tick is not None and killer:
            for (att, vic, ass, flash, hs, tk) in deaths:
                if (died_tick < tk <= died_tick + TRADE_WINDOW
                        and vic == killer and att in teammates):
                    traded_death = True
                    break
        # A teammate died and I killed their killer within the window.
        for (att, vic, ass, flash, hs, tk) in deaths:
            if vic in teammates:
                for (att2, vic2, _a, _f, _h, tk2) in deaths:
                    if (tk < tk2 <= tk + TRADE_WINDOW and att2 == sid and vic2 == att):
                        traded_kill = True
                        break
            if traded_kill:
                break

        rows.append({
            "round_num": rn, "steamid": sid, "name": names.get(sid, ""),
            "side": side, "is_me": sid == my_sid,
            "kills": kills, "deaths": deaths_n, "assists": assists,
            "damage": dmg_by.get(sid, 0), "headshots": headshots,
            "opening_kill": opening_valid and first_att == sid,
            "opening_death": opening_valid and first_vic == sid,
            "traded_kill": traded_kill, "traded_death": traded_death,
            "survived": survived, "util_damage": util_dmg_by.get(sid, 0),
            "flash_assists": flash_assists,
        })
    return rows


def parse_demo(path: Path) -> dict:
    """Parse a demo file. Returns a dict ready for DB insertion."""
    parser = DemoParser(str(path))
    header = parser.parse_header()
    map_name = header.get("map_name") or "unknown"

    # Demo tickrate. CS2 demos are effectively always 64, but read it from the
    # header when present rather than assuming, and centralize it so all time
    # math (TTD/TTK/trade window/blind duration) derives from one source.
    try:
        tickrate = int(float(header.get("tickrate") or 0))
    except (ValueError, TypeError):
        tickrate = 0
    if tickrate <= 0:
        tickrate = 64

    # Event tables we need
    wanted_events = [
        "round_start", "round_end", "round_freeze_end",
        "player_death", "player_hurt", "player_blind", "player_spawn",
        "weapon_fire",
        "bomb_planted", "item_purchase",
        "smokegrenade_detonate", "flashbang_detonate",
        "inferno_startburn", "hegrenade_detonate",
        "begin_new_match",
    ]
    events = {}
    try:
        ev_list = parser.parse_events(wanted_events, player=["X", "Y", "Z", "inventory"])
        # demoparser2 returns list of (name, df) tuples
        events = {name: df for (name, df) in ev_list}
    except Exception as e:
        log(f"parse_events error: {e}")

    # Per-tick fields for all players — used for spawn_x/y, velocity, hp, team,
    # player positions, clutch detection, and replay data.
    tick_props = ["X", "Y", "Z", "health", "team_num",
                  "velocity_X", "velocity_Y", "is_alive",
                  "balance", "current_equip_value", "name", "yaw", "pitch",
                  "active_weapon_name"]
    all_ticks = None
    ticks = None  # my ticks only (used by tick_value())
    try:
        all_ticks = parser.parse_ticks(tick_props)
        if all_ticks is not None and len(all_ticks) > 0:
            ticks = all_ticks[_id_match(all_ticks["steamid"], STEAM_ID64)].copy().reset_index(drop=True)
    except Exception:
        try:
            ticks = parser.parse_ticks(tick_props, players=[STEAM_ID64])
        except Exception as e:
            log(f"parse_ticks error: {e}")
            ticks = None

    round_ends = events.get("round_end")
    round_starts = events.get("round_start")
    freeze_ends = events.get("round_freeze_end")
    deaths = events.get("player_death")
    hurts = events.get("player_hurt")
    blinds = events.get("player_blind")
    purchases = events.get("item_purchase")
    bombs = events.get("bomb_planted")

    rounds_total = 0 if round_ends is None else len(round_ends)
    team_score = opp_score = 0
    if round_ends is not None and len(round_ends) > 0:
        last = round_ends.iloc[-1]
        team_score = _i(last.get("t_score", 0), 0)
        opp_score = _i(last.get("ct_score", 0), 0)

    # Build round boundaries: list of (round_num, start_tick, freeze_tick, end_tick)
    round_bounds = []
    if round_starts is not None and round_ends is not None:
        starts = round_starts.sort_values("tick").reset_index(drop=True)
        ends = round_ends.sort_values("tick").reset_index(drop=True)
        n_rounds = min(len(starts), len(ends))
        for i in range(n_rounds):
            st = _i(starts.iloc[i]["tick"], 0)
            en = _i(ends.iloc[i]["tick"], 0)
            fz = st
            if freeze_ends is not None and len(freeze_ends) > 0:
                between = freeze_ends[(freeze_ends["tick"] >= st) & (freeze_ends["tick"] <= en)]
                if len(between) > 0:
                    fz = _i(between.iloc[0]["tick"], st)
            round_bounds.append((i + 1, st, fz, en))

    def in_round(df, tick_col="tick"):
        out = {}
        if df is None or len(df) == 0:
            return out
        for (rn, st, _fz, en) in round_bounds:
            sub = df[(df[tick_col] >= st) & (df[tick_col] <= en)]
            out[rn] = sub
        return out

    deaths_by_round = in_round(deaths)
    hurts_by_round = in_round(hurts)
    blinds_by_round = in_round(blinds)
    purchases_by_round = in_round(purchases)
    bombs_by_round = in_round(bombs)
    fires_by_round = in_round(events.get("weapon_fire"))

    # Tick lookup helper
    def tick_value(tick, col, default=None):
        if ticks is None or len(ticks) == 0 or "tick" not in ticks.columns:
            return default
        sub = ticks[ticks["tick"] == tick]
        if len(sub) == 0:
            # nearest available tick
            sub = ticks[ticks["tick"] <= tick]
            if len(sub) == 0:
                return default
            sub = sub.iloc[-1:]
        v = sub.iloc[0].get(col, default)
        return v if v is not None else default

    # Build per-player tick index for fast O(log n) lookups
    # player_ticks: {steamid_int: DataFrame sorted by tick}
    player_ticks: dict = {}
    if all_ticks is not None and len(all_ticks) > 0:
        import pandas as pd
        for sid_val, grp in all_ticks.groupby("steamid"):
            try:
                # Avoid int(float(x)) — float64 can't represent large SteamIDs
                # exactly (e.g. ...013 → ...016). Use int() directly
                # on the numpy int64 scalar which preserves all 64 bits.
                sid_int = int(sid_val)
                if sid_int > 0:
                    player_ticks[sid_int] = grp.sort_values("tick").reset_index(drop=True)
            except Exception:
                pass

    # Player display names (for the all-player round stats table).
    player_names: dict = {}
    for _sid, _df in player_ticks.items():
        try:
            player_names[_sid] = str(_df.iloc[0].get("name", "") or "")
        except Exception:
            player_names[_sid] = ""

    def player_state_at(sid: int, tick: int) -> dict | None:
        """Return {x,y,alive,team,hp} for a player at the nearest tick <= given tick."""
        df = player_ticks.get(sid)
        if df is None or len(df) == 0:
            return None
        ticks_arr = df["tick"].values
        idx = int(ticks_arr.searchsorted(tick, side='right')) - 1
        if idx < 0:
            return None
        row = df.iloc[idx]
        tn = _i(row.get("team_num", 0), 0)
        return {
            "x": float(row.get("X", 0) or 0),
            "y": float(row.get("Y", 0) or 0),
            "z": float(row.get("Z", 0) or 0),
            "alive": bool(row.get("is_alive", False) or False),
            "team": "CT" if tn == SIDE_CT else "T",
            "hp": _i(row.get("health", 0), 0),
            "balance": _i(row.get("balance", 0), 0),
            "equip": _i(row.get("current_equip_value", 0), 0),
            "yaw": float(row.get("yaw", 0) or 0),
            "pitch": float(row.get("pitch", 0) or 0),
            "active_weapon": str(row.get("active_weapon_name", "") or ""),
        }

    def teams_at_tick(tick: int) -> dict:
        """Returns {steamid_int: "T"/"CT"} for all known players at tick."""
        result = {}
        for sid, df in player_ticks.items():
            st2 = player_state_at(sid, tick)
            if st2 and st2["team"] in ("T", "CT"):
                result[sid] = st2["team"]
        return result

    # ---- Per-round assembly ----
    player_rounds_rows = []
    round_player_stats_rows = []
    damage_events_rows = []
    kill_events_rows = []
    grenade_events_rows = []
    shot_events_rows = []

    for (rn, st, fz, en) in round_bounds:
        # team at freeze_end
        my_team = tick_value(fz, "team_num", None)
        if my_team not in (SIDE_T, SIDE_CT):
            # try at start
            my_team = tick_value(st, "team_num", None)
        if my_team == SIDE_T:
            side = "T"
        elif my_team == SIDE_CT:
            side = "CT"
        else:
            continue  # skip rounds where we cannot determine side

        # Team membership this round (sid -> "T"/"CT"), used for teammate- and
        # enemy-verified trade detection. teams_at_tick reads team_num from the
        # per-player ticks, so this reflects post-half side swaps correctly.
        round_teams = teams_at_tick(fz)
        my_team_sids = {sid for sid, t in round_teams.items()
                        if t == side and sid != STEAM_ID64}
        opp_team_sids = {sid for sid, t in round_teams.items() if t != side}

        # round result. demoparser2's `winner` is either a side string ('T'/'CT')
        # or the numeric team_num (2/3) depending on parser version — handle both.
        round_won = False
        if round_ends is not None:
            rend = round_ends[(round_ends["tick"] >= st) & (round_ends["tick"] <= en)]
            if len(rend) > 0:
                winner = rend.iloc[-1].get("winner", None)
                if winner is not None:
                    w = str(winner).strip()
                    if w in ("T", "CT"):
                        round_won = (w == side)
                    else:
                        try:
                            round_won = (int(w) == my_team)
                        except (ValueError, TypeError):
                            round_won = False

        d_round = deaths_by_round.get(rn)
        h_round = hurts_by_round.get(rn)
        b_round = blinds_by_round.get(rn)
        p_round = purchases_by_round.get(rn)
        bomb_round = bombs_by_round.get(rn)
        f_round = fires_by_round.get(rn)

        # All-player (team + enemy) per-round stats — derived from the same
        # death/hurt events, teammate-verified via round_teams.
        round_player_stats_rows.extend(
            _round_player_stats(rn, round_teams, d_round, h_round,
                                 tickrate, STEAM_ID64, player_names))

        # ---- shot_events: every weapon_fire by me this round ----
        # For gun shots also record speed at trigger time, position within the
        # burst, and whether the bullet connected (a hurt I dealt within 4 ticks).
        mine_f = None
        my_hurt_ticks = []   # ticks where I dealt non-grenade damage
        if h_round is not None and len(h_round) > 0:
            _acol = "attacker_steamid" if "attacker_steamid" in h_round.columns else "attacker_name"
            _mh = h_round[_id_match(h_round[_acol], STEAM_ID64)]
            for _, hrow in _mh.iterrows():
                hw = _norm_weapon(str(hrow.get("weapon", "") or ""))
                if hw not in NON_GUN_WEAPONS and "inferno" not in hw:
                    my_hurt_ticks.append(_i(hrow.get("tick", 0), 0))
        my_hurt_ticks.sort()

        my_gun_shots = []  # [(tick, weapon, burst_idx, speed, hit)]
        if f_round is not None and len(f_round) > 0:
            uid_f = ("user_steamid" if "user_steamid" in f_round.columns
                     else "user_name" if "user_name" in f_round.columns else None)
            if uid_f is not None:
                mine_f = f_round[_id_match(f_round[uid_f], STEAM_ID64)].sort_values("tick")
                prev_tick = None
                prev_weapon = None
                burst_idx = 0
                for _, frow in mine_f.iterrows():
                    w = _norm_weapon(str(frow.get("weapon", "") or ""))
                    t = _i(frow.get("tick", 0), 0)
                    is_gun = w not in NON_GUN_WEAPONS
                    speed = None
                    bidx = None
                    hit = None
                    if is_gun:
                        if (prev_tick is None or w != prev_weapon
                                or t - prev_tick > BURST_GAP_TICKS):
                            burst_idx = 1
                        else:
                            burst_idx += 1
                        bidx = burst_idx
                        prev_tick, prev_weapon = t, w
                        try:
                            vx = float(tick_value(t, "velocity_X", 0) or 0)
                            vy = float(tick_value(t, "velocity_Y", 0) or 0)
                            speed = (vx * vx + vy * vy) ** 0.5
                        except Exception:
                            speed = None
                        j = bisect.bisect_left(my_hurt_ticks, t)
                        hit = j < len(my_hurt_ticks) and my_hurt_ticks[j] <= t + 4
                        my_gun_shots.append((t, w, bidx, speed, hit))
                    shot_events_rows.append({
                        "round_num": rn,
                        "side": side,
                        "weapon": w,
                        "tick": t,
                        "speed": speed,
                        "burst_idx": bidx,
                        "hit": hit,
                    })

        # Combat
        kills = deaths_count = assists = headshots = 0
        damage_total = 0
        opening_kill = opening_death = False
        traded_death = traded_kill = False
        my_death_tick = None
        my_killer = None

        if d_round is not None and len(d_round) > 0:
            d_sorted = d_round.sort_values("tick").reset_index(drop=True)
            first = d_sorted.iloc[0]
            attacker_id_col = "attacker_steamid" if "attacker_steamid" in d_sorted.columns else "attacker_name"
            victim_id_col = "user_steamid" if "user_steamid" in d_sorted.columns else "user_name"
            try:
                if _i(first.get(attacker_id_col, 0), 0) == STEAM_ID64:
                    opening_kill = True
                if _i(first.get(victim_id_col, 0), 0) == STEAM_ID64:
                    opening_death = True
            except Exception:
                pass

            for _, row in d_sorted.iterrows():
                try:
                    att = _i(row.get(attacker_id_col, 0), 0)
                    vic = _i(row.get(victim_id_col, 0), 0)
                except Exception:
                    att = vic = 0
                ass = 0
                try:
                    ass = _i(row.get("assister_steamid", 0), 0)
                except Exception:
                    pass
                if att == STEAM_ID64:
                    kills += 1
                    if bool(row.get("headshot", False)):
                        headshots += 1
                if vic == STEAM_ID64:
                    deaths_count += 1
                    my_death_tick = _i(row.get("tick", 0), 0)
                    my_killer = att
                if ass == STEAM_ID64:
                    assists += 1

            # Trade detection (within TRADE_WINDOW). Now teammate-verified: we
            # know every player's team this round via round_teams, so a "trade"
            # requires the avenging/avenged kill to involve an actual teammate.
            TRADE_WINDOW = int(5.0 * tickrate)
            # traded_death: I died and a teammate (or I) killed my killer in window.
            if my_death_tick is not None and my_killer:
                follow = d_sorted[(d_sorted["tick"] > my_death_tick)
                                  & (d_sorted["tick"] <= my_death_tick + TRADE_WINDOW)]
                for _, frow in follow.iterrows():
                    try:
                        if _i(frow.get(victim_id_col, 0), 0) == my_killer:
                            avenger = _i(frow.get(attacker_id_col, 0), 0)
                            if avenger == STEAM_ID64 or avenger in my_team_sids:
                                traded_death = True
                                break
                    except Exception:
                        continue
            # traded_kill: a teammate died and I killed their killer within window.
            for _, drow in d_sorted.iterrows():
                try:
                    vic = _i(drow.get(victim_id_col, 0), 0)
                    if vic not in my_team_sids:  # teammates only (excludes me & enemies)
                        continue
                    killer_of_mate = _i(drow.get(attacker_id_col, 0), 0)
                    vt = _i(drow.get("tick", 0), 0)
                except Exception:
                    continue
                window = d_sorted[(d_sorted["tick"] > vt) & (d_sorted["tick"] <= vt + TRADE_WINDOW)]
                for _, krow in window.iterrows():
                    try:
                        if (_i(krow.get(attacker_id_col, 0), 0) == STEAM_ID64
                                and _i(krow.get(victim_id_col, 0), 0) == killer_of_mate):
                            traded_kill = True
                            break
                    except Exception:
                        continue
                if traded_kill:
                    break

        # Damage aggregation
        my_first_hurt_tick = None
        duel_entry_hp = None
        if h_round is not None and len(h_round) > 0:
            attacker_id_col = "attacker_steamid" if "attacker_steamid" in h_round.columns else "attacker_name"
            victim_id_col = "user_steamid" if "user_steamid" in h_round.columns else "user_name"
            h_sorted = h_round.sort_values("tick").reset_index(drop=True)
            for _, row in h_sorted.iterrows():
                try:
                    att = _i(row.get(attacker_id_col, 0), 0)
                except Exception:
                    att = 0
                if att == STEAM_ID64:
                    dmg = _i(row.get("dmg_health", row.get("damage", 0)), 0)
                    damage_total += dmg
                    if my_first_hurt_tick is None:
                        my_first_hurt_tick = _i(row.get("tick", 0), 0)
                        duel_entry_hp = _i(tick_value(my_first_hurt_tick, "health", 100), 100)

        # multikill (count of kills this round)
        multikill = kills

        survived = (my_death_tick is None)
        high_damage_no_kill = (damage_total >= 80 and kills == 0)

        # Death timing / phase
        death_tick_val = my_death_tick or 0
        round_len = max(en - st, 1)
        death_phase = None
        if my_death_tick is not None:
            offset = (my_death_tick - st) / round_len
            if offset < 1/3:
                death_phase = "early"
            elif offset < 2/3:
                death_phase = "mid"
            else:
                death_phase = "late"

        # avg_ttk_ms — per kill, ms from first hurt to player_death of that victim
        avg_ttk_ms = None
        if d_round is not None and h_round is not None and len(d_round) > 0:
            attacker_id_col_d = "attacker_steamid" if "attacker_steamid" in d_round.columns else "attacker_name"
            victim_id_col_d = "user_steamid" if "user_steamid" in d_round.columns else "user_name"
            attacker_id_col_h = "attacker_steamid" if "attacker_steamid" in h_round.columns else "attacker_name"
            victim_id_col_h = "user_steamid" if "user_steamid" in h_round.columns else "user_name"
            ttks = []
            my_kills = d_round[_id_match(d_round[attacker_id_col_d], STEAM_ID64)]
            for _, krow in my_kills.iterrows():
                try:
                    vic = _i(krow.get(victim_id_col_d, 0), 0)
                    death_t = _i(krow.get("tick", 0), 0)
                except Exception:
                    continue
                hurts_to_vic = h_round[
                    _id_match(h_round[attacker_id_col_h], STEAM_ID64)
                    & _id_match(h_round[victim_id_col_h], vic)
                    & (h_round["tick"] <= death_t)
                ]
                if len(hurts_to_vic) > 0:
                    first_hit = _i(hurts_to_vic.iloc[0]["tick"], 0)
                    ttks.append((death_t - first_hit) / tickrate * 1000.0)
            if ttks:
                avg_ttk_ms = sum(ttks) / len(ttks)

        # ---- Tier-1 mechanics: time-to-damage + crosshair placement ----
        # Engagement = consecutive hurts I deal to the same victim with <2s gaps.
        # ttd = ms from the start of the firing burst to the first hit;
        # crosshair_err = vertical angle (deg) between my aim and the victim's
        # head at burst start (positive = aiming too low).
        ttd_ms = None
        crosshair_err_deg = None
        if h_round is not None and len(h_round) > 0 and my_gun_shots:
            shot_ticks = [s[0] for s in my_gun_shots]
            attacker_id_col_h = "attacker_steamid" if "attacker_steamid" in h_round.columns else "attacker_name"
            victim_id_col_h = "user_steamid" if "user_steamid" in h_round.columns else "user_name"
            mine_h2 = h_round[_id_match(h_round[attacker_id_col_h], STEAM_ID64)].sort_values("tick")
            # first hurt tick of each engagement, keyed by victim
            engagements = []  # [(first_hurt_tick, victim_sid)]
            last_hurt_by_vic: dict = {}
            for _, hrow in mine_h2.iterrows():
                hw = _norm_weapon(str(hrow.get("weapon", "") or ""))
                if hw in NON_GUN_WEAPONS or "inferno" in hw:
                    continue
                try:
                    vic = _i(hrow.get(victim_id_col_h, 0), 0)
                except Exception:
                    continue
                ht = _i(hrow.get("tick", 0), 0)
                if vic not in last_hurt_by_vic or ht - last_hurt_by_vic[vic] > 128:
                    engagements.append((ht, vic))
                last_hurt_by_vic[vic] = ht

            ttds, errs = [], []
            for (ht, vic) in engagements:
                # walk back from the last shot at/before the hurt through the
                # contiguous burst to find when I started firing
                j = bisect.bisect_right(shot_ticks, ht) - 1
                if j < 0 or ht - shot_ticks[j] > 128:
                    continue
                while j > 0 and shot_ticks[j] - shot_ticks[j - 1] <= BURST_GAP_TICKS:
                    j -= 1
                t0 = shot_ticks[j]
                ttds.append((ht - t0) / tickrate * 1000.0)

                vic_st = player_state_at(vic, t0)
                if vic_st is None or not vic_st["alive"]:
                    continue
                try:
                    my_x = float(tick_value(t0, "X", None))
                    my_y = float(tick_value(t0, "Y", None))
                    my_z = float(tick_value(t0, "Z", None))
                    my_pitch = float(tick_value(t0, "pitch", None))
                except (TypeError, ValueError):
                    continue
                horiz = math.hypot(vic_st["x"] - my_x, vic_st["y"] - my_y)
                if horiz < 50:  # point-blank — angle is meaningless
                    continue
                # both Z values are origins; head ≈ origin + eye height for both,
                # so the offsets cancel. Source pitch: positive = looking down.
                needed_pitch = -math.degrees(math.atan2(vic_st["z"] - my_z, horiz))
                errs.append(my_pitch - needed_pitch)
            if ttds:
                ttd_ms = sum(ttds) / len(ttds)
            if errs:
                crosshair_err_deg = sum(errs) / len(errs)

        # ---- Tier-1 mechanics: death context ----
        death_blinded = False
        death_unused_util = None
        if my_death_tick is not None:
            if b_round is not None and len(b_round) > 0:
                vcol_b = "user_steamid" if "user_steamid" in b_round.columns else "user_name"
                mine_blind = b_round[_id_match(b_round[vcol_b], STEAM_ID64)]
                for _, brow in mine_blind.iterrows():
                    bt = _i(brow.get("tick", 0), 0)
                    dur = float(brow.get("blind_duration", 0) or 0)
                    if bt <= my_death_tick <= bt + int(dur * tickrate):
                        death_blinded = True
                        break
            # grenades still in my inventory at the moment of death (exact —
            # parse_events attaches user_inventory to the death event)
            if d_round is not None and len(d_round) > 0:
                vcol_d = "user_steamid" if "user_steamid" in d_round.columns else "user_name"
                my_deaths_df = d_round[_id_match(d_round[vcol_d], STEAM_ID64)]
                if len(my_deaths_df) > 0 and "user_inventory" in my_deaths_df.columns:
                    inv = my_deaths_df.iloc[0].get("user_inventory")
                    try:
                        death_unused_util = sum(
                            1 for item in (inv if inv is not None else [])
                            if any(k in str(item).lower() for k in
                                   ("flash", "smoke", "molotov", "incendiary",
                                    "grenade", "decoy")))
                    except TypeError:
                        death_unused_util = None

        # Economy
        money_start_raw = tick_value(fz, "balance", None)
        equip_value_raw = tick_value(fz, "current_equip_value", None)
        money_start = _i(money_start_raw, None) if money_start_raw is not None else None
        equip_value = _i(equip_value_raw, None) if equip_value_raw is not None else None

        # Spent: my balance at fz minus my balance at end (rough)
        my_balance_end = tick_value(en, "balance", money_start)
        try:
            spent = max((money_start or 0) - _i(my_balance_end, 0), 0)
        except Exception:
            spent = 0

        if spent == 0:
            buy_type = "eco"
        elif spent < 1000:
            buy_type = "semi"
        elif spent < 3500:
            buy_type = "force"
        else:
            buy_type = "full"

        weapon_purchased = None
        PRIMARY_PRIORITY = {"awp": 5, "ak47": 4, "m4a1": 4, "m4a4": 4,
                            "ssg08": 3, "aug": 4, "sg556": 4, "usp_s": 3}
        if p_round is not None and len(p_round) > 0:
            mine = _filter_me(p_round, "user_steamid" if "user_steamid" in p_round.columns
                              else ("steamid" if "steamid" in p_round.columns else "user_name"))
            best_score = -1
            for _, prow in mine.iterrows() if mine is not None else []:
                w = _norm_weapon(str(prow.get("item", prow.get("weapon", ""))).lower())
                score = PRIMARY_PRIORITY.get(w, 1 if w else 0)
                if score > best_score:
                    best_score = score
                    weapon_purchased = w

        saved_weapon = survived and (not round_won) and (equip_value or 0) >= 1500
        lost_kit_on_eco = (buy_type in ("eco", "semi")) and (not survived) and (equip_value or 0) >= 2700

        # Utility
        util_thrown = 0
        util_damage = 0
        flash_assists = 0
        team_flashes = 0
        first_util_tick = None
        for ev_name, gtype in GRENADE_EVENT_TO_TYPE.items():
            df = events.get(ev_name)
            if df is None or len(df) == 0:
                continue
            sub = df[(df["tick"] >= st) & (df["tick"] <= en)]
            uid = "user_steamid" if "user_steamid" in sub.columns else ("thrower_steamid" if "thrower_steamid" in sub.columns else None)
            if uid is None:
                continue
            mine = sub[_id_match(sub[uid], STEAM_ID64)]
            util_thrown += len(mine)
            for _, grow in mine.iterrows():
                tt = _i(grow.get("tick", 0), 0)
                if first_util_tick is None or tt < first_util_tick:
                    first_util_tick = tt

        # Util damage from player_hurt with grenade weapons
        if h_round is not None and len(h_round) > 0:
            grenade_weapons = {"hegrenade", "inferno", "molotov", "incgrenade"}
            attacker_id_col_h = "attacker_steamid" if "attacker_steamid" in h_round.columns else "attacker_name"
            mine_h = h_round[_id_match(h_round[attacker_id_col_h], STEAM_ID64)]
            for _, row in mine_h.iterrows():
                w = str(row.get("weapon", "")).lower()
                if any(g in w for g in grenade_weapons):
                    util_damage += _i(row.get("dmg_health", row.get("damage", 0)), 0)

        # team_flashes: flashbang I threw that blinded a teammate
        if b_round is not None and len(b_round) > 0:
            attacker_id_col_b = "attacker_steamid" if "attacker_steamid" in b_round.columns else "attacker_name"
            victim_id_col_b = "user_steamid" if "user_steamid" in b_round.columns else "user_name"
            mine_b = b_round[_id_match(b_round[attacker_id_col_b], STEAM_ID64)]
            round_teams = teams_at_tick(fz)
            my_team_str = side  # "T" or "CT"
            for _, row in mine_b.iterrows():
                vic_id = _i(row.get(victim_id_col_b, 0), 0)
                if vic_id == STEAM_ID64 or vic_id == 0:
                    continue
                # Use proper team lookup; fall back to friendly_fire flag if not available
                vic_team = round_teams.get(vic_id)
                if vic_team is not None:
                    if vic_team == my_team_str:
                        team_flashes += 1
                elif row.get("friendly_fire", False) is True:
                    team_flashes += 1

        # util_timing
        util_timing = None
        if first_util_tick is not None and round_len > 0:
            offset = (first_util_tick - st) / round_len
            if offset < 1/3:
                util_timing = "early"
            elif offset < 2/3:
                util_timing = "mid"
            else:
                util_timing = "late"

        spawn_x = tick_value(fz, "X", None)
        spawn_y = tick_value(fz, "Y", None)
        try:
            spawn_x = float(spawn_x) if spawn_x is not None else None
            spawn_y = float(spawn_y) if spawn_y is not None else None
        except Exception:
            spawn_x, spawn_y = None, None

        # Clutch detection — proper: find the moment I became sole survivor
        was_clutch = False
        clutch_vs = 0
        clutch_won = False

        round_teams = teams_at_tick(fz)
        my_team_str = side
        opp_team_str = "CT" if side == "T" else "T"

        my_team_sids = {sid for sid, t in round_teams.items() if t == my_team_str}
        opp_team_sids = {sid for sid, t in round_teams.items() if t == opp_team_str}

        if d_round is not None and len(d_round) > 0 and my_team_sids and opp_team_sids:
            my_dead: set = set()
            opp_dead: set = set()
            attacker_id_col_c = "attacker_steamid" if "attacker_steamid" in d_round.columns else "attacker_name"
            victim_id_col_c = "user_steamid" if "user_steamid" in d_round.columns else "user_name"

            for _, drow in d_round.sort_values("tick").iterrows():
                vic = _i(drow.get(victim_id_col_c, 0), 0)
                if vic in my_team_sids:
                    my_dead.add(vic)
                    my_alive_now = my_team_sids - my_dead
                    opp_alive_now = opp_team_sids - opp_dead
                    # Clutch: I am the only one left on my team with enemies still alive
                    if STEAM_ID64 in my_alive_now and len(my_alive_now) == 1 and len(opp_alive_now) >= 1:
                        was_clutch = True
                        clutch_vs = len(opp_alive_now)
                        # clutch_won is set after we know round_won
                elif vic in opp_team_sids:
                    opp_dead.add(vic)

        if was_clutch:
            clutch_won = round_won

        # Bomb planted
        planted_bomb = False
        if bomb_round is not None and len(bomb_round) > 0:
            uid = "user_steamid" if "user_steamid" in bomb_round.columns else "user_name"
            mine_bp = bomb_round[_id_match(bomb_round[uid], STEAM_ID64)]
            planted_bomb = len(mine_bp) > 0

        player_rounds_rows.append({
            "round_num": rn,
            "side": side,
            "round_won": round_won,
            "kills": kills,
            "deaths": deaths_count,
            "assists": assists,
            "damage": damage_total,
            "headshots": headshots,
            "multikill": multikill,
            "opening_kill": opening_kill,
            "opening_death": opening_death,
            "traded_death": traded_death,
            "traded_kill": traded_kill,
            "survived": survived,
            "high_damage_no_kill": high_damage_no_kill,
            "money_start": money_start,
            "equip_value": equip_value,
            "spent": spent,
            "buy_type": buy_type,
            "weapon_purchased": weapon_purchased,
            "saved_weapon": saved_weapon,
            "lost_kit_on_eco": lost_kit_on_eco,
            "util_thrown": util_thrown,
            "util_wasted": 0,  # computed post-insert via grenade_events
            "util_damage": util_damage,
            "util_timing": util_timing,
            "flash_assists": flash_assists,
            "team_flashes": team_flashes,
            "spawn_x": spawn_x,
            "spawn_y": spawn_y,
            "death_tick": death_tick_val,
            "death_phase": death_phase,
            "avg_ttk_ms": avg_ttk_ms,
            "duel_entry_hp": duel_entry_hp,
            "ttd_ms": ttd_ms,
            "crosshair_err_deg": crosshair_err_deg,
            "death_blinded": death_blinded,
            "death_unused_util": death_unused_util,
            "was_clutch": was_clutch,
            "clutch_vs": clutch_vs,
            "clutch_won": clutch_won,
            "planted_bomb": planted_bomb,
        })

        # ---- damage_events (player_hurt where I am attacker or victim) ----
        if h_round is not None and len(h_round) > 0:
            attacker_id_col_h = "attacker_steamid" if "attacker_steamid" in h_round.columns else "attacker_name"
            victim_id_col_h = "user_steamid" if "user_steamid" in h_round.columns else "user_name"
            for _, row in h_round.iterrows():
                try:
                    att = _i(row.get(attacker_id_col_h, 0), 0)
                    vic = _i(row.get(victim_id_col_h, 0), 0)
                except Exception:
                    continue
                if STEAM_ID64 not in (att, vic):
                    continue
                attacker_is_you = (att == STEAM_ID64)
                weapon = _norm_weapon(str(row.get("weapon", "") or ""))
                hitgroup = _to_hitgroup(row.get("hitgroup", 0))
                damage_dealt = _i(row.get("dmg_health", row.get("damage", 0)), 0)
                victim_hp_after = _i(row.get("health", 0), 0)
                victim_hp_before = victim_hp_after + damage_dealt
                victim_died = victim_hp_after <= 0
                attacker_hp = None
                if attacker_is_you:
                    attacker_hp = _i(tick_value(_i(row.get("tick", 0), 0), "health", 100), 100)
                # moving check (attacker only)
                moving = False
                if attacker_is_you:
                    vx = tick_value(_i(row.get("tick", 0), 0), "velocity_X", 0) or 0
                    vy = tick_value(_i(row.get("tick", 0), 0), "velocity_Y", 0) or 0
                    try:
                        speed = (float(vx) ** 2 + float(vy) ** 2) ** 0.5
                        moving = speed > 10
                    except Exception:
                        moving = False
                damage_events_rows.append({
                    "round_num": rn,
                    "side": side,
                    "tick": _i(row.get("tick", 0), 0),
                    "attacker_is_you": attacker_is_you,
                    "weapon": weapon,
                    "hitgroup": hitgroup,
                    "damage_dealt": damage_dealt,
                    "victim_died": victim_died,
                    "attacker_hp": attacker_hp,
                    "victim_hp_before": victim_hp_before,
                    "moving_on_first_shot": moving,
                })

        # ---- kill_events ----
        if d_round is not None and len(d_round) > 0:
            attacker_id_col_d = "attacker_steamid" if "attacker_steamid" in d_round.columns else "attacker_name"
            victim_id_col_d = "user_steamid" if "user_steamid" in d_round.columns else "user_name"
            for _, row in d_round.iterrows():
                try:
                    att = _i(row.get(attacker_id_col_d, 0), 0)
                    vic = _i(row.get(victim_id_col_d, 0), 0)
                except Exception:
                    continue
                if STEAM_ID64 not in (att, vic):
                    continue
                is_victim = (vic == STEAM_ID64)
                tick_n = _i(row.get("tick", 0), 0)
                # positions
                if is_victim:
                    vx = tick_value(tick_n, "X")
                    vy = tick_value(tick_n, "Y")
                    vz = tick_value(tick_n, "Z")
                    ax = ay = az = None
                else:
                    ax = tick_value(tick_n, "X")
                    ay = tick_value(tick_n, "Y")
                    az = tick_value(tick_n, "Z")
                    vx = row.get("user_X", None)
                    vy = row.get("user_Y", None)
                    vz = row.get("user_Z", None)
                kill_events_rows.append({
                    "round_num": rn,
                    "side": side,
                    "is_victim": is_victim,
                    "tick": tick_n,
                    "attacker_x": _f(ax),
                    "attacker_y": _f(ay),
                    "attacker_z": _f(az),
                    "victim_x": _f(vx),
                    "victim_y": _f(vy),
                    "victim_z": _f(vz),
                    "weapon": _norm_weapon(str(row.get("weapon", "") or "")),
                    "was_blind": bool(row.get("attackerblind", row.get("victim_blind", False)) or False),
                    "through_smoke": bool(row.get("thrusmoke", row.get("through_smoke", False)) or False),
                    "headshot": bool(row.get("headshot", False) or False),
                    "victim_hp_remaining": 0,
                })

        # ---- grenade_events ----
        for ev_name, gtype in GRENADE_EVENT_TO_TYPE.items():
            df = events.get(ev_name)
            if df is None or len(df) == 0:
                continue
            sub = df[(df["tick"] >= st) & (df["tick"] <= en)]
            uid = "user_steamid" if "user_steamid" in sub.columns else ("thrower_steamid" if "thrower_steamid" in sub.columns else None)
            if uid is None:
                continue
            mine = sub[_id_match(sub[uid], STEAM_ID64)]
            for _, grow in mine.iterrows():
                t_tick = _i(grow.get("tick", 0), 0)
                land_x = grow.get("x", None)
                land_y = grow.get("y", None)
                land_z = grow.get("z", None)
                throw_x = tick_value(t_tick - 32, "X")
                throw_y = tick_value(t_tick - 32, "Y")
                throw_z = tick_value(t_tick - 32, "Z")

                # flashes from this throw
                enemies_flashed = 0
                teammates_flashed = 0
                if gtype == "flash" and b_round is not None and len(b_round) > 0:
                    attacker_id_col_b = "attacker_steamid" if "attacker_steamid" in b_round.columns else "attacker_name"
                    window = b_round[(b_round["tick"] >= t_tick) & (b_round["tick"] <= t_tick + 192)]
                    window = window[_id_match(window[attacker_id_col_b], STEAM_ID64)]
                    for _, brow in window.iterrows():
                        if brow.get("friendly_fire", False) is True:
                            teammates_flashed += 1
                        else:
                            enemies_flashed += 1

                # damage from this grenade
                dmg = 0
                if gtype in ("he", "molotov") and h_round is not None and len(h_round) > 0:
                    attacker_id_col_h = "attacker_steamid" if "attacker_steamid" in h_round.columns else "attacker_name"
                    window = h_round[
                        _id_match(h_round[attacker_id_col_h], STEAM_ID64)
                        & (h_round["tick"] >= t_tick - tickrate)
                        & (h_round["tick"] <= t_tick + int(5.0 * tickrate))
                    ]
                    for _, row in window.iterrows():
                        w = str(row.get("weapon", "")).lower()
                        if gtype == "he" and "hegrenade" in w:
                            dmg += _i(row.get("dmg_health", row.get("damage", 0)), 0)
                        elif gtype == "molotov" and ("inferno" in w or "molotov" in w or "incgrenade" in w):
                            dmg += _i(row.get("dmg_health", row.get("damage", 0)), 0)

                had_effect = (enemies_flashed > 0) or (dmg > 0) or (gtype == "smoke")

                grenade_events_rows.append({
                    "round_num": rn,
                    "side": side,
                    "grenade_type": gtype,
                    "throw_x": _f(throw_x),
                    "throw_y": _f(throw_y),
                    "throw_z": _f(throw_z),
                    "land_x": _f(land_x),
                    "land_y": _f(land_y),
                    "land_z": _f(land_z),
                    "throw_tick": t_tick - 32,
                    "detonation_tick": t_tick,
                    "teammates_flashed": teammates_flashed,
                    "enemies_flashed": enemies_flashed,
                    "damage_dealt": dmg,
                    "had_effect": had_effect,
                })

    # Derive scores from per-round results; round_end in CS2 demos only
    # carries the winning side, not numeric scores. team_score = rounds my
    # team won; opp_score = remainder.
    team_score = sum(1 for r in player_rounds_rows if r.get("round_won"))
    opp_score = max(rounds_total - team_score, 0) if rounds_total else (
        sum(1 for r in player_rounds_rows if r.get("round_won") is False))
    won = team_score > opp_score
    played_at = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)

    # Build replay data per round
    replay_rows = []
    for (rn, st, fz, en) in round_bounds:
        # only if we have player_ticks data
        if not player_ticks:
            break
        # find which round's data we have
        rt = teams_at_tick(fz)
        if not rt:
            continue
        # get the side for this round (from player_rounds_rows)
        pr = next((r for r in player_rounds_rows if r["round_num"] == rn), None)
        if pr is None:
            continue
        b_round = blinds_by_round.get(rn)
        replay_data = _extract_round_replay(
            rn, st, fz, en, player_ticks,
            kill_events_rows, grenade_events_rows, damage_events_rows,
            pr["side"], rt, player_state_at,
            blind_rows=b_round,
        )
        replay_rows.append({"round_num": rn, "data": replay_data})

    return {
        "map": map_name,
        "played_at": played_at,
        "rounds_total": rounds_total,
        "team_score": team_score,
        "opp_score": opp_score,
        "won": won,
        "demo_filename": path.name,
        "player_rounds": player_rounds_rows,
        "round_player_stats": round_player_stats_rows,
        "damage_events": damage_events_rows,
        "kill_events": kill_events_rows,
        "grenade_events": grenade_events_rows,
        "shot_events": shot_events_rows,
        "replay_rows": replay_rows,
    }


def _f(v):
    try:
        return float(v) if v is not None else None
    except Exception:
        return None


_REPLAY_SAMPLE_TICKS = 8   # sample every 8 ticks (~8fps at 64Hz)

def _extract_round_replay(rn, st, fz, en, player_ticks, kill_rows, grenade_rows, dmg_rows, my_side, round_teams, player_state_at_fn, blind_rows=None):
    """Build compact replay JSONB for one round."""
    import json as _json

    # Player manifest: {str(sid): {"team": "CT"/"T", "is_me": bool, "name": str}}
    players = {}
    for sid, team in round_teams.items():
        pt = player_ticks.get(sid)
        try:
            nm = str(pt.iloc[0].get("name", "") or "") if pt is not None and len(pt) > 0 else ""
        except Exception:
            nm = ""
        players[str(sid)] = {"team": team, "is_me": sid == STEAM_ID64, "name": nm}

    # Sample frames: every REPLAY_SAMPLE_TICKS from freeze_end to round_end
    frames = []
    t = fz
    while t <= en + _REPLAY_SAMPLE_TICKS:
        player_states = {}
        for sid in round_teams:
            st2 = player_state_at_fn(sid, t)
            if st2:
                player_states[str(sid)] = [
                    round(st2["x"], 1),
                    round(st2["y"], 1),
                    1 if st2["alive"] else 0,
                    st2["hp"],
                    st2.get("balance", 0),      # index 4
                    st2.get("equip", 0),         # index 5
                    round(st2.get("yaw", 0), 1), # index 6
                    st2.get("active_weapon", ""),# index 7
                ]
        frames.append([t, player_states])
        t += _REPLAY_SAMPLE_TICKS

    # Events from already-collected kill/grenade rows for this round
    events = []
    for r in kill_rows:
        if r.get("round_num") != rn:
            continue
        e = {"t_type": "kill", "hs": r.get("headshot", False),
             "w": r.get("weapon", ""), "iv": r.get("is_victim", False),
             "tick": r.get("tick", 0)}
        if r.get("is_victim"):
            e["x"] = r.get("victim_x")
            e["y"] = r.get("victim_y")
        else:
            e["x"] = r.get("attacker_x")
            e["y"] = r.get("attacker_y")
        events.append(e)

    for r in grenade_rows:
        if r.get("round_num") != rn:
            continue
        events.append({
            "t_type": "nade",
            "gt": r.get("grenade_type", ""),
            "tx": r.get("throw_x"), "ty": r.get("throw_y"),
            "lx": r.get("land_x"), "ly": r.get("land_y"),
            "tick": r.get("detonation_tick", 0),
        })

    for r in dmg_rows:
        if r.get("round_num") != rn:
            continue
        events.append({
            "t_type": "dmg",
            "tick": r.get("tick", 0),
            "hg":   r.get("hitgroup", 0),
            "you":  bool(r.get("attacker_is_you", False)),
            "w":    r.get("weapon", ""),
            "died": bool(r.get("victim_died", False)),
            "dmg":  r.get("damage_dealt", 0),
        })

    # Blind events — per-player flash duration for replay overlay
    if blind_rows is not None and len(blind_rows) > 0:
        victim_col = "user_steamid" if "user_steamid" in blind_rows.columns else "user_name"
        for _, r in blind_rows.iterrows():
            dur = r.get("blind_duration", r.get("duration", 0)) or 0
            try:
                dur = float(dur)
            except (TypeError, ValueError):
                dur = 0.0
            if dur < 0.1:
                continue
            vic = r.get(victim_col, 0)
            try:
                vic_sid = str(int(float(vic))) if vic else ""
            except (TypeError, ValueError):
                vic_sid = str(vic) if vic else ""
            if not vic_sid:
                continue
            events.append({
                "t_type": "blind",
                "tick":   int(r.get("tick", 0) or 0),
                "sid":    vic_sid,
                "dur":    round(dur, 3),
            })

    return {
        "start_tick": st,
        "freeze_tick": fz,
        "end_tick": en,
        "sample_rate": _REPLAY_SAMPLE_TICKS,
        "players": players,
        "frames": frames,
        "events": events,
    }


# ----------------------------------------------------------------------------
# DB write
# ----------------------------------------------------------------------------
def write_match(conn, matchid: int, sharecode: str, parsed: dict,
                platform: str = 'mm', faceit_match_id: str = None):
    with conn:
        with conn.cursor() as c:
            c.execute(
                "INSERT INTO matches "
                "(match_id, sharecode, map, played_at, rounds_total, team_score, "
                " opp_score, won, demo_filename, platform) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                "ON CONFLICT (match_id) DO NOTHING",
                (matchid, sharecode, parsed["map"], parsed["played_at"],
                 parsed["rounds_total"], parsed["team_score"], parsed["opp_score"],
                 parsed["won"], parsed["demo_filename"], platform),
            )

            pr_cols = ["match_id","round_num","side","round_won","kills","deaths",
                       "assists","damage","headshots","multikill","opening_kill",
                       "opening_death","traded_death","traded_kill","survived",
                       "high_damage_no_kill","money_start","equip_value","spent",
                       "buy_type","weapon_purchased","saved_weapon","lost_kit_on_eco",
                       "util_thrown","util_wasted","util_damage","util_timing",
                       "flash_assists","team_flashes","spawn_x","spawn_y",
                       "death_tick","death_phase","avg_ttk_ms","duel_entry_hp",
                       "ttd_ms","crosshair_err_deg","death_blinded","death_unused_util",
                       "was_clutch","clutch_vs","clutch_won","planted_bomb"]
            pr_rows = [tuple([matchid] + [r.get(col) for col in pr_cols[1:]])
                       for r in parsed["player_rounds"]]
            if pr_rows:
                # Upsert: keep stable fields on conflict, update computed heuristics
                # so re-parsing a demo refreshes clutch/trade/flash without
                # manually clearing rows.
                update_cols = [
                    "was_clutch","clutch_vs","clutch_won",
                    "team_flashes","traded_kill","traded_death",
                    "opening_kill","opening_death",
                    "kills","deaths","assists","damage","headshots","multikill",
                    "survived","high_damage_no_kill","avg_ttk_ms","duel_entry_hp",
                    "ttd_ms","crosshair_err_deg","death_blinded","death_unused_util",
                    "spawn_x","spawn_y","death_tick","death_phase",
                    "util_thrown","util_wasted","util_damage","util_timing",
                    "flash_assists","money_start","equip_value","spent",
                    "buy_type","weapon_purchased","saved_weapon","lost_kit_on_eco",
                    "planted_bomb",
                ]
                set_clause = ", ".join(f"{col}=excluded.{col}" for col in update_cols)
                psycopg2.extras.execute_values(
                    c,
                    f"INSERT INTO player_rounds ({','.join(pr_cols)}) VALUES %s "
                    f"ON CONFLICT (match_id, round_num) DO UPDATE SET {set_clause}",
                    pr_rows,
                )

            # All-player round stats (team + enemy). Delete-before-insert so a
            # re-parse refreshes cleanly.
            c.execute("DELETE FROM round_player_stats WHERE match_id=%s", (matchid,))
            rps_cols = ["match_id", "round_num", "steamid", "name", "side", "is_me",
                        "kills", "deaths", "assists", "damage", "headshots",
                        "opening_kill", "opening_death", "traded_kill", "traded_death",
                        "survived", "util_damage", "flash_assists"]
            rps_rows = [tuple([matchid] + [r.get(col) for col in rps_cols[1:]])
                        for r in parsed.get("round_player_stats", [])]
            if rps_rows:
                psycopg2.extras.execute_values(
                    c,
                    f"INSERT INTO round_player_stats ({','.join(rps_cols)}) VALUES %s",
                    rps_rows,
                )

            # For event tables: delete existing rows for this match before
            # re-inserting, so re-parses don't accumulate duplicates.
            c.execute("DELETE FROM damage_events  WHERE match_id=%s", (matchid,))
            c.execute("DELETE FROM kill_events    WHERE match_id=%s", (matchid,))
            c.execute("DELETE FROM grenade_events WHERE match_id=%s", (matchid,))
            c.execute("DELETE FROM shot_events    WHERE match_id=%s", (matchid,))

            de_cols = ["match_id","round_num","side","tick","attacker_is_you","weapon",
                       "hitgroup","damage_dealt","victim_died","attacker_hp",
                       "victim_hp_before","moving_on_first_shot"]
            de_rows = [tuple([matchid] + [r.get(col) for col in de_cols[1:]])
                       for r in parsed["damage_events"]]
            if de_rows:
                psycopg2.extras.execute_values(
                    c,
                    f"INSERT INTO damage_events ({','.join(de_cols)}) VALUES %s",
                    de_rows,
                )

            ke_cols = ["match_id","round_num","side","is_victim","attacker_x",
                       "attacker_y","attacker_z","victim_x","victim_y","victim_z",
                       "weapon","was_blind","through_smoke","headshot",
                       "victim_hp_remaining"]
            ke_rows = [tuple([matchid] + [r.get(col) for col in ke_cols[1:]])
                       for r in parsed["kill_events"]]
            if ke_rows:
                psycopg2.extras.execute_values(
                    c,
                    f"INSERT INTO kill_events ({','.join(ke_cols)}) VALUES %s",
                    ke_rows,
                )

            ge_cols = ["match_id","round_num","side","grenade_type","throw_x",
                       "throw_y","throw_z","land_x","land_y","land_z","throw_tick",
                       "detonation_tick","teammates_flashed","enemies_flashed",
                       "damage_dealt","had_effect"]
            ge_rows = [tuple([matchid] + [r.get(col) for col in ge_cols[1:]])
                       for r in parsed["grenade_events"]]
            if ge_rows:
                psycopg2.extras.execute_values(
                    c,
                    f"INSERT INTO grenade_events ({','.join(ge_cols)}) VALUES %s",
                    ge_rows,
                )

            se_cols = ["match_id", "round_num", "side", "weapon", "tick",
                       "speed", "burst_idx", "hit"]
            se_rows = [tuple([matchid] + [r.get(col) for col in se_cols[1:]])
                       for r in parsed["shot_events"]]
            if se_rows:
                psycopg2.extras.execute_values(
                    c,
                    f"INSERT INTO shot_events ({','.join(se_cols)}) VALUES %s",
                    se_rows,
                )

            # Post-insert util_wasted = grenades thrown with had_effect=FALSE
            c.execute(
                "UPDATE player_rounds pr SET util_wasted = sub.wasted "
                "FROM (SELECT round_num, COUNT(*) FILTER (WHERE NOT had_effect) AS wasted "
                "      FROM grenade_events WHERE match_id=%s GROUP BY round_num) sub "
                "WHERE pr.match_id=%s AND pr.round_num=sub.round_num",
                (matchid, matchid),
            )

            rr_rows = parsed.get("replay_rows", [])
            if rr_rows:
                psycopg2.extras.execute_values(
                    c,
                    "INSERT INTO round_replays (match_id, round_num, data) VALUES %s "
                    "ON CONFLICT (match_id, round_num) DO UPDATE SET data = EXCLUDED.data",
                    [(matchid, r["round_num"], psycopg2.extras.Json(r["data"])) for r in rr_rows],
                )


# ----------------------------------------------------------------------------
# FACEIT demo processing
# ----------------------------------------------------------------------------

def faceit_numeric_id(faceit_match_id: str) -> int:
    """Derive a stable uint64-range numeric ID from a FACEIT UUID.
    Uses SHA-256 mod 10^15 to stay well below CS2 match IDs (~3e18)."""
    return int.from_bytes(
        hashlib.sha256(faceit_match_id.encode()).digest()[:8], 'big'
    ) % (10 ** 15)


def get_pending_faceit_demos(conn):
    """Return FACEIT matches that have a demo_url and haven't been successfully parsed.
    Retries up to 3 times so transient network failures don't permanently block a match.
    No LIMIT: the whole queue is scanned so manual demo drops anywhere in the
    backlog are found; API downloads are capped per cycle in process_faceit_demos."""
    with conn.cursor() as c:
        c.execute("""
            SELECT faceit_match_id, demo_url, map, played_at, demo_parse_attempts
            FROM faceit_matches
            WHERE demo_url IS NOT NULL
              AND (demo_parsed IS NULL OR demo_parsed = FALSE)
              AND COALESCE(demo_parse_attempts, 0) < 3
            ORDER BY played_at DESC NULLS LAST
        """)
        return c.fetchall()


def mark_faceit_demo_done(conn, faceit_id: str, numeric_id: int):
    with conn.cursor() as c:
        c.execute(
            "UPDATE faceit_matches "
            "SET demo_parsed=TRUE, cs2owl_match_id=%s, demo_parse_error=NULL "
            "WHERE faceit_match_id=%s",
            (numeric_id, faceit_id),
        )
    conn.commit()


def mark_faceit_demo_failed(conn, faceit_id: str, err):
    with conn.cursor() as c:
        c.execute(
            "UPDATE faceit_matches "
            "SET demo_parse_error=%s, demo_parse_attempts=COALESCE(demo_parse_attempts,0)+1 "
            "WHERE faceit_match_id=%s",
            (str(err)[:500], faceit_id),
        )
    conn.commit()


def process_faceit_demos(conn):
    pending = get_pending_faceit_demos(conn)
    if not pending:
        return
    log(f"FACEIT demo queue: {len(pending)} match(es)")
    downloads_this_cycle = 0
    scope_blocked = False
    for row in pending:
        faceit_id = row[0]
        demo_url  = row[1]
        map_name  = row[2]
        played_at = row[3]  # actual match time from FACEIT API
        attempts  = row[4] or 0

        numeric_id = faceit_numeric_id(faceit_id)

        # Already written (e.g. restarted mid-flight) — just mark done
        with conn.cursor() as c:
            c.execute("SELECT 1 FROM matches WHERE match_id=%s", (numeric_id,))
            if c.fetchone():
                mark_faceit_demo_done(conn, faceit_id, numeric_id)
                log(f"FACEIT {faceit_id}: already in matches, marking done")
                continue

        try:
            demo_path = existing_demo_path(numeric_id)
            if demo_path is None:
                demo_path = find_manual_faceit_demo(faceit_id, numeric_id)
                if demo_path is not None:
                    log(f"FACEIT manual demo drop found: {demo_path.name}")
            if demo_path is None:
                # API download — capped per cycle, skipped while key lacks scope
                if scope_blocked or downloads_this_cycle >= 3:
                    continue
                log(f"FACEIT {faceit_id[:8]}… attempt {attempts+1}/3")
                downloads_this_cycle += 1
                signed = faceit_signed_url(demo_url)
                demo_path = download_demo(signed, numeric_id)
                log(f"FACEIT demo downloaded: {demo_path.name}")
            else:
                log(f"FACEIT demo cache hit: {demo_path.name}")

            parsed = parse_demo(demo_path)

            # Use the FACEIT API's known map name when the demo header is wrong/missing
            if map_name and map_name not in ("unknown", ""):
                parsed["map"] = map_name

            # Use the actual match time instead of demo file mtime
            if played_at is not None:
                parsed["played_at"] = played_at

            write_match(conn, numeric_id, None, parsed,
                        platform="faceit", faceit_match_id=faceit_id)
            mark_faceit_demo_done(conn, faceit_id, numeric_id)
            log(f"FACEIT {faceit_id}: parsed {parsed['rounds_total']} rounds, "
                f"{parsed['team_score']}-{parsed['opp_score']}, won={parsed['won']}")
        except Exception as e:
            err_str = str(e)
            # API key misconfigured (missing 'downloads' scope) — a config
            # problem, not a demo problem. Log loudly, don't burn an attempt,
            # and stop the queue for this cycle.
            if "scope" in err_str.lower() or "FACEIT_API_KEY not set" in err_str:
                log(f"FACEIT {faceit_id}: download API auth problem — {err_str}")
                log("FACEIT demo downloads need a key with the 'downloads' scope "
                    "(apply: https://fce.gg/downloads-api-application). "
                    "Still checking for manual demo drops in /demos.")
                scope_blocked = True
                continue
            # CDN unreachable — count the attempt so we stop after 3 total.
            # Keep the URL; the poller only re-fetches when url IS NULL AND attempts < 3.
            if any(k in err_str for k in ('NameResolutionError', 'ConnectionError',
                                           'Failed to resolve', 'No address associated',
                                           'RemoteDisconnected', 'HTTPSConnectionPool')):
                with conn.cursor() as c:
                    c.execute("""UPDATE faceit_matches
                                 SET demo_parse_attempts=COALESCE(demo_parse_attempts,0)+1,
                                     demo_parse_error=%s
                                 WHERE faceit_match_id=%s""",
                              (f"CDN unreachable: {err_str[:200]}", faceit_id))
                conn.commit()
                log(f"FACEIT {faceit_id}: CDN unreachable (attempt {attempts+1}/3)")
            else:
                traceback.print_exc()
                log(f"FACEIT {faceit_id}: parse failed — {e}")
                mark_faceit_demo_failed(conn, faceit_id, e)


# ----------------------------------------------------------------------------
# Main loop
# ----------------------------------------------------------------------------
def notify_discord(conn, matchid: int, parsed: dict):
    """Post a match summary to Discord. Silently no-ops if webhook URL not set."""
    if not DISCORD_WEBHOOK:
        return
    try:
        with conn.cursor() as c:
            c.execute("""
                SELECT SUM(kills) AS k, SUM(deaths) AS d,
                       ROUND(AVG(damage)) AS adr,
                       ROUND(100.0*SUM(headshots)/NULLIF(SUM(kills),0)) AS hs,
                       SUM(CASE WHEN opening_kill THEN 1 ELSE 0 END) AS openers
                FROM player_rounds WHERE match_id=%s
            """, (matchid,))
            row = c.fetchone()
    except Exception:
        row = None

    map_name = (parsed.get("map") or "?").replace("de_", "").upper()
    won      = parsed.get("won", False)
    score    = f"{parsed.get('team_score',0)}–{parsed.get('opp_score',0)}"
    result   = "✅ WIN" if won else "❌ LOSS"
    color    = 0x4aaa6a if won else 0xc44040

    fields = []
    if row and row[0] is not None:
        k, d = int(row[0] or 0), int(row[1] or 1)
        fields = [
            {"name": "K/D",  "value": str(round(k / max(d, 1), 2)), "inline": True},
            {"name": "ADR",  "value": str(int(row[2] or 0)),         "inline": True},
            {"name": "HS%",  "value": f"{int(row[3] or 0)}%",        "inline": True},
            {"name": "FK",   "value": str(int(row[4] or 0)),         "inline": True},
        ]

    payload = {"embeds": [{"title": f"{map_name}  {result}  {score}", "color": color, "fields": fields,
                           "footer": {"text": f"cs2owl · match {matchid}"}}]}
    try:
        requests.post(DISCORD_WEBHOOK, json=payload, timeout=5)
    except Exception as e:
        log(f"discord notify failed: {e}")


def process_one(conn, code, attempts):
    matchid, outcomeid, token = decode_sharecode(code)
    log(f"processing {code} -> matchid={matchid}")

    demo_path = existing_demo_path(matchid)
    if demo_path is None:
        try:
            url = request_demo_url(code)
        except Exception as e:
            raise RuntimeError(f"gc fetch failed: {e}")
        demo_path = download_demo(url, matchid)
        log(f"downloaded -> {demo_path}")
    else:
        log(f"using existing demo {demo_path}")

    parsed = parse_demo(demo_path)
    write_match(conn, matchid, code, parsed)
    mark_parsed(conn, code)
    log(f"parsed match {matchid}: {parsed['rounds_total']} rounds, "
        f"score {parsed['team_score']}-{parsed['opp_score']}, won={parsed['won']}")
    notify_discord(conn, matchid, parsed)


def prune_old_demos():
    """Delete .dem files older than DEMO_RETENTION_DAYS. Parsed data lives in
    Postgres; the raw .dem is only useful for re-parses or debugging."""
    if DEMO_RETENTION_DAYS <= 0:
        return
    cutoff = time.time() - (DEMO_RETENTION_DAYS * 86400)
    removed = 0
    freed = 0
    for p in DEMOS_DIR.glob("*.dem"):
        try:
            if p.stat().st_mtime < cutoff:
                freed += p.stat().st_size
                p.unlink()
                removed += 1
        except FileNotFoundError:
            pass
        except Exception as e:
            log(f"prune error on {p}: {e}")
    # Also clean up stale .part files leftover from interrupted downloads
    for p in DEMOS_DIR.glob("*.dem.part"):
        try:
            if p.stat().st_mtime < cutoff:
                p.unlink()
        except Exception:
            pass
    if removed:
        log(f"pruned {removed} demos older than {DEMO_RETENTION_DAYS}d ({freed/1024/1024:.0f} MB freed)")


def main():
    log(f"starting; demos dir = {DEMOS_DIR}; retention = {DEMO_RETENTION_DAYS}d")
    DEMOS_DIR.mkdir(parents=True, exist_ok=True)
    last_prune = 0
    while True:
        try:
            # Prune at most once an hour to avoid wasted scans
            if time.time() - last_prune > 3600:
                prune_old_demos()
                last_prune = time.time()
            conn = db()
            pending = get_pending(conn)
            log(f"{len(pending)} pending sharecode(s)")
            for code, attempts in pending:
                try:
                    process_one(conn, code, attempts)
                except Exception as e:
                    traceback.print_exc()
                    log(f"failed {code}: {e}")
                    try:
                        mark_failed(conn, code, e, attempts)
                    except Exception as ee:
                        log(f"could not mark failure: {ee}")

            try:
                process_faceit_demos(conn)
            except Exception as e:
                log(f"FACEIT demo loop error: {e}")

            conn.close()
        except Exception as e:
            log(f"loop error: {e}")
        time.sleep(WORKER_INTERVAL)


if __name__ == "__main__":
    main()

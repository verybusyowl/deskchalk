#!/usr/bin/env python3
"""
Polls FACEIT Open API v4 for new CS2 matches.
Fetches per-match player stats directly from the API (no demo required).
Writes results into the faceit_matches table.

Required env vars:
  FACEIT_API_KEY     — from https://developers.faceit.com/
  FACEIT_NICKNAME    — your FACEIT display name (exact, case-sensitive)
  DB_DSN             — postgres connection string
Optional:
  POLL_SECONDS       — polling interval (default 600)
"""
import os, sys, time, json
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
import requests

FACEIT_API_KEY  = os.environ.get("FACEIT_API_KEY", "")
FACEIT_NICKNAME = os.environ.get("FACEIT_NICKNAME", "")
DB_DSN          = os.environ["DB_DSN"]
POLL_SECONDS    = int(os.environ.get("FACEIT_POLL_SECONDS", os.environ.get("POLL_SECONDS", "600")))
BASE_URL        = "https://open.faceit.com/data/v4"


def log(*args):
    print(f"[{datetime.now().isoformat(timespec='seconds')}] [faceit-poller]", *args, flush=True)


def _api(path, **params):
    r = requests.get(
        f"{BASE_URL}{path}",
        params=params or None,
        headers={"Authorization": f"Bearer {FACEIT_API_KEY}"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def get_player_id(nickname: str) -> tuple[str, int, int]:
    """Returns (player_id, faceit_elo, faceit_level)."""
    data = _api("/players", nickname=nickname, game="cs2")
    pid = data["player_id"]
    cs2 = data.get("games", {}).get("cs2", {})
    elo = cs2.get("faceit_elo")
    lvl = cs2.get("skill_level")
    return pid, (int(elo) if elo else None), (int(lvl) if lvl else None)


def get_match_history(player_id: str, limit: int = 20) -> list:
    data = _api(f"/players/{player_id}/history", game="cs2", limit=limit, offset=0)
    return data.get("items", [])


def get_match_stats(match_id: str) -> dict:
    return _api(f"/matches/{match_id}/stats")


def get_match_details(match_id: str) -> dict:
    return _api(f"/matches/{match_id}")


def _safe_int(v, default=0) -> int:
    if v is None:
        return default
    try:
        return int(float(str(v)))
    except (ValueError, TypeError):
        return default


def _safe_float(v, default=None):
    if v is None:
        return default
    try:
        return float(str(v))
    except (ValueError, TypeError):
        return default


def find_my_faction(item: dict, player_id: str) -> tuple:
    """Returns (faction_key, won, my_score, opp_score)."""
    teams = item.get("teams", {})
    results = item.get("results", {})
    score = results.get("score", {})
    winner = results.get("winner", "")
    for fk, fdata in teams.items():
        players = fdata.get("players", fdata.get("roster", []))
        if any(p.get("player_id") == player_id for p in players):
            other = "faction2" if fk == "faction1" else "faction1"
            return (
                fk,
                winner == fk,
                _safe_int(score.get(fk, 0)),
                _safe_int(score.get(other, 0)),
            )
    return None, False, 0, 0


def extract_my_stats(match_stats: dict, player_id: str) -> dict:
    """Pull my player_stats dict from FACEIT match stats response."""
    for rnd in match_stats.get("rounds", []):
        for team in rnd.get("teams", []):
            for player in team.get("players", []):
                if player.get("player_id") == player_id:
                    return player.get("player_stats", {})
    return {}


def extract_all_stats(match_stats: dict, player_id: str) -> list:
    """Per-player match stats for ALL players in both teams (the 9 the poller
    used to throw away + you). Match-level aggregates from the FACEIT stats API.
    `faction` = the stats team_id, so allies share one value and enemies another."""
    rounds = match_stats.get("rounds", [])
    if not rounds:
        return []
    rnd = rounds[0]  # CS2 matchmaking is Bo1 → one round entry per match
    out = []
    for team in rnd.get("teams", []):
        tid = team.get("team_id") or team.get("team_stats", {}).get("Team Win") or "?"
        for player in team.get("players", []):
            pid = player.get("player_id")
            ps = player.get("player_stats", {})
            # FACEIT CS2 has no "First Deaths". Entry duels are "Entry Count"
            # (taken) and "Entry Wins" (won); entries lost = count - wins.
            entry_count = _safe_int(ps.get("Entry Count"))
            entry_wins  = _safe_int(ps.get("Entry Wins"))
            out.append({
                "player_id":      pid,
                "nickname":       player.get("nickname"),
                "faction":        tid,
                "is_me":          pid == player_id,
                "kills":          _safe_int(ps.get("Kills")),
                "deaths":         _safe_int(ps.get("Deaths")),
                "assists":        _safe_int(ps.get("Assists")),
                "adr":            _safe_float(ps.get("ADR")) or _safe_float(ps.get("Average Damage per Round")),
                "hs_pct":         _safe_float(ps.get("Headshots %")),
                "kd_ratio":       _safe_float(ps.get("K/D Ratio")),
                "mvps":           _safe_int(ps.get("MVPs")),
                "opening_kills":  entry_wins,                          # entry duels won
                "opening_deaths": max(entry_count - entry_wins, 0),    # entry duels lost
            })
    return out


def upsert_player_stats(conn, faceit_match_id: str, players: list):
    """Store every player's match-level stats. Delete-then-insert so a re-fetch
    is clean and idempotent."""
    if not players:
        return
    with conn.cursor() as c:
        c.execute("DELETE FROM faceit_player_match_stats WHERE faceit_match_id=%s",
                  (faceit_match_id,))
        psycopg2.extras.execute_values(
            c,
            "INSERT INTO faceit_player_match_stats "
            "(faceit_match_id, player_id, nickname, faction, is_me, kills, deaths, "
            " assists, adr, hs_pct, kd_ratio, mvps, opening_kills, opening_deaths) VALUES %s",
            [(faceit_match_id, p["player_id"], p["nickname"], p["faction"], p["is_me"],
              p["kills"], p["deaths"], p["assists"], p["adr"], p["hs_pct"], p["kd_ratio"],
              p["mvps"], p["opening_kills"], p["opening_deaths"]) for p in players],
        )
    conn.commit()


def db():
    return psycopg2.connect(DB_DSN, cursor_factory=psycopg2.extras.RealDictCursor)


def get_known_ids(conn) -> set:
    with conn.cursor() as c:
        c.execute("SELECT faceit_match_id FROM faceit_matches")
        return {row["faceit_match_id"] for row in c.fetchall()}


def upsert_match(conn, row: dict):
    with conn.cursor() as c:
        c.execute("""
            INSERT INTO faceit_matches (
                faceit_match_id, map, played_at, won, team_score, opp_score,
                kills, deaths, assists, adr, hs_pct, kd_ratio,
                mvps, opening_kills, opening_deaths,
                triple_kills, quadro_kills, penta_kills,
                faceit_elo, elo_change, faceit_level, demo_url
            ) VALUES (
                %(faceit_match_id)s, %(map)s, to_timestamp(%(played_at)s), %(won)s,
                %(team_score)s, %(opp_score)s,
                %(kills)s, %(deaths)s, %(assists)s, %(adr)s, %(hs_pct)s, %(kd_ratio)s,
                %(mvps)s, %(opening_kills)s, %(opening_deaths)s,
                %(triple_kills)s, %(quadro_kills)s, %(penta_kills)s,
                %(faceit_elo)s, %(elo_change)s, %(faceit_level)s, %(demo_url)s
            ) ON CONFLICT (faceit_match_id) DO NOTHING
        """, row)
    conn.commit()


def main():
    if not FACEIT_API_KEY or not FACEIT_NICKNAME:
        log("FACEIT_API_KEY or FACEIT_NICKNAME not set — sleeping indefinitely")
        log("Set both in .env to enable FACEIT ingestion.")
        while True:
            time.sleep(3600)

    log(f"starting for FACEIT nickname: {FACEIT_NICKNAME}")

    # Self-sufficient: ensure the all-player stats table exists even if the app
    # hasn't created it yet (poller and app boot independently).
    try:
        c0 = db()
        with c0.cursor() as cc:
            cc.execute("""
                CREATE TABLE IF NOT EXISTS faceit_player_match_stats (
                    faceit_match_id TEXT REFERENCES faceit_matches(faceit_match_id) ON DELETE CASCADE,
                    player_id TEXT NOT NULL, nickname TEXT, faction TEXT,
                    is_me BOOLEAN DEFAULT FALSE,
                    kills INT DEFAULT 0, deaths INT DEFAULT 0, assists INT DEFAULT 0,
                    adr FLOAT, hs_pct FLOAT, kd_ratio FLOAT, mvps INT DEFAULT 0,
                    opening_kills INT DEFAULT 0, opening_deaths INT DEFAULT 0,
                    PRIMARY KEY (faceit_match_id, player_id));
                CREATE INDEX IF NOT EXISTS idx_fpms_match ON faceit_player_match_stats(faceit_match_id);
            """)
        c0.commit(); c0.close()
    except Exception as e:
        log(f"warn: could not ensure faceit_player_match_stats: {e}")

    player_id = None
    current_elo = None
    current_level = None

    while True:
        try:
            if player_id is None:
                player_id, current_elo, current_level = get_player_id(FACEIT_NICKNAME)
                log(f"player_id={player_id}  elo={current_elo}  level={current_level}")

            conn = db()
            known = get_known_ids(conn)
            history = get_match_history(player_id)

            new_count = 0
            for item in history:
                match_id = item.get("match_id")
                if not match_id or match_id in known:
                    continue

                try:
                    faction, won, my_score, opp_score = find_my_faction(item, player_id)
                    if faction is None:
                        log(f"  skip {match_id}: my player not found in teams")
                        continue

                    played_at = item.get("finished_at") or item.get("started_at", 0)

                    # Match stats (kills, deaths, etc.)
                    mstats = get_match_stats(match_id)
                    ps = extract_my_stats(mstats, player_id)

                    kills   = _safe_int(ps.get("Kills"))
                    deaths  = _safe_int(ps.get("Deaths"))
                    assists = _safe_int(ps.get("Assists"))
                    hs_pct  = _safe_float(ps.get("Headshots %"))
                    kd      = _safe_float(ps.get("K/D Ratio"))
                    # ADR: FACEIT may call it "ADR" or "Damage" / rounds
                    adr = _safe_float(ps.get("ADR")) or _safe_float(ps.get("adr"))
                    if adr is None:
                        dmg = _safe_float(ps.get("Damage"))
                        # Approximate: total_rounds = team_score + opp_score
                        total_rounds = my_score + opp_score
                        if dmg is not None and total_rounds > 0:
                            adr = round(dmg / total_rounds, 1)

                    # Get demo URL from match details
                    demo_url = None
                    map_name = "unknown"
                    try:
                        details = get_match_details(match_id)
                        demo_urls = details.get("demo_url", [])
                        demo_url = demo_urls[0] if demo_urls else None
                        # Map name: from voting or top-level
                        pick = details.get("voting", {}).get("map", {}).get("pick", [])
                        map_name = pick[0] if pick else details.get("map", "unknown")
                    except Exception as e:
                        log(f"  warn: couldn't get details for {match_id}: {e}")

                    # ELO: try history item fields first, fall back to current snapshot
                    elo_change = item.get("elo_change")
                    if elo_change is not None:
                        elo_change = _safe_int(elo_change)
                    # Per-match ELO snapshot: use current for the most recent match,
                    # NULL for older ones (filled by DB LAG computation on next cycle)
                    match_elo = current_elo if new_count == 0 else None

                    row = {
                        "faceit_match_id": match_id,
                        "map":             map_name,
                        "played_at":       played_at,
                        "won":             won,
                        "team_score":      my_score,
                        "opp_score":       opp_score,
                        "kills":           kills,
                        "deaths":          deaths,
                        "assists":         assists,
                        "adr":             adr,
                        "hs_pct":          hs_pct,
                        "kd_ratio":        kd,
                        "mvps":            _safe_int(ps.get("MVPs")),
                        # FACEIT has no "First Deaths"; entries = Entry Count/Wins.
                        "opening_kills":   _safe_int(ps.get("Entry Wins")),
                        "opening_deaths":  max(_safe_int(ps.get("Entry Count"))
                                               - _safe_int(ps.get("Entry Wins")), 0),
                        "triple_kills":    _safe_int(ps.get("Triple Kills")),
                        "quadro_kills":    _safe_int(ps.get("Quadro Kills")),
                        "penta_kills":     _safe_int(ps.get("Penta Kills")),
                        "faceit_elo":      match_elo,
                        "elo_change":      elo_change,
                        "faceit_level":    current_level,
                        "demo_url":        demo_url,
                    }

                    upsert_match(conn, row)
                    try:
                        upsert_player_stats(conn, match_id, extract_all_stats(mstats, player_id))
                    except Exception as e:
                        log(f"  warn: all-player stats store failed for {match_id[:8]}: {e}")
                    new_count += 1
                    log(f"  +{match_id}  {map_name}  {'W' if won else 'L'}  {my_score}-{opp_score}  K/D={kd}")
                    time.sleep(0.5)

                except Exception as e:
                    log(f"  ERROR processing {match_id}: {e}", file=sys.stderr)
                    continue

            log(f"cycle complete: {new_count} new match(es) ingested")

            # Backfill all-player stats for matches stored before the team-data
            # update (the other 9 players were never saved). Bounded per cycle.
            try:
                with conn.cursor() as c:
                    c.execute("""SELECT fm.faceit_match_id FROM faceit_matches fm
                                 LEFT JOIN faceit_player_match_stats s
                                   ON s.faceit_match_id = fm.faceit_match_id
                                 WHERE s.faceit_match_id IS NULL
                                 ORDER BY fm.played_at DESC LIMIT 15""")
                    missing = [r["faceit_match_id"] for r in c.fetchall()]
                for fid in missing:
                    try:
                        players = extract_all_stats(get_match_stats(fid), player_id)
                        upsert_player_stats(conn, fid, players)
                        log(f"  backfilled all-player stats {fid[:8]} ({len(players)} players)")
                        time.sleep(0.5)
                    except Exception as e:
                        log(f"  warn: backfill failed {fid[:8]}: {e}")
                if missing:
                    log(f"backfill: {len(missing)} match(es) this cycle")
            except Exception as e:
                log(f"  warn: backfill step failed: {e}")

            # Re-fetch demo URLs for matches where url is NULL and still under retry limit
            try:
                with conn.cursor() as c:
                    c.execute("""SELECT faceit_match_id FROM faceit_matches
                                 WHERE demo_url IS NULL AND demo_parsed = FALSE
                                   AND COALESCE(demo_parse_attempts, 0) < 3
                                 LIMIT 10""")
                    stale = [r["faceit_match_id"] for r in c.fetchall()]
                for fid in stale:
                    try:
                        details = get_match_details(fid)
                        urls = details.get("demo_url", [])
                        new_url = urls[0] if urls else None
                        if new_url:
                            with conn.cursor() as c:
                                c.execute("UPDATE faceit_matches SET demo_url=%s WHERE faceit_match_id=%s",
                                          (new_url, fid))
                            conn.commit()
                            log(f"  refreshed demo URL for {fid[:8]}")
                        time.sleep(0.5)
                    except Exception as e:
                        log(f"  warn: URL refresh failed for {fid[:8]}: {e}")
            except Exception as e:
                log(f"  warn: stale URL refresh step failed: {e}")

            # Backfill elo_change from consecutive known ELO snapshots.
            # Snapshots are taken from the PREVIOUS poll cycle, so faceit_elo
            # is the player's ELO going INTO the match — the change a match
            # produced is therefore next_snapshot - this_snapshot (LEAD).
            try:
                with conn.cursor() as c:
                    c.execute("""
                        WITH ordered AS (
                          SELECT faceit_match_id,
                                 LEAD(faceit_elo) OVER (ORDER BY played_at)
                                   - faceit_elo AS chg
                          FROM faceit_matches WHERE faceit_elo IS NOT NULL
                        )
                        UPDATE faceit_matches fm
                        SET elo_change = o.chg
                        FROM ordered o
                        WHERE fm.faceit_match_id = o.faceit_match_id
                          AND o.chg IS NOT NULL
                          AND fm.elo_change IS NULL
                    """)
                conn.commit()
            except Exception as e:
                log(f"  warn: elo_change backfill failed: {e}")

            conn.close()

            # Refresh current ELO each cycle
            try:
                _, current_elo, current_level = get_player_id(FACEIT_NICKNAME)
            except Exception:
                pass

        except Exception as e:
            log(f"ERROR: {e}", file=sys.stderr)

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()

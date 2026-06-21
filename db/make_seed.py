#!/usr/bin/env python3
"""
Generate db/seed_demo.sql — an ANONYMIZED snapshot of a real instance so a fresh
clone can show a fully-populated dashboard without the evaluator having any data.

Reads the live DB (DB_DSN) and writes anonymized INSERTs. All identifying fields
are scrubbed: sharecodes, demo filenames/urls, Steam IDs, FACEIT match IDs and
player IDs, and every nickname (the owner becomes "You", everyone else becomes a
stable "Player NN"). Gameplay numbers and map positions are kept — that's the
demo's value. Run:  python db/make_seed.py  (inside a container with DB_DSN set).

The seed is OPT-IN — it is NOT auto-loaded by the compose, so real installs never
mix in demo rows. Load it with the documented one-liner (see README).
"""
import os, psycopg2, psycopg2.extras

conn = psycopg2.connect(os.environ["DB_DSN"], cursor_factory=psycopg2.extras.RealDictCursor)
cur = conn.cursor()

# ── deterministic anonymization maps ────────────────────────────────────────
_mid, _fc, _sid, _pid, _nick = {}, {}, {}, {}, {}
def mid(v):
    if v is None: return None
    if v not in _mid: _mid[v] = 100000 + len(_mid) + 1
    return _mid[v]
def fc(v):
    if v is None: return None
    if v not in _fc: _fc[v] = f"demo-{len(_fc)+1:04d}"
    return _fc[v]
def sid(v, is_me):
    if v is None: return None
    if is_me: return 999999            # owner — stable fake, unique per match (appears once)
    if v not in _sid: _sid[v] = 1000 + len(_sid) + 1
    return _sid[v]
def pid(v, is_me):
    if v is None: return None
    if is_me: return "demo-you"
    if v not in _pid: _pid[v] = f"demo-p{len(_pid)+1:04d}"
    return _pid[v]
def nick(v, is_me):
    if is_me: return "You"
    if v not in _nick: _nick[v] = f"Player {len(_nick)+1:02d}"
    return _nick[v]

emitted = []
def emit(table, cols, values):
    sql = cur.mogrify(
        f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join(['%s']*len(cols))}) ON CONFLICT DO NOTHING;",
        values,
    ).decode()
    emitted.append(sql)

# ── matches (+ children) ────────────────────────────────────────────────────
cur.execute("SELECT * FROM matches ORDER BY played_at NULLS LAST")
for i, m in enumerate([dict(r) for r in cur.fetchall()], 1):
    # sharecode is NULL: it FKs the MM ingestion queue (sharecodes), which the
    # demo doesn't need — and it's the real Steam sharecode anyway.
    emit("matches",
         ["match_id","sharecode","map","played_at","rounds_total","team_score","opp_score","won","demo_filename","platform"],
         [mid(m["match_id"]), None, m["map"], m["played_at"], m["rounds_total"],
          m["team_score"], m["opp_score"], m["won"], f"demo_{i:04d}.dem", m["platform"]])

cur.execute("SELECT * FROM player_rounds")
PR_COLS = ["match_id","round_num","side","round_won","kills","deaths","assists","damage","headshots",
           "multikill","opening_kill","opening_death","traded_death","traded_kill","survived",
           "high_damage_no_kill","money_start","equip_value","spent","buy_type","weapon_purchased",
           "saved_weapon","lost_kit_on_eco","util_thrown","util_wasted","util_damage","util_timing",
           "flash_assists","team_flashes","spawn_x","spawn_y","death_tick","death_phase","avg_ttk_ms",
           "duel_entry_hp","was_clutch","clutch_vs","clutch_won","planted_bomb","ttd_ms",
           "crosshair_err_deg","death_blinded","death_unused_util"]
for r in [dict(x) for x in cur.fetchall()]:
    r["match_id"] = mid(r["match_id"])
    emit("player_rounds", PR_COLS, [r[c] for c in PR_COLS])

cur.execute("SELECT * FROM round_player_stats")
RPS_COLS = ["match_id","round_num","steamid","name","side","is_me","kills","deaths","assists",
            "damage","headshots","opening_kill","opening_death","traded_kill","traded_death",
            "survived","util_damage","flash_assists"]
for r in [dict(x) for x in cur.fetchall()]:
    me = r["is_me"]
    r["match_id"], r["steamid"], r["name"] = mid(r["match_id"]), sid(r["steamid"], me), nick(r["name"], me)
    emit("round_player_stats", RPS_COLS, [r[c] for c in RPS_COLS])

for tbl, cols in [
    ("kill_events", ["match_id","round_num","side","is_victim","attacker_x","attacker_y","attacker_z",
                     "victim_x","victim_y","victim_z","weapon","was_blind","through_smoke","headshot","victim_hp_remaining"]),
    ("grenade_events", ["match_id","round_num","side","grenade_type","throw_x","throw_y","throw_z",
                        "land_x","land_y","land_z","throw_tick","detonation_tick","teammates_flashed",
                        "enemies_flashed","damage_dealt","had_effect"]),
]:
    cur.execute(f"SELECT * FROM {tbl}")
    for r in [dict(x) for x in cur.fetchall()]:
        r["match_id"] = mid(r["match_id"])
        emit(tbl, cols, [r[c] for c in cols])

# ── FACEIT (+ players) ──────────────────────────────────────────────────────
cur.execute("SELECT * FROM faceit_matches ORDER BY played_at NULLS LAST")
FM_COLS = ["faceit_match_id","map","played_at","won","team_score","opp_score","kills","deaths",
           "assists","adr","hs_pct","kd_ratio","mvps","opening_kills","opening_deaths","triple_kills",
           "quadro_kills","penta_kills","faceit_elo","elo_change","faceit_level"]
for r in [dict(x) for x in cur.fetchall()]:
    r["faceit_match_id"] = fc(r["faceit_match_id"])
    emit("faceit_matches", FM_COLS, [r[c] for c in FM_COLS])

cur.execute("SELECT * FROM faceit_player_match_stats")
FP_COLS = ["faceit_match_id","player_id","nickname","faction","is_me","kills","deaths","assists",
           "adr","hs_pct","kd_ratio","mvps","opening_kills","opening_deaths"]
for r in [dict(x) for x in cur.fetchall()]:
    me = r["is_me"]
    r["faceit_match_id"], r["player_id"], r["nickname"] = fc(r["faceit_match_id"]), pid(r["player_id"], me), nick(r["nickname"], me)
    emit("faceit_player_match_stats", FP_COLS, [r[c] for c in FP_COLS])

conn.close()

header = (
    "-- DeskChalk demo seed — ANONYMIZED sample data (generated by db/make_seed.py).\n"
    "-- OPT-IN: load into a running instance to preview a populated dashboard:\n"
    "--   docker compose exec -T db psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" < db/seed_demo.sql\n"
    "-- All nicknames/IDs/sharecodes are fake; gameplay stats + positions are real.\n"
    f"-- {len(_mid)} MM matches, {len(_fc)} FACEIT matches, {len(emitted)} rows.\n\n"
    "BEGIN;\n"
)
with open(os.environ.get("SEED_OUT", "/repo/db/seed_demo.sql"), "w") as f:
    f.write(header)
    f.write("\n".join(emitted))
    f.write("\n\nCOMMIT;\n")
print(f"wrote db/seed_demo.sql: {len(emitted)} rows, {len(_mid)} MM + {len(_fc)} FACEIT matches, "
      f"{len(_nick)} distinct players anonymized")

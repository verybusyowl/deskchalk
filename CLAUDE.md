# cs2owl — Claude Code Context

Self-hosted CS2 analytics pipeline. Docker Compose stack in the repo root.

## Product direction (2026-06-11)

**The product is a coach, not a stats explorer.** Goal: deliver "the one thing to fix next" in seconds. Build priority is the coach loop: demo ingest → Tier-1 mechanics metrics (counter-strafe, first-bullet accuracy, spray, TTD, crosshair placement, death context) → Today's Focus card (`/api/todays_focus`) → measured improvement (`focus_log` baselines, post-session Discord recaps, weekly rotation).

**Frozen surfaces (maintenance-only, do not extend):** 2D replay viewer extras, themes, storyboard round review, Grafana dashboards. Fix bugs there if asked, but no new features until the coach loop is proven.

**FACEIT demos** need an API key with the `downloads` scope — granted only via application form (https://fce.gg/downloads-api-application, ~30-day review), not a portal checkbox. The worker exchanges stored CDN URLs for signed URLs via `POST open.faceit.com/download/v2/demos/download` (direct backblaze CDN is dead). **Bridge until approved:** download a demo via "Watch Demo" in the FACEIT match-room page and drop the file into `demos/` — the worker matches it by the match UUID in the filename, decompresses (.zst/.gz/.bz2), and parses it within ~2 min. Do NOT use website session tokens (same ToS stance as the Steam scraper rule).

## Architecture

```
cs2-poller   → polls Steam Web API (GetNextMatchSharingCode) → writes sharecodes to DB
cs2-gc-client → Node.js, CS2 Game Coordinator client, fetches demo URLs (no host port)
cs2-worker   → downloads + parses demos, writes all events to DB, builds replay JSONB
cs2-renderer → FastAPI, PNG endpoints: /heatmap and /hitbox (port 8087)
cs2-coach    → FastAPI, Claude-powered /ask endpoint (port 8088)
cs2-app      → FastAPI + static SPA (port 5608) — main UI
```

All services join `webapp_app_net` (postgres) AND `cs2_net` (outbound internet).

## Shared infrastructure (DO NOT recreate)

- **Postgres**: existing `postgres` container in `webapp_app_net`. DB = `cs2`, role = `cs2user`. Does NOT use `appuser` (webapp superuser) for normal ops.
- **Grafana**: existing container on port 3002. CS2 datasource uid = `CS2-Postgres` (type `grafana-postgresql-datasource`).

## Key files

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | Stack definition |
| `.env` | Secrets: STEAM_ID64, STEAM_API_KEY, MATCH_AUTH_CODE, POSTGRES_PASSWORD, ANTHROPIC_API_KEY |
| `db/init.sql` | Schema + views (source of truth — re-apply with `docker exec -i postgres psql -U cs2user -d cs2 < db/init.sql`) |
| `worker/worker.py` | Demo parser (~1200 lines). Parses demoparser2 output into 7 tables. |
| `app/main.py` | FastAPI backend for SPA + /ask endpoint |
| `app/static/index.html` | Single-file SPA (~2200 lines) |
| `renderer/renderer.py` | Heatmap + hitbox PNG renderer |

## Database schema (cs2 database)

- `matches` — one row per match
- `player_rounds` — one row per round (my perspective): kills, deaths, damage, was_clutch, team_flashes, etc.
- `damage_events`, `kill_events`, `grenade_events`, `shot_events` — per-event tables
- `round_replays` — JSONB per round: 16-tick sampled frames + events. Players include `name`, `team`, `is_me`. Frame player state: `[x, y, alive, hp, balance, equip]` (indices 0–5). Events: `kill` (tick,x,y,hs,iv,w), `nade` (tick,gt,tx,ty,lx,ly), `dmg` (tick,hg,you,w,died,dmg).
- `damage_events` — per-hit events including `tick`, `hitgroup` (1=head,2=chest,3=stomach,4-5=arms,6-7=legs), `attacker_is_you`, `victim_died`.
- `map_radar_calibration` — origin_x, origin_y, scale per map for world→pixel transform
- `grenade_lineups` — seeded lineups reference
- `coach_cache` — weekly AI coach cache

Key views: `v_by_map`, `v_per_weapon`, `v_recent_form`, `v_session`, `v_match_score`.

## Critical gotchas

- **NUMERIC(20,0)** for match_id everywhere — CS2 match IDs are unsigned 64-bit, exceed signed BIGINT. Serialize as string in API to avoid JS float precision loss.
- **polars-lts-cpu** (not polars) — works on low-power CPUs without AVX/AVX2.
- **SteamID precision**: never `int(float(sid))` — use `int(sid)` directly on numpy int64/uint64.
- **globaloffensive npm** pinned `^3.3.0` — check GitHub before rebuilding gc-client.
- **webapp_app_net is internal:true** — no outbound internet. Services that need Steam also join `cs2_net`.
- **round_replays ON CONFLICT DO UPDATE** (not DO NOTHING) — so re-parses refresh data.

## API endpoints (app, port 5608)

- `GET /api/matches` — match list with KPIs
- `GET /api/match_rounds?match_id=X` — per-round data incl. equip_value, money_start
- `GET /api/round_replay?match_id=X&round=N` — full replay JSONB
- `GET /api/radar_calibration?map=X` — origin_x, origin_y, scale
- `GET /api/death_patterns?map=X&days=90` — my death positions (x,y,weapon,headshot,side,round_won)
- `GET /radar/{map}.png` — serves radar PNG from the `radars/` dir
- `GET /ask?q=...&map=...&days=30&html=true` — Claude coach Q&A
- `GET /heatmap?map=X&type=kills|deaths|grenades|aim&side=CT|T|all&days=N` — PNG heatmap (port 8087 via renderer)
- `GET /hitbox?map=X&days=N&perspective=incoming|outgoing` — PNG hitbox silhouette

## SPA tab structure

1. **Overview** — KPIs, recent form, per-map table, top weapons, pitfalls, AI coach (cached)
2. **Map tabs** (de_inferno, etc.) — heatmaps, CT/T cards, economy, clutch, match history
3. **▶ Replay** — Noesis-style 2-column layout: match/round sidebar + canvas + panels

## Replay tab features

- Square canvas (`Math.min(wrap.clientWidth, wrap.clientHeight, 700)`), radar PNG overlaid
- **Round filter chips**: CT/T/Won/Lost/Eco/Force/Full/Clutch/FK — filters sidebar list
- **Economy badges** per round from `equip_value` (Full≥4500, Force≥2000, else Eco)
- **Scrubber markers**: thin canvas above scrubber, green=kills, red=deaths, team-color=nades
- **Pattern mode** (📊 button): density heatmap from all rounds' alive positions (64×64 grid)
- **Kill feed panel**: scrollable event log (kills/deaths/grenades/damage hits) below canvas
- **Aim panel**: 120×180 hitbox silhouette canvas; flashes regions green=my hits / red=hits on me
- **Coach linking**: "Round N" in coach answers → clickable link that seeks replay to that round
- Grenade trajectories colored by team (CT blue / T orange); dead players show persistent X
- `rp.filters`, `rp.patternMode`, `rp.roundMeta`, `rp.roundCache` are key state fields

## Rebuild commands

```bash
# Rebuild and restart single service
docker compose build <service> && docker compose up -d <service>

# Re-parse all matches (resets sharecodes, uses cached .dem files)
sudo docker exec postgres psql -U cs2user -d cs2 \
  -c "UPDATE sharecodes SET status='pending', attempts=0 WHERE status='parsed';"

# Apply schema changes
sudo docker exec -i postgres psql -U cs2user -d cs2 < db/init.sql

# Check worker logs
sudo docker logs cs2-worker --tail 50
```

## Radar calibration

`map_radar_calibration` table seeded with active-duty values. If heatmap points fall off-canvas, read `game/csgo/resource/overviews/{map}.txt` from CS2 install for origin/scale.

## Status (2026-05-22)

- 10 matches parsed, 226 rounds; FACEIT ingestion active (ELO 1617, Level 8)
- All heuristics working: clutch, team_flashes, traded_kill, opening duel, true accuracy
- Replay tab: 4fps interpolation, player names, filter chips, pattern heatmap, kill feed, aim panel, coach linking
- Leetify-style sidebar: T/CT player scorecards (HP bar, weapon icon, money, nade chips, K/D for me)
- Weapon icons on radar canvas: cs[7]=weapon_name → wImg() cache → 14/12px icon right of dot
- Round number bar (W/L colored, clickable)
- Dual-line trend chart: MM rating (orange) + FACEIT ELO (green), independent Y-axes
- Carousel: slide 1=FACEIT-style KPIs, slide 2=this week's matches, slide 3=coach brief (+↻ refresh)
- Maps table: "Form" sparkline column (last 5 results as colored dots from rating_trend)
- Drill cards: Done/Skip buttons → POST /api/drill_log; GET /api/drill_log returns history
- Scrubber markers: 3 layers — dmg (yellow/orange half-height), nade (team-colored), kill (green/red)
- `damage_events.tick` populated after 2026-05-19 re-parse; old rows have NULL tick
- Worker: `de_cols` must include `"tick"` for damage tick to persist to DB
- FACEIT demo CDN issue: stored URLs use dead `backblaze.faceit-cdn.net` hostname; worker now clears stale
  URLs on DNS failure; poller re-fetches fresh URLs next cycle. Rebuilds required (worker + faceit-poller).

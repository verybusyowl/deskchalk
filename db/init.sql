-- ============================================================
-- CS2 personal analytics schema v1
-- All stats are from YOUR perspective (single player).
-- ============================================================

CREATE TABLE IF NOT EXISTS sharecodes (
    code            TEXT PRIMARY KEY,
    discovered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','parsed','failed','expired')),
    attempts        INT NOT NULL DEFAULT 0,
    last_error      TEXT,
    parsed_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS matches (
    match_id        NUMERIC(20,0) PRIMARY KEY,
    sharecode       TEXT REFERENCES sharecodes(code),
    map             TEXT NOT NULL,
    played_at       TIMESTAMPTZ,
    rounds_total    INT,
    team_score      INT,
    opp_score       INT,
    won             BOOLEAN,
    demo_filename   TEXT
);

CREATE TABLE IF NOT EXISTS player_rounds (
    match_id            NUMERIC(20,0) REFERENCES matches(match_id) ON DELETE CASCADE,
    round_num           INT NOT NULL,
    side                TEXT NOT NULL CHECK (side IN ('CT','T')),
    round_won           BOOLEAN,
    -- Combat
    kills               INT DEFAULT 0,
    deaths              INT DEFAULT 0,
    assists             INT DEFAULT 0,
    damage              INT DEFAULT 0,
    headshots           INT DEFAULT 0,
    multikill           INT DEFAULT 0,
    opening_kill        BOOLEAN DEFAULT FALSE,
    opening_death       BOOLEAN DEFAULT FALSE,
    traded_death        BOOLEAN DEFAULT FALSE,
    traded_kill         BOOLEAN DEFAULT FALSE,
    survived            BOOLEAN DEFAULT FALSE,
    high_damage_no_kill BOOLEAN DEFAULT FALSE,
    -- Economy
    money_start         INT,
    equip_value         INT,
    spent               INT,
    buy_type            TEXT,
    weapon_purchased    TEXT,
    saved_weapon        BOOLEAN DEFAULT FALSE,
    lost_kit_on_eco     BOOLEAN DEFAULT FALSE,
    -- Utility
    util_thrown         INT DEFAULT 0,
    util_wasted         INT DEFAULT 0,
    util_damage         INT DEFAULT 0,
    util_timing         TEXT,
    flash_assists       INT DEFAULT 0,
    team_flashes        INT DEFAULT 0,
    -- Positioning
    spawn_x             FLOAT,
    spawn_y             FLOAT,
    death_tick          INT,
    death_phase         TEXT,
    -- Duel quality
    avg_ttk_ms          FLOAT,
    duel_entry_hp       INT,
    -- Clutch
    was_clutch          BOOLEAN DEFAULT FALSE,
    clutch_vs           INT,
    clutch_won          BOOLEAN DEFAULT FALSE,
    -- Bomb
    planted_bomb        BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (match_id, round_num)
);

CREATE TABLE IF NOT EXISTS damage_events (
    id                  SERIAL PRIMARY KEY,
    match_id            NUMERIC(20,0) REFERENCES matches(match_id) ON DELETE CASCADE,
    round_num           INT,
    side                TEXT,
    attacker_is_you     BOOLEAN,
    weapon              TEXT,
    hitgroup            INT,
    damage_dealt        INT,
    victim_died         BOOLEAN,
    attacker_hp         INT,
    victim_hp_before    INT,
    moving_on_first_shot BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS kill_events (
    id                  SERIAL PRIMARY KEY,
    match_id            NUMERIC(20,0) REFERENCES matches(match_id) ON DELETE CASCADE,
    round_num           INT,
    side                TEXT,
    is_victim           BOOLEAN,
    attacker_x          FLOAT,
    attacker_y          FLOAT,
    attacker_z          FLOAT,
    victim_x            FLOAT,
    victim_y            FLOAT,
    victim_z            FLOAT,
    weapon              TEXT,
    was_blind           BOOLEAN DEFAULT FALSE,
    through_smoke       BOOLEAN DEFAULT FALSE,
    headshot            BOOLEAN DEFAULT FALSE,
    victim_hp_remaining INT
);

CREATE TABLE IF NOT EXISTS grenade_events (
    id                  SERIAL PRIMARY KEY,
    match_id            NUMERIC(20,0) REFERENCES matches(match_id) ON DELETE CASCADE,
    round_num           INT,
    side                TEXT,
    grenade_type        TEXT,
    throw_x             FLOAT,
    throw_y             FLOAT,
    throw_z             FLOAT,
    land_x              FLOAT,
    land_y              FLOAT,
    land_z              FLOAT,
    throw_tick          INT,
    detonation_tick     INT,
    teammates_flashed   INT DEFAULT 0,
    enemies_flashed     INT DEFAULT 0,
    damage_dealt        INT DEFAULT 0,
    had_effect          BOOLEAN DEFAULT FALSE
);

-- Every weapon_fire event by the player. Lets v_per_weapon compute true
-- accuracy = hits / shots_fired (otherwise we only have hits via damage_events
-- and have no idea how many shots missed).
CREATE TABLE IF NOT EXISTS shot_events (
    id         SERIAL PRIMARY KEY,
    match_id   NUMERIC(20,0) REFERENCES matches(match_id) ON DELETE CASCADE,
    round_num  INT,
    side       TEXT,
    weapon     TEXT,
    tick       INT
);
CREATE INDEX IF NOT EXISTS idx_se_match  ON shot_events(match_id);
CREATE INDEX IF NOT EXISTS idx_se_weapon ON shot_events(weapon);

CREATE TABLE IF NOT EXISTS round_replays (
    match_id  NUMERIC(20,0) NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
    round_num INTEGER       NOT NULL,
    data      JSONB         NOT NULL,
    PRIMARY KEY (match_id, round_num)
);
CREATE INDEX IF NOT EXISTS idx_rr_match ON round_replays(match_id);

CREATE TABLE IF NOT EXISTS grenade_lineups (
    id              SERIAL PRIMARY KEY,
    map             TEXT NOT NULL,
    grenade_type    TEXT NOT NULL CHECK (grenade_type IN ('smoke','flash','molotov','he')),
    name            TEXT NOT NULL,
    throw_x         FLOAT,
    throw_y         FLOAT,
    land_x          FLOAT,
    land_y          FLOAT,
    side            TEXT CHECK (side IN ('CT','T','both')),
    difficulty      TEXT CHECK (difficulty IN ('easy','medium','hard')),
    notes           TEXT,
    image_path      TEXT,
    tags            TEXT[],
    added_at        TIMESTAMPTZ DEFAULT now()
);

-- Per-map radar calibration: world units -> radar pixel coords.
-- Transform: px = (world_x - origin_x) / scale ; py = (origin_y - world_y) / scale (Y inverted)
-- Source values from CS2's game/csgo/resource/overviews/{name}.txt
CREATE TABLE IF NOT EXISTS map_radar_calibration (
    map         TEXT PRIMARY KEY,
    origin_x    FLOAT NOT NULL,
    origin_y    FLOAT NOT NULL,
    scale       FLOAT NOT NULL,
    radar_size  INT NOT NULL DEFAULT 1024,
    notes       TEXT
);

INSERT INTO map_radar_calibration (map, origin_x, origin_y, scale, notes) VALUES
    ('de_dust2',   -2476,  3239, 4.40, 'Active duty'),
    ('de_mirage',  -3230,  1713, 5.00, 'Active duty'),
    ('de_inferno', -2087,  3870, 4.90, 'Active duty'),
    ('de_nuke',    -3453,  2887, 7.00, 'Active duty; multi-level (lower/upper) not yet handled'),
    ('de_ancient', -2953,  2164, 5.00, 'Active duty'),
    ('de_anubis',  -2796,  3328, 5.22, 'Active duty'),
    ('de_vertigo', -3168,  1762, 4.00, 'Active duty; multi-level (A/B sites different floors)')
ON CONFLICT (map) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pr_side    ON player_rounds(side);
CREATE INDEX IF NOT EXISTS idx_pr_match   ON player_rounds(match_id);
CREATE INDEX IF NOT EXISTS idx_m_map      ON matches(map);
CREATE INDEX IF NOT EXISTS idx_m_when     ON matches(played_at);
CREATE INDEX IF NOT EXISTS idx_de_match   ON damage_events(match_id);
CREATE INDEX IF NOT EXISTS idx_de_weapon  ON damage_events(weapon);
CREATE INDEX IF NOT EXISTS idx_de_hg      ON damage_events(hitgroup);
CREATE INDEX IF NOT EXISTS idx_ke_match   ON kill_events(match_id);
CREATE INDEX IF NOT EXISTS idx_ke_side    ON kill_events(side);
CREATE INDEX IF NOT EXISTS idx_ge_match   ON grenade_events(match_id);
CREATE INDEX IF NOT EXISTS idx_ge_type    ON grenade_events(grenade_type);

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_by_map AS
SELECT
    m.map,
    COUNT(DISTINCT m.match_id)                                              AS matches,
    ROUND(100.0 * COUNT(DISTINCT CASE WHEN m.won THEN m.match_id END)::numeric
          / NULLIF(COUNT(DISTINCT m.match_id), 0), 1)                       AS win_pct,
    SUM(pr.kills)                                                           AS kills,
    SUM(pr.deaths)                                                          AS deaths,
    ROUND(SUM(pr.kills)::numeric / NULLIF(SUM(pr.deaths),0), 2)            AS kd,
    ROUND(AVG(pr.damage), 1)                                                AS adr,
    ROUND(100.0*SUM(CASE WHEN pr.opening_kill THEN 1 END)
          / NULLIF(SUM(CASE WHEN pr.opening_kill OR pr.opening_death THEN 1 END),0),1)
                                                                            AS opening_win_pct,
    ROUND(100.0*SUM(CASE WHEN pr.high_damage_no_kill THEN 1 END)
          / NULLIF(COUNT(*),0), 1)                                          AS fight_conversion_fail_pct
FROM matches m
JOIN player_rounds pr USING (match_id)
GROUP BY m.map ORDER BY matches DESC;

CREATE OR REPLACE VIEW v_by_side AS
SELECT
    m.map, pr.side,
    COUNT(*)                                                                AS rounds,
    ROUND(100.0*SUM(CASE WHEN pr.round_won THEN 1 END)/COUNT(*),1)         AS round_win_pct,
    ROUND(AVG(pr.damage),1)                                                 AS adr,
    ROUND(100.0*SUM(CASE WHEN pr.opening_death THEN 1 END)/COUNT(*),1)     AS opening_death_pct,
    ROUND(100.0*SUM(CASE WHEN pr.opening_kill  THEN 1 END)/COUNT(*),1)     AS opening_kill_pct,
    ROUND(AVG(pr.util_thrown),2)                                            AS util_per_round,
    ROUND(AVG(pr.team_flashes),2)                                           AS team_flashes_per_round,
    ROUND(100.0*SUM(CASE WHEN pr.death_phase='early' AND pr.deaths>0 THEN 1 END)
          / NULLIF(SUM(CASE WHEN pr.deaths>0 THEN 1 END),0),1)             AS early_death_pct
FROM matches m JOIN player_rounds pr USING (match_id)
GROUP BY m.map, pr.side ORDER BY m.map, pr.side;

CREATE OR REPLACE VIEW v_economy_mistakes AS
SELECT
    m.map, pr.side, COUNT(*) AS rounds,
    SUM(CASE WHEN pr.lost_kit_on_eco THEN 1 ELSE 0 END)                    AS lost_kit_on_eco,
    SUM(CASE WHEN pr.buy_type='force' AND NOT pr.round_won
              AND pr.damage < 50 THEN 1 ELSE 0 END)                        AS bad_force_buys,
    SUM(CASE WHEN NOT pr.round_won AND NOT pr.survived
              AND pr.equip_value >= 2700
              AND NOT pr.saved_weapon THEN 1 ELSE 0 END)                   AS failed_saves,
    SUM(CASE WHEN pr.buy_type='eco' AND pr.spent > 1000 THEN 1 ELSE 0 END) AS eco_breaks
FROM matches m JOIN player_rounds pr USING (match_id)
GROUP BY m.map, pr.side ORDER BY m.map, pr.side;

CREATE OR REPLACE VIEW v_utility AS
SELECT
    m.map, pr.side, ge.grenade_type,
    COUNT(*)                                                                AS throws,
    ROUND(100.0*SUM(CASE WHEN ge.had_effect THEN 1 END)/COUNT(*),1)        AS effective_pct,
    ROUND(AVG(ge.enemies_flashed),2)                                        AS avg_enemies_flashed,
    ROUND(AVG(ge.teammates_flashed),2)                                      AS avg_teammates_flashed,
    ROUND(AVG(ge.damage_dealt),1)                                           AS avg_damage,
    SUM(CASE WHEN NOT ge.had_effect THEN 1 ELSE 0 END)                     AS wasted_throws
FROM grenade_events ge
JOIN matches m USING (match_id)
JOIN player_rounds pr ON pr.match_id = ge.match_id AND pr.round_num = ge.round_num
GROUP BY m.map, pr.side, ge.grenade_type ORDER BY m.map, pr.side, ge.grenade_type;

CREATE OR REPLACE VIEW v_grenade_consistency AS
SELECT
    m.map, ge.grenade_type,
    ROUND(ge.throw_x / 100) * 100                                           AS throw_zone_x,
    ROUND(ge.throw_y / 100) * 100                                           AS throw_zone_y,
    COUNT(*)                                                                AS attempts,
    ROUND(STDDEV(ge.land_x)::numeric, 1)                                   AS land_x_stddev,
    ROUND(STDDEV(ge.land_y)::numeric, 1)                                   AS land_y_stddev,
    ROUND((STDDEV(ge.land_x) + STDDEV(ge.land_y))::numeric / 2, 1)        AS consistency_score
FROM grenade_events ge JOIN matches m USING (match_id)
WHERE ge.grenade_type IN ('smoke','molotov')
GROUP BY m.map, ge.grenade_type, ROUND(ge.throw_x/100)*100, ROUND(ge.throw_y/100)*100
HAVING COUNT(*) >= 3
ORDER BY consistency_score DESC;

CREATE OR REPLACE VIEW v_hitgroup AS
SELECT
    m.map, de.weapon, de.hitgroup,
    CASE de.hitgroup
        WHEN 1 THEN 'Head' WHEN 2 THEN 'Chest' WHEN 3 THEN 'Stomach'
        WHEN 4 THEN 'Left Arm' WHEN 5 THEN 'Right Arm'
        WHEN 6 THEN 'Left Leg' WHEN 7 THEN 'Right Leg' ELSE 'Generic'
    END                                                                     AS hitgroup_name,
    COUNT(*)                                                                AS hits,
    SUM(CASE WHEN de.victim_died THEN 1 ELSE 0 END)                        AS lethal_hits,
    ROUND(100.0*SUM(CASE WHEN de.victim_died THEN 1 END)/COUNT(*),1)       AS lethality_pct,
    SUM(CASE WHEN de.moving_on_first_shot THEN 1 ELSE 0 END)               AS moving_shots
FROM damage_events de JOIN matches m USING (match_id)
WHERE de.attacker_is_you = TRUE
GROUP BY m.map, de.weapon, de.hitgroup ORDER BY m.map, de.weapon, hits DESC;

CREATE OR REPLACE VIEW v_clutch AS
SELECT
    m.map, pr.side, pr.clutch_vs,
    COUNT(*)                                                                AS clutch_attempts,
    SUM(CASE WHEN pr.clutch_won THEN 1 ELSE 0 END)                         AS clutch_wins,
    ROUND(100.0*SUM(CASE WHEN pr.clutch_won THEN 1 END)/COUNT(*),1)        AS clutch_win_pct
FROM player_rounds pr JOIN matches m USING (match_id)
WHERE pr.was_clutch = TRUE
GROUP BY m.map, pr.side, pr.clutch_vs ORDER BY m.map, pr.side, pr.clutch_vs;

CREATE OR REPLACE VIEW v_per_weapon AS
WITH ks AS (
  SELECT m.map, ke.weapon, ke.side,
    COUNT(*) FILTER (WHERE ke.is_victim = FALSE) AS kills,
    COUNT(*) FILTER (WHERE ke.is_victim = TRUE)  AS deaths,
    SUM(CASE WHEN ke.headshot AND NOT ke.is_victim THEN 1 ELSE 0 END) AS headshots
  FROM kill_events ke JOIN matches m USING(match_id)
  WHERE COALESCE(m.platform,'mm') = 'mm'
  GROUP BY m.map, ke.weapon, ke.side
), dmg AS (
  SELECT m.map, de.weapon, de.side,
    SUM(de.damage_dealt) FILTER (WHERE de.attacker_is_you) AS damage_dealt,
    COUNT(*) FILTER (WHERE de.attacker_is_you)             AS hits,
    SUM(CASE WHEN de.attacker_is_you AND de.moving_on_first_shot THEN 1 ELSE 0 END) AS moving_hits
  FROM damage_events de JOIN matches m USING(match_id)
  WHERE COALESCE(m.platform,'mm') = 'mm'
  GROUP BY m.map, de.weapon, de.side
), shots AS (
  SELECT m.map, se.weapon, se.side, COUNT(*) AS shots_fired
  FROM shot_events se JOIN matches m USING(match_id)
  WHERE COALESCE(m.platform,'mm') = 'mm'
  GROUP BY m.map, se.weapon, se.side
)
SELECT
  COALESCE(ks.map, dmg.map, shots.map)          AS map,
  COALESCE(ks.weapon, dmg.weapon, shots.weapon) AS weapon,
  COALESCE(ks.side, dmg.side, shots.side)       AS side,
  COALESCE(ks.kills, 0)            AS kills,
  COALESCE(ks.deaths, 0)           AS deaths,
  COALESCE(ks.headshots, 0)        AS headshots,
  ROUND(100.0 * NULLIF(ks.headshots,0) / NULLIF(ks.kills,0), 1)    AS hs_pct,
  COALESCE(dmg.hits, 0)            AS hits,
  COALESCE(dmg.damage_dealt, 0)    AS damage_dealt,
  COALESCE(dmg.moving_hits, 0)     AS moving_hits,
  ROUND(100.0 * NULLIF(dmg.moving_hits,0) / NULLIF(dmg.hits,0), 1) AS moving_pct,
  ROUND(NULLIF(dmg.damage_dealt,0)::numeric / NULLIF(dmg.hits,0), 1) AS dmg_per_hit,
  COALESCE(shots.shots_fired, 0)   AS shots_fired,
  ROUND(100.0 * NULLIF(dmg.hits,0)::numeric / NULLIF(shots.shots_fired,0), 1) AS accuracy_pct
FROM ks
  FULL OUTER JOIN dmg   USING (map, weapon, side)
  FULL OUTER JOIN shots USING (map, weapon, side);

CREATE OR REPLACE VIEW v_recent_form AS
SELECT match_id, map, played_at, won, team_score, opp_score,
       ROW_NUMBER() OVER (ORDER BY played_at DESC) AS recency
FROM matches WHERE COALESCE(platform,'mm') = 'mm' ORDER BY played_at DESC;

CREATE OR REPLACE VIEW v_session AS
WITH gaps AS (
  SELECT match_id, map, played_at, won, team_score, opp_score,
    EXTRACT(EPOCH FROM (played_at - LAG(played_at) OVER (ORDER BY played_at))) / 3600.0
      AS hours_since_prev
  FROM matches WHERE COALESCE(platform,'mm') = 'mm'
)
SELECT *,
  SUM(CASE WHEN hours_since_prev IS NULL OR hours_since_prev > 4 THEN 1 ELSE 0 END)
    OVER (ORDER BY played_at) AS session_id
FROM gaps;

CREATE OR REPLACE VIEW v_match_score AS
WITH per_match AS (
    SELECT m.match_id, m.played_at, m.map, m.won, m.team_score, m.opp_score,
           COUNT(*)                                                          AS rounds,
           SUM(pr.kills)                                                     AS kills,
           SUM(pr.deaths)                                                    AS deaths,
           SUM(pr.headshots)                                                 AS hs,
           SUM(CASE WHEN pr.kills > 0 OR pr.assists > 0 OR pr.survived
                      OR pr.traded_death THEN 1 ELSE 0 END)                  AS kast_rounds,
           AVG(pr.damage)                                                    AS adr,
           SUM(CASE WHEN pr.opening_kill  THEN 1 ELSE 0 END)                 AS open_k,
           SUM(CASE WHEN pr.opening_death THEN 1 ELSE 0 END)                 AS open_d,
           SUM(CASE WHEN pr.round_won     THEN 1 ELSE 0 END)                 AS round_wins
    FROM matches m JOIN player_rounds pr USING(match_id)
    WHERE COALESCE(m.platform,'mm') = 'mm'
    GROUP BY m.match_id, m.played_at, m.map, m.won, m.team_score, m.opp_score
)
SELECT
    match_id, played_at, map, won, team_score, opp_score,
    rounds, kills, deaths, kast_rounds, adr, round_wins, open_k, open_d,
    ROUND(GREATEST(0, LEAST(100,
        30.0 * LEAST(1.0, (kast_rounds::numeric / NULLIF(rounds,0)) / 0.70)
      + GREATEST(0, LEAST(20, 10 + (open_k - open_d)::numeric * 2))
      + 20.0 * LEAST(1.0, COALESCE(adr,0) / 80.0)
      + 15.0 * LEAST(1.0, (round_wins::numeric / NULLIF(rounds,0)) / 0.50)
      + 10.0 * LEAST(1.0, (hs::numeric / NULLIF(kills,0)) / 0.45)
      +  5.0 * LEAST(1.0, (kills::numeric / NULLIF(deaths,0)) / 1.10)
    )), 1) AS score
FROM per_match;

CREATE OR REPLACE VIEW v_recent_pitfalls AS
WITH recent AS (
    SELECT pr.* FROM player_rounds pr
    JOIN matches m USING (match_id)
    WHERE m.match_id IN (
        SELECT match_id FROM matches
        WHERE COALESCE(platform,'mm') = 'mm'
        ORDER BY played_at DESC NULLS LAST LIMIT 20
    )
)
SELECT 'T-side opening deaths' AS pitfall,
    ROUND(100.0*SUM(CASE WHEN side='T' AND opening_death THEN 1 END)
          / NULLIF(SUM(CASE WHEN side='T' THEN 1 END),0),1) AS rate_pct FROM recent
UNION ALL
SELECT 'Failed weapon saves on lost rounds',
    ROUND(100.0*SUM(CASE WHEN NOT round_won AND NOT survived
          AND equip_value>=2700 AND NOT saved_weapon THEN 1 END)
          / NULLIF(SUM(CASE WHEN NOT round_won THEN 1 END),0),1) FROM recent
UNION ALL
SELECT 'Bad force-buys (lost, under 50 dmg)',
    ROUND(100.0*SUM(CASE WHEN buy_type='force' AND NOT round_won AND damage<50 THEN 1 END)
          / NULLIF(SUM(CASE WHEN buy_type='force' THEN 1 END),0),1) FROM recent
UNION ALL
SELECT 'Rounds with zero utility thrown',
    ROUND(100.0*SUM(CASE WHEN util_thrown=0 THEN 1 END)/COUNT(*),1) FROM recent
UNION ALL
SELECT 'Fight conversion failures (80+ dmg, 0 kills)',
    ROUND(100.0*SUM(CASE WHEN high_damage_no_kill THEN 1 END)/COUNT(*),1) FROM recent
UNION ALL
SELECT 'Early round deaths (first third of round)',
    ROUND(100.0*SUM(CASE WHEN death_phase='early' AND deaths>0 THEN 1 END)
          / NULLIF(SUM(CASE WHEN deaths>0 THEN 1 END),0),1) FROM recent
UNION ALL
SELECT 'Avg team flashes per round',
    ROUND(AVG(team_flashes)::numeric, 2) FROM recent;

-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_faceit_by_map AS
SELECT
    map,
    COUNT(*)                                                                      AS matches,
    ROUND(100.0 * COUNT(*) FILTER (WHERE won) / NULLIF(COUNT(*), 0), 1)          AS win_pct,
    ROUND(AVG(kd_ratio)::numeric, 2)                                              AS kd,
    ROUND(AVG(adr)::numeric, 1)                                                   AS adr,
    ROUND(AVG(hs_pct)::numeric, 1)                                                AS hs_pct,
    ROUND(AVG(kills)::numeric, 1)                                                 AS avg_kills,
    ROUND(AVG(deaths)::numeric, 1)                                                AS avg_deaths,
    SUM(triple_kills)                                                             AS triple_kills,
    SUM(quadro_kills)                                                             AS quadro_kills,
    SUM(penta_kills)                                                              AS penta_kills
FROM faceit_matches
GROUP BY map ORDER BY matches DESC;

-- ============================================================================
-- Tier-1 mechanics metrics (2026-06-11)
-- ============================================================================
ALTER TABLE shot_events   ADD COLUMN IF NOT EXISTS speed     FLOAT;
ALTER TABLE shot_events   ADD COLUMN IF NOT EXISTS burst_idx INT;
ALTER TABLE shot_events   ADD COLUMN IF NOT EXISTS hit       BOOLEAN;
ALTER TABLE player_rounds ADD COLUMN IF NOT EXISTS ttd_ms            FLOAT;
ALTER TABLE player_rounds ADD COLUMN IF NOT EXISTS crosshair_err_deg FLOAT;
ALTER TABLE player_rounds ADD COLUMN IF NOT EXISTS death_blinded     BOOLEAN DEFAULT FALSE;
ALTER TABLE player_rounds ADD COLUMN IF NOT EXISTS death_unused_util INT;

-- Per-match mechanics rollup. speed < 34 u/s at trigger time = counter-strafed.
CREATE OR REPLACE VIEW v_mechanics AS
SELECT
    m.match_id,
    m.map,
    m.played_at,
    m.platform,
    se.counter_strafe_pct,
    se.first_bullet_acc_pct,
    se.spray_early_acc_pct,
    se.spray_late_acc_pct,
    pr.ttd_ms,
    pr.crosshair_err_deg,
    pr.deaths_blinded,
    pr.avg_unused_util_at_death
FROM matches m
JOIN (
    SELECT match_id,
        ROUND(100.0 * COUNT(*) FILTER (WHERE burst_idx = 1 AND speed < 34)::numeric
              / NULLIF(COUNT(*) FILTER (WHERE burst_idx = 1), 0), 1)            AS counter_strafe_pct,
        ROUND(100.0 * COUNT(*) FILTER (WHERE burst_idx = 1 AND hit)::numeric
              / NULLIF(COUNT(*) FILTER (WHERE burst_idx = 1), 0), 1)            AS first_bullet_acc_pct,
        ROUND(100.0 * COUNT(*) FILTER (WHERE burst_idx BETWEEN 1 AND 5 AND hit)::numeric
              / NULLIF(COUNT(*) FILTER (WHERE burst_idx BETWEEN 1 AND 5), 0), 1) AS spray_early_acc_pct,
        ROUND(100.0 * COUNT(*) FILTER (WHERE burst_idx > 5 AND hit)::numeric
              / NULLIF(COUNT(*) FILTER (WHERE burst_idx > 5), 0), 1)            AS spray_late_acc_pct
    FROM shot_events WHERE burst_idx IS NOT NULL GROUP BY match_id
) se USING (match_id)
JOIN (
    SELECT match_id,
        ROUND(AVG(ttd_ms)::numeric, 0)             AS ttd_ms,
        ROUND(AVG(crosshair_err_deg)::numeric, 2)  AS crosshair_err_deg,
        COUNT(*) FILTER (WHERE death_blinded)      AS deaths_blinded,
        ROUND(AVG(death_unused_util) FILTER (WHERE deaths > 0)::numeric, 2) AS avg_unused_util_at_death
    FROM player_rounds GROUP BY match_id
) pr USING (match_id)
ORDER BY m.played_at DESC;

-- Rolling mechanics trend: last 10 matches vs the 10 before that
CREATE OR REPLACE VIEW v_mechanics_trend AS
WITH ranked AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY played_at DESC) AS rn
    FROM v_mechanics
)
SELECT
    CASE WHEN rn <= 10 THEN 'recent' ELSE 'previous' END AS window,
    COUNT(*)                          AS matches,
    ROUND(AVG(counter_strafe_pct), 1) AS counter_strafe_pct,
    ROUND(AVG(first_bullet_acc_pct), 1) AS first_bullet_acc_pct,
    ROUND(AVG(spray_early_acc_pct), 1) AS spray_early_acc_pct,
    ROUND(AVG(spray_late_acc_pct), 1)  AS spray_late_acc_pct,
    ROUND(AVG(ttd_ms), 0)             AS ttd_ms,
    ROUND(AVG(crosshair_err_deg), 2)  AS crosshair_err_deg,
    SUM(deaths_blinded)               AS deaths_blinded
FROM ranked WHERE rn <= 20
GROUP BY 1 ORDER BY 1 DESC;

-- ============================================================================
-- All-player (team + enemy) round stats (2026-06-19)
-- Additive: one row per player per round (all 10), derived from death/hurt
-- events. Does NOT touch player_rounds (YOU-only) or existing views.
-- ============================================================================

CREATE TABLE IF NOT EXISTS round_player_stats (
    match_id      NUMERIC(20,0) REFERENCES matches(match_id) ON DELETE CASCADE,
    round_num     INT NOT NULL,
    steamid       NUMERIC(20,0) NOT NULL,
    name          TEXT,
    side          TEXT CHECK (side IN ('CT','T')),
    is_me         BOOLEAN DEFAULT FALSE,
    kills         INT DEFAULT 0,
    deaths        INT DEFAULT 0,
    assists       INT DEFAULT 0,
    damage        INT DEFAULT 0,
    headshots     INT DEFAULT 0,
    opening_kill  BOOLEAN DEFAULT FALSE,
    opening_death BOOLEAN DEFAULT FALSE,
    traded_kill   BOOLEAN DEFAULT FALSE,   -- this player avenged a teammate's death
    traded_death  BOOLEAN DEFAULT FALSE,   -- this player's death was avenged by a teammate
    survived      BOOLEAN DEFAULT FALSE,
    util_damage   INT DEFAULT 0,
    flash_assists INT DEFAULT 0,
    PRIMARY KEY (match_id, round_num, steamid)
);
CREATE INDEX IF NOT EXISTS idx_rps_match ON round_player_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_rps_steam ON round_player_stats(steamid);

-- Per-match: your output vs your own team's per-round averages + your rank.
CREATE OR REPLACE VIEW v_team_relative AS
WITH me_side AS (
    SELECT match_id, round_num, side FROM round_player_stats WHERE is_me
),
ally AS (
    SELECT r.match_id, r.steamid, bool_or(r.is_me) AS is_me,
           MAX(r.name) AS name,
           SUM(r.kills) AS kills, SUM(r.deaths) AS deaths, SUM(r.assists) AS assists,
           SUM(r.damage) AS damage, COUNT(*) AS rounds
    FROM round_player_stats r
    JOIN me_side ms ON ms.match_id = r.match_id AND ms.round_num = r.round_num
                   AND ms.side = r.side
    GROUP BY r.match_id, r.steamid
),
ranked AS (
    SELECT *, RANK() OVER (PARTITION BY match_id ORDER BY kills DESC) AS team_rank
    FROM ally
)
SELECT
    rk.match_id, m.map, m.played_at, m.won,
    MAX(CASE WHEN rk.is_me THEN rk.kills END)                               AS my_kills,
    ROUND(AVG(rk.kills), 1)                                                  AS team_avg_kills,
    MAX(CASE WHEN rk.is_me THEN ROUND(rk.damage::numeric/NULLIF(rk.rounds,0),1) END) AS my_adr,
    ROUND(AVG(rk.damage::numeric/NULLIF(rk.rounds,0)), 1)                    AS team_avg_adr,
    MAX(CASE WHEN rk.is_me THEN rk.team_rank END)                           AS my_team_rank,
    COUNT(*)                                                                 AS team_size
FROM ranked rk JOIN matches m USING (match_id)
GROUP BY rk.match_id, m.map, m.played_at, m.won
ORDER BY m.played_at DESC;

-- Per-match: how strong the opponents were (difficulty context for your stats).
CREATE OR REPLACE VIEW v_enemy_strength AS
WITH me_side AS (
    SELECT match_id, round_num, side FROM round_player_stats WHERE is_me
),
enemy AS (
    SELECT r.match_id, r.steamid,
           SUM(r.kills) AS kills, SUM(r.deaths) AS deaths,
           SUM(r.damage) AS damage, COUNT(*) AS rounds
    FROM round_player_stats r
    JOIN me_side ms ON ms.match_id = r.match_id AND ms.round_num = r.round_num
                   AND ms.side <> r.side
    GROUP BY r.match_id, r.steamid
)
SELECT e.match_id, m.map, m.played_at,
    COUNT(*)                                              AS enemy_players,
    ROUND(AVG(e.kills::numeric/NULLIF(e.deaths,0)), 2)    AS enemy_avg_kd,
    ROUND(AVG(e.damage::numeric/NULLIF(e.rounds,0)), 1)   AS enemy_avg_adr,
    ROUND(MAX(e.kills::numeric/NULLIF(e.deaths,0)), 2)    AS enemy_top_kd
FROM enemy e JOIN matches m USING (match_id)
GROUP BY e.match_id, m.map, m.played_at
ORDER BY m.played_at DESC;

-- Per-match: your trade involvement vs the team — trade-reliant (often
-- avenged) or trade-provider (you avenge teammates)?
CREATE OR REPLACE VIEW v_trade_impact AS
WITH me_side AS (
    SELECT match_id, round_num, side FROM round_player_stats WHERE is_me
),
ally AS (
    SELECT r.match_id, r.steamid, bool_or(r.is_me) AS is_me,
           SUM(CASE WHEN r.deaths > 0 THEN 1 ELSE 0 END)        AS died_rounds,
           SUM(CASE WHEN r.traded_death THEN 1 ELSE 0 END)      AS times_traded_for,
           SUM(CASE WHEN r.traded_kill THEN 1 ELSE 0 END)       AS trades_made
    FROM round_player_stats r
    JOIN me_side ms ON ms.match_id = r.match_id AND ms.round_num = r.round_num
                   AND ms.side = r.side
    GROUP BY r.match_id, r.steamid
)
SELECT a.match_id, m.map, m.played_at,
    MAX(CASE WHEN a.is_me THEN ROUND(100.0*a.times_traded_for/NULLIF(a.died_rounds,0),1) END) AS my_traded_for_pct,
    ROUND(AVG(100.0*a.times_traded_for/NULLIF(a.died_rounds,0)),1)        AS team_avg_traded_for_pct,
    MAX(CASE WHEN a.is_me THEN a.trades_made END)                        AS my_trades_made,
    ROUND(AVG(a.trades_made),1)                                          AS team_avg_trades_made
FROM ally a JOIN matches m USING (match_id)
GROUP BY a.match_id, m.map, m.played_at
ORDER BY m.played_at DESC;

-- Per-match: KAST% (real teammate-verified trades) for you vs team average.
CREATE OR REPLACE VIEW v_round_impact AS
WITH me_side AS (
    SELECT match_id, round_num, side FROM round_player_stats WHERE is_me
),
ally AS (
    SELECT r.match_id, r.steamid, bool_or(r.is_me) AS is_me,
           COUNT(*) AS rounds,
           SUM(CASE WHEN r.kills > 0 OR r.assists > 0 OR r.survived
                      OR r.traded_death THEN 1 ELSE 0 END) AS kast_rounds
    FROM round_player_stats r
    JOIN me_side ms ON ms.match_id = r.match_id AND ms.round_num = r.round_num
                   AND ms.side = r.side
    GROUP BY r.match_id, r.steamid
)
SELECT a.match_id, m.map, m.played_at,
    MAX(CASE WHEN a.is_me THEN ROUND(100.0*a.kast_rounds/NULLIF(a.rounds,0),1) END) AS my_kast_pct,
    ROUND(AVG(100.0*a.kast_rounds/NULLIF(a.rounds,0)),1)                  AS team_avg_kast_pct
FROM ally a JOIN matches m USING (match_id)
GROUP BY a.match_id, m.map, m.played_at
ORDER BY m.played_at DESC;

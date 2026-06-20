-- ============================================================================
-- FACEIT team-data store (2026-06-20)
-- The FACEIT match-stats API returns per-player stats for ALL 10 players, but
-- the poller only stored the user's row. This table keeps every player's
-- match-level stats so FACEIT matches get the same team-relative / enemy-strength
-- / entry context the demo path gets (at match granularity — FACEIT stats are
-- per-match aggregates, not per-round). Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS faceit_player_match_stats (
    faceit_match_id TEXT REFERENCES faceit_matches(faceit_match_id) ON DELETE CASCADE,
    player_id       TEXT NOT NULL,
    nickname        TEXT,
    faction         TEXT,            -- stats team_id; allies share one, enemies the other
    is_me           BOOLEAN DEFAULT FALSE,
    kills           INT DEFAULT 0,
    deaths          INT DEFAULT 0,
    assists         INT DEFAULT 0,
    adr             FLOAT,
    hs_pct          FLOAT,
    kd_ratio        FLOAT,
    mvps            INT DEFAULT 0,
    opening_kills   INT DEFAULT 0,
    opening_deaths  INT DEFAULT 0,
    PRIMARY KEY (faceit_match_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_fpms_match ON faceit_player_match_stats(faceit_match_id);

-- You vs your FACEIT team average (+ your rank within the team), per match.
CREATE OR REPLACE VIEW v_faceit_team_relative AS
WITH me AS (
    SELECT faceit_match_id, faction FROM faceit_player_match_stats WHERE is_me
),
ally AS (
    SELECT s.faceit_match_id, s.is_me, s.kills, s.adr,
           RANK() OVER (PARTITION BY s.faceit_match_id ORDER BY s.kills DESC) AS team_rank
    FROM faceit_player_match_stats s
    JOIN me ON me.faceit_match_id = s.faceit_match_id AND me.faction = s.faction
)
SELECT a.faceit_match_id, fm.map, fm.played_at, fm.won,
    MAX(CASE WHEN a.is_me THEN a.kills END)     AS my_kills,
    ROUND(AVG(a.kills), 1)                      AS team_avg_kills,
    MAX(CASE WHEN a.is_me THEN a.adr END)       AS my_adr,
    ROUND(AVG(a.adr)::numeric, 1)               AS team_avg_adr,
    MAX(CASE WHEN a.is_me THEN a.team_rank END) AS my_team_rank,
    COUNT(*)                                    AS team_size
FROM ally a JOIN faceit_matches fm USING (faceit_match_id)
GROUP BY a.faceit_match_id, fm.map, fm.played_at, fm.won
ORDER BY fm.played_at DESC;

-- How strong the opposing FACEIT team was (difficulty context), per match.
CREATE OR REPLACE VIEW v_faceit_enemy_strength AS
WITH me AS (
    SELECT faceit_match_id, faction FROM faceit_player_match_stats WHERE is_me
),
enemy AS (
    SELECT s.faceit_match_id, s.kills, s.deaths, s.adr
    FROM faceit_player_match_stats s
    JOIN me ON me.faceit_match_id = s.faceit_match_id AND me.faction <> s.faction
)
SELECT e.faceit_match_id, fm.map, fm.played_at,
    COUNT(*)                                            AS enemy_players,
    ROUND(AVG(e.kills::numeric/NULLIF(e.deaths,0)), 2)  AS enemy_avg_kd,
    ROUND(AVG(e.adr)::numeric, 1)                       AS enemy_avg_adr,
    ROUND(MAX(e.kills::numeric/NULLIF(e.deaths,0)), 2)  AS enemy_top_kd
FROM enemy e JOIN faceit_matches fm USING (faceit_match_id)
GROUP BY e.faceit_match_id, fm.map, fm.played_at
ORDER BY fm.played_at DESC;

-- Your opening-duel involvement vs team, per match (FACEIT First Kills/Deaths).
CREATE OR REPLACE VIEW v_faceit_entry AS
WITH me AS (
    SELECT faceit_match_id, faction FROM faceit_player_match_stats WHERE is_me
),
ally AS (
    SELECT s.faceit_match_id, s.is_me, s.opening_kills AS ek, s.opening_deaths AS ed
    FROM faceit_player_match_stats s
    JOIN me ON me.faceit_match_id = s.faceit_match_id AND me.faction = s.faction
)
SELECT a.faceit_match_id, fm.map, fm.played_at,
    MAX(CASE WHEN a.is_me THEN a.ek END)                       AS my_entry_kills,
    MAX(CASE WHEN a.is_me THEN a.ed END)                       AS my_entry_deaths,
    MAX(CASE WHEN a.is_me THEN a.ek + a.ed END)                AS my_entries,
    MAX(CASE WHEN a.is_me THEN ROUND(100.0*a.ek/NULLIF(a.ek+a.ed,0),1) END) AS my_entry_win_pct,
    ROUND(AVG(a.ek + a.ed), 1)                                 AS team_avg_entries
FROM ally a JOIN faceit_matches fm USING (faceit_match_id)
GROUP BY a.faceit_match_id, fm.map, fm.played_at
ORDER BY fm.played_at DESC;

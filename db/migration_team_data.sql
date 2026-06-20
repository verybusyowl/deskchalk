-- ============================================================================
-- All-player (team + enemy) round stats (2026-06-19)
-- Additive: stores one row per player per round (all 10), derived from the
-- death/hurt event tables. Does NOT touch player_rounds (still YOU-only) or
-- any existing view. Enables team-relative and opponent-strength context.
-- Idempotent: safe to run against an existing live DB.
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

-- "My side this round" — the anchor every team/enemy split joins against.
-- (A player's side flips at the half, so allies are defined per-round, not by
-- a fixed roster.)

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

-- Per-match: your trade involvement vs the team — are you trade-reliant
-- (often avenged) or a trade-provider (you avenge teammates)?
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

-- Per-match: entry (opening-duel) involvement and success — you vs team.
-- entry_kills = rounds you took the opening kill; entry_deaths = rounds you took
-- the opening death; my_entries = opening duels you were in; entry_win_pct = how
-- many of those you won. Surfaces whether you're the entry and if it's working.
CREATE OR REPLACE VIEW v_entry_impact AS
WITH me_side AS (
    SELECT match_id, round_num, side FROM round_player_stats WHERE is_me
),
ally AS (
    SELECT r.match_id, r.steamid, bool_or(r.is_me) AS is_me,
           SUM(CASE WHEN r.opening_kill  THEN 1 ELSE 0 END) AS entry_kills,
           SUM(CASE WHEN r.opening_death THEN 1 ELSE 0 END) AS entry_deaths
    FROM round_player_stats r
    JOIN me_side ms ON ms.match_id = r.match_id AND ms.round_num = r.round_num
                   AND ms.side = r.side
    GROUP BY r.match_id, r.steamid
)
SELECT a.match_id, m.map, m.played_at,
    MAX(CASE WHEN a.is_me THEN a.entry_kills END)                  AS my_entry_kills,
    MAX(CASE WHEN a.is_me THEN a.entry_deaths END)                 AS my_entry_deaths,
    MAX(CASE WHEN a.is_me THEN a.entry_kills + a.entry_deaths END) AS my_entries,
    MAX(CASE WHEN a.is_me THEN ROUND(100.0*a.entry_kills
              /NULLIF(a.entry_kills + a.entry_deaths,0),1) END)    AS my_entry_win_pct,
    ROUND(AVG(a.entry_kills + a.entry_deaths),1)                   AS team_avg_entries
FROM ally a JOIN matches m USING (match_id)
GROUP BY a.match_id, m.map, m.played_at
ORDER BY m.played_at DESC;

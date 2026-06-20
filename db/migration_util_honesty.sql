-- ============================================================================
-- Utility honesty fix (2026-06-20)
-- Smokes and decoys have no flash/damage signal, so the worker used to hardcode
-- their had_effect=TRUE — they could never be "wasted" and they inflated
-- effective_pct. Now the worker stores NULL ("not gradable") for smoke/decoy.
-- This migration (1) backfills existing smoke/decoy rows to NULL and (2) replaces
-- v_utility so effective_pct/wasted_throws are computed over gradable throws only.
-- Idempotent.
-- ============================================================================

UPDATE grenade_events
SET had_effect = NULL
WHERE grenade_type IN ('smoke', 'decoy') AND had_effect IS NOT NULL;

CREATE OR REPLACE VIEW v_utility AS
SELECT
    m.map, pr.side, ge.grenade_type,
    COUNT(*)                                                                AS throws,
    ROUND(100.0*SUM(CASE WHEN ge.had_effect THEN 1 END)
          /NULLIF(COUNT(*) FILTER (WHERE ge.had_effect IS NOT NULL),0),1)   AS effective_pct,
    ROUND(AVG(ge.enemies_flashed),2)                                        AS avg_enemies_flashed,
    ROUND(AVG(ge.teammates_flashed),2)                                      AS avg_teammates_flashed,
    ROUND(AVG(ge.damage_dealt),1)                                           AS avg_damage,
    SUM(CASE WHEN ge.had_effect = FALSE THEN 1 ELSE 0 END)                  AS wasted_throws
FROM grenade_events ge
JOIN matches m USING (match_id)
JOIN player_rounds pr ON pr.match_id = ge.match_id AND pr.round_num = ge.round_num
GROUP BY m.map, pr.side, ge.grenade_type ORDER BY m.map, pr.side, ge.grenade_type;

-- Recompute util_wasted on existing rows so smokes no longer count as wasted/effective.
-- (COUNT FILTER (WHERE NOT had_effect) already excludes NULL, so smoke/decoy drop out.)
UPDATE player_rounds pr SET util_wasted = sub.wasted
FROM (SELECT match_id, round_num, COUNT(*) FILTER (WHERE NOT had_effect) AS wasted
      FROM grenade_events GROUP BY match_id, round_num) sub
WHERE pr.match_id = sub.match_id AND pr.round_num = sub.round_num;

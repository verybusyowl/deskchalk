-- ============================================================================
-- FACEIT live profile (2026-06-20)
-- "Current Elo" was derived from the latest match's faceit_elo — a per-match
-- PRE-match snapshot that lags your real Elo (and goes stale between matches /
-- before the next poll ingests recent games). The poller already fetches your
-- true current Elo + level every cycle; this single-row table persists it so the
-- dashboard shows the real number. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS faceit_profile (
    id            INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    current_elo   INT,
    current_level INT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

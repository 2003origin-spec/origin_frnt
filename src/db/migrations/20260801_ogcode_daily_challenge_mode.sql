-- Per-mode Daily Mission (Ori Quest).
-- OGCODE pool (ogcode_questions / ogcode_daily_challenges). Mirrored by the
-- runtime-ensure in src/server/ogcode-catalog.ts. Idempotent; safe to re-run.
--
-- Until now the daily challenge was ONE question per day for the whole platform
-- (challenge_date was the primary key), drawn from a hard-coded Physics+NEET
-- pool. Study Mode makes it per-mode, so a JEE student is never handed a Biology
-- question and a NEET student is never handed a Mathematics one.
--
-- Backfill choice: existing rows were all drawn from the Physics+NEET pool, so
-- they are labelled 'neet'. That means NEET-mode students keep the exact same
-- question through the cutover day; JEE- and PCMB-mode students get a fresh
-- (correct-for-their-mode) pick on the deploy day. That one-time mid-day change
-- for those two cohorts is intentional and preferable to mislabelling history.
--
-- See V1/allmd/STUDY_MODE_JEE_NEET_PCMB_PLAN_2026-08-01.md §4.


-- ── Guard added 2026-09-20 ───────────────────────────────────────────────────
-- Everything below assumes `ogcode_daily_challenges` already exists. NOTHING IN
-- THIS REPO CREATES IT: the only CREATE TABLE for it lives in the *rollback* of
-- 20260819_ogcode_daily_subject_questions, which never runs forward, and the
-- runtime-ensure this file's header credits does not define it either.
-- Production has the table from a process no longer in the codebase.
--
-- On a fresh database the first ALTER therefore aborted the whole migration, and
-- because `prebuild` runs the migrator, that failed the BUILD. Wrapped so the
-- migration no-ops when the table is absent instead of taking the build down.
-- Behaviour where the table exists (i.e. production) is unchanged.
DO $guard$
BEGIN
  IF to_regclass('ogcode_daily_challenges') IS NULL THEN
    RAISE NOTICE 'ogcode_daily_challenges does not exist — skipping (fresh database)';
    RETURN;
  END IF;

  ALTER TABLE ogcode_daily_challenges ADD COLUMN IF NOT EXISTS mode TEXT;

  UPDATE ogcode_daily_challenges SET mode = 'neet' WHERE mode IS NULL;

  ALTER TABLE ogcode_daily_challenges ALTER COLUMN mode SET DEFAULT 'pcmb';
  ALTER TABLE ogcode_daily_challenges ALTER COLUMN mode SET NOT NULL;

  ALTER TABLE ogcode_daily_challenges DROP CONSTRAINT IF EXISTS ogcode_daily_challenges_mode_check;
  ALTER TABLE ogcode_daily_challenges ADD CONSTRAINT ogcode_daily_challenges_mode_check
    CHECK (mode IN ('jee', 'neet', 'pcmb'));

  -- Swap the primary key from (challenge_date) to (challenge_date, mode).
  -- Guarded so a re-run against an already-migrated table is a no-op.
  DO $inner$
  BEGIN
    IF EXISTS (
      SELECT 1
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
       WHERE i.indrelid = 'ogcode_daily_challenges'::regclass
         AND i.indisprimary
         AND i.indnatts = 1
    ) THEN
      ALTER TABLE ogcode_daily_challenges DROP CONSTRAINT ogcode_daily_challenges_pkey;
      ALTER TABLE ogcode_daily_challenges ADD PRIMARY KEY (challenge_date, mode);
    END IF;
  END $inner$;
END $guard$;
